import { Document, Types } from 'mongoose';
import { IGeoPoint } from '../canteens/canteen.interface.js';

export enum OrderStatus {
  PLACED = 'placed',
  ACCEPTED_BY_CANTEEN = 'accepted_by_canteen',
  PREPARING = 'preparing',
  READY_FOR_PICKUP = 'ready_for_pickup',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export interface IOrderItemSnapshot {
  menuItemId: Types.ObjectId;
  name: string;
  unitPrice: number; // Snapshot price at time of order creation
  quantity: number;
  subtotal: number;
  customizationNotes?: string;
}

export interface IOrderPricing {
  itemsTotal: number;
  taxAmount: number; // e.g. 5% GST/tax
  packagingFee: number;
  deliveryFee: number;
  discountAmount: number;
  totalAmount: number; // Strictly computed on server
}

export interface IDeliveryDropLocation {
  location: IGeoPoint;
  campusBlock: string;
  roomNumber: string;
  deliveryInstructions?: string;
}

export interface IOrderStatusHistory {
  status: OrderStatus;
  timestamp: Date;
  updatedBy: Types.ObjectId;
  notes?: string;
}

export interface IOrderCancellation {
  cancelledBy: 'customer' | 'canteen' | 'system' | 'admin';
  reason: string;
  cancelledAt: Date;
}

export interface IOrder extends Document {
  _id: Types.ObjectId;
  orderNumber: string; // e.g. "ZL-20261113-ABCD"
  customerId: Types.ObjectId;
  canteenId: Types.ObjectId;
  deliveryPartnerId?: Types.ObjectId;
  items: IOrderItemSnapshot[];
  pricing: IOrderPricing;
  deliveryDrop: IDeliveryDropLocation;
  status: OrderStatus;
  statusHistory: IOrderStatusHistory[];
  cancellation?: IOrderCancellation;
  deliveryOtp: string; // 6-digit OTP for handshake at delivery point
  estimatedDeliveryAt?: Date;
  specialInstructions?: string;
  createdAt: Date;
  updatedAt: Date;
}
