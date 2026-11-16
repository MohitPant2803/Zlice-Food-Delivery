import { UserRole } from '../constants/roles.js';
import { Permission } from '../constants/permissions.js';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
  canteenId?: string;
  permissions: Permission[];
  sessionId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      canteenId?: string;
      token?: string;
    }
  }
}

export {};
