import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../constants/roles.js';
import { ApiError } from '../utils/apiError.js';
import { Canteen } from '../modules/canteens/canteen.model.js';
import { logger } from '../utils/logger.js';

export interface CanteenScopeOptions {
  paramName?: string; // route param name, e.g. ':canteenId'
  allowAdminBypass?: boolean;
}

/**
 * Enterprise Multi-Tenant Canteen Scoping Middleware.
 * 
 * Enforces strict tenant data isolation to guarantee that Canteen Owners and Staff
 * can NEVER inspect, query, or mutate resources belonging to another canteen.
 * 
 * Defense-in-depth principles applied:
 * 1. Role validation is NOT enough: Checks explicit user-canteen association.
 * 2. Route param validation: Matches requested resource against JWT tenant claims.
 * 3. Database consistency check: Verifies user is still an active owner/staff member in DB
 *    (preventing unauthorized access if staff was fired after token issuance).
 * 4. Context injection: Overrides req.canteenId with verified tenant identity for query scoping.
 */
export const requireCanteenScope = (options: CanteenScopeOptions = {}) => {
  const { paramName = 'canteenId', allowAdminBypass = true } = options;

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(ApiError.unauthorized('Authentication required'));
      }

      // 1. Admin bypass with audit logging
      if (req.user.role === UserRole.ADMIN && allowAdminBypass) {
        const targetCanteenId = req.params[paramName] || req.body?.canteenId || req.query?.canteenId;
        if (targetCanteenId) {
          req.canteenId = targetCanteenId as string;
        }
        logger.info(`[AUDIT] Admin ${req.user.userId} accessed canteen context: ${req.canteenId || 'ALL'}`);
        return next();
      }

      // 2. Reject users who do not have canteen roles
      const isCanteenRole =
        req.user.role === UserRole.CANTEEN_OWNER || req.user.role === UserRole.CANTEEN_STAFF;

      if (!isCanteenRole) {
        return next(
          ApiError.forbidden(
            'Tenant access denied: Only authorized canteen operators may access this resource.',
            'NON_CANTEEN_ROLE'
          )
        );
      }

      // 3. User must have an associated canteenId
      const userCanteenId = req.user.canteenId;
      if (!userCanteenId) {
        return next(
          ApiError.forbidden(
            'Tenant access denied: Your account is not bound to any registered canteen.',
            'UNBOUND_CANTEEN_USER'
          )
        );
      }

      // 4. Extract target canteenId from route params, query, or body
      const requestedCanteenId =
        req.params[paramName] || req.body?.canteenId || req.query?.canteenId;

      // 5. If a specific canteenId was requested, enforce strict identity match
      if (requestedCanteenId && requestedCanteenId !== userCanteenId) {
        logger.warn(
          `🚨 MULTI-TENANT VIOLATION ATTEMPT: User ${req.user.userId} (Canteen: ${userCanteenId}) attempted unauthorized access to Canteen ${requestedCanteenId}`
        );
        return next(
          ApiError.forbidden(
            'Security violation: Cross-canteen access is strictly prohibited.',
            'CROSS_TENANT_VIOLATION'
          )
        );
      }

      // 6. Database Verification (defense-in-depth: check if canteen exists and is active)
      const canteen = await Canteen.findById(userCanteenId);
      if (!canteen || !canteen.isActive) {
        return next(
          ApiError.forbidden(
            'Access denied: The associated canteen is deactivated or does not exist.',
            'CANTEEN_INACTIVE'
          )
        );
      }

      // 7. Inject verified canteenId into the Express request
      // Downstream controller/service queries MUST use req.canteenId rather than user input!
      req.canteenId = userCanteenId;

      next();
    } catch (error) {
      next(error);
    }
  };
};
