import mongoose, { Schema } from 'mongoose';
import { IDeliveryTracking } from './tracking.interface.js';

const breadcrumbSchema = new Schema(
  {
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
    speedKmh: { type: Number },
    headingDegrees: { type: Number },
    accuracyMeters: { type: Number },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const deliveryTrackingSchema = new Schema<IDeliveryTracking>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true,
      index: true,
    },
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    canteenId: {
      type: Schema.Types.ObjectId,
      ref: 'Canteen',
      required: true,
    },
    currentLocation: {
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
    lastUpdated: {
      type: Date,
      default: Date.now,
      index: true,
    },
    estimatedArrivalMinutes: {
      type: Number,
      default: 15,
      min: 0,
    },
    distanceRemainingMeters: {
      type: Number,
      default: 0,
      min: 0,
    },
    breadcrumbs: {
      type: [breadcrumbSchema],
      default: [],
    },
    isCompleted: {
      type: Boolean,
      default: false,
      index: true,
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

deliveryTrackingSchema.index({ 'currentLocation': '2dsphere' });

export const DeliveryTracking = mongoose.model<IDeliveryTracking>(
  'DeliveryTracking',
  deliveryTrackingSchema
);
