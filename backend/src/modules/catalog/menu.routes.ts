import { Router } from 'express';
import { MenuController } from './menu.controller.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { requireRole, requirePermission } from '../../middlewares/authorize.js';
import { requireCanteenScope } from '../../middlewares/canteenScope.js';
import { validate } from '../../middlewares/validate.js';
import { UserRole } from '../../constants/roles.js';
import { Permission } from '../../constants/permissions.js';
import {
  createMenuItemSchema,
  updateMenuItemSchema,
  toggleAvailabilitySchema,
} from './menu.validation.js';

const router = Router();

// Public: Browse menu items for a canteen
router.get('/canteens/:canteenId', MenuController.getCanteenMenu);
router.get('/items/:itemId', MenuController.getMenuItemById);

// Protected: Canteen Management endpoints
router.post(
  '/canteens/:canteenId/items',
  authenticate,
  requireRole(UserRole.CANTEEN_OWNER, UserRole.ADMIN),
  requirePermission(Permission.MENU_CREATE),
  requireCanteenScope({ paramName: 'canteenId' }),
  validate(createMenuItemSchema),
  MenuController.createMenuItem
);

router.patch(
  '/canteens/:canteenId/items/:itemId',
  authenticate,
  requireRole(UserRole.CANTEEN_OWNER, UserRole.ADMIN),
  requirePermission(Permission.MENU_UPDATE),
  requireCanteenScope({ paramName: 'canteenId' }),
  validate(updateMenuItemSchema),
  MenuController.updateMenuItem
);

router.patch(
  '/canteens/:canteenId/items/:itemId/availability',
  authenticate,
  requireRole(UserRole.CANTEEN_OWNER, UserRole.CANTEEN_STAFF, UserRole.ADMIN),
  requirePermission(Permission.MENU_TOGGLE_AVAILABILITY),
  requireCanteenScope({ paramName: 'canteenId' }),
  validate(toggleAvailabilitySchema),
  MenuController.toggleAvailability
);

router.delete(
  '/canteens/:canteenId/items/:itemId',
  authenticate,
  requireRole(UserRole.CANTEEN_OWNER, UserRole.ADMIN),
  requirePermission(Permission.MENU_DELETE),
  requireCanteenScope({ paramName: 'canteenId' }),
  MenuController.deleteMenuItem
);

export const menuRouter = router;
