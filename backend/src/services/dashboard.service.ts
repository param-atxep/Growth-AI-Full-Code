import prisma from '../config/database.js';
import { parseDateRange, calculatePercentageChange, getFiscalYearDates } from '../utils/helpers.js';
import { Decimal } from '@prisma/client/runtime/library';

export interface DashboardMetrics {
  revenue: {
    total: number;
    previousPeriod: number;
    growth: number;
  };
  profit: {
    total: number;
    previousPeriod: number;
    growth: number;
    margin: number;
  };
  sales: {
    count: number;
    previousPeriod: number;
    growth: number;
    averageValue: number;
  };
  inventory: {
    totalProducts: number;
    totalStockValue: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
  customers: {
    total: number;
  };
  expenses: {
    total: number;
    previousPeriod: number;
    growth: number;
  };
}

export interface TopProduct {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  unitsSold: number;
  revenue: number;
  profit: number;
}

export interface SalesChartData {
  date: string;
  revenue: number;
  profit: number;
  sales: number;
}

export interface CategoryRevenue {
  category: string;
  revenue: number;
  percentage: number;
}

export interface ExpenseBreakdown {
  category: string;
  amount: number;
  percentage: number;
  color: string;
}

/**
 * Get dashboard overview metrics
 */
export const getDashboardMetrics = async (
  storeId: string,
  startDate?: string,
  endDate?: string
): Promise<DashboardMetrics> => {
  const { start, end } = parseDateRange(startDate, endDate);
  
  // Calculate previous period for comparison
  const periodLength = end.getTime() - start.getTime();
  const previousStart = new Date(start.getTime() - periodLength);
  const previousEnd = new Date(start.getTime() - 1);

  // Current period sales
  const [currentSales, previousSales, currentExpenses, previousExpenses, inventory, customerCount] = await Promise.all([
    prisma.sale.aggregate({
      where: {
        storeId,
        invoiceDate: { gte: start, lte: end },
        status: 'COMPLETED',
      },
      _sum: { totalAmount: true, profit: true, totalCost: true },
      _count: true,
    }),
    prisma.sale.aggregate({
      where: {
        storeId,
        invoiceDate: { gte: previousStart, lte: previousEnd },
        status: 'COMPLETED',
      },
      _sum: { totalAmount: true, profit: true },
      _count: true,
    }),
    prisma.expense.aggregate({
      where: {
        storeId,
        date: { gte: start, lte: end },
      },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: {
        storeId,
        date: { gte: previousStart, lte: previousEnd },
      },
      _sum: { amount: true },
    }),
    prisma.product.aggregate({
      where: { storeId, isActive: true },
      _count: true,
    }),
    prisma.customer.count({
      where: { storeId },
    }),
  ]);

  // Get inventory stats
  const products = await prisma.product.findMany({
    where: { storeId, isActive: true },
    select: {
      stockQuantity: true,
      lowStockThreshold: true,
      costPrice: true,
    },
  });

  const totalStockValue = products.reduce(
    (sum, p) => sum + p.stockQuantity * Number(p.costPrice),
    0
  );
  const lowStockCount = products.filter(
    (p) => p.stockQuantity > 0 && p.stockQuantity <= p.lowStockThreshold
  ).length;
  const outOfStockCount = products.filter((p) => p.stockQuantity === 0).length;

  // Calculate metrics
  const currentRevenue = Number(currentSales._sum.totalAmount || 0);
  const previousRevenue = Number(previousSales._sum.totalAmount || 0);
  const currentProfit = Number(currentSales._sum.profit || 0);
  const previousProfit = Number(previousSales._sum.profit || 0);
  const currentExpenseTotal = Number(currentExpenses._sum.amount || 0);
  const previousExpenseTotal = Number(previousExpenses._sum.amount || 0);

  return {
    revenue: {
      total: currentRevenue,
      previousPeriod: previousRevenue,
      growth: calculatePercentageChange(currentRevenue, previousRevenue),
    },
    profit: {
      total: currentProfit,
      previousPeriod: previousProfit,
      growth: calculatePercentageChange(currentProfit, previousProfit),
      margin: currentRevenue > 0 ? (currentProfit / currentRevenue) * 100 : 0,
    },
    sales: {
      count: currentSales._count,
      previousPeriod: previousSales._count,
      growth: calculatePercentageChange(currentSales._count, previousSales._count),
      averageValue: currentSales._count > 0 ? currentRevenue / currentSales._count : 0,
    },
    inventory: {
      totalProducts: inventory._count,
      totalStockValue,
      lowStockCount,
      outOfStockCount,
    },
    customers: {
      total: customerCount,
    },
    expenses: {
      total: currentExpenseTotal,
      previousPeriod: previousExpenseTotal,
      growth: calculatePercentageChange(currentExpenseTotal, previousExpenseTotal),
    },
  };
};

/**
 * Get top selling products
 */
export const getTopProducts = async (
  storeId: string,
  limit: number = 5,
  startDate?: string,
  endDate?: string
): Promise<TopProduct[]> => {
  const { start, end } = parseDateRange(startDate, endDate);

  const topProducts = await prisma.saleItem.groupBy({
    by: ['productId'],
    where: {
      sale: {
        storeId,
        invoiceDate: { gte: start, lte: end },
        status: 'COMPLETED',
      },
    },
    _sum: {
      quantity: true,
      totalPrice: true,
      profit: true,
    },
    orderBy: {
      _sum: {
        quantity: 'desc',
      },
    },
    take: limit,
  });

  // Get product details
  const productIds = topProducts.map((p) => p.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      sku: true,
      category: { select: { name: true } },
    },
  });

  const productMap = new Map(products.map((p) => [p.id, p]));

  return topProducts.map((item) => {
    const product = productMap.get(item.productId);
    return {
      id: item.productId,
      name: product?.name || 'Unknown',
      sku: product?.sku || '',
      category: product?.category?.name || null,
      unitsSold: item._sum.quantity || 0,
      revenue: Number(item._sum.totalPrice || 0),
      profit: Number(item._sum.profit || 0),
    };
  });
};

/**
 * Get sales chart data
 */
export const getSalesChartData = async (
  storeId: string,
  startDate?: string,
  endDate?: string,
  groupBy: 'day' | 'week' | 'month' = 'day'
): Promise<SalesChartData[]> => {
  const { start, end } = parseDateRange(startDate, endDate);

  const sales = await prisma.sale.findMany({
    where: {
      storeId,
      invoiceDate: { gte: start, lte: end },
      status: 'COMPLETED',
    },
    select: {
      totalAmount: true,
      profit: true,
      invoiceDate: true,
    },
    orderBy: { invoiceDate: 'asc' },
  });

  // Group by date
  const grouped = sales.reduce((acc, sale) => {
    let key: string;
    const date = sale.invoiceDate;
    
    if (groupBy === 'day') {
      key = date.toISOString().split('T')[0];
    } else if (groupBy === 'week') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      key = weekStart.toISOString().split('T')[0];
    } else {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    if (!acc[key]) {
      acc[key] = { revenue: 0, profit: 0, sales: 0 };
    }
    acc[key].revenue += Number(sale.totalAmount);
    acc[key].profit += Number(sale.profit);
    acc[key].sales += 1;

    return acc;
  }, {} as Record<string, { revenue: number; profit: number; sales: number }>);

  return Object.entries(grouped)
    .map(([date, data]) => ({
      date,
      revenue: Number(data.revenue.toFixed(2)),
      profit: Number(data.profit.toFixed(2)),
      sales: data.sales,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

/**
 * Get revenue by category
 */
export const getRevenueByCategory = async (
  storeId: string,
  startDate?: string,
  endDate?: string
): Promise<CategoryRevenue[]> => {
  const { start, end } = parseDateRange(startDate, endDate);

  const categoryRevenue = await prisma.$queryRaw<Array<{ category_name: string; revenue: Decimal }>>`
    SELECT 
      COALESCE(c.name, 'Uncategorized') as category_name,
      SUM(si."totalPrice") as revenue
    FROM sale_items si
    JOIN sales s ON si."saleId" = s.id
    JOIN products p ON si."productId" = p.id
    LEFT JOIN categories c ON p."categoryId" = c.id
    WHERE s."storeId" = ${storeId}
      AND s."invoiceDate" >= ${start}
      AND s."invoiceDate" <= ${end}
      AND s.status = 'COMPLETED'
    GROUP BY c.name
    ORDER BY revenue DESC
  `;

  const total = categoryRevenue.reduce((sum, c) => sum + Number(c.revenue), 0);

  return categoryRevenue.map((item) => ({
    category: item.category_name,
    revenue: Number(item.revenue),
    percentage: total > 0 ? Number(((Number(item.revenue) / total) * 100).toFixed(2)) : 0,
  }));
};

/**
 * Get expense breakdown by category
 */
export const getExpenseBreakdown = async (
  storeId: string,
  startDate?: string,
  endDate?: string
): Promise<ExpenseBreakdown[]> => {
  const { start, end } = parseDateRange(startDate, endDate);

  const expenses = await prisma.expense.findMany({
    where: {
      storeId,
      date: { gte: start, lte: end },
    },
    select: {
      amount: true,
      category: {
        select: { name: true, color: true },
      },
    },
  });

  const grouped = expenses.reduce((acc, exp) => {
    const key = exp.category?.name || 'Other';
    if (!acc[key]) {
      acc[key] = { amount: 0, color: exp.category?.color || '#6B7280' };
    }
    acc[key].amount += Number(exp.amount);
    return acc;
  }, {} as Record<string, { amount: number; color: string }>);

  const total = Object.values(grouped).reduce((sum, c) => sum + c.amount, 0);

  return Object.entries(grouped)
    .map(([category, data]) => ({
      category,
      amount: Number(data.amount.toFixed(2)),
      percentage: total > 0 ? Number(((data.amount / total) * 100).toFixed(2)) : 0,
      color: data.color,
    }))
    .sort((a, b) => b.amount - a.amount);
};

/**
 * Get low stock alerts
 */
export const getLowStockAlerts = async (storeId: string) => {
  const products = await prisma.product.findMany({
    where: {
      storeId,
      isActive: true,
      stockQuantity: { lte: prisma.product.fields.lowStockThreshold },
    },
    select: {
      id: true,
      name: true,
      sku: true,
      stockQuantity: true,
      lowStockThreshold: true,
      reorderQuantity: true,
      costPrice: true,
      category: { select: { name: true } },
    },
    orderBy: { stockQuantity: 'asc' },
  });

  return products.map((p) => ({
    ...p,
    costPrice: Number(p.costPrice),
    isOutOfStock: p.stockQuantity === 0,
    estimatedReorderCost: Number(p.costPrice) * p.reorderQuantity,
  }));
};

/**
 * Get sales by day of week
 */
export const getSalesByDayOfWeek = async (
  storeId: string,
  startDate?: string,
  endDate?: string
) => {
  const { start, end } = parseDateRange(startDate, endDate);

  const sales = await prisma.sale.findMany({
    where: {
      storeId,
      invoiceDate: { gte: start, lte: end },
      status: 'COMPLETED',
    },
    select: {
      totalAmount: true,
      invoiceDate: true,
    },
  });

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const byDay = dayNames.map((name) => ({ day: name, revenue: 0, count: 0 }));

  sales.forEach((sale) => {
    const dayIndex = sale.invoiceDate.getDay();
    byDay[dayIndex].revenue += Number(sale.totalAmount);
    byDay[dayIndex].count += 1;
  });

  return byDay;
};

/**
 * Get dead stock (products with no sales in 60+ days)
 */
export const getDeadStock = async (storeId: string, days: number = 60) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const products = await prisma.product.findMany({
    where: {
      storeId,
      isActive: true,
      stockQuantity: { gt: 0 },
      OR: [
        { lastSoldAt: null },
        { lastSoldAt: { lt: cutoffDate } },
      ],
    },
    select: {
      id: true,
      name: true,
      sku: true,
      stockQuantity: true,
      costPrice: true,
      sellingPrice: true,
      lastSoldAt: true,
      createdAt: true,
      category: { select: { name: true } },
    },
    orderBy: { lastSoldAt: 'asc' },
  });

  return products.map((p) => ({
    ...p,
    costPrice: Number(p.costPrice),
    sellingPrice: Number(p.sellingPrice),
    stockValue: p.stockQuantity * Number(p.costPrice),
    daysSinceLastSale: p.lastSoldAt
      ? Math.floor((Date.now() - p.lastSoldAt.getTime()) / (1000 * 60 * 60 * 24))
      : Math.floor((Date.now() - p.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
  }));
};

/**
 * Get fast moving products
 */
export const getFastMovingProducts = async (storeId: string, days: number = 30) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const fastMoving = await prisma.saleItem.groupBy({
    by: ['productId'],
    where: {
      sale: {
        storeId,
        invoiceDate: { gte: startDate },
        status: 'COMPLETED',
      },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 20,
  });

  const productIds = fastMoving.map((p) => p.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      sku: true,
      stockQuantity: true,
      costPrice: true,
      sellingPrice: true,
      lowStockThreshold: true,
      category: { select: { name: true } },
    },
  });

  const productMap = new Map(products.map((p) => [p.id, p]));

  return fastMoving.map((item) => {
    const product = productMap.get(item.productId);
    const dailyVelocity = (item._sum.quantity || 0) / days;
    const daysOfStock = product && dailyVelocity > 0 
      ? Math.floor(product.stockQuantity / dailyVelocity) 
      : 999;

    return {
      id: item.productId,
      name: product?.name || 'Unknown',
      sku: product?.sku || '',
      category: product?.category?.name || null,
      unitsSold: item._sum.quantity || 0,
      dailyVelocity: Number(dailyVelocity.toFixed(2)),
      currentStock: product?.stockQuantity || 0,
      daysOfStock,
      needsRestock: daysOfStock <= 7,
    };
  });
};
