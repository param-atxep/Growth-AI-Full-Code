import prisma from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { parseDateRange } from '../utils/helpers.js';
import { CreateExpenseInput } from '../validations/index.js';

/**
 * Create expense
 */
export const createExpense = async (storeId: string, data: CreateExpenseInput) => {
  // Map description to title if title not provided
  const { description, category, vendor, notes, ...rest } = data;
  
  // If category name is provided but no categoryId, look up the category
  let categoryId = rest.categoryId;
  if (!categoryId && category) {
    const existingCategory = await prisma.expenseCategory.findFirst({
      where: { storeId, name: category },
    });
    if (existingCategory) {
      categoryId = existingCategory.id;
    } else {
      // Create the category if it doesn't exist
      const newCategory = await prisma.expenseCategory.create({
        data: { storeId, name: category },
      });
      categoryId = newCategory.id;
    }
  }
  
  const expense = await prisma.expense.create({
    data: {
      storeId,
      title: rest.title || description,
      description: notes || description,
      amount: rest.amount,
      paymentMethod: rest.paymentMethod || 'CASH',
      date: data.date ? new Date(data.date) : new Date(),
      reference: vendor || rest.reference,
      isRecurring: rest.isRecurring || false,
      recurringPeriod: rest.recurringPeriod,
      categoryId,
    },
    include: {
      category: { select: { id: true, name: true, color: true } },
    },
  });

  return formatExpenseResponse(expense);
};

/**
 * Update expense
 */
export const updateExpense = async (
  storeId: string,
  expenseId: string,
  data: Partial<CreateExpenseInput>
) => {
  const existing = await prisma.expense.findFirst({
    where: { id: expenseId, storeId },
  });

  if (!existing) {
    throw AppError.notFound('Expense not found');
  }

  // Map description to title if title not provided
  const { description, category, vendor, notes, ...rest } = data;

  const expense = await prisma.expense.update({
    where: { id: expenseId },
    data: {
      ...(rest.title && { title: rest.title }),
      ...(!rest.title && description && { title: description }),
      ...(notes && { description: notes }),
      ...(rest.amount !== undefined && { amount: rest.amount }),
      ...(rest.paymentMethod && { paymentMethod: rest.paymentMethod }),
      ...(data.date && { date: new Date(data.date) }),
      ...(vendor && { reference: vendor }),
      ...(rest.isRecurring !== undefined && { isRecurring: rest.isRecurring }),
      ...(rest.recurringPeriod && { recurringPeriod: rest.recurringPeriod }),
      ...(rest.categoryId && { categoryId: rest.categoryId }),
    },
    include: {
      category: { select: { id: true, name: true, color: true } },
    },
  });

  return formatExpenseResponse(expense);
};

/**
 * Delete expense
 */
export const deleteExpense = async (storeId: string, expenseId: string) => {
  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, storeId },
  });

  if (!expense) {
    throw AppError.notFound('Expense not found');
  }

  await prisma.expense.delete({
    where: { id: expenseId },
  });

  return { message: 'Expense deleted successfully' };
};

/**
 * Get all expenses
 */
export const getExpenses = async (
  storeId: string,
  options: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    categoryId?: string;
    category?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}
) => {
  const {
    page = 1,
    limit = 20,
    startDate,
    endDate,
    categoryId,
    category,
    sortBy = 'date',
    sortOrder = 'desc',
  } = options;

  const skip = (page - 1) * limit;

  const where: any = {
    storeId,
  };

  // Only apply date filter if at least one date is provided
  if (startDate || endDate) {
    const { start, end } = parseDateRange(startDate, endDate);
    where.date = { gte: start, lte: end };
  }

  if (categoryId) where.categoryId = categoryId;
  
  // Support filtering by category name
  if (category && !categoryId) {
    where.category = { name: category };
  }

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, color: true } },
      },
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    }),
    prisma.expense.count({ where }),
  ]);

  return {
    expenses: expenses.map(formatExpenseResponse),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get expense by ID
 */
export const getExpenseById = async (storeId: string, expenseId: string) => {
  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, storeId },
    include: {
      category: { select: { id: true, name: true, color: true } },
    },
  });

  if (!expense) {
    throw AppError.notFound('Expense not found');
  }

  return formatExpenseResponse(expense);
};

/**
 * Get expense summary
 */
export const getExpenseSummary = async (
  storeId: string,
  startDate?: string,
  endDate?: string
) => {
  const { start, end } = parseDateRange(startDate, endDate);
  
  // Calculate this month's date range
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const [total, thisMonthTotal, byCategory, byMonth] = await Promise.all([
    prisma.expense.aggregate({
      where: {
        storeId,
        date: { gte: start, lte: end },
      },
      _sum: { amount: true },
      _count: true,
      _avg: { amount: true },
    }),
    prisma.expense.aggregate({
      where: {
        storeId,
        date: { gte: thisMonthStart, lte: thisMonthEnd },
      },
      _sum: { amount: true },
    }),
    prisma.expense.groupBy({
      by: ['categoryId'],
      where: {
        storeId,
        date: { gte: start, lte: end },
      },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('month', date) as month,
        SUM(amount) as total
      FROM expenses
      WHERE "storeId" = ${storeId}
        AND date >= ${start}
        AND date <= ${end}
      GROUP BY DATE_TRUNC('month', date)
      ORDER BY month DESC
    `,
  ]);

  // Get category details
  const categoryIds = byCategory.map((c) => c.categoryId).filter(Boolean) as string[];
  const categories = await prisma.expenseCategory.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true, color: true },
  });
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const totalAmount = Number(total._sum.amount || 0);
  const thisMonthAmount = Number(thisMonthTotal._sum.amount || 0);
  
  // Calculate days in range for average per day
  const daysDiff = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const avgPerDay = totalAmount / daysDiff;

  return {
    // Frontend expected fields
    total: totalAmount,
    thisMonth: thisMonthAmount,
    avgPerDay: avgPerDay,
    // Additional fields
    totalExpenses: totalAmount,
    expenseCount: total._count,
    averageExpense: Number(total._avg.amount || 0),
    byCategory: byCategory.map((item) => {
      const category = item.categoryId ? categoryMap.get(item.categoryId) : null;
      const amount = Number(item._sum.amount || 0);
      return {
        categoryId: item.categoryId,
        categoryName: category?.name || 'Uncategorized',
        color: category?.color || '#6B7280',
        amount,
        count: item._count,
        percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0,
      };
    }),
    byMonth: (byMonth as any[]).map((item) => ({
      month: item.month,
      total: Number(item.total),
    })),
  };
};

/**
 * Get expense categories
 */
export const getExpenseCategories = async (storeId: string) => {
  const categories = await prisma.expenseCategory.findMany({
    where: { storeId, isActive: true },
    include: {
      _count: { select: { expenses: true } },
    },
    orderBy: { name: 'asc' },
  });

  return categories;
};

/**
 * Create expense category
 */
export const createExpenseCategory = async (
  storeId: string,
  data: { name: string; description?: string; color?: string; icon?: string }
) => {
  return prisma.expenseCategory.create({
    data: {
      storeId,
      ...data,
    },
  });
};

/**
 * Update expense category
 */
export const updateExpenseCategory = async (
  storeId: string,
  categoryId: string,
  data: { name?: string; description?: string; color?: string; icon?: string }
) => {
  const category = await prisma.expenseCategory.findFirst({
    where: { id: categoryId, storeId },
  });

  if (!category) {
    throw AppError.notFound('Expense category not found');
  }

  return prisma.expenseCategory.update({
    where: { id: categoryId },
    data,
  });
};

// Helper function
function formatExpenseResponse(expense: any) {
  return {
    id: expense.id,
    title: expense.title,
    description: expense.title, // Frontend uses description for display
    notes: expense.description, // Original description field is used as notes
    amount: Number(expense.amount),
    date: expense.date,
    paymentMethod: expense.paymentMethod,
    vendor: expense.reference, // Frontend uses vendor for display
    reference: expense.reference,
    category: expense.category?.name || 'Uncategorized', // Frontend expects category as string
    categoryId: expense.categoryId,
    categoryData: expense.category,
    isRecurring: expense.isRecurring,
    recurringPeriod: expense.recurringPeriod,
    receipt: expense.receipt,
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,
  };
}
