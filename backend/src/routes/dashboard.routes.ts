import { Router } from 'express';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth.js';
import * as dashboardService from '../services/dashboard.service.js';
import { sendSuccess } from '../utils/response.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/dashboard/metrics
 * @desc Get dashboard overview metrics
 */
router.get(
  '/metrics',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const metrics = await dashboardService.getDashboardMetrics(
      req.store.id,
      startDate,
      endDate
    );
    sendSuccess(res, metrics);
  })
);

/**
 * @route GET /api/dashboard/top-products
 * @desc Get top selling products
 */
router.get(
  '/top-products',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { limit, startDate, endDate } = req.query as { 
      limit?: string; 
      startDate?: string; 
      endDate?: string;
    };
    const products = await dashboardService.getTopProducts(
      req.store.id,
      limit ? parseInt(limit) : 5,
      startDate,
      endDate
    );
    sendSuccess(res, products);
  })
);

/**
 * @route GET /api/dashboard/sales-chart
 * @desc Get sales chart data
 */
router.get(
  '/sales-chart',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { startDate, endDate, groupBy } = req.query as { 
      startDate?: string; 
      endDate?: string;
      groupBy?: 'day' | 'week' | 'month';
    };
    const chartData = await dashboardService.getSalesChartData(
      req.store.id,
      startDate,
      endDate,
      groupBy || 'day'
    );
    sendSuccess(res, chartData);
  })
);

/**
 * @route GET /api/dashboard/revenue-by-category
 * @desc Get revenue breakdown by category
 */
router.get(
  '/revenue-by-category',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const data = await dashboardService.getRevenueByCategory(
      req.store.id,
      startDate,
      endDate
    );
    sendSuccess(res, data);
  })
);

/**
 * @route GET /api/dashboard/expense-breakdown
 * @desc Get expense breakdown by category
 */
router.get(
  '/expense-breakdown',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const data = await dashboardService.getExpenseBreakdown(
      req.store.id,
      startDate,
      endDate
    );
    sendSuccess(res, data);
  })
);

/**
 * @route GET /api/dashboard/low-stock
 * @desc Get low stock alerts
 */
router.get(
  '/low-stock',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const alerts = await dashboardService.getLowStockAlerts(req.store.id);
    sendSuccess(res, alerts);
  })
);

/**
 * @route GET /api/dashboard/sales-by-day
 * @desc Get sales breakdown by day of week
 */
router.get(
  '/sales-by-day',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const data = await dashboardService.getSalesByDayOfWeek(
      req.store.id,
      startDate,
      endDate
    );
    sendSuccess(res, data);
  })
);

/**
 * @route GET /api/dashboard/dead-stock
 * @desc Get dead stock products
 */
router.get(
  '/dead-stock',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { days } = req.query as { days?: string };
    const data = await dashboardService.getDeadStock(
      req.store.id,
      days ? parseInt(days) : 60
    );
    sendSuccess(res, data);
  })
);

/**
 * @route GET /api/dashboard/fast-moving
 * @desc Get fast moving products
 */
router.get(
  '/fast-moving',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { days } = req.query as { days?: string };
    const data = await dashboardService.getFastMovingProducts(
      req.store.id,
      days ? parseInt(days) : 30
    );
    sendSuccess(res, data);
  })
);

export default router;
