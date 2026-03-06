import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import prisma from '../config/database.js';
import { AppError } from '../utils/AppError.js';

export interface JWTPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  store: {
    id: string;
    name: string;
    creditBalance: number;
  };
}

/**
 * JWT Authentication Middleware
 * Validates JWT token and attaches user and active store to request
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized('Access token is required');
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    let decoded: JWTPayload;
    try {
      decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw AppError.unauthorized('Token has expired', 'TOKEN_EXPIRED');
      }
      throw AppError.unauthorized('Invalid token', 'INVALID_TOKEN');
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    });

    if (!user) {
      throw AppError.unauthorized('User not found');
    }

    if (!user.isActive) {
      throw AppError.forbidden('Account is deactivated');
    }

    // Get active store (use storeId from header or get first store)
    const storeId = req.headers['x-store-id'] as string;
    
    let store;
    if (storeId) {
      store = await prisma.store.findFirst({
        where: { 
          id: storeId, 
          userId: user.id,
          isActive: true 
        },
        select: {
          id: true,
          name: true,
          creditBalance: true,
        },
      });
    } else {
      store = await prisma.store.findFirst({
        where: { 
          userId: user.id,
          isActive: true 
        },
        select: {
          id: true,
          name: true,
          creditBalance: true,
        },
      });
    }

    if (!store) {
      throw AppError.notFound('No active store found for this user');
    }

    // Attach user and store to request
    (req as AuthenticatedRequest).user = user;
    (req as AuthenticatedRequest).store = store;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional Authentication Middleware
 * Doesn't fail if no token provided, but attaches user if valid token exists
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
        },
      });

      if (user && user.isActive) {
        const store = await prisma.store.findFirst({
          where: { userId: user.id, isActive: true },
          select: {
            id: true,
            name: true,
            creditBalance: true,
          },
        });

        if (store) {
          (req as AuthenticatedRequest).user = user;
          (req as AuthenticatedRequest).store = store;
        }
      }
    } catch {
      // Token invalid, continue without auth
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Generate JWT tokens
 */
export const generateTokens = (userId: string, email: string): {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
} => {
  const accessToken = jwt.sign(
    { userId, email },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] }
  );

  const refreshToken = jwt.sign(
    { userId, email, type: 'refresh' },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'] }
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: config.jwt.expiresIn,
  };
};

/**
 * Verify refresh token and generate new tokens
 */
export const refreshAccessToken = async (refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}> => {
  try {
    const decoded = jwt.verify(refreshToken, config.jwt.secret) as JWTPayload & { type: string };
    
    if (decoded.type !== 'refresh') {
      throw AppError.unauthorized('Invalid refresh token');
    }

    // Verify refresh token exists in database
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw AppError.unauthorized('Refresh token expired or invalid');
    }

    // Delete old refresh token
    await prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });

    // Generate new tokens
    const tokens = generateTokens(decoded.userId, decoded.email);

    // Store new refresh token
    await prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: decoded.userId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    return tokens;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw AppError.unauthorized('Invalid refresh token');
  }
};
