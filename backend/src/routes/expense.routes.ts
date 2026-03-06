import { Router } from 'express';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { validate } from '../middlewares/validate.js';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth.js';
import * as expenseService from '../services/expense.service.js';
import { createExpenseSchema, updateExpenseSchema } from '../validations/index.js';
import { sendSuccess, sendCreated, sendPaginated } from '../utils/response.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ==================== EXPENSE CATEGORIES ====================

/**
 * @route GET /api/expenses/categories
 * @desc Get all expense categories
 */
router.get(
  '/categories',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const categories = await expenseService.getExpenseCategories(req.store.id);
    sendSuccess(res, categories);
  })
);

/**
 * @route POST /api/expenses/categories
 * @desc Create expense category
 */
router.post(
  '/categories',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const category = await expenseService.createExpenseCategory(req.store.id, req.body);
    sendCreated(res, category);
  })
);

/**
 * @route PUT /api/expenses/categories/:id
 * @desc Update expense category
 */
router.put(
  '/categories/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const category = await expenseService.updateExpenseCategory(
      req.store.id,
      req.params.id,
      req.body
    );
    sendSuccess(res, category);
  })
);

// ==================== EXPENSES ====================

/**
 * @route GET /api/expenses
 * @desc Get all expenses with filtering
 */
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { 
      page = '1', 
      limit = '20', 
      startDate, 
      endDate,
      categoryId,
      category,
      sortBy,
      sortOrder
    } = req.query as Record<string, string>;

    const result = await expenseService.getExpenses(req.store.id, {
      page: parseInt(page),
      limit: parseInt(limit),
      startDate,
      endDate,
      categoryId,
      category,
      sortBy,
      sortOrder: sortOrder as 'asc' | 'desc',
    });
    // Return format: { expenses: [...], pagination: { page, totalPages, ... } }
    sendSuccess(res, result);
  })
);

/**
 * @route GET /api/expenses/summary
 * @desc Get expense summary
 */
router.get(
  '/summary',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const summary = await expenseService.getExpenseSummary(req.store.id, startDate, endDate);
    sendSuccess(res, summary);
  })
);

/**
 * @route GET /api/expenses/:id
 * @desc Get expense by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const expense = await expenseService.getExpenseById(req.store.id, req.params.id);
    sendSuccess(res, expense);
  })
);

/**
 * @route POST /api/expenses
 * @desc Create expense
 */
router.post(
  '/',
  validate(createExpenseSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const expense = await expenseService.createExpense(req.store.id, req.body);
    sendCreated(res, expense);
  })
);

/**
 * @route PUT /api/expenses/:id
 * @desc Update expense
 */
router.put(
  '/:id',
  validate(updateExpenseSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const expense = await expenseService.updateExpense(
      req.store.id,
      req.params.id,
      req.body
    );
    sendSuccess(res, expense);
  })
);

/**
 * @route DELETE /api/expenses/:id
 * @desc Delete expense
 */
router.delete(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const result = await expenseService.deleteExpense(req.store.id, req.params.id);
    sendSuccess(res, result);
  })
);

export default router;
