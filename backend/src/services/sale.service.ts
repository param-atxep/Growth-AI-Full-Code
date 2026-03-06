import prisma from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { generateInvoiceNumber, calculateGST, parseDateRange } from '../utils/helpers.js';
import { CreateSaleInput } from '../validations/index.js';

/**
 * Create a new sale
 */
export const createSale = async (storeId: string, data: CreateSaleInput) => {
  // Start transaction
  const sale = await prisma.$transaction(async (tx) => {
    // Get all products
    const productIds = data.items.map((item) => item.productId);
    const products = await tx.product.findMany({
      where: { id: { in: productIds }, storeId },
    });

    if (products.length !== productIds.length) {
      throw AppError.badRequest('One or more products not found');
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    // Calculate totals
    let subtotal = 0;
    let totalCost = 0;
    let totalTax = 0;

    const saleItems = data.items.map((item) => {
      const product = productMap.get(item.productId)!;

      // Check stock
      if (product.stockQuantity < item.quantity) {
        throw AppError.badRequest(
          `Insufficient stock for ${product.name}. Available: ${product.stockQuantity}`
        );
      }

      const itemSubtotal = item.unitPrice * item.quantity;
      const itemDiscount = item.discount || 0;
      const taxableAmount = itemSubtotal - itemDiscount;
      const gstAmount = (taxableAmount * Number(product.gstRate)) / 100;
      const itemTotal = taxableAmount + gstAmount;
      const itemCost = Number(product.costPrice) * item.quantity;
      const itemProfit = taxableAmount - itemCost;

      subtotal += itemSubtotal;
      totalCost += itemCost;
      totalTax += gstAmount;

      return {
        productId: item.productId,
        productName: product.name,
        sku: product.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        costPrice: Number(product.costPrice),
        discount: itemDiscount,
        gstRate: Number(product.gstRate),
        gstAmount,
        totalPrice: itemTotal,
        profit: itemProfit,
      };
    });

    // Apply sale-level discount
    let discountAmount = data.discountAmount || 0;
    if (data.discountPercent && data.discountPercent > 0) {
      discountAmount = (subtotal * data.discountPercent) / 100;
    }

    const totalAmount = subtotal - discountAmount + totalTax;
    const totalProfit = saleItems.reduce((sum, item) => sum + item.profit, 0) - discountAmount;
    const profitMargin = totalAmount > 0 ? (totalProfit / totalAmount) * 100 : 0;
    const dueAmount = totalAmount - data.paidAmount;

    // Generate invoice number
    const invoiceNumber = generateInvoiceNumber('INV');

    // Create sale
    const newSale = await tx.sale.create({
      data: {
        storeId,
        customerId: data.customerId,
        invoiceNumber,
        subtotal,
        discountAmount,
        discountPercent: data.discountPercent || 0,
        taxAmount: totalTax,
        totalAmount,
        totalCost,
        profit: totalProfit,
        profitMargin,
        paymentMethod: data.paymentMethod,
        paymentStatus: dueAmount <= 0 ? 'PAID' : dueAmount < totalAmount ? 'PARTIAL' : 'UNPAID',
        paidAmount: data.paidAmount,
        dueAmount: Math.max(0, dueAmount),
        notes: data.notes,
        items: {
          create: saleItems,
        },
      },
      include: {
        items: true,
        customer: true,
      },
    });

    // Update product stock and stats
    for (const item of data.items) {
      const product = productMap.get(item.productId)!;

      await tx.product.update({
        where: { id: item.productId },
        data: {
          stockQuantity: product.stockQuantity - item.quantity,
          totalSold: product.totalSold + item.quantity,
          lastSoldAt: new Date(),
        },
      });

      // Create stock movement
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: 'SALE',
          quantity: -item.quantity,
          previousStock: product.stockQuantity,
          newStock: product.stockQuantity - item.quantity,
          reference: newSale.invoiceNumber,
        },
      });
    }

    // Update customer stats if exists
    if (data.customerId) {
      await tx.customer.update({
        where: { id: data.customerId },
        data: {
          totalPurchases: { increment: totalAmount },
          totalVisits: { increment: 1 },
          lastVisitAt: new Date(),
        },
      });
    }

    return newSale;
  });

  return formatSaleResponse(sale);
};

/**
 * Get all sales
 */
export const getSales = async (
  storeId: string,
  options: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    customerId?: string;
    paymentStatus?: string;
    paymentMethod?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}
) => {
  const {
    page = 1,
    limit = 20,
    startDate,
    endDate,
    customerId,
    paymentStatus,
    paymentMethod,
    sortBy = 'invoiceDate',
    sortOrder = 'desc',
  } = options;

  const skip = (page - 1) * limit;
  const { start, end } = parseDateRange(startDate, endDate);

  const where: any = {
    storeId,
    invoiceDate: { gte: start, lte: end },
  };

  if (customerId) where.customerId = customerId;
  if (paymentStatus) where.paymentStatus = paymentStatus;
  if (paymentMethod) where.paymentMethod = paymentMethod;

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        items: {
          select: {
            id: true,
            productName: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    }),
    prisma.sale.count({ where }),
  ]);

  return {
    sales: sales.map(formatSaleResponse),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Get sale by ID
 */
export const getSaleById = async (storeId: string, saleId: string) => {
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, storeId },
    include: {
      customer: true,
      items: {
        include: {
          product: {
            select: { id: true, name: true, sku: true, imageUrl: true },
          },
        },
      },
    },
  });

  if (!sale) {
    throw AppError.notFound('Sale not found');
  }

  return formatSaleResponse(sale);
};

/**
 * Cancel a sale (refund)
 */
export const cancelSale = async (storeId: string, saleId: string) => {
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, storeId },
    include: { items: true },
  });

  if (!sale) {
    throw AppError.notFound('Sale not found');
  }

  if (sale.status === 'CANCELLED') {
    throw AppError.badRequest('Sale is already cancelled');
  }

  await prisma.$transaction(async (tx) => {
    // Update sale status
    await tx.sale.update({
      where: { id: saleId },
      data: {
        status: 'CANCELLED',
        paymentStatus: 'REFUNDED',
      },
    });

    // Restore stock for each item
    for (const item of sale.items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
      });

      if (product) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: product.stockQuantity + item.quantity,
            totalSold: Math.max(0, product.totalSold - item.quantity),
          },
        });

        // Create stock movement
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'RETURN',
            quantity: item.quantity,
            previousStock: product.stockQuantity,
            newStock: product.stockQuantity + item.quantity,
            reference: sale.invoiceNumber,
            reason: 'Sale cancelled',
          },
        });
      }
    }

    // Update customer stats if exists
    if (sale.customerId) {
      await tx.customer.update({
        where: { id: sale.customerId },
        data: {
          totalPurchases: { decrement: Number(sale.totalAmount) },
        },
      });
    }
  });

  return { message: 'Sale cancelled successfully' };
};

/**
 * Get sales summary
 */
export const getSalesSummary = async (
  storeId: string,
  startDate?: string,
  endDate?: string
) => {
  const { start, end } = parseDateRange(startDate, endDate);

  const summary = await prisma.sale.aggregate({
    where: {
      storeId,
      invoiceDate: { gte: start, lte: end },
      status: 'COMPLETED',
    },
    _sum: {
      totalAmount: true,
      profit: true,
      taxAmount: true,
      discountAmount: true,
    },
    _count: true,
    _avg: {
      totalAmount: true,
      profitMargin: true,
    },
  });

  const byPaymentMethod = await prisma.sale.groupBy({
    by: ['paymentMethod'],
    where: {
      storeId,
      invoiceDate: { gte: start, lte: end },
      status: 'COMPLETED',
    },
    _sum: { totalAmount: true },
    _count: true,
  });

  return {
    totalRevenue: Number(summary._sum.totalAmount || 0),
    totalProfit: Number(summary._sum.profit || 0),
    totalTax: Number(summary._sum.taxAmount || 0),
    totalDiscount: Number(summary._sum.discountAmount || 0),
    salesCount: summary._count,
    averageOrderValue: Number(summary._avg.totalAmount || 0),
    averageProfitMargin: Number(summary._avg.profitMargin || 0),
    byPaymentMethod: byPaymentMethod.map((pm) => ({
      method: pm.paymentMethod,
      total: Number(pm._sum.totalAmount || 0),
      count: pm._count,
    })),
  };
};

// Helper function to format sale response
function formatSaleResponse(sale: any) {
  return {
    ...sale,
    subtotal: Number(sale.subtotal),
    discountAmount: Number(sale.discountAmount),
    discountPercent: Number(sale.discountPercent),
    taxAmount: Number(sale.taxAmount),
    totalAmount: Number(sale.totalAmount),
    totalCost: Number(sale.totalCost),
    profit: Number(sale.profit),
    profitMargin: Number(sale.profitMargin),
    paidAmount: Number(sale.paidAmount),
    dueAmount: Number(sale.dueAmount),
    items: sale.items?.map((item: any) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      costPrice: Number(item.costPrice),
      discount: Number(item.discount),
      gstRate: Number(item.gstRate),
      gstAmount: Number(item.gstAmount),
      totalPrice: Number(item.totalPrice),
      profit: Number(item.profit),
    })),
  };
}
