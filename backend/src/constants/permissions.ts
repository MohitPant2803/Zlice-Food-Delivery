import { UserRole } from './roles.js';

export enum Permission {
  // Canteen Permissions
  CANTEEN_READ = 'canteen:read',
  CANTEEN_CREATE = 'canteen:create',
  CANTEEN_UPDATE = 'canteen:update',
  CANTEEN_DELETE = 'canteen:delete',
  CANTEEN_MANAGE_STAFF = 'canteen:manage_staff',
  CANTEEN_VIEW_METRICS = 'canteen:view_metrics',

  // Menu Permissions
  MENU_READ = 'menu:read',
  MENU_CREATE = 'menu:create',
  MENU_UPDATE = 'menu:update',
  MENU_DELETE = 'menu:delete',
  MENU_TOGGLE_AVAILABILITY = 'menu:toggle_availability',

  // Order Permissions
  ORDER_CREATE = 'order:create',
  ORDER_VIEW_OWN = 'order:view_own',
  ORDER_CANCEL_OWN = 'order:cancel_own',
  ORDER_VIEW_CANTEEN = 'order:view_canteen',
  ORDER_UPDATE_STATUS = 'order:update_status',
  ORDER_VIEW_ALL = 'order:view_all',

  // Delivery Permissions
  DELIVERY_VIEW_OFFERS = 'delivery:view_offers',
  DELIVERY_ACCEPT = 'delivery:accept',
  DELIVERY_UPDATE_STATUS = 'delivery:update_status',
  DELIVERY_UPDATE_LOCATION = 'delivery:update_location',
  DELIVERY_VIEW_EARNINGS = 'delivery:view_earnings',

  // User & Session Management
  USER_VIEW_PROFILE = 'user:view_profile',
  USER_UPDATE_PROFILE = 'user:update_profile',
  SESSION_MANAGE_OWN = 'session:manage_own',

  // Administrative
  ADMIN_MANAGE_USERS = 'admin:manage_users',
  ADMIN_SYSTEM_CONFIG = 'admin:system_config',
}

/**
 * Role-to-Permissions Mapping matrix.
 * Provides fine-grained capability checks on top of RBAC.
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.CUSTOMER]: [
    Permission.CANTEEN_READ,
    Permission.MENU_READ,
    Permission.ORDER_CREATE,
    Permission.ORDER_VIEW_OWN,
    Permission.ORDER_CANCEL_OWN,
    Permission.USER_VIEW_PROFILE,
    Permission.USER_UPDATE_PROFILE,
    Permission.SESSION_MANAGE_OWN,
  ],

  [UserRole.CANTEEN_STAFF]: [
    Permission.CANTEEN_READ,
    Permission.MENU_READ,
    Permission.MENU_TOGGLE_AVAILABILITY,
    Permission.ORDER_VIEW_CANTEEN,
    Permission.ORDER_UPDATE_STATUS,
    Permission.USER_VIEW_PROFILE,
    Permission.USER_UPDATE_PROFILE,
    Permission.SESSION_MANAGE_OWN,
  ],

  [UserRole.CANTEEN_OWNER]: [
    Permission.CANTEEN_READ,
    Permission.CANTEEN_UPDATE,
    Permission.CANTEEN_MANAGE_STAFF,
    Permission.CANTEEN_VIEW_METRICS,
    Permission.MENU_READ,
    Permission.MENU_CREATE,
    Permission.MENU_UPDATE,
    Permission.MENU_DELETE,
    Permission.MENU_TOGGLE_AVAILABILITY,
    Permission.ORDER_VIEW_CANTEEN,
    Permission.ORDER_UPDATE_STATUS,
    Permission.USER_VIEW_PROFILE,
    Permission.USER_UPDATE_PROFILE,
    Permission.SESSION_MANAGE_OWN,
  ],

  [UserRole.DELIVERY_PARTNER]: [
    Permission.DELIVERY_VIEW_OFFERS,
    Permission.DELIVERY_ACCEPT,
    Permission.DELIVERY_UPDATE_STATUS,
    Permission.DELIVERY_UPDATE_LOCATION,
    Permission.DELIVERY_VIEW_EARNINGS,
    Permission.USER_VIEW_PROFILE,
    Permission.USER_UPDATE_PROFILE,
    Permission.SESSION_MANAGE_OWN,
  ],

  [UserRole.ADMIN]: Object.values(Permission),
};
