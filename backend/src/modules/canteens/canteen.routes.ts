import { Router } from 'express';
import { CanteenController } from './canteen.controller.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { requireRole, requirePermission } from '../../middlewares/authorize.js';
import { requireCanteenScope } from '../../middlewares/canteenScope.js';
import { UserRole } from '../../constants/roles.js';
import { Permission } from '../../constants/permissions.js';

const router = Router();

// Public: View canteen by ID
router.get('/:canteenId', CanteenController.getCanteenById);

// Multi-Tenant Protected: View canteen orders
// Protected by:
// 1. authenticate (valid JWT + active session)
// 2. requireRole (CANTEEN_OWNER, CANTEEN_STAFF, or ADMIN)
// 3. requirePermission (ORDER_VIEW_CANTEEN)
// 4. requireCanteenScope (verifies caller owns/operates the specified canteenId!)
router.get(
  '/:canteenId/orders',
  authenticate,
  requireRole(UserRole.CANTEEN_OWNER, UserRole.CANTEEN_STAFF, UserRole.ADMIN),
  requirePermission(Permission.ORDER_VIEW_CANTEEN),
  requireCanteenScope({ paramName: 'canteenId' }),
  CanteenController.getCanteenOrders
);

// Multi-Tenant Protected: Toggle canteen open/close status
router.patch(
  '/:canteenId/status',
  authenticate,
  requireRole(UserRole.CANTEEN_OWNER, UserRole.ADMIN),
  requirePermission(Permission.CANTEEN_UPDATE),
  requireCanteenScope({ paramName: 'canteenId' }),
  CanteenController.toggleStatus
);

export const canteenRouter = router;
