import { Document, Types } from 'mongoose';

export enum MenuCategory {
  SNACKS = 'snacks',
  MEALS = 'meals',
  BEVERAGES = 'beverages',
  DESSERTS = 'desserts',
  COMBOS = 'combos',
}

export interface IMenuItem extends Document {
  _id: Types.ObjectId;
  canteenId: Types.ObjectId;
  name: string;
  description?: string;
  price: number; // in currency units (e.g. INR/USD)
  category: MenuCategory;
  isVeg: boolean;
  isAvailable: boolean;
  preparationTimeMinutes: number;
  imageUrl?: string;
  calories?: number;
  allergens?: string[];
  discountPercent?: number;
  createdAt: Date;
  updatedAt: Date;
}
