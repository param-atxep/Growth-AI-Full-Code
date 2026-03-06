import { Response, NextFunction } from 'express';
import prisma from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { config } from '../config/index.js';
import { AuthenticatedRequest } from './auth.js';
import { AIFeature } from '@prisma/client';

export interface CreditRequest extends AuthenticatedRequest {
  creditCost: number;
  aiFeature: AIFeature;
}

/**
 * Credit costs for different AI features
 */
export const CREDIT_COSTS: Record<AIFeature, number> = {
  SALES_PREDICTION: config.credits.costs.prediction,
  CHAT_ASSISTANT: config.credits.costs.chat,
  RESTOCK_RECOMMENDATION: config.credits.costs.prediction,
  MARKETING_SUGGESTION: config.credits.costs.prediction,
  PRODUCT_ANALYSIS: config.credits.costs.prediction,
  GROWTH_INSIGHTS: config.credits.costs.prediction,
};

/**
 * Credit Check Middleware Factory
 * Validates that the store has sufficient credits for the AI operation
 * 
 * @param feature - The AI feature being used
 */
export const requireCredits = (feature: AIFeature) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (
    req: any,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const store = (req as AuthenticatedRequest).store;
      const creditCost = CREDIT_COSTS[feature];

      if (!creditCost) {
        throw AppError.internal(`Unknown AI feature: ${feature}`);
      }

      // Check if store has sufficient credits
      if (store.creditBalance < creditCost) {
        throw AppError.insufficientCredits(creditCost, store.creditBalance);
      }

      // Attach credit info to request for later deduction
      (req as CreditRequest).creditCost = creditCost;
      (req as CreditRequest).aiFeature = feature;

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Deduct credits from store account
 * Should be called AFTER successful AI operation
 */
export const deductCredits = async (
  storeId: string,
  feature: AIFeature,
  description: string
): Promise<{ newBalance: number; creditsDeducted: number }> => {
  const creditCost = CREDIT_COSTS[feature];

  // Use transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Get current balance with lock
    const store = await tx.store.findUniqueOrThrow({
      where: { id: storeId },
      select: { creditBalance: true },
    });

    if (store.creditBalance < creditCost) {
      throw AppError.insufficientCredits(creditCost, store.creditBalance);
    }

    const newBalance = store.creditBalance - creditCost;

    // Update store balance
    await tx.store.update({
      where: { id: storeId },
      data: { creditBalance: newBalance },
    });

    // Log the transaction
    await tx.creditTransaction.create({
      data: {
        storeId,
        type: 'AI_USAGE',
        amount: -creditCost,
        balanceAfter: newBalance,
        description,
        reference: feature,
      },
    });

    return { newBalance, creditsDeducted: creditCost };
  });

  return result;
};

/**
 * Add credits to store account (for purchases)
 */
export const addCredits = async (
  storeId: string,
  amount: number,
  description: string,
  paymentId?: string,
  metadata?: Record<string, unknown>
): Promise<{ newBalance: number; creditsAdded: number }> => {
  const result = await prisma.$transaction(async (tx) => {
    const store = await tx.store.findUniqueOrThrow({
      where: { id: storeId },
      select: { creditBalance: true },
    });

    const newBalance = store.creditBalance + amount;

    // Update store balance
    await tx.store.update({
      where: { id: storeId },
      data: { creditBalance: newBalance },
    });

    // Log the transaction
    await tx.creditTransaction.create({
      data: {
        storeId,
        type: 'PURCHASE',
        amount,
        balanceAfter: newBalance,
        description,
        paymentId,
        metadata: metadata as any,
      },
    });

    return { newBalance, creditsAdded: amount };
  });

  return result;
};

/**
 * Get credit balance for a store
 */
export const getCreditBalance = async (storeId: string): Promise<number> => {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { creditBalance: true },
  });
  return store?.creditBalance ?? 0;
};

/**
 * Get credit transaction history
 */
export const getCreditHistory = async (
  storeId: string,
  page: number = 1,
  limit: number = 20
) => {
  const skip = (page - 1) * limit;

  const [transactions, total] = await Promise.all([
    prisma.creditTransaction.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.creditTransaction.count({
      where: { storeId },
    }),
  ]);

  return {
    transactions,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Credit plans available for purchase
 */
export const CREDIT_PLANS = [
  {
    id: 'plan_basic',
    name: 'Basic',
    credits: 2000,
    price: 499,
    currency: 'INR',
    popular: false,
    description: 'Perfect for getting started',
  },
  {
    id: 'plan_pro',
    name: 'Professional',
    credits: 10000,
    price: 2999,
    currency: 'INR',
    popular: true,
    description: 'Best value for growing businesses',
    savings: '40% OFF',
  },
  {
    id: 'plan_enterprise',
    name: 'Enterprise',
    credits: 50000,
    price: 9999,
    currency: 'INR',
    popular: false,
    description: 'For high-volume businesses',
    savings: '60% OFF',
  },
];

/**
 * Log AI usage
 */
export const logAIUsage = async (
  storeId: string,
  feature: AIFeature,
  creditsUsed: number,
  prompt?: string,
  response?: string,
  tokensUsed?: number,
  latencyMs?: number,
  success: boolean = true,
  errorMessage?: string
): Promise<void> => {
  await prisma.aIUsageLog.create({
    data: {
      storeId,
      feature,
      creditsUsed,
      prompt: prompt?.substring(0, 5000), // Limit storage
      response: response?.substring(0, 10000),
      tokensUsed,
      latencyMs,
      success,
      errorMessage,
    },
  });
};

/**
 * Get AI usage statistics for a store
 */
export const getAIUsageStats = async (storeId: string, days: number = 30) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const [totalUsage, usageByFeature, dailyUsage] = await Promise.all([
    // Total credits used
    prisma.aIUsageLog.aggregate({
      where: {
        storeId,
        createdAt: { gte: startDate },
      },
      _sum: { creditsUsed: true },
      _count: true,
    }),

    // Usage by feature
    prisma.aIUsageLog.groupBy({
      by: ['feature'],
      where: {
        storeId,
        createdAt: { gte: startDate },
      },
      _sum: { creditsUsed: true },
      _count: true,
    }),

    // Daily usage
    prisma.$queryRaw`
      SELECT 
        DATE("createdAt") as date,
        CAST(SUM("creditsUsed") AS INTEGER) as credits,
        CAST(COUNT(*) AS INTEGER) as requests
      FROM ai_usage_logs
      WHERE "storeId" = ${storeId}
        AND "createdAt" >= ${startDate}
      GROUP BY DATE("createdAt")
      ORDER BY date DESC
    `,
  ]);

  return {
    totalCreditsUsed: totalUsage._sum.creditsUsed ?? 0,
    totalRequests: totalUsage._count,
    usageByFeature,
    dailyUsage,
  };
};
