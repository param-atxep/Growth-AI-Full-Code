import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';

/**
 * General API rate limiter
 */
export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs, // 15 minutes
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT',
      message: 'Too many requests. Please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    return (req as any).user?.id || req.ip || 'unknown';
  },
});

/**
 * AI endpoints rate limiter - more restrictive
 */
export const aiLimiter = rateLimit({
  windowMs: config.rateLimit.ai.windowMs, // 1 minute
  max: config.rateLimit.ai.maxRequests, // 10 requests per minute
  message: {
    success: false,
    error: {
      code: 'AI_RATE_LIMIT',
      message: 'AI request limit exceeded. Please wait before making more AI requests.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return (req as any).user?.id || req.ip || 'unknown';
  },
});

/**
 * Auth endpoints rate limiter - stricter for security
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login attempts per 15 minutes
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT',
      message: 'Too many login attempts. Please try again in 15 minutes.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Skip rate limiting for specific conditions
 */
export const shouldSkipRateLimit = (req: any): boolean => {
  // Skip in development
  if (config.isDevelopment) return true;
  
  // Skip for health checks
  if (req.path === '/health') return true;
  
  return false;
};
