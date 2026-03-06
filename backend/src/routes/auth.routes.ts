import { Router } from 'express';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { validate } from '../middlewares/validate.js';
import { authLimiter } from '../middlewares/rateLimiter.js';
import { authenticate, refreshAccessToken } from '../middlewares/auth.js';
import * as authService from '../services/auth.service.js';
import { 
  registerSchema, 
  loginSchema, 
  changePasswordSchema 
} from '../validations/index.js';
import { sendSuccess, sendCreated } from '../utils/response.js';

const router = Router();

/**
 * @route POST /api/auth/register
 * @desc Register new user with store
 */
router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.registerUser(req.body);
    sendCreated(res, result, 'Registration successful');
  })
);

/**
 * @route POST /api/auth/login
 * @desc Login user
 */
router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.loginUser(req.body);
    sendSuccess(res, result, 'Login successful');
  })
);

/**
 * @route POST /api/auth/refresh
 * @desc Refresh access token
 */
router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return sendSuccess(res, null, 'Refresh token required', 400);
    }
    const tokens = await refreshAccessToken(refreshToken);
    sendSuccess(res, tokens, 'Token refreshed');
  })
);

/**
 * @route POST /api/auth/logout
 * @desc Logout user
 */
router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await authService.logout(refreshToken);
    }
    sendSuccess(res, null, 'Logged out successfully');
  })
);

/**
 * @route GET /api/auth/me
 * @desc Get current user profile
 */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: any, res) => {
    const profile = await authService.getUserProfile(req.user.id);
    sendSuccess(res, profile);
  })
);

/**
 * @route POST /api/auth/change-password
 * @desc Change password
 */
router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  asyncHandler(async (req: any, res) => {
    const { currentPassword, newPassword } = req.body;
    const result = await authService.changePassword(
      req.user.id, 
      currentPassword, 
      newPassword
    );
    sendSuccess(res, result);
  })
);

export default router;
