import { Router } from 'express';
import { OrderController } from './order.controller.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { requireRole, requirePermission } from '../../middlewares/authorize.js';
import { requireCanteenScope } from '../../middlewares/canteenScope.js';
import { validate } from '../../middlewares/validate.js';
import { UserRole } from '../../constants/roles.js';
import { Permission } from '../../constants/permissions.js';
import {
  calculatePriceSchema,
  createOrderSchema,
  updateOrderStatusSchema,
  cancelOrderSchema,
} from './order.validation.js';

const router = Router();

router.use(authenticate);

// 1. Price calculation preview (Customer / Any authenticated user)
router.post(
  '/calculate-price',
  validate(calculatePriceSchema),
  OrderController.calculatePrice
);

// 2. Customer Order Placement
router.post(
  '/',
  requireRole(UserRole.CUSTOMER),
  requirePermission(Permission.ORDER_CREATE),
  validate(createOrderSchema),
  OrderController.createOrder
);

// 3. Customer Order History
router.get(
  '/me',
  requireRole(UserRole.CUSTOMER),
  requirePermission(Permission.ORDER_VIEW_OWN),
  OrderController.getMyOrders
);

// 4. Canteen Scoped Orders Dashboard
router.get(
  '/canteen/:canteenId',
  requireRole(UserRole.CANTEEN_OWNER, UserRole.CANTEEN_STAFF, UserRole.ADMIN),
  requirePermission(Permission.ORDER_VIEW_CANTEEN),
  requireCanteenScope({ paramName: 'canteenId' }),
  OrderController.getCanteenOrders
);

// 5. Canteen Scoped Metrics & Analytics
router.get(
  '/canteen/:canteenId/metrics',
  requireRole(UserRole.CANTEEN_OWNER, UserRole.ADMIN),
  requirePermission(Permission.CANTEEN_VIEW_METRICS),
  requireCanteenScope({ paramName: 'canteenId' }),
  OrderController.getCanteenMetrics
);

// 6. Canteen Status Advancement (Kitchen flow)
router.patch(
  '/canteen/:canteenId/:orderId/status',
  requireRole(UserRole.CANTEEN_OWNER, UserRole.CANTEEN_STAFF, UserRole.ADMIN),
  requirePermission(Permission.ORDER_UPDATE_STATUS),
  requireCanteenScope({ paramName: 'canteenId' }),
  validate(updateOrderStatusSchema),
  OrderController.updateStatus
);

// 7. Order Cancellation (Customer or Canteen)
router.post(
  '/:orderId/cancel',
  validate(cancelOrderSchema),
  OrderController.cancelOrder
);

export const orderRouter = router;
