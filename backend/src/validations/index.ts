import { z } from 'zod';

// Common validations
export const emailSchema = z.string().email('Invalid email address');
export const passwordSchema = z.string()
  .min(6, 'Password must be at least 6 characters');

export const phoneSchema = z.string()
  .regex(/^[6-9]\d{9}$/, 'Invalid phone number')
  .optional()
  .or(z.literal(''));

export const gstinSchema = z.string()
  .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN')
  .optional();

export const uuidSchema = z.string().uuid('Invalid ID format');

export const paginationSchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('20'),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const dateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// Auth validations
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  phone: phoneSchema,
  storeName: z.string().min(2, 'Store name must be at least 2 characters').max(100),
  storeType: z.string().optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: passwordSchema,
});

// Store validations
export const createStoreSchema = z.object({
  name: z.string().min(2).max(100),
  businessType: z.string().optional(),
  gstin: gstinSchema,
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().regex(/^[1-9][0-9]{5}$/, 'Invalid pincode').optional(),
  phone: phoneSchema,
  email: emailSchema.optional(),
});

export const updateStoreSchema = createStoreSchema.partial();

// Category validations
export const createCategorySchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color code').optional(),
  icon: z.string().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

// Product validations
export const createProductSchema = z.object({
  categoryId: uuidSchema.optional(),
  sku: z.string().min(1).max(50).optional(),
  barcode: z.string().optional(),
  name: z.string().min(2).max(200),
  description: z.string().optional(),
  costPrice: z.number().positive('Cost price must be positive'),
  sellingPrice: z.number().positive('Selling price must be positive'),
  mrp: z.number().positive().optional(),
  gstRate: z.number().min(0).max(28).default(0),
  hsnCode: z.string().optional(),
  unit: z.string().default('pcs'),
  stockQuantity: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(10),
  reorderQuantity: z.number().int().min(0).default(50),
  location: z.string().optional(),
  expiryDate: z.string().datetime().optional(),
  batchNumber: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

export const updateProductSchema = createProductSchema.partial();

export const bulkProductSchema = z.array(createProductSchema);

// Sale validations
export const saleItemSchema = z.object({
  productId: uuidSchema,
  quantity: z.number().int().positive('Quantity must be positive'),
  unitPrice: z.number().positive(),
  discount: z.number().min(0).default(0),
});

export const createSaleSchema = z.object({
  customerId: uuidSchema.optional(),
  items: z.array(saleItemSchema).min(1, 'At least one item is required'),
  discountAmount: z.number().min(0).default(0),
  discountPercent: z.number().min(0).max(100).default(0),
  paymentMethod: z.enum(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'CREDIT', 'MIXED']).default('CASH'),
  paidAmount: z.number().min(0),
  notes: z.string().optional(),
});

// Expense validations
export const createExpenseSchema = z.object({
  categoryId: uuidSchema.optional(),
  title: z.string().min(2).max(200).optional(),
  description: z.string().min(2).max(200),
  amount: z.number().positive('Amount must be positive'),
  date: z.string().optional(),
  category: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'CREDIT', 'MIXED']).default('CASH'),
  reference: z.string().optional(),
  vendor: z.string().optional(),
  notes: z.string().optional(),
  isRecurring: z.boolean().default(false),
  recurringPeriod: z.enum(['daily', 'weekly', 'monthly']).optional(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

// Customer validations
export const createCustomerSchema = z.object({
  name: z.string().min(2).max(100),
  email: emailSchema.optional(),
  phone: phoneSchema,
  address: z.string().optional(),
  gstin: gstinSchema,
  notes: z.string().optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

// AI validations
export const aiChatSchema = z.object({
  message: z.string().min(1).max(2000),
  context: z.object({
    includeInventory: z.boolean().default(true),
    includeSales: z.boolean().default(true),
    includeExpenses: z.boolean().default(true),
  }).optional(),
});

export const aiPredictionSchema = z.object({
  type: z.enum(['revenue', 'restock', 'marketing', 'growth']),
  days: z.number().int().min(7).max(90).default(30),
});

// Stock adjustment validation
export const stockAdjustmentSchema = z.object({
  productId: uuidSchema.optional(), // Optional since ID is in URL
  type: z.enum(['PURCHASE', 'ADJUSTMENT', 'DAMAGE', 'EXPIRED', 'RETURN', 'IN', 'OUT']),
  quantity: z.number().int(),
  reason: z.string().optional(),
  reference: z.string().optional(),
});

// Export types
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateStoreInput = z.infer<typeof createStoreSchema>;
export type UpdateStoreInput = z.infer<typeof updateStoreSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type AIChatInput = z.infer<typeof aiChatSchema>;
export type AIPredictionInput = z.infer<typeof aiPredictionSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type DateRangeInput = z.infer<typeof dateRangeSchema>;
