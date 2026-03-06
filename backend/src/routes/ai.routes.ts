import { Router } from 'express';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { validate } from '../middlewares/validate.js';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth.js';
import { requireCredits, CreditRequest } from '../middlewares/credits.js';
import { aiLimiter } from '../middlewares/rateLimiter.js';
import * as aiService from '../services/ai.service.js';
import { aiChatSchema, aiPredictionSchema } from '../validations/index.js';
import { sendSuccess } from '../utils/response.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Apply rate limiting to all AI routes
router.use(aiLimiter);

/**
 * @route POST /api/ai/chat
 * @desc AI Chat Assistant - ask business questions
 */
router.post(
  '/chat',
  requireCredits('CHAT_ASSISTANT'),
  validate(aiChatSchema),
  asyncHandler(async (req: CreditRequest, res) => {
    const { message, context } = req.body;
    const result = await aiService.aiChatAssistant(
      req.store.id,
      message,
      context?.includeInventory ?? true
    );
    sendSuccess(res, {
      response: result.content,
      tokensUsed: result.tokensUsed,
      latencyMs: result.latencyMs,
      creditsUsed: req.creditCost,
      remainingCredits: req.store.creditBalance - req.creditCost,
    });
  })
);

/**
 * @route POST /api/ai/predict
 * @desc AI Sales Prediction
 */
router.post(
  '/predict',
  requireCredits('SALES_PREDICTION'),
  validate(aiPredictionSchema),
  asyncHandler(async (req: CreditRequest, res) => {
    const { type, days } = req.body;
    
    let result;
    switch (type) {
      case 'revenue':
        result = await aiService.aiSalesPrediction(req.store.id, days);
        break;
      case 'restock':
        result = await aiService.aiRestockRecommendations(req.store.id);
        break;
      case 'marketing':
        result = await aiService.aiMarketingSuggestions(req.store.id);
        break;
      case 'growth':
        result = await aiService.aiGrowthInsights(req.store.id);
        break;
      default:
        result = await aiService.aiSalesPrediction(req.store.id, days);
    }

    sendSuccess(res, {
      type,
      response: result.content,
      tokensUsed: result.tokensUsed,
      latencyMs: result.latencyMs,
      creditsUsed: req.creditCost,
      remainingCredits: req.store.creditBalance - req.creditCost,
    });
  })
);

/**
 * @route GET /api/ai/restock-recommendations
 * @desc Get AI restock recommendations
 */
router.get(
  '/restock-recommendations',
  requireCredits('RESTOCK_RECOMMENDATION'),
  asyncHandler(async (req: CreditRequest, res) => {
    const result = await aiService.aiRestockRecommendations(req.store.id);
    sendSuccess(res, {
      response: result.content,
      tokensUsed: result.tokensUsed,
      latencyMs: result.latencyMs,
      creditsUsed: req.creditCost,
      remainingCredits: req.store.creditBalance - req.creditCost,
    });
  })
);

/**
 * @route GET /api/ai/marketing-suggestions
 * @desc Get AI marketing suggestions
 */
router.get(
  '/marketing-suggestions',
  requireCredits('MARKETING_SUGGESTION'),
  asyncHandler(async (req: CreditRequest, res) => {
    const result = await aiService.aiMarketingSuggestions(req.store.id);
    sendSuccess(res, {
      response: result.content,
      tokensUsed: result.tokensUsed,
      latencyMs: result.latencyMs,
      creditsUsed: req.creditCost,
      remainingCredits: req.store.creditBalance - req.creditCost,
    });
  })
);

/**
 * @route GET /api/ai/growth-insights
 * @desc Get AI growth insights
 */
router.get(
  '/growth-insights',
  requireCredits('GROWTH_INSIGHTS'),
  asyncHandler(async (req: CreditRequest, res) => {
    const result = await aiService.aiGrowthInsights(req.store.id);
    sendSuccess(res, {
      response: result.content,
      tokensUsed: result.tokensUsed,
      latencyMs: result.latencyMs,
      creditsUsed: req.creditCost,
      remainingCredits: req.store.creditBalance - req.creditCost,
    });
  })
);

export default router;
