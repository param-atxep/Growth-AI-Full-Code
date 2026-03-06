import bcrypt from 'bcryptjs';
import prisma from '../config/database.js';
import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';
import { generateTokens } from '../middlewares/auth.js';
import { RegisterInput, LoginInput } from '../validations/index.js';

/**
 * Register a new user with store
 */
export const registerUser = async (data: RegisterInput) => {
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase() },
  });

  if (existingUser) {
    throw AppError.conflict('User with this email already exists');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(data.password, 12);

  // Split name into firstName and lastName
  const nameParts = data.name.trim().split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ') || '';

  // Create user and store in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create user
    const user = await tx.user.create({
      data: {
        email: data.email.toLowerCase(),
        password: hashedPassword,
        firstName: firstName,
        lastName: lastName,
        phone: data.phone,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    });

    // Create default store with initial credits
    const store = await tx.store.create({
      data: {
        userId: user.id,
        name: data.storeName,
        businessType: data.storeType || 'RETAIL',
        creditBalance: config.credits.initial,
      },
      select: {
        id: true,
        name: true,
        creditBalance: true,
      },
    });

    // Log initial credit grant
    await tx.creditTransaction.create({
      data: {
        storeId: store.id,
        type: 'INITIAL_GRANT',
        amount: config.credits.initial,
        balanceAfter: config.credits.initial,
        description: 'Welcome bonus credits',
      },
    });

    // Create default expense categories
    const defaultExpenseCategories = [
      { name: 'Rent', color: '#EF4444', icon: 'building' },
      { name: 'Utilities', color: '#F59E0B', icon: 'zap' },
      { name: 'Salaries', color: '#10B981', icon: 'users' },
      { name: 'Inventory', color: '#3B82F6', icon: 'package' },
      { name: 'Marketing', color: '#8B5CF6', icon: 'megaphone' },
      { name: 'Transportation', color: '#EC4899', icon: 'truck' },
      { name: 'Maintenance', color: '#6366F1', icon: 'wrench' },
      { name: 'Other', color: '#6B7280', icon: 'more-horizontal' },
    ];

    await tx.expenseCategory.createMany({
      data: defaultExpenseCategories.map((cat) => ({
        storeId: store.id,
        ...cat,
      })),
    });

    // Create default product categories
    const defaultCategories = [
      { name: 'Electronics', color: '#3B82F6', icon: 'smartphone' },
      { name: 'Clothing', color: '#8B5CF6', icon: 'shirt' },
      { name: 'Groceries', color: '#10B981', icon: 'shopping-bag' },
      { name: 'Home & Kitchen', color: '#F59E0B', icon: 'home' },
      { name: 'Health & Beauty', color: '#EC4899', icon: 'heart' },
      { name: 'Sports', color: '#EF4444', icon: 'dumbbell' },
      { name: 'Books & Stationery', color: '#6366F1', icon: 'book' },
      { name: 'Other', color: '#6B7280', icon: 'box' },
    ];

    await tx.category.createMany({
      data: defaultCategories.map((cat) => ({
        storeId: store.id,
        ...cat,
      })),
    });

    return { user, store };
  });

  // Generate tokens
  const tokens = generateTokens(result.user.id, result.user.email);

  // Store refresh token
  await prisma.refreshToken.create({
    data: {
      token: tokens.refreshToken,
      userId: result.user.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  return {
    user: result.user,
    store: result.store,
    tokens,
  };
};

/**
 * Login user
 */
export const loginUser = async (data: LoginInput) => {
  // Find user
  const user = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase() },
    select: {
      id: true,
      email: true,
      password: true,
      firstName: true,
      lastName: true,
      isActive: true,
    },
  });

  if (!user) {
    throw AppError.unauthorized('Invalid email or password');
  }

  if (!user.isActive) {
    throw AppError.forbidden('Account is deactivated');
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(data.password, user.password);
  if (!isPasswordValid) {
    throw AppError.unauthorized('Invalid email or password');
  }

  // Get user's stores
  const stores = await prisma.store.findMany({
    where: { userId: user.id, isActive: true },
    select: {
      id: true,
      name: true,
      creditBalance: true,
    },
  });

  if (stores.length === 0) {
    throw AppError.notFound('No active stores found');
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // Generate tokens
  const tokens = generateTokens(user.id, user.email);

  // Store refresh token
  await prisma.refreshToken.create({
    data: {
      token: tokens.refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    },
    stores,
    activeStore: stores[0],
    tokens,
  };
};

/**
 * Change password
 */
export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  });

  if (!user) {
    throw AppError.notFound('User not found');
  }

  const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
  if (!isPasswordValid) {
    throw AppError.unauthorized('Current password is incorrect');
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  // Invalidate all refresh tokens
  await prisma.refreshToken.deleteMany({
    where: { userId },
  });

  return { message: 'Password changed successfully' };
};

/**
 * Get user profile
 */
export const getUserProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      avatar: true,
      isEmailVerified: true,
      lastLoginAt: true,
      createdAt: true,
      stores: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          businessType: true,
          creditBalance: true,
        },
      },
    },
  });

  if (!user) {
    throw AppError.notFound('User not found');
  }

  return user;
};

/**
 * Logout - invalidate refresh token
 */
export const logout = async (refreshToken: string) => {
  await prisma.refreshToken.deleteMany({
    where: { token: refreshToken },
  });
  return { message: 'Logged out successfully' };
};
