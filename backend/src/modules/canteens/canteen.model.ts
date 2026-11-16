import mongoose, { Schema } from 'mongoose';
import { ICanteen } from './canteen.interface.js';

const canteenSchema = new Schema<ICanteen>(
  {
    name: {
      type: String,
      required: [true, 'Canteen name is required'],
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    campusZone: {
      type: String,
      required: [true, 'Campus zone is required (e.g. North Cafeteria, Science Block)'],
      trim: true,
      index: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Canteen owner reference is required'],
      index: true,
    },
    staffIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isOpen: {
      type: Boolean,
      default: true,
      index: true,
    },
    contactPhone: {
      type: String,
      required: [true, 'Contact phone number is required'],
      trim: true,
    },
    rating: {
      type: Number,
      default: 4.5,
      min: 1,
      max: 5,
    },
    ratingCount: {
      type: Number,
      default: 0,
    },
    bannerImage: {
      type: String,
      default: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
    },
    isActive: {
      type: Boolean,
      default: true,
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

// 2dsphere index for campus geospatial queries ($near, $geoWithin)
canteenSchema.index({ location: '2dsphere' });
canteenSchema.index({ ownerId: 1, isActive: 1 });

export const Canteen = mongoose.model<ICanteen>('Canteen', canteenSchema);
