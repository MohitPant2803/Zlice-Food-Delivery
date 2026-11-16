import { Router } from 'express';
import { DeliveryController } from './delivery.controller.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { requireRole, requirePermission } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { UserRole } from '../../constants/roles.js';
import { Permission } from '../../constants/permissions.js';
import {
  toggleOnlineSchema,
  updateLocationSchema,
  acceptOfferSchema,
  rejectOfferSchema,
  pickupOrderSchema,
  completeDeliverySchema,
  triggerDispatchSchema,
} from './delivery.validation.js';

const router = Router();

router.use(authenticate);

// Delivery Partner Online & GPS endpoints
router.patch(
  '/status/online',
  requireRole(UserRole.DELIVERY_PARTNER),
  validate(toggleOnlineSchema),
  DeliveryController.toggleOnline
);

router.post(
  '/location',
  requireRole(UserRole.DELIVERY_PARTNER),
  requirePermission(Permission.DELIVERY_UPDATE_LOCATION),
  validate(updateLocationSchema),
  DeliveryController.updateLocation
);

// Delivery Partner Offer Handshake
router.get(
  '/offers',
  requireRole(UserRole.DELIVERY_PARTNER),
  requirePermission(Permission.DELIVERY_VIEW_OFFERS),
  DeliveryController.getMyOffers
);

router.post(
  '/offers/:assignmentId/accept',
  requireRole(UserRole.DELIVERY_PARTNER),
  requirePermission(Permission.DELIVERY_ACCEPT),
  validate(acceptOfferSchema),
  DeliveryController.acceptOffer
);

router.post(
  '/offers/:assignmentId/reject',
  requireRole(UserRole.DELIVERY_PARTNER),
  validate(rejectOfferSchema),
  DeliveryController.rejectOffer
);

// Order Pickup & Handshake Drop-off
router.patch(
  '/orders/:orderId/pickup',
  requireRole(UserRole.DELIVERY_PARTNER),
  requirePermission(Permission.DELIVERY_UPDATE_STATUS),
  validate(pickupOrderSchema),
  DeliveryController.pickupOrder
);

router.post(
  '/orders/:orderId/deliver',
  requireRole(UserRole.DELIVERY_PARTNER),
  requirePermission(Permission.DELIVERY_UPDATE_STATUS),
  validate(completeDeliverySchema),
  DeliveryController.completeDelivery
);

// Dispatch Trigger (Canteen Owner/Staff/Admin triggers dispatch when order is ready)
router.post(
  '/orders/:orderId/dispatch',
  requireRole(UserRole.CANTEEN_OWNER, UserRole.CANTEEN_STAFF, UserRole.ADMIN),
  validate(triggerDispatchSchema),
  DeliveryController.triggerDispatch
);

// Timeout Sweep (Worker / Admin trigger)
router.post(
  '/timeouts/sweep',
  requireRole(UserRole.ADMIN),
  DeliveryController.sweepTimeouts
);

export const deliveryRouter = router;
