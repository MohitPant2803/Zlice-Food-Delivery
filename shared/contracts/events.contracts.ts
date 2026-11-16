import { ISharedLiveTracking, SharedOrderStatus } from './domain.contracts.js';

/**
 * Socket.IO Typed Events Contract
 * Single source of truth for real-time WebSocket communication across apps.
 */

// Server to Client Events
export interface ServerToClientEvents {
  // Tracking Room Events (Customer, Canteen, Admin)
  'order:tracking:snapshot': (data: ISharedLiveTracking) => void;
  'order:tracking:update': (data: ISharedLiveTracking) => void;
  'order:status:change': (data: { orderId: string; status: SharedOrderStatus; payload?: any }) => void;
  'tracking_error': (error: { message: string }) => void;

  // Canteen Room Events (Kitchen Dashboard)
  'canteen:new_order': (order: { orderId: string; orderNumber: string; totalAmount: number }) => void;
  'canteen:order:updated': (data: { orderId: string; status: SharedOrderStatus }) => void;

  // Delivery Partner Room Events (Mobile App)
  'delivery:new_offer': (offer: { assignmentId: string; orderId: string; canteenName: string; timeoutSeconds: number }) => void;
  'delivery:offer_expired': (data: { assignmentId: string }) => void;
}

// Client to Server Events
export interface ClientToServerEvents {
  // Tracking Room Management
  'join_order_tracking': (data: { orderId: string }) => void;
  'leave_order_tracking': (data: { orderId: string }) => void;

  // GPS Coordinate Streaming (Delivery App)
  'partner_location_update': (data: {
    orderId: string;
    coordinates: [number, number]; // [lng, lat]
    speedKmh?: number;
    headingDegrees?: number;
    accuracyMeters?: number;
  }) => void;
}
