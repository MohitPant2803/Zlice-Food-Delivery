import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../../config/env.js';
import { UserRole } from '../../constants/roles.js';
import { Permission, ROLE_PERMISSIONS } from '../../constants/permissions.js';
import { ApiError } from '../../utils/apiError.js';
import { cache } from '../../config/redis.js';

export interface IAccessTokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  canteenId?: string;
  permissions: Permission[];
  sessionId: string;
}

export interface IRefreshTokenPayload {
  userId: string;
  sessionId: string;
  family: string;
  tokenVersion: number;
}

export class TokenService {
  /**
   * Hashes a raw token using SHA-256 before persisting in DB.
   * Defends against DB leaks where plain refresh tokens could be compromised.
   */
  static hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Generates a short-lived Access Token (default 15 minutes).
   */
  static generateAccessToken(params: {
    userId: string;
    email: string;
    role: UserRole;
    canteenId?: string;
    sessionId: string;
  }): string {
    const permissions = ROLE_PERMISSIONS[params.role] || [];

    const payload: IAccessTokenPayload = {
      userId: params.userId,
      email: params.email,
      role: params.role,
      canteenId: params.canteenId,
      permissions,
      sessionId: params.sessionId,
    };

    return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRATION as any,
      audience: 'zlice-client',
      issuer: 'zlice-auth-service',
    });
  }

  /**
   * Generates a cryptographically strong Refresh Token.
   */
  static generateRefreshToken(params: {
    userId: string;
    sessionId: string;
    family: string;
    tokenVersion?: number;
  }): { token: string; family: string; expiresAt: Date } {
    const tokenVersion = params.tokenVersion || 1;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + env.JWT_REFRESH_EXPIRATION_DAYS);

    const payload: IRefreshTokenPayload = {
      userId: params.userId,
      sessionId: params.sessionId,
      family: params.family,
      tokenVersion,
    };

    const token = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: `${env.JWT_REFRESH_EXPIRATION_DAYS}d` as any,
      audience: 'zlice-client',
      issuer: 'zlice-auth-service',
    });

    return { token, family: params.family, expiresAt };
  }

  /**
   * Verifies an access token.
   */
  static verifyAccessToken(token: string): IAccessTokenPayload {
    try {
      return jwt.verify(token, env.JWT_ACCESS_SECRET, {
        audience: 'zlice-client',
        issuer: 'zlice-auth-service',
      }) as IAccessTokenPayload;
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw ApiError.unauthorized('Access token has expired', 'TOKEN_EXPIRED');
      }
      throw ApiError.unauthorized('Invalid access token', 'TOKEN_INVALID');
    }
  }

  /**
   * Verifies a refresh token.
   */
  static verifyRefreshToken(token: string): IRefreshTokenPayload {
    try {
      return jwt.verify(token, env.JWT_REFRESH_SECRET, {
        audience: 'zlice-client',
        issuer: 'zlice-auth-service',
      }) as IRefreshTokenPayload;
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw ApiError.unauthorized('Refresh token has expired', 'REFRESH_TOKEN_EXPIRED');
      }
      throw ApiError.unauthorized('Invalid refresh token', 'REFRESH_TOKEN_INVALID');
    }
  }

  /**
   * Fast Redis cache check to verify if a session or token has been revoked.
   */
  static async isSessionRevoked(sessionId: string): Promise<boolean> {
    const revoked = await cache.get(`session:revoked:${sessionId}`);
    return revoked === 'true';
  }

  /**
   * Fast Redis mark to blacklist a session immediately across all API nodes.
   */
  static async markSessionRevoked(sessionId: string, ttlSeconds = 60 * 60 * 24 * 7): Promise<void> {
    await cache.setex(`session:revoked:${sessionId}`, ttlSeconds, 'true');
  }
}
