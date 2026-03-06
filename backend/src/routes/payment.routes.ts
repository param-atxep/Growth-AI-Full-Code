import { Router, Request, Response } from 'express';
import express from 'express';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth.js';
import { CREDIT_PLANS } from '../middlewares/credits.js';
import { sendSuccess, sendPaginated } from '../utils/response.js';
import {
  createCheckoutSession,
  verifyCheckoutSession,
  getPaymentHistory,
  handleStripeWebhook,
} from '../services/payment.service.js';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createCheckoutSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
});

const verifySessionSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
});

/**
 * @route GET /api/payments/plans
 * @desc Get available credit plans
 */
router.get(
  '/plans',
  asyncHandler(async (req, res) => {
    sendSuccess(res, CREDIT_PLANS);
  })
);

/**
 * @route POST /api/payments/create-checkout
 * @desc Create a Stripe Checkout Session for credit purchase
 */
router.post(
  '/create-checkout',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const validation = createCheckoutSchema.safeParse(req.body);
    if (!validation.success) {
      return sendSuccess(res, null, validation.error.errors[0].message, 400);
    }

    const { planId } = validation.data;

    const checkoutData = await createCheckoutSession({
      storeId: req.store.id,
      planId,
      userId: req.user.id,
    });

    sendSuccess(res, checkoutData, 'Checkout session created successfully');
  })
);

/**
 * @route POST /api/payments/verify
 * @desc Verify Stripe payment after successful checkout
 */
router.post(
  '/verify',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const validation = verifySessionSchema.safeParse(req.body);
    if (!validation.success) {
      return sendSuccess(res, null, validation.error.errors[0].message, 400);
    }

    const result = await verifyCheckoutSession(validation.data.sessionId, req.store.id);

    sendSuccess(res, result, 'Payment verified successfully');
  })
);

/**
 * @route GET /api/payments/history
 * @desc Get payment history
 */
router.get(
  '/history',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { page = '1', limit = '20' } = req.query as Record<string, string>;
    const result = await getPaymentHistory(
      req.store.id,
      parseInt(page),
      parseInt(limit)
    );
    sendPaginated(
      res,
      result.payments,
      result.page,
      result.limit,
      result.total
    );
  })
);

/**
 * @route POST /api/payments/webhook
 * @desc Handle Stripe webhook events
 * Note: This endpoint needs raw body for signature verification
 */
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      return sendSuccess(res, { received: true });
    }

    const result = await handleStripeWebhook(req.body, signature);
    sendSuccess(res, result);
  })
);

export default router;
