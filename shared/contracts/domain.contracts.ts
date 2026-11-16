/**
 * Zlice Platform - Domain-Specific API Contracts
 * Contract single-source-of-truth ensuring zero type-drift across web and mobile apps.
 */

export enum SharedOrderStatus {
  PLACED = 'placed',
  ACCEPTED_BY_CANTEEN = 'accepted_by_canteen',
  PREPARING = 'preparing',
  READY_FOR_PICKUP = 'ready_for_pickup',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export interface ISharedGeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

// 1. Menu & Catalog Contract
export interface ISharedMenuItem {
  id: string;
  canteenId: string;
  name: string;
  description?: string;
  price: number;
  category: 'snacks' | 'meals' | 'beverages' | 'desserts' | 'combos';
  isVeg: boolean;
  isAvailable: boolean;
  preparationTimeMinutes: number;
  imageUrl?: string;
}

// 2. Cart Contract
export interface ISharedCartItem {
  menuItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  imageUrl?: string;
  isVeg: boolean;
  isAvailable: boolean;
  customizationNotes?: string;
}

export interface ISharedCartSummary {
  canteenId: string | null;
  canteenName: string | null;
  items: ISharedCartItem[];
  itemsCount: number;
  itemsTotal: number;
  taxAmount: number;
  packagingFee: number;
  deliveryFee: number;
  totalAmount: number;
}

// 3. Order Placement & State Contract
export interface ISharedOrderPricing {
  itemsTotal: number;
  taxAmount: number;
  packagingFee: number;
  deliveryFee: number;
  discountAmount: number;
  totalAmount: number;
}

export interface ISharedOrderItemSnapshot {
  menuItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  customizationNotes?: string;
}

export interface ISharedOrderDetail {
  id: string;
  orderNumber: string;
  customerId: string;
  canteenId: string;
  deliveryPartnerId?: string;
  items: ISharedOrderItemSnapshot[];
  pricing: ISharedOrderPricing;
  status: SharedOrderStatus;
  deliveryOtp?: string; // Visible ONLY to customer
  estimatedDeliveryAt?: string;
  createdAt: string;
  deliveryDrop: {
    campusBlock: string;
    roomNumber: string;
    location: ISharedGeoPoint;
    deliveryInstructions?: string;
  };
}

// 4. Live Tracking Contract
export interface ISharedLiveTracking {
  orderId: string;
  orderNumber: string;
  status: SharedOrderStatus;
  partnerId: string;
  currentLocation: [number, number]; // [lng, lat]
  canteenLocation: [number, number];
  dropLocation: [number, number];
  distanceRemainingMeters: number;
  estimatedArrivalMinutes: number;
  speedKmh?: number;
  headingDegrees?: number;
  lastUpdated: string;
}

// 5. Delivery Partner Offer Contract
export interface ISharedDeliveryOffer {
  assignmentId: string;
  orderId: string;
  canteenName: string;
  campusZone: string;
  distanceToCanteenMeters: number;
  distanceToDropMeters: number;
  payoutAmount: number;
  expiresInSeconds: number;
}
