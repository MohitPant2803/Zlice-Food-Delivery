import { Document, Types } from 'mongoose';
import { IGeoPoint } from '../canteens/canteen.interface.js';

export enum DeliveryAssignmentStatus {
  OFFERED = 'offered',       // Dispatched to partner, 30s countdown active
  ACCEPTED = 'accepted',     // Partner accepted offer
  REJECTED = 'rejected',     // Partner explicitly rejected offer
  TIMED_OUT = 'timed_out',   // 30s timer expired without response
  CANCELLED = 'cancelled',   // Order was cancelled before acceptance
}

export interface IDeliveryAssignment extends Document {
  _id: Types.ObjectId;
  orderId: Types.ObjectId;
  canteenId: Types.ObjectId;
  partnerId: Types.ObjectId;
  attemptNumber: number;
  rejectedPartnerIds: Types.ObjectId[];
  canteenLocation: IGeoPoint;
  dropLocation: IGeoPoint;
  distanceToCanteenMeters: number;
  status: DeliveryAssignmentStatus;
  offeredAt: Date;
  expiresAt: Date; // e.g. offeredAt + 30 seconds
  respondedAt?: Date;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}
