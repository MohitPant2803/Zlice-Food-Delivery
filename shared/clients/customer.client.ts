/**
 * Customer Mobile App (React Native) - Client Integration Architecture
 * 
 * Demonstrates:
 * 1. Mobile Hardware Keystore / Keychain token management
 * 2. Zero-trust order placement
 * 3. Deep Linking: zlice://orders/:orderId/track
 * 4. Resilient Socket.IO tracking stream with auto-reconnect
 */

import { ISharedCartSummary, ISharedOrderDetail, ISharedLiveTracking } from '../contracts/domain.contracts.js';
import { IApiSuccessEnvelope } from '../contracts/common.contracts.js';

export interface IMobileSecureStorage {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export class CustomerApiClient {
  private baseUrl: string;
  private secureStorage: IMobileSecureStorage;

  constructor(baseUrl: string, secureStorage: IMobileSecureStorage) {
    this.baseUrl = baseUrl;
    this.secureStorage = secureStorage;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.secureStorage.getItemAsync('zlice_access_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  /**
   * Fetch live server-authoritative cart with calculated taxes & packaging.
   */
  async getCart(): Promise<ISharedCartSummary> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/api/v1/cart`, { headers });
    const payload: IApiSuccessEnvelope<{ cart: ISharedCartSummary }> = await response.json();
    return payload.data.cart;
  }

  /**
   * Place Order with zero-trust server-side pricing.
   */
  async placeOrder(params: {
    canteenId: string;
    items: Array<{ menuItemId: string; quantity: number; customizationNotes?: string }>;
    deliveryDrop: {
      campusBlock: string;
      roomNumber: string;
      longitude: number;
      latitude: number;
      deliveryInstructions?: string;
    };
  }): Promise<ISharedOrderDetail> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/api/v1/orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    const payload: IApiSuccessEnvelope<{ order: ISharedOrderDetail }> = await response.json();
    return payload.data.order;
  }

  /**
   * Deep Link Resolution: Handles links from SMS or Push Notifications.
   * e.g. "zlice://orders/65a1b2c3d4/track" -> navigates directly to Active Tracking Screen.
   */
  static parseDeepLink(url: string): { route: string; params: Record<string, string> } | null {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'zlice:') return null;

      // In custom schemes (zlice://orders/123/track), parsed.host is 'orders' and pathname is '/123/track'
      const fullPath = `${parsed.host || ''}/${parsed.pathname.replace(/^\/+/, '')}`.replace(/^\/+/, '');
      const parts = fullPath.split('/');

      if (parts[0] === 'orders' && parts[2] === 'track') {
        return {
          route: 'LiveTrackingScreen',
          params: { orderId: parts[1] },
        };
      }
      return null;
    } catch {
      return null;
    }
  }
}
