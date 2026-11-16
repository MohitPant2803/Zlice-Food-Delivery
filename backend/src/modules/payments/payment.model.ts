import mongoose, { Schema } from 'mongoose';
import {
  IPaymentTransaction,
  IWebhookLog,
  PaymentGateway,
  PaymentStatus,
} from './payment.interface.js';

const refundRecordSchema = new Schema(
  {
    refundId: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    reason: { type: String, trim: true },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'completed',
    },
    refundedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const paymentTransactionSchema = new Schema<IPaymentTransaction>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    canteenId: {
      type: Schema.Types.ObjectId,
      ref: 'Canteen',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Amount cannot be negative'],
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
    },
    gateway: {
      type: String,
      enum: Object.values(PaymentGateway),
      required: true,
      index: true,
    },
    gatewayOrderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    gatewayPaymentId: {
      type: String,
      index: true,
    },
    gatewaySignature: {
      type: String,
    },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.INITIATED,
      index: true,
    },
    failureReason: {
      type: String,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    refund: {
      type: refundRecordSchema,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret: any) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

paymentTransactionSchema.index({ customerId: 1, createdAt: -1 });
paymentTransactionSchema.index({ canteenId: 1, status: 1 });

const webhookLogSchema = new Schema<IWebhookLog>(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    gateway: {
      type: String,
      enum: Object.values(PaymentGateway),
      required: true,
    },
    eventType: {
      type: String,
      required: true,
      index: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: ['processed', 'failed', 'ignored'],
      default: 'processed',
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

webhookLogSchema.index({ eventId: 1, gateway: 1 });

export const PaymentTransaction = mongoose.model<IPaymentTransaction>(
  'PaymentTransaction',
  paymentTransactionSchema
);

export const WebhookLog = mongoose.model<IWebhookLog>('WebhookLog', webhookLogSchema);
