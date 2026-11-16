import mongoose, { Schema } from 'mongoose';
import { ISession } from './session.interface.js';

const sessionSchema = new Schema<ISession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    refreshTokenHash: {
      type: String,
      required: true,
      index: true,
    },
    family: {
      type: String,
      required: true,
      index: true,
    },
    deviceInfo: {
      browser: { type: String, default: 'Unknown' },
      os: { type: String, default: 'Unknown' },
      device: { type: String, default: 'Desktop/Mobile' },
      ip: { type: String, default: '0.0.0.0' },
    },
    userAgent: {
      type: String,
      default: '',
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    revokedReason: {
      type: String,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB TTL index to automatically purge expired sessions
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

sessionSchema.index({ userId: 1, isRevoked: 1 });
sessionSchema.index({ family: 1, isRevoked: 1 });

export const Session = mongoose.model<ISession>('Session', sessionSchema);
