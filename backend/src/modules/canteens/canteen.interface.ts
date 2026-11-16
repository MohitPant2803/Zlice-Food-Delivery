import { Document, Types } from 'mongoose';

export interface IGeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface ICanteen extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  campusZone: string;
  location: IGeoPoint;
  ownerId: Types.ObjectId;
  staffIds: Types.ObjectId[];
  isOpen: boolean;
  contactPhone: string;
  rating: number;
  ratingCount: number;
  bannerImage?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
