import { Types } from 'mongoose';

export interface ICartItemInput {
  menuItemId: string;
  quantity: number;
  customizationNotes?: string;
}

export interface ICartItemDetailed {
  menuItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  imageUrl?: string;
  isVeg: boolean;
  isAvailable: boolean;
  customizationNotes?: string;
}

export interface ICartSummary {
  canteenId: string | null;
  canteenName: string | null;
  items: ICartItemDetailed[];
  itemsCount: number;
  itemsTotal: number;
  taxAmount: number;
  packagingFee: number;
  deliveryFee: number;
  totalAmount: number;
}
