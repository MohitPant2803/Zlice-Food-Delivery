import mongoose, { Types } from 'mongoose';
import { User } from '../users/user.model.js';
import { Canteen } from '../canteens/canteen.model.js';
import { SessionService } from '../session/session.service.js';
import { TokenService } from './token.service.js';
import { UserRole } from '../../constants/roles.js';
import { ApiError } from '../../utils/apiError.js';
import { logger } from '../../utils/logger.js';

export interface IClientMeta {
  userAgent?: string;
  ipAddress?: string;
}

export class AuthService {
  /**
   * Register a new Customer.
   */
  static async registerCustomer(dto: {
    name: string;
    email: string;
    phone: string;
    password: string;
    campusBlock?: string;
    roomNumber?: string;
    defaultDeliveryInstructions?: string;
  }, meta: IClientMeta) {
    const existing = await User.findOne({
      $or: [{ email: dto.email }, { phone: dto.phone }],
    });

    if (existing) {
      throw ApiError.conflict('An account with this email or phone number already exists.');
    }

    const user = await User.create({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      password: dto.password,
      role: UserRole.CUSTOMER,
      campusBlock: dto.campusBlock,
      roomNumber: dto.roomNumber,
      defaultDeliveryInstructions: dto.defaultDeliveryInstructions,
      lastLoginAt: new Date(),
    });

    const { session, refreshToken } = await SessionService.createSession({
      userId: user._id,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });

    const accessToken = TokenService.generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      sessionId: session._id.toString(),
    });

    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        campusBlock: user.campusBlock,
        roomNumber: user.roomNumber,
      },
      tokens: { accessToken, refreshToken },
    };
  }

  /**
   * Register a Canteen Owner and their Canteen atomically.
   */
  static async registerCanteenOwner(dto: {
    name: string;
    email: string;
    phone: string;
    password: string;
    canteenName: string;
    campusZone: string;
    contactPhone: string;
    description?: string;
    longitude: number;
    latitude: number;
  }, meta: IClientMeta) {
    const existing = await User.findOne({
      $or: [{ email: dto.email }, { phone: dto.phone }],
    });
    if (existing) {
      throw ApiError.conflict('An account with this email or phone number already exists.');
    }

    // Atomic creation: Canteen + Owner
    const mongoSession = await mongoose.startSession();
    let createdUser: any;
    let createdCanteen: any;

    try {
      await mongoSession.withTransaction(async () => {
        const canteenId = new Types.ObjectId();
        const userId = new Types.ObjectId();

        const [canteen] = await Canteen.create(
          [
            {
              _id: canteenId,
              name: dto.canteenName,
              campusZone: dto.campusZone,
              description: dto.description,
              contactPhone: dto.contactPhone,
              ownerId: userId,
              location: {
                type: 'Point',
                coordinates: [dto.longitude, dto.latitude],
              },
              isOpen: true,
            },
          ],
          { session: mongoSession }
        );

        const [user] = await User.create(
          [
            {
              _id: userId,
              name: dto.name,
              email: dto.email,
              phone: dto.phone,
              password: dto.password,
              role: UserRole.CANTEEN_OWNER,
              canteenId: canteen._id,
              lastLoginAt: new Date(),
            },
          ],
          { session: mongoSession }
        );

        createdUser = user;
        createdCanteen = canteen;
      });
    } finally {
      await mongoSession.endSession();
    }

    const { session, refreshToken } = await SessionService.createSession({
      userId: createdUser._id,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });

    const accessToken = TokenService.generateAccessToken({
      userId: createdUser._id.toString(),
      email: createdUser.email,
      role: createdUser.role,
      canteenId: createdCanteen._id.toString(),
      sessionId: session._id.toString(),
    });

    return {
      user: {
        id: createdUser._id.toString(),
        name: createdUser.name,
        email: createdUser.email,
        phone: createdUser.phone,
        role: createdUser.role,
        canteenId: createdCanteen._id.toString(),
      },
      canteen: {
        id: createdCanteen._id.toString(),
        name: createdCanteen.name,
        campusZone: createdCanteen.campusZone,
        location: createdCanteen.location,
      },
      tokens: { accessToken, refreshToken },
    };
  }

  /**
   * Onboard Canteen Staff.
   * Can ONLY be invoked by the verified Canteen Owner for their specific Canteen.
   */
  static async registerCanteenStaff(
    ownerCanteenId: string,
    dto: {
      name: string;
      email: string;
      phone: string;
      password: string;
    }
  ) {
    const existing = await User.findOne({
      $or: [{ email: dto.email }, { phone: dto.phone }],
    });
    if (existing) {
      throw ApiError.conflict('An account with this email or phone number already exists.');
    }

    const canteen = await Canteen.findById(ownerCanteenId);
    if (!canteen) {
      throw ApiError.notFound('Associated canteen not found');
    }

    const staffUser = await User.create({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      password: dto.password,
      role: UserRole.CANTEEN_STAFF,
      canteenId: canteen._id,
    });

    // Link staff to Canteen document
    canteen.staffIds.push(staffUser._id);
    await canteen.save();

    logger.info(`Staff member ${staffUser.email} onboarded for Canteen [${canteen.name}]`);

    return {
      id: staffUser._id.toString(),
      name: staffUser.name,
      email: staffUser.email,
      phone: staffUser.phone,
      role: staffUser.role,
      canteenId: canteen._id.toString(),
    };
  }

  /**
   * Register a Delivery Partner.
   */
  static async registerDeliveryPartner(dto: {
    name: string;
    email: string;
    phone: string;
    password: string;
    vehicleType?: 'bicycle' | 'ebike' | 'scooter' | 'walking';
    vehicleNumber?: string;
  }, meta: IClientMeta) {
    const existing = await User.findOne({
      $or: [{ email: dto.email }, { phone: dto.phone }],
    });
    if (existing) {
      throw ApiError.conflict('An account with this email or phone number already exists.');
    }

    const user = await User.create({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      password: dto.password,
      role: UserRole.DELIVERY_PARTNER,
      vehicleType: dto.vehicleType || 'bicycle',
      vehicleNumber: dto.vehicleNumber,
      isOnline: false,
      lastLoginAt: new Date(),
    });

    const { session, refreshToken } = await SessionService.createSession({
      userId: user._id,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });

    const accessToken = TokenService.generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      sessionId: session._id.toString(),
    });

    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        vehicleType: user.vehicleType,
      },
      tokens: { accessToken, refreshToken },
    };
  }

  /**
   * Unified Login handler for all roles (Customer, Owner, Staff, Delivery, Admin).
   */
  static async login(credentials: { email: string; password: string }, meta: IClientMeta) {
    const user = await User.findOne({ email: credentials.email }).select('+password');

    if (!user) {
      throw ApiError.unauthorized('Invalid email or password credentials', 'INVALID_CREDENTIALS');
    }

    const isMatch = await user.comparePassword(credentials.password);
    if (!isMatch) {
      throw ApiError.unauthorized('Invalid email or password credentials', 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      throw ApiError.forbidden('Your account has been deactivated. Please contact support.', 'ACCOUNT_DISABLED');
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Create tracking session
    const { session, refreshToken } = await SessionService.createSession({
      userId: user._id,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });

    const accessToken = TokenService.generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      canteenId: user.canteenId?.toString(),
      sessionId: session._id.toString(),
    });

    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        canteenId: user.canteenId?.toString(),
        avatar: user.avatar,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
      sessionId: session._id.toString(),
    };
  }

  /**
   * Refreshes access token with rotation.
   */
  static async refresh(refreshToken: string, meta: IClientMeta) {
    return SessionService.rotateRefreshToken(refreshToken, meta.userAgent, meta.ipAddress);
  }

  /**
   * Terminate current session (Logout).
   */
  static async logout(sessionId: string) {
    await SessionService.revokeSession(sessionId, 'User initiated logout');
  }

  /**
   * Terminate all active sessions (Logout everywhere).
   */
  static async logoutAllDevices(userId: string, currentSessionId?: string) {
    await SessionService.revokeAllUserSessions(userId, currentSessionId);
  }

  /**
   * Get authenticated user profile.
   */
  static async getProfile(userId: string) {
    const user = await User.findById(userId).populate('canteenId');
    if (!user) {
      throw ApiError.notFound('User profile not found');
    }
    return user;
  }
}
