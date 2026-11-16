import { Document, Types } from 'mongoose';

export enum PaymentGateway {
  RAZORPAY = 'razorpay',
  STRIPE = 'stripe',
  CAMPUS_WALLET = 'campus_wallet',
  CASH_ON_DELIVERY = 'cash_on_delivery',
}

export enum PaymentStatus {
  INITIATED = 'initiated',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

export interface IRefundRecord {
  refundId: string;
  amount: number;
  reason: string;
  status: 'pending' | 'completed' | 'failed';
  refundedAt: Date;
}

export interface IPaymentTransaction extends Document {
  _id: Types.ObjectId;
  orderId: Types.ObjectId;
  customerId: Types.ObjectId;
  canteenId: Types.ObjectId;
  amount: number;
  currency: string;
  gateway: PaymentGateway;
  gatewayOrderId: string;
  gatewayPaymentId?: string;
  gatewaySignature?: string;
  status: PaymentStatus;
  failureReason?: string;
  idempotencyKey: string;
  refund?: IRefundRecord;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWebhookLog extends Document {
  _id: Types.ObjectId;
  eventId: string; // Unique Gateway Event ID (e.g. evt_123 or pay_captured_xyz)
  gateway: PaymentGateway;
  eventType: string;
  payload: Record<string, any>;
  status: 'processed' | 'failed' | 'ignored';
  processedAt: Date;
  createdAt: Date;
}
