import { Document, Types } from 'mongoose';

export interface IDeviceInfo {
  browser?: string;
  os?: string;
  device?: string;
  ip?: string;
}

export interface ISession extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  refreshTokenHash: string;
  family: string; // Token family UUID to detect reuse / replay attacks
  deviceInfo: IDeviceInfo;
  userAgent: string;
  isRevoked: boolean;
  revokedReason?: string;
  expiresAt: Date;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
