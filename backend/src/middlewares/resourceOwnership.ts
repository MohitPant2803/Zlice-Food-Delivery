import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../constants/roles.js';
import { ApiError } from '../utils/apiError.js';

/**
 * Ensures a user can only read/modify their own user profile or resource
 * unless they are an Administrator. Prevents IDOR (Insecure Direct Object Reference).
 */
export const requireSelfOrAdmin = (userIdParam = 'userId') => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    if (req.user.role === UserRole.ADMIN) {
      return next();
    }

    const targetUserId = req.params[userIdParam];
    if (targetUserId && targetUserId !== req.user.userId) {
      return next(
        ApiError.forbidden(
          'Access denied: You do not have permission to access or modify another user account.',
          'OWNERSHIP_VIOLATION'
        )
      );
    }

    next();
  };
};
