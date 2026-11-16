import mongoose, { Schema } from 'mongoose';
import { IMenuItem, MenuCategory } from './menu.interface.js';

const menuItemSchema = new Schema<IMenuItem>(
  {
    canteenId: {
      type: Schema.Types.ObjectId,
      ref: 'Canteen',
      required: [true, 'Canteen ID is required for a menu item'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
      maxlength: [120, 'Item name cannot exceed 120 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Item price is required'],
      min: [0, 'Price cannot be negative'],
    },
    category: {
      type: String,
      enum: Object.values(MenuCategory),
      required: [true, 'Menu category is required'],
      index: true,
    },
    isVeg: {
      type: Boolean,
      default: true,
      index: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
      index: true,
    },
    preparationTimeMinutes: {
      type: Number,
      default: 15,
      min: [1, 'Preparation time must be at least 1 minute'],
      max: [120, 'Preparation time cannot exceed 120 minutes'],
    },
    imageUrl: {
      type: String,
      default: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80',
    },
    calories: {
      type: Number,
    },
    allergens: [
      {
        type: String,
        trim: true,
      },
    ],
    discountPercent: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
      max: [90, 'Discount cannot exceed 90%'],
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

// Compound indexes for fast menu queries
menuItemSchema.index({ canteenId: 1, isAvailable: 1 });
menuItemSchema.index({ canteenId: 1, category: 1 });
menuItemSchema.index({ name: 'text', description: 'text' });

export const MenuItem = mongoose.model<IMenuItem>('MenuItem', menuItemSchema);
