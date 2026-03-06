import prisma from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { generateSKU } from '../utils/helpers.js';
import { CreateProductInput, UpdateProductInput } from '../validations/index.js';

/**
 * Helper to create inventory expense when adding products
 */
const createInventoryExpense = async (
  storeId: string,
  productName: string,
  quantity: number,
  costPrice: number,
  isRestock: boolean = false
) => {
  const totalAmount = quantity * costPrice;
  if (totalAmount <= 0) return null;

  // Find or create "Inventory" expense category
  let category = await prisma.expenseCategory.findFirst({
    where: { storeId, name: 'Inventory' },
  });

  if (!category) {
    category = await prisma.expenseCategory.create({
      data: {
        storeId,
        name: 'Inventory',
        color: '#3B82F6', // Blue color for inventory
      },
    });
  }

  // Create the expense
  return prisma.expense.create({
    data: {
      storeId,
      categoryId: category.id,
      title: isRestock ? `Restock: ${productName}` : `New Product: ${productName}`,
      description: `${isRestock ? 'Restocked' : 'Added'} ${quantity} units @ ₹${costPrice} each`,
      amount: totalAmount,
      date: new Date(),
      paymentMethod: 'CASH',
      reference: `INV-${Date.now()}`,
    },
  });
};

/**
 * Create a new product or update stock if product with same name exists
 */
export const createProduct = async (storeId: string, data: CreateProductInput) => {
  // Check if a product with the same name already exists in the store
  const existingProduct = await prisma.product.findFirst({
    where: { 
      storeId, 
      name: { equals: data.name, mode: 'insensitive' } 
    },
    include: {
      category: { select: { id: true, name: true, color: true } },
    },
  });

  // If product with same name exists, update its stock
  if (existingProduct) {
    const previousStock = existingProduct.stockQuantity;
    const newStock = previousStock + (data.stockQuantity || 0);

    // Create stock movement for restock
    if (data.stockQuantity > 0) {
      await prisma.stockMovement.create({
        data: {
          productId: existingProduct.id,
          type: 'PURCHASE',
          quantity: data.stockQuantity,
          previousStock,
          newStock,
          reason: 'Restock - product already exists',
        },
      });
    }

    // Update the product with new stock and optionally other fields
    const updatedProduct = await prisma.product.update({
      where: { id: existingProduct.id },
      data: {
        stockQuantity: newStock,
        costPrice: data.costPrice ?? existingProduct.costPrice,
        sellingPrice: data.sellingPrice ?? existingProduct.sellingPrice,
        lastRestockedAt: data.stockQuantity > 0 ? new Date() : existingProduct.lastRestockedAt,
      },
      include: {
        category: { select: { id: true, name: true, color: true } },
      },
    });

    // Create expense for restocked inventory
    if (data.stockQuantity > 0) {
      const costPrice = data.costPrice ?? Number(existingProduct.costPrice);
      await createInventoryExpense(storeId, existingProduct.name, data.stockQuantity, costPrice, true);
    }

    return { ...updatedProduct, restocked: true, addedQuantity: data.stockQuantity || 0 };
  }

  // New product - check SKU uniqueness
  const sku = data.sku || generateSKU();

  const existingSku = await prisma.product.findFirst({
    where: { storeId, sku },
  });

  if (existingSku) {
    throw AppError.conflict('A product with this SKU already exists');
  }

  const product = await prisma.product.create({
    data: {
      storeId,
      ...data,
      sku,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      lastRestockedAt: data.stockQuantity > 0 ? new Date() : null,
    },
    include: {
      category: { select: { id: true, name: true, color: true } },
    },
  });

  // Create stock movement for initial stock
  if (data.stockQuantity > 0) {
    await prisma.stockMovement.create({
      data: {
        productId: product.id,
        type: 'PURCHASE',
        quantity: data.stockQuantity,
        previousStock: 0,
        newStock: data.stockQuantity,
        reason: 'Initial stock',
      },
    });

    // Create expense for new product inventory investment
    if (data.costPrice) {
      await createInventoryExpense(storeId, data.name, data.stockQuantity, data.costPrice, false);
    }
  }

  return { ...product, restocked: false };
};

/**
 * Update a product
 */
export const updateProduct = async (
  storeId: string,
  productId: string,
  data: UpdateProductInput
) => {
  // Verify ownership
  const existingProduct = await prisma.product.findFirst({
    where: { id: productId, storeId },
  });

  if (!existingProduct) {
    throw AppError.notFound('Product not found');
  }

  // Check SKU uniqueness if being updated
  if (data.sku && data.sku !== existingProduct.sku) {
    const skuExists = await prisma.product.findFirst({
      where: { storeId, sku: data.sku, NOT: { id: productId } },
    });

    if (skuExists) {
      throw AppError.conflict('A product with this SKU already exists');
    }
  }

  // Track stock changes
  if (data.stockQuantity !== undefined && data.stockQuantity !== existingProduct.stockQuantity) {
    await prisma.stockMovement.create({
      data: {
        productId,
        type: 'ADJUSTMENT',
        quantity: data.stockQuantity - existingProduct.stockQuantity,
        previousStock: existingProduct.stockQuantity,
        newStock: data.stockQuantity,
        reason: 'Manual adjustment',
      },
    });
  }

  const product = await prisma.product.update({
    where: { id: productId },
    data: {
      ...data,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
    },
    include: {
      category: { select: { id: true, name: true, color: true } },
    },
  });

  return product;
};

/**
 * Get all products for a store
 */
export const getProducts = async (
  storeId: string,
  options: {
    page?: number;
    limit?: number;
    categoryId?: string;
    search?: string;
    lowStock?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}
) => {
  const {
    page = 1,
    limit = 20,
    categoryId,
    search,
    lowStock,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = options;

  const skip = (page - 1) * limit;

  const where: any = {
    storeId,
    isActive: true,
  };

  if (categoryId) {
    where.categoryId = categoryId;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
      { barcode: { contains: search, mode: 'insensitive' } },
    ];
  }

  // For lowStock filter, we need to use $queryRaw since Prisma doesn't support field-to-field comparison
  // For simplicity, we'll fetch and filter in application code
  let filterLowStock = lowStock;

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, color: true } },
      },
      skip: filterLowStock ? 0 : skip,
      take: filterLowStock ? 1000 : limit, // Get more if filtering
      orderBy: { [sortBy]: sortOrder },
    }),
    prisma.product.count({ where }),
  ]);

  // Filter low stock products in application code
  let filteredProducts = products;
  if (filterLowStock) {
    filteredProducts = products.filter(p => p.stockQuantity <= p.lowStockThreshold);
  }
  
  // Apply pagination after filtering
  const paginatedProducts = filterLowStock 
    ? filteredProducts.slice(skip, skip + limit)
    : filteredProducts;
  
  const finalTotal = filterLowStock ? filteredProducts.length : total;

  return {
    products: paginatedProducts.map((p) => ({
      ...p,
      costPrice: Number(p.costPrice),
      sellingPrice: Number(p.sellingPrice),
      mrp: p.mrp ? Number(p.mrp) : null,
      gstRate: Number(p.gstRate),
      profitMargin: Number(p.sellingPrice) > 0
        ? ((Number(p.sellingPrice) - Number(p.costPrice)) / Number(p.sellingPrice)) * 100
        : 0,
      // Field aliases for frontend compatibility
      currentStock: p.stockQuantity,
      minStockLevel: p.lowStockThreshold,
    })),
    total: finalTotal,
    page,
    limit,
    totalPages: Math.ceil(finalTotal / limit),
  };
};

/**
 * Get a single product
 */
export const getProductById = async (storeId: string, productId: string) => {
  const product = await prisma.product.findFirst({
    where: { id: productId, storeId },
    include: {
      category: { select: { id: true, name: true, color: true } },
      stockMovements: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!product) {
    throw AppError.notFound('Product not found');
  }

  return {
    ...product,
    costPrice: Number(product.costPrice),
    sellingPrice: Number(product.sellingPrice),
    mrp: product.mrp ? Number(product.mrp) : null,
    gstRate: Number(product.gstRate),
    // Field aliases for frontend compatibility
    currentStock: product.stockQuantity,
    minStockLevel: product.lowStockThreshold,
  };
};

/**
 * Delete a product (soft delete)
 */
export const deleteProduct = async (storeId: string, productId: string) => {
  const product = await prisma.product.findFirst({
    where: { id: productId, storeId },
  });

  if (!product) {
    throw AppError.notFound('Product not found');
  }

  await prisma.product.update({
    where: { id: productId },
    data: { isActive: false },
  });

  return { message: 'Product deleted successfully' };
};

/**
 * Bulk import products
 */
export const bulkImportProducts = async (
  storeId: string,
  products: CreateProductInput[]
) => {
  const results = {
    imported: 0,
    failed: 0,
    errors: [] as Array<{ row: number; error: string }>,
  };

  for (let i = 0; i < products.length; i++) {
    try {
      await createProduct(storeId, products[i]);
      results.imported++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        row: i + 1,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
};

/**
 * Adjust stock
 */
export const adjustStock = async (
  storeId: string,
  productId: string,
  adjustment: {
    type: 'PURCHASE' | 'ADJUSTMENT' | 'DAMAGE' | 'EXPIRED' | 'RETURN' | 'IN' | 'OUT';
    quantity: number;
    reason?: string;
    reference?: string;
  }
) => {
  const product = await prisma.product.findFirst({
    where: { id: productId, storeId },
  });

  if (!product) {
    throw AppError.notFound('Product not found');
  }

  // Handle IN/OUT type mapping
  let adjustedQuantity = adjustment.quantity;
  let stockMovementType = adjustment.type;

  if (adjustment.type === 'IN') {
    adjustedQuantity = Math.abs(adjustment.quantity);
    stockMovementType = 'PURCHASE';
  } else if (adjustment.type === 'OUT') {
    adjustedQuantity = -Math.abs(adjustment.quantity);
    stockMovementType = 'ADJUSTMENT';
  }

  const newStock = product.stockQuantity + adjustedQuantity;

  if (newStock < 0) {
    throw AppError.badRequest('Stock cannot be negative');
  }

  const [updatedProduct] = await prisma.$transaction([
    prisma.product.update({
      where: { id: productId },
      data: {
        stockQuantity: newStock,
        lastRestockedAt: adjustedQuantity > 0 ? new Date() : undefined,
      },
    }),
    prisma.stockMovement.create({
      data: {
        productId,
        type: stockMovementType as 'PURCHASE' | 'ADJUSTMENT' | 'DAMAGE' | 'EXPIRED' | 'RETURN',
        quantity: adjustedQuantity,
        previousStock: product.stockQuantity,
        newStock,
        reason: adjustment.reason,
        reference: adjustment.reference,
      },
    }),
  ]);

  return updatedProduct;
};

/**
 * Get product categories
 */
export const getCategories = async (storeId: string) => {
  const categories = await prisma.category.findMany({
    where: { storeId, isActive: true },
    include: {
      _count: { select: { products: true } },
    },
    orderBy: { name: 'asc' },
  });

  return categories;
};

/**
 * Create category
 */
export const createCategory = async (
  storeId: string,
  data: { name: string; description?: string; color?: string; icon?: string }
) => {
  const category = await prisma.category.create({
    data: {
      storeId,
      ...data,
    },
  });

  return category;
};

/**
 * Update category
 */
export const updateCategory = async (
  storeId: string,
  categoryId: string,
  data: { name?: string; description?: string; color?: string; icon?: string }
) => {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, storeId },
  });

  if (!category) {
    throw AppError.notFound('Category not found');
  }

  return prisma.category.update({
    where: { id: categoryId },
    data,
  });
};

/**
 * Delete category
 */
export const deleteCategory = async (storeId: string, categoryId: string) => {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, storeId },
  });

  if (!category) {
    throw AppError.notFound('Category not found');
  }

  // Set products to uncategorized
  await prisma.product.updateMany({
    where: { categoryId, storeId },
    data: { categoryId: null },
  });

  await prisma.category.update({
    where: { id: categoryId },
    data: { isActive: false },
  });

  return { message: 'Category deleted successfully' };
};

/**
 * Get stock movement history for a product
 */
export const getStockHistory = async (
  storeId: string,
  productId: string,
  options: { page?: number; limit?: number }
) => {
  const page = options.page || 1;
  const limit = options.limit || 10;
  const skip = (page - 1) * limit;

  // First verify the product belongs to the store
  const product = await prisma.product.findFirst({
    where: { id: productId, storeId },
    select: { id: true, name: true },
  });

  if (!product) {
    throw AppError.notFound('Product not found');
  }

  const [movements, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.stockMovement.count({ where: { productId } }),
  ]);

  return {
    movements,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};
