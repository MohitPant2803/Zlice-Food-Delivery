export enum UserRole {
  CUSTOMER = 'customer',
  CANTEEN_OWNER = 'canteen_owner',
  CANTEEN_STAFF = 'canteen_staff',
  DELIVERY_PARTNER = 'delivery_partner',
  ADMIN = 'admin',
}

export const ALL_ROLES = Object.values(UserRole);
