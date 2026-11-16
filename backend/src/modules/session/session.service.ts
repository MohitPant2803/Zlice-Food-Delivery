import { Types } from 'mongoose';
import crypto from 'crypto';
import { UAParser } from 'ua-parser-js';
import { Session } from './session.model.js';
import { IDeviceInfo, ISession } from './session.interface.js';
import { TokenService } from '../auth/token.service.js';
import { ApiError } from '../../utils/apiError.js';
import { logger } from '../../utils/logger.js';
import { User } from '../users/user.model.js';

export interface ICreateSessionParams {
  userId: Types.ObjectId;
  userAgent?: string;
  ipAddress?: string;
}

export class SessionService {
  /**
   * Parse user agent string to extract human-readable device metadata.
   */
  static parseDeviceInfo(userAgent = '', ip = '0.0.0.0'): IDeviceInfo {
    const parser = new UAParser(userAgent);
    const browser = parser.getBrowser();
    const os = parser.getOS();
    const device = parser.getDevice();

    return {
      browser: browser.name ? `${browser.name} ${browser.version || ''}`.trim() : 'Browser',
      os: os.name ? `${os.name} ${os.version || ''}`.trim() : 'OS',
      device: device.type || (device.vendor ? `${device.vendor} ${device.model || ''}`.trim() : 'Desktop/Laptop'),
      ip,
    };
  }

  /**
   * Creates a new session on user login.
   */
  static async createSession(params: ICreateSessionParams) {
    const sessionId = new Types.ObjectId();
    const family = crypto.randomUUID();
    const deviceInfo = this.parseDeviceInfo(params.userAgent, params.ipAddress);

    const { token: refreshToken, expiresAt } = TokenService.generateRefreshToken({
      userId: params.userId.toString(),
      sessionId: sessionId.toString(),
      family,
      tokenVersion: 1,
    });

    const refreshTokenHash = TokenService.hashToken(refreshToken);

    const session = await Session.create({
      _id: sessionId,
      userId: params.userId,
      refreshTokenHash,
      family,
      deviceInfo,
      userAgent: params.userAgent || '',
      expiresAt,
      lastActiveAt: new Date(),
    });

    return { session, refreshToken };
  }

  /**
   * Rotates a refresh token with strict reuse/replay attack detection (RFC 6819).
   */
  static async rotateRefreshToken(incomingRefreshToken: string, userAgent?: string, ip?: string) {
    // 1. Verify cryptographic signature & get payload
    const payload = TokenService.verifyRefreshToken(incomingRefreshToken);
    const { userId, sessionId, family, tokenVersion } = payload;

    // 2. Fast Redis check for revoked session
    const isRevokedInCache = await TokenService.isSessionRevoked(sessionId);
    if (isRevokedInCache) {
      throw ApiError.unauthorized('Session has been revoked. Please sign in again.', 'SESSION_REVOKED');
    }

    // 3. Find session in DB
    const session = await Session.findById(sessionId);

    // If session doesn't exist or is already marked revoked:
    // This is an indicator of token reuse after compromise or replay attack!
    if (!session || session.isRevoked) {
      logger.warn(`🚨 SECURITY BREACH DETECTED: Token reuse attempt on revoked session [${sessionId}], family [${family}]`);
      
      // Revoke all sessions belonging to this family immediately!
      await this.revokeFamily(family, 'Security incident: Attempted reuse of revoked token');
      throw ApiError.unauthorized('Security incident detected: Compromised token lineage revoked.', 'TOKEN_REUSE_DETECTED');
    }

    // 4. Verify token hash against currently stored hash
    const incomingTokenHash = TokenService.hashToken(incomingRefreshToken);
    if (session.refreshTokenHash !== incomingTokenHash) {
      // Replay attack: An older refresh token from this active session is being used again!
      logger.warn(`🚨 REPLAY ATTACK DETECTED: Token mismatch for session [${sessionId}]. Attacker may have stolen an older token!`);

      // Invalidate the entire session family immediately!
      await this.revokeSession(session._id.toString(), 'Security breach: Stale refresh token reuse detected');
      await this.revokeFamily(family, 'Security breach: Family invalidated due to replay attempt');

      throw ApiError.unauthorized('Security violation: Replay token detected. Session terminated.', 'REPLAY_ATTACK_DETECTED');
    }

    // 5. Look up user to ensure still active and fetch latest role/tenant info
    const user = await User.findById(userId);
    if (!user || !user.isActive) {
      await this.revokeSession(session._id.toString(), 'User inactive or deleted');
      throw ApiError.unauthorized('User account is inactive or disabled', 'USER_INACTIVE');
    }

    // 6. Generate new Refresh Token (incrementing version, keeping same family)
    const { token: newRefreshToken, expiresAt: newExpiresAt } = TokenService.generateRefreshToken({
      userId: user._id.toString(),
      sessionId: session._id.toString(),
      family: session.family,
      tokenVersion: tokenVersion + 1,
    });

    // 7. Generate new Access Token
    const newAccessToken = TokenService.generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      canteenId: user.canteenId?.toString(),
      sessionId: session._id.toString(),
    });

    // 8. Atomically update session with new refresh token hash and activity
    session.refreshTokenHash = TokenService.hashToken(newRefreshToken);
    session.expiresAt = newExpiresAt;
    session.lastActiveAt = new Date();
    if (userAgent || ip) {
      session.deviceInfo = this.parseDeviceInfo(userAgent, ip);
    }
    await session.save();

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        canteenId: user.canteenId?.toString(),
      },
    };
  }

  /**
   * Revokes a specific session (single device logout).
   */
  static async revokeSession(sessionId: string, reason = 'User requested logout'): Promise<void> {
    await Session.findByIdAndUpdate(sessionId, {
      isRevoked: true,
      revokedReason: reason,
    });
    await TokenService.markSessionRevoked(sessionId);
  }

  /**
   * Revokes all sessions in a family (used during breach mitigation).
   */
  static async revokeFamily(family: string, reason: string): Promise<void> {
    const sessions = await Session.find({ family, isRevoked: false });
    for (const s of sessions) {
      await TokenService.markSessionRevoked(s._id.toString());
    }
    await Session.updateMany({ family }, { isRevoked: true, revokedReason: reason });
  }

  /**
   * Revokes all active sessions for a user (logout all other devices).
   */
  static async revokeAllUserSessions(userId: Types.ObjectId | string, currentSessionIdToKeep?: string): Promise<void> {
    const query: any = { userId, isRevoked: false };
    if (currentSessionIdToKeep) {
      query._id = { $ne: currentSessionIdToKeep };
    }

    const sessions = await Session.find(query);
    for (const s of sessions) {
      await TokenService.markSessionRevoked(s._id.toString());
    }

    await Session.updateMany(query, {
      isRevoked: true,
      revokedReason: 'User initiated remote logout on all devices',
    });
  }

  /**
   * Retrieves all active sessions for a user (for device management settings).
   */
  static async getUserActiveSessions(userId: Types.ObjectId | string, currentSessionId?: string) {
    const sessions = await Session.find({
      userId,
      isRevoked: false,
      expiresAt: { $gt: new Date() },
    })
      .sort({ lastActiveAt: -1 })
      .lean();

    return sessions.map((s) => ({
      sessionId: s._id.toString(),
      deviceInfo: s.deviceInfo,
      lastActiveAt: s.lastActiveAt,
      createdAt: s.createdAt,
      isCurrent: currentSessionId ? s._id.toString() === currentSessionId : false,
    }));
  }
}
