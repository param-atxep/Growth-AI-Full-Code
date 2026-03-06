import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

/**
 * Not Found Handler
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};

/**
 * Global Error Handler
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details: unknown = undefined;

  // Handle known error types
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Handle Prisma errors
    switch (err.code) {
      case 'P2002':
        statusCode = 409;
        code = 'DUPLICATE_ENTRY';
        const fields = (err.meta?.target as string[])?.join(', ') || 'field';
        message = `A record with this ${fields} already exists`;
        break;
      case 'P2003':
        statusCode = 400;
        code = 'FOREIGN_KEY_ERROR';
        message = 'Referenced record does not exist';
        break;
      case 'P2025':
        statusCode = 404;
        code = 'NOT_FOUND';
        message = 'Record not found';
        break;
      default:
        message = 'Database error occurred';
    }
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Invalid data provided';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Token has expired';
  }

  // Log error
  if (statusCode >= 500) {
    logger.error(`[${code}] ${message}`, {
      error: err.stack,
      path: req.path,
      method: req.method,
      body: req.body,
    });
  } else {
    logger.warn(`[${code}] ${message}`, {
      path: req.path,
      method: req.method,
    });
  }

  // Send response
  const errorObj: Record<string, unknown> = { code, message };
  if (details) errorObj.details = details;
  if (config.isDevelopment && statusCode >= 500) errorObj.stack = err.stack;
  
  const response: Record<string, unknown> = {
    success: false,
    error: errorObj,
  };

  res.status(statusCode).json(response);
};

/**
 * Async Handler Wrapper
 * Wraps async route handlers to properly catch errors
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const asyncHandler = <T>(
  fn: (req: any, res: Response, next: NextFunction) => Promise<T>
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (req: any, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
