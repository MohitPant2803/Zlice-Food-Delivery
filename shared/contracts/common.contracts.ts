/**
 * Zlice Platform - Unified Response Envelopes & Error Payloads
 * Shared across Customer Mobile App, Canteen Web, Delivery Partner App, and Admin Dashboard.
 */

export interface IApiSuccessEnvelope<T = any> {
  success: true;
  statusCode: number;
  message: string;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    timestamp?: string;
  };
}

export interface IApiErrorField {
  field: string;
  message: string;
}

export interface IApiErrorEnvelope {
  success: false;
  statusCode: number;
  errorCode: string;
  message: string;
  details?: IApiErrorField[];
  stack?: string;
}

export type ApiResponse<T> = IApiSuccessEnvelope<T> | IApiErrorEnvelope;

/**
 * Common User Profile & Auth Tokens
 */
export interface IUserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'customer' | 'canteen_owner' | 'canteen_staff' | 'delivery_partner' | 'admin';
  avatar?: string;
  canteenId?: string;
  campusBlock?: string;
  roomNumber?: string;
  vehicleType?: 'bicycle' | 'ebike' | 'scooter' | 'walking';
}

export interface IAuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export interface IAuthResponse {
  user: IUserProfile;
  tokens: IAuthTokens;
  sessionId: string;
}
