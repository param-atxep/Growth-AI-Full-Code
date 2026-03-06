import { Router } from 'express';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth.js';
import prisma from '../config/database.js';
import { sendSuccess } from '../utils/response.js';
import { AppError } from '../utils/AppError.js';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Validation schemas
const updateStoreSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  businessType: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pincode: z.string().max(20).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  gstin: z.string().max(20).optional(),
  currency: z.string().max(10).optional(),
  timezone: z.string().max(50).optional(),
  lowStockThreshold: z.number().min(0).optional(),
});

const updatePreferencesSchema = z.object({
  enableNotifications: z.boolean().optional(),
  enableWeeklyReport: z.boolean().optional(),
  darkMode: z.boolean().optional(),
  lowStockThreshold: z.number().min(0).optional(),
});

/**
 * @route GET /api/stores/current
 * @desc Get current store details
 */
router.get(
  '/current',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const store = await prisma.store.findUnique({
      where: { id: req.store.id },
      select: {
        id: true,
        name: true,
        businessType: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        phone: true,
        email: true,
        gstin: true,
        currency: true,
        timezone: true,
        lowStockThreshold: true,
        enableNotifications: true,
        enableWeeklyReport: true,
        darkMode: true,
        creditBalance: true,
        createdAt: true,
      },
    });

    if (!store) {
      throw AppError.notFound('Store not found');
    }

    sendSuccess(res, store);
  })
);

/**
 * @route PUT /api/stores/:id
 * @desc Update store settings
 */
router.put(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;

    // Verify user owns this store
    const store = await prisma.store.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!store) {
      throw AppError.notFound('Store not found');
    }

    const data = updateStoreSchema.parse(req.body);

    const updatedStore = await prisma.store.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        businessType: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        phone: true,
        email: true,
        gstin: true,
        currency: true,
        timezone: true,
        lowStockThreshold: true,
        enableNotifications: true,
        enableWeeklyReport: true,
        darkMode: true,
        creditBalance: true,
      },
    });

    sendSuccess(res, updatedStore, 'Store updated successfully');
  })
);

/**
 * @route PUT /api/stores/:id/preferences
 * @desc Update store preferences (notifications, theme, etc.)
 */
router.put(
  '/:id/preferences',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;

    // Verify user owns this store
    const store = await prisma.store.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!store) {
      throw AppError.notFound('Store not found');
    }

    const data = updatePreferencesSchema.parse(req.body);

    const updatedStore = await prisma.store.update({
      where: { id },
      data,
      select: {
        id: true,
        enableNotifications: true,
        enableWeeklyReport: true,
        darkMode: true,
        lowStockThreshold: true,
      },
    });

    sendSuccess(res, updatedStore, 'Preferences updated successfully');
  })
);

/**
 * @route GET /api/stores/:id/export
 * @desc Export all store data
 */
router.get(
  '/:id/export',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;

    // Verify user owns this store
    const store = await prisma.store.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!store) {
      throw AppError.notFound('Store not found');
    }

    // Fetch all store data
    const [storeData, products, categories, sales, expenses, customers] = await Promise.all([
      prisma.store.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          businessType: true,
          address: true,
          city: true,
          state: true,
          phone: true,
          email: true,
          currency: true,
          createdAt: true,
        },
      }),
      prisma.product.findMany({
        where: { storeId: id },
        select: {
          id: true,
          sku: true,
          name: true,
          description: true,
          costPrice: true,
          sellingPrice: true,
          stockQuantity: true,
          totalSold: true,
          createdAt: true,
        },
      }),
      prisma.category.findMany({
        where: { storeId: id },
        select: {
          id: true,
          name: true,
          description: true,
        },
      }),
      prisma.sale.findMany({
        where: { storeId: id },
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          profit: true,
          paymentMethod: true,
          paymentStatus: true,
          invoiceDate: true,
          items: {
            select: {
              productName: true,
              quantity: true,
              unitPrice: true,
              totalPrice: true,
            },
          },
        },
        orderBy: { invoiceDate: 'desc' },
      }),
      prisma.expense.findMany({
        where: { storeId: id },
        select: {
          id: true,
          description: true,
          amount: true,
          date: true,
          category: {
            select: { name: true },
          },
        },
        orderBy: { date: 'desc' },
      }),
      prisma.customer.findMany({
        where: { storeId: id },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          totalPurchases: true,
        },
      }),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      store: storeData,
      products,
      categories,
      sales,
      expenses,
      customers,
      summary: {
        totalProducts: products.length,
        totalCategories: categories.length,
        totalSales: sales.length,
        totalExpenses: expenses.length,
        totalCustomers: customers.length,
      },
    };

    // Send as JSON file
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="store-export-${storeData?.name?.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json"`
    );
    res.send(JSON.stringify(exportData, null, 2));
  })
);

export default router;
