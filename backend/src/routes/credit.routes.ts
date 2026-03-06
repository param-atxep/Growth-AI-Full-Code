import { Router } from 'express';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth.js';
import { 
  getCreditBalance, 
  getCreditHistory, 
  getAIUsageStats,
  CREDIT_PLANS,
  addCredits
} from '../middlewares/credits.js';
import { sendSuccess, sendPaginated } from '../utils/response.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/credits/balance
 * @desc Get current credit balance
 */
router.get(
  '/balance',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const balance = await getCreditBalance(req.store.id);
    sendSuccess(res, { balance, storeId: req.store.id });
  })
);

/**
 * @route GET /api/credits/plans
 * @desc Get available credit plans
 */
router.get(
  '/plans',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    sendSuccess(res, CREDIT_PLANS);
  })
);

/**
 * @route GET /api/credits/history
 * @desc Get credit transaction history
 */
router.get(
  '/history',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { page = '1', limit = '20' } = req.query as Record<string, string>;
    const result = await getCreditHistory(
      req.store.id,
      parseInt(page),
      parseInt(limit)
    );
    sendPaginated(
      res,
      result.transactions,
      result.page,
      result.limit,
      result.total
    );
  })
);

/**
 * @route GET /api/credits/usage
 * @desc Get AI usage statistics
 */
router.get(
  '/usage',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { days = '30' } = req.query as Record<string, string>;
    const stats = await getAIUsageStats(req.store.id, parseInt(days));
    sendSuccess(res, stats);
  })
);

/**
 * @route POST /api/credits/purchase
 * @desc Purchase credits (webhook endpoint for payment gateway)
 * In production, this would be triggered by payment gateway webhook
 */
router.post(
  '/purchase',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { planId, paymentId } = req.body;
    
    const plan = CREDIT_PLANS.find(p => p.id === planId);
    if (!plan) {
      return sendSuccess(res, null, 'Invalid plan', 400);
    }

    // In production, verify payment with payment gateway here
    // For now, just add credits directly
    const result = await addCredits(
      req.store.id,
      plan.credits,
      `Purchased ${plan.name} plan (${plan.credits} credits)`,
      paymentId,
      { planId, price: plan.price, currency: plan.currency }
    );

    sendSuccess(res, {
      message: 'Credits purchased successfully',
      creditsAdded: result.creditsAdded,
      newBalance: result.newBalance,
      plan: plan.name,
    });
  })
);

/**
 * @route POST /api/credits/webhook
 * @desc Payment gateway webhook endpoint
 * This would be used by Razorpay/Stripe to confirm payments
 */
router.post(
  '/webhook',
  asyncHandler(async (req, res) => {
    // Verify webhook signature in production
    const { event, payload } = req.body;

    // Handle different payment events
    switch (event) {
      case 'payment.captured':
        // Payment successful - credits should already be added
        // This is for logging/verification
        break;
      case 'payment.failed':
        // Handle failed payment
        break;
      default:
        // Unknown event
        break;
    }

    sendSuccess(res, { received: true });
  })
);

export default router;
