import mongoose, { Schema } from 'mongoose';
import { IDeliveryAssignment, DeliveryAssignmentStatus } from './assignment.interface.js';

const deliveryAssignmentSchema = new Schema<IDeliveryAssignment>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    canteenId: {
      type: Schema.Types.ObjectId,
      ref: 'Canteen',
      required: true,
      index: true,
    },
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    attemptNumber: {
      type: Number,
      default: 1,
      min: 1,
    },
    rejectedPartnerIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    canteenLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    dropLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    distanceToCanteenMeters: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: Object.values(DeliveryAssignmentStatus),
      default: DeliveryAssignmentStatus.OFFERED,
      index: true,
    },
    offeredAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    respondedAt: {
      type: Date,
    },
    cancellationReason: {
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

// High performance compound indexes
deliveryAssignmentSchema.index({ orderId: 1, attemptNumber: 1 });
deliveryAssignmentSchema.index({ partnerId: 1, status: 1 });
deliveryAssignmentSchema.index({ status: 1, expiresAt: 1 });

export const DeliveryAssignment = mongoose.model<IDeliveryAssignment>(
  'DeliveryAssignment',
  deliveryAssignmentSchema
);
