import mongoose, { Schema } from 'mongoose';
import { IOrder, OrderStatus } from './order.interface.js';

const orderItemSnapshotSchema = new Schema(
  {
    menuItemId: {
      type: Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    customizationNotes: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const orderPricingSchema = new Schema(
  {
    itemsTotal: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, required: true, min: 0 },
    packagingFee: { type: Number, required: true, min: 0, default: 0 },
    deliveryFee: { type: Number, required: true, min: 0, default: 0 },
    discountAmount: { type: Number, required: true, min: 0, default: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const statusHistorySchema = new Schema(
  {
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer reference is required'],
      index: true,
    },
    canteenId: {
      type: Schema.Types.ObjectId,
      ref: 'Canteen',
      required: [true, 'Canteen reference is required'],
      index: true,
    },
    deliveryPartnerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    items: {
      type: [orderItemSnapshotSchema],
      required: true,
      validate: {
        validator: (v: any[]) => Array.isArray(v) && v.length > 0,
        message: 'Order must contain at least one item',
      },
    },
    pricing: {
      type: orderPricingSchema,
      required: true,
    },
    deliveryDrop: {
      location: {
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point',
        },
        coordinates: {
          type: [Number], // [lng, lat]
          required: true,
        },
      },
      campusBlock: {
        type: String,
        required: [true, 'Campus block/building is required'],
        trim: true,
      },
      roomNumber: {
        type: String,
        required: [true, 'Room or desk number is required'],
        trim: true,
      },
      deliveryInstructions: {
        type: String,
        trim: true,
      },
    },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PLACED,
      index: true,
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
    cancellation: {
      cancelledBy: {
        type: String,
        enum: ['customer', 'canteen', 'system', 'admin'],
      },
      reason: { type: String, trim: true },
      cancelledAt: { type: Date },
    },
    deliveryOtp: {
      type: String,
      required: true,
      length: 6,
    },
    estimatedDeliveryAt: {
      type: Date,
    },
    specialInstructions: {
      type: String,
      trim: true,
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

// High-performance compound indexes
orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ canteenId: 1, status: 1, createdAt: -1 });
orderSchema.index({ deliveryPartnerId: 1, status: 1 });
orderSchema.index({ 'deliveryDrop.location': '2dsphere' });

export const Order = mongoose.model<IOrder>('Order', orderSchema);
