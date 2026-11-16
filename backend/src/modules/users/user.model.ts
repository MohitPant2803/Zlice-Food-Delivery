import mongoose, { Schema } from 'mongoose';
import { IUser } from './user.interface.js';
import { UserRole } from '../../constants/roles.js';
import { PasswordUtil } from '../../utils/password.js';

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
      index: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Security: Never return password in queries by default
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.CUSTOMER,
      index: true,
    },
    avatar: {
      type: String,
      default: 'https://api.dicebear.com/7.x/bottts/svg?seed=zlice',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isVerified: {
      type: Boolean,
      default: true, // Auto-verified for campus MVP
    },
    lastLoginAt: {
      type: Date,
    },

    // Canteen Multi-Tenant Association
    canteenId: {
      type: Schema.Types.ObjectId,
      ref: 'Canteen',
      index: true,
      required: function (this: IUser) {
        return this.role === UserRole.CANTEEN_STAFF;
      },
    },

    // Customer-specific details
    campusBlock: {
      type: String,
      trim: true,
    },
    roomNumber: {
      type: String,
      trim: true,
    },
    defaultDeliveryInstructions: {
      type: String,
      trim: true,
    },

    // Delivery Partner specific details
    vehicleType: {
      type: String,
      enum: ['bicycle', 'ebike', 'scooter', 'walking'],
      default: 'bicycle',
    },
    vehicleNumber: {
      type: String,
      trim: true,
    },
    isOnline: {
      type: Boolean,
      default: false,
      index: true,
    },
    currentLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
    },
    totalDeliveries: {
      type: Number,
      default: 0,
    },
    averageRating: {
      type: Number,
      default: 5.0,
      min: 1,
      max: 5,
    },
    activeOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },
    activeAssignmentId: {
      type: Schema.Types.ObjectId,
      ref: 'DeliveryAssignment',
      default: null,
      index: true,
    },
    reservedUntil: {
      type: Date,
      default: null,
    },
    acceptanceRate: {
      type: Number,
      default: 100.0,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret: any) => {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
userSchema.index({ 'currentLocation': '2dsphere' });
userSchema.index({ role: 1, isOnline: 1, activeOrderId: 1, activeAssignmentId: 1 });
userSchema.index({ canteenId: 1, role: 1 });

// Password hashing pre-save hook
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  try {
    this.password = await PasswordUtil.hash(this.password);
    next();
  } catch (err: any) {
    next(err);
  }
});

// Instance method for password verification
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  if (!this.password) return false;
  return PasswordUtil.compare(candidatePassword, this.password);
};

export const User = mongoose.model<IUser>('User', userSchema);
