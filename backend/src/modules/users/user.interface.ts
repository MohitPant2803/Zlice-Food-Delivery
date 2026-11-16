import { Document, Types } from 'mongoose';
import { UserRole } from '../../constants/roles.js';
import { IGeoPoint } from '../canteens/canteen.interface.js';

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  password?: string;
  role: UserRole;
  avatar?: string;
  isActive: boolean;
  isVerified: boolean;
  lastLoginAt?: Date;

  // Multi-tenant canteen linkage (for Canteen Owners & Staff)
  canteenId?: Types.ObjectId;

  // Customer specific attributes
  campusBlock?: string;
  roomNumber?: string;
  defaultDeliveryInstructions?: string;

  // Delivery Partner specific attributes
  vehicleType?: 'bicycle' | 'ebike' | 'scooter' | 'walking';
  vehicleNumber?: string;
  isOnline?: boolean;
  currentLocation?: IGeoPoint;
  totalDeliveries?: number;
  averageRating?: number;
  activeOrderId?: Types.ObjectId | null;
  activeAssignmentId?: Types.ObjectId | null;
  reservedUntil?: Date | null;
  acceptanceRate?: number;

  createdAt: Date;
  updatedAt: Date;

  comparePassword(candidatePassword: string): Promise<boolean>;
}
