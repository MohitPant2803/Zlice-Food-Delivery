import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../constants/roles.js';
import { Permission } from '../constants/permissions.js';
import { ApiError } from '../utils/apiError.js';

/**
 * Role-Based Access Control (RBAC) Middleware.
 * Ensures the authenticated user belongs to at least one of the specified roles.
 */
export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `Access denied. Role '${req.user.role}' does not have sufficient clearance for this resource.`,
          'ROLE_FORBIDDEN'
        )
      );
    }

    next();
  };
};

/**
 * Fine-Grained Permission-Based Access Control (PBAC) Middleware.
 * Ensures the authenticated user has all specified permissions.
 */
export const requirePermission = (...requiredPermissions: Permission[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    // Admins bypass granular permission checks
    if (req.user.role === UserRole.ADMIN) {
      return next();
    }

    const userPermissions = new Set(req.user.permissions);
    const hasAll = requiredPermissions.every((p) => userPermissions.has(p));

    if (!hasAll) {
      return next(
        ApiError.forbidden(
          'Access denied. Missing required permission(s) to execute this operation.',
          'INSUFFICIENT_PERMISSIONS'
        )
      );
    }

    next();
  };
};
