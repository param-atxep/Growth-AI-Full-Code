import { Router } from 'express';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { validate } from '../middlewares/validate.js';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth.js';
import * as saleService from '../services/sale.service.js';
import { createSaleSchema, paginationSchema, dateRangeSchema, createCustomerSchema } from '../validations/index.js';
import { sendSuccess, sendCreated, sendPaginated } from '../utils/response.js';
import prisma from '../config/database.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/sales
 * @desc Get all sales with filtering and pagination
 */
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { 
      page = '1', 
      limit = '20', 
      startDate, 
      endDate,
      customerId,
      paymentStatus,
      paymentMethod,
      sortBy,
      sortOrder
    } = req.query as Record<string, string>;

    const result = await saleService.getSales(req.store.id, {
      page: parseInt(page),
      limit: parseInt(limit),
      startDate,
      endDate,
      customerId,
      paymentStatus,
      paymentMethod,
      sortBy,
      sortOrder: sortOrder as 'asc' | 'desc',
    });
    sendPaginated(res, result.sales, result.page, result.limit, result.total);
  })
);

/**
 * @route GET /api/sales/summary
 * @desc Get sales summary
 */
router.get(
  '/summary',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const summary = await saleService.getSalesSummary(req.store.id, startDate, endDate);
    sendSuccess(res, summary);
  })
);

/**
 * @route POST /api/sales
 * @desc Create a new sale
 */
router.post(
  '/',
  validate(createSaleSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const sale = await saleService.createSale(req.store.id, req.body);
    sendCreated(res, sale, 'Sale recorded successfully');
  })
);

// ==================== DAILY REPORT ====================

/**
 * @route GET /api/sales/report/daily
 * @desc Get daily sales report
 */
router.get(
  '/report/daily',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { date } = req.query as { date?: string };
    const reportDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(reportDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(reportDate.setHours(23, 59, 59, 999));

    const summary = await saleService.getSalesSummary(
      req.store.id, 
      startOfDay.toISOString(), 
      endOfDay.toISOString()
    );
    sendSuccess(res, summary);
  })
);

// ==================== CUSTOMERS ====================

/**
 * @route GET /api/sales/customers
 * @desc Get all customers
 */
router.get(
  '/customers',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { page = '1', limit = '20', search } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const where: any = { storeId: req.store.id };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { name: 'asc' },
      }),
      prisma.customer.count({ where }),
    ]);

    sendSuccess(res, {
      customers,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) },
    });
  })
);

/**
 * @route POST /api/sales/customers
 * @desc Create a new customer
 */
router.post(
  '/customers',
  validate(createCustomerSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const customer = await prisma.customer.create({
      data: {
        storeId: req.store.id,
        ...req.body,
      },
    });
    sendCreated(res, customer, 'Customer created successfully');
  })
);

/**
 * @route GET /api/sales/customers/:id
 * @desc Get a single customer
 */
router.get(
  '/customers/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, storeId: req.store.id },
      include: {
        sales: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            createdAt: true,
          },
        },
      },
    });
    if (!customer) {
      return sendSuccess(res, null, 'Customer not found');
    }
    sendSuccess(res, customer);
  })
);

// ==================== PARAMETERIZED ROUTES ====================
// These must come LAST to avoid matching specific routes like /report/daily

/**
 * @route GET /api/sales/:id
 * @desc Get a single sale
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const sale = await saleService.getSaleById(req.store.id, req.params.id);
    sendSuccess(res, sale);
  })
);

/**
 * @route POST /api/sales/:id/cancel
 * @desc Cancel a sale
 */
router.post(
  '/:id/cancel',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const result = await saleService.cancelSale(req.store.id, req.params.id);
    sendSuccess(res, result);
  })
);

export default router;
