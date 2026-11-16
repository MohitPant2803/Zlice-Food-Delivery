import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { requireRole, requirePermission } from '../../middlewares/authorize.js';
import { requireCanteenScope } from '../../middlewares/canteenScope.js';
import { authRateLimiter } from '../../middlewares/rateLimiter.js';
import { UserRole } from '../../constants/roles.js';
import { Permission } from '../../constants/permissions.js';
import {
  customerRegisterSchema,
  canteenOwnerRegisterSchema,
  deliveryPartnerRegisterSchema,
  canteenStaffCreateSchema,
  loginSchema,
  refreshTokenSchema,
  revokeSessionSchema,
} from './auth.validation.js';

const router = Router();

// Public Authentication endpoints with brute-force rate limiting
router.post(
  '/register/customer',
  authRateLimiter,
  validate(customerRegisterSchema),
  AuthController.registerCustomer
);

router.post(
  '/register/canteen-owner',
  authRateLimiter,
  validate(canteenOwnerRegisterSchema),
  AuthController.registerCanteenOwner
);

router.post(
  '/register/delivery-partner',
  authRateLimiter,
  validate(deliveryPartnerRegisterSchema),
  AuthController.registerDeliveryPartner
);

router.post(
  '/login',
  authRateLimiter,
  validate(loginSchema),
  AuthController.login
);

router.post(
  '/refresh-token',
  validate(refreshTokenSchema),
  AuthController.refreshToken
);

// Protected endpoints
router.use(authenticate);

// Current user profile
router.get('/me', AuthController.getMe);

// Canteen Staff Onboarding (Requires CANTEEN_OWNER + Canteen Scope)
router.post(
  '/register/canteen-staff',
  requireRole(UserRole.CANTEEN_OWNER),
  requirePermission(Permission.CANTEEN_MANAGE_STAFF),
  requireCanteenScope(),
  validate(canteenStaffCreateSchema),
  AuthController.registerCanteenStaff
);

// Session & Device Management
router.post('/logout', AuthController.logout);
router.post('/logout-all', AuthController.logoutAllDevices);
router.get('/sessions', AuthController.getSessions);
router.delete('/sessions/:sessionId', validate(revokeSessionSchema), AuthController.revokeSession);

export const authRouter = router;
