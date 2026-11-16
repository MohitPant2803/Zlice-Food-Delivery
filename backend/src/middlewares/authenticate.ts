import { Request, Response, NextFunction } from 'express';
import { TokenService } from '../modules/auth/token.service.js';
import { ApiError } from '../utils/apiError.js';

export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    let token: string | undefined;

    // 1. Extract from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
      // 2. Extract from signed/HttpOnly cookie (for web clients)
      token = req.cookies.accessToken;
    }

    if (!token) {
      throw ApiError.unauthorized('Authentication credentials were not provided', 'AUTH_REQUIRED');
    }

    // 3. Verify token cryptographic integrity
    const payload = TokenService.verifyAccessToken(token);

    // 4. Check Redis revocation cache (fast path, O(1))
    const isRevoked = await TokenService.isSessionRevoked(payload.sessionId);
    if (isRevoked) {
      throw ApiError.unauthorized('Your session has expired or was revoked. Please log in again.', 'SESSION_REVOKED');
    }

    // 5. Populate user and tenant context onto Express Request
    req.user = payload;
    if (payload.canteenId) {
      req.canteenId = payload.canteenId;
    }
    req.token = token;

    next();
  } catch (error) {
    next(error);
  }
};
