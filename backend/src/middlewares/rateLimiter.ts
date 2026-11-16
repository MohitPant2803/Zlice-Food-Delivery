import rateLimit from 'express-rate-limit';
import { ApiError } from '../utils/apiError.js';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Max 20 login/register attempts per IP per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(ApiError.badRequest('Too many authentication attempts. Please try again after 15 minutes.', 'RATE_LIMIT_EXCEEDED'));
  },
});

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
});
