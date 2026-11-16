import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.js';
import { SessionService } from '../session/session.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { ApiError } from '../../utils/apiError.js';
import { env } from '../../config/env.js';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? ('strict' as const) : ('lax' as const),
  path: '/',
};

const extractClientMeta = (req: Request) => ({
  userAgent: req.headers['user-agent'] || '',
  ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '0.0.0.0',
});

export class AuthController {
  static async registerCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const meta = extractClientMeta(req);
      const result = await AuthService.registerCustomer(req.body, meta);

      // Attach refresh token cookie for web clients
      res.cookie('refreshToken', result.tokens.refreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: env.JWT_REFRESH_EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
      });

      ApiResponse.created(res, 'Customer account successfully registered', result);
    } catch (error) {
      next(error);
    }
  }

  static async registerCanteenOwner(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const meta = extractClientMeta(req);
      const result = await AuthService.registerCanteenOwner(req.body, meta);

      res.cookie('refreshToken', result.tokens.refreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: env.JWT_REFRESH_EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
      });

      ApiResponse.created(res, 'Canteen and owner account successfully registered', result);
    } catch (error) {
      next(error);
    }
  }

  static async registerDeliveryPartner(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const meta = extractClientMeta(req);
      const result = await AuthService.registerDeliveryPartner(req.body, meta);

      res.cookie('refreshToken', result.tokens.refreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: env.JWT_REFRESH_EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
      });

      ApiResponse.created(res, 'Delivery partner account registered successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async registerCanteenStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Must be scoped to the authenticated owner's canteen
      const canteenId = req.user?.canteenId;
      if (!canteenId) {
        throw ApiError.forbidden('Only canteen owners with a registered canteen can onboard staff');
      }

      const result = await AuthService.registerCanteenStaff(canteenId, req.body);
      ApiResponse.created(res, 'Canteen staff member registered successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const meta = extractClientMeta(req);
      const result = await AuthService.login(req.body, meta);

      res.cookie('refreshToken', result.tokens.refreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: env.JWT_REFRESH_EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
      });

      ApiResponse.success(res, 'Signed in successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Refresh token can come from Authorization header, body, or HttpOnly cookie
      const refreshToken =
        (req.body.refreshToken || req.cookies?.refreshToken || req.headers['x-refresh-token']) as string | undefined;

      if (!refreshToken) {
        throw ApiError.unauthorized('Refresh token is required', 'REFRESH_TOKEN_REQUIRED');
      }

      const meta = extractClientMeta(req);
      const result = await AuthService.refresh(refreshToken, meta);

      res.cookie('refreshToken', result.refreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: env.JWT_REFRESH_EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
      });

      ApiResponse.success(res, 'Token refreshed successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.sessionId) {
        await AuthService.logout(req.user.sessionId);
      }

      res.clearCookie('refreshToken', COOKIE_OPTIONS);
      ApiResponse.success(res, 'Logged out successfully from this device');
    } catch (error) {
      next(error);
    }
  }

  static async logoutAllDevices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      await AuthService.logoutAllDevices(req.user.userId, req.user.sessionId);
      res.clearCookie('refreshToken', COOKIE_OPTIONS);

      ApiResponse.success(res, 'All other device sessions have been revoked successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const user = await AuthService.getProfile(req.user.userId);
      ApiResponse.success(res, 'User profile fetched successfully', {
        user,
        permissions: req.user.permissions,
        canteenId: req.user.canteenId,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const sessions = await SessionService.getUserActiveSessions(req.user.userId, req.user.sessionId);
      ApiResponse.success(res, 'Active sessions retrieved', { sessions });
    } catch (error) {
      next(error);
    }
  }

  static async revokeSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessionId = req.params.sessionId as string;
      await SessionService.revokeSession(sessionId, 'Revoked by user from device dashboard');
      ApiResponse.success(res, 'Session terminated successfully');
    } catch (error) {
      next(error);
    }
  }
}
