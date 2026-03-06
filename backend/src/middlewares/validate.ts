import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '../utils/AppError.js';

type RequestField = 'body' | 'query' | 'params';

/**
 * Validation Middleware Factory
 * Validates request data against a Zod schema
 */
export const validate = (schema: ZodSchema, field: RequestField = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req[field];
      const result = schema.safeParse(data);

      if (!result.success) {
        const errors = result.error.errors.map((error) => ({
          field: error.path.join('.'),
          message: error.message,
        }));

        throw new AppError(
          `Validation failed: ${errors.map(e => e.message).join(', ')}`,
          400,
          'VALIDATION_ERROR'
        );
      }

      // Replace with parsed data (includes default values and transformations)
      req[field] = result.data;
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Validate multiple fields
 */
export const validateMultiple = (schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      for (const [field, schema] of Object.entries(schemas)) {
        if (schema) {
          const data = req[field as RequestField];
          const result = schema.safeParse(data);

          if (!result.success) {
            const errors = result.error.errors.map((error) => ({
              field: `${field}.${error.path.join('.')}`,
              message: error.message,
            }));

            throw new AppError(
              `Validation failed: ${errors.map(e => e.message).join(', ')}`,
              400,
              'VALIDATION_ERROR'
            );
          }

          req[field as RequestField] = result.data;
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};
