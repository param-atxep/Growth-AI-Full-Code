import { Router } from 'express';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { validate } from '../middlewares/validate.js';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth.js';
import * as productService from '../services/product.service.js';
import { 
  createProductSchema, 
  updateProductSchema, 
  createCategorySchema,
  paginationSchema,
  stockAdjustmentSchema
} from '../validations/index.js';
import { sendSuccess, sendCreated, sendPaginated } from '../utils/response.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ==================== CATEGORIES ====================

/**
 * @route GET /api/products/categories
 * @desc Get all product categories
 */
router.get(
  '/categories',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const categories = await productService.getCategories(req.store.id);
    sendSuccess(res, categories);
  })
);

/**
 * @route POST /api/products/categories
 * @desc Create a new category
 */
router.post(
  '/categories',
  validate(createCategorySchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const category = await productService.createCategory(req.store.id, req.body);
    sendCreated(res, category);
  })
);

/**
 * @route PUT /api/products/categories/:id
 * @desc Update a category
 */
router.put(
  '/categories/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const category = await productService.updateCategory(
      req.store.id,
      req.params.id,
      req.body
    );
    sendSuccess(res, category);
  })
);

/**
 * @route DELETE /api/products/categories/:id
 * @desc Delete a category
 */
router.delete(
  '/categories/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const result = await productService.deleteCategory(req.store.id, req.params.id);
    sendSuccess(res, result);
  })
);

// ==================== PRODUCTS ====================

/**
 * @route GET /api/products/:id/stock-history
 * @desc Get stock movement history for a product
 */
router.get(
  '/:id/stock-history',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { page, limit } = req.query as any;
    const result = await productService.getStockHistory(
      req.store.id,
      req.params.id,
      { page: parseInt(page) || 1, limit: parseInt(limit) || 10 }
    );
    sendSuccess(res, result);
  })
);

/**
 * @route GET /api/products
 * @desc Get all products with filtering and pagination
 */
router.get(
  '/',
  validate(paginationSchema, 'query'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { page, limit, sortBy, sortOrder, ...filters } = req.query as any;
    const result = await productService.getProducts(req.store.id, {
      page,
      limit,
      sortBy,
      sortOrder,
      categoryId: filters.categoryId,
      search: filters.search,
      lowStock: filters.lowStock === 'true',
    });
    // Return structure that frontend expects
    sendSuccess(res, {
      products: result.products,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  })
);

/**
 * @route GET /api/products/:id
 * @desc Get a single product
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const product = await productService.getProductById(req.store.id, req.params.id);
    sendSuccess(res, product);
  })
);

/**
 * @route POST /api/products
 * @desc Create a new product
 */
router.post(
  '/',
  validate(createProductSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const product = await productService.createProduct(req.store.id, req.body);
    sendCreated(res, product);
  })
);

/**
 * @route PUT /api/products/:id
 * @desc Update a product
 */
router.put(
  '/:id',
  validate(updateProductSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const product = await productService.updateProduct(
      req.store.id,
      req.params.id,
      req.body
    );
    sendSuccess(res, product);
  })
);

/**
 * @route DELETE /api/products/:id
 * @desc Delete a product (soft delete)
 */
router.delete(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const result = await productService.deleteProduct(req.store.id, req.params.id);
    sendSuccess(res, result);
  })
);

/**
 * @route POST /api/products/bulk-import
 * @desc Bulk import products
 */
router.post(
  '/bulk-import',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { products } = req.body;
    const result = await productService.bulkImportProducts(req.store.id, products);
    sendSuccess(res, result);
  })
);

/**
 * @route POST /api/products/:id/stock-adjust
 * @desc Adjust product stock
 */
router.post(
  '/:id/stock-adjust',
  validate(stockAdjustmentSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { type, quantity, reason, reference } = req.body;
    const product = await productService.adjustStock(
      req.store.id,
      req.params.id,
      { type, quantity, reason, reference }
    );
    sendSuccess(res, product);
  })
);

/**
 * @route POST /api/products/:id/stock
 * @desc Add/adjust stock for a product (alias for stock-adjust)
 */
router.post(
  '/:id/stock',
  validate(stockAdjustmentSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { type, quantity, reason, reference } = req.body;
    const product = await productService.adjustStock(
      req.store.id,
      req.params.id,
      { type, quantity, reason, reference }
    );
    sendSuccess(res, product);
  })
);

export default router;
