import { Document, Types } from 'mongoose';
import { IGeoPoint } from '../canteens/canteen.interface.js';

export interface IBreadcrumb {
  location: IGeoPoint;
  speedKmh?: number;
  headingDegrees?: number;
  accuracyMeters?: number;
  timestamp: Date;
}

export interface IDeliveryTracking extends Document {
  _id: Types.ObjectId;
  orderId: Types.ObjectId;
  partnerId: Types.ObjectId;
  canteenId: Types.ObjectId;
  currentLocation: IGeoPoint;
  lastUpdated: Date;
  estimatedArrivalMinutes: number;
  distanceRemainingMeters: number;
  breadcrumbs: IBreadcrumb[];
  isCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
