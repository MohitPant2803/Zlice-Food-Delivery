/**
 * Delivery Partner Mobile App (React Native) - Client Integration Architecture
 * 
 * Demonstrates:
 * 1. Background GPS coordinate streaming with battery conservation
 * 2. 30-Second Offer Modal state management
 * 3. Pickup milestone transition
 * 4. Drop-off completion via 6-digit cryptographic OTP handshake
 */

import { ISharedDeliveryOffer, ISharedOrderDetail } from '../contracts/domain.contracts.js';
import { IApiSuccessEnvelope } from '../contracts/common.contracts.js';
import { IMobileSecureStorage } from './customer.client.js';

export class DeliveryApiClient {
  private baseUrl: string;
  private secureStorage: IMobileSecureStorage;

  constructor(baseUrl: string, secureStorage: IMobileSecureStorage) {
    this.baseUrl = baseUrl;
    this.secureStorage = secureStorage;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.secureStorage.getItemAsync('zlice_partner_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  /**
   * Toggle Online / Offline driver readiness.
   */
  async setOnlineStatus(isOnline: boolean): Promise<boolean> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/api/v1/delivery/status/online`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ isOnline }),
    });

    const payload: IApiSuccessEnvelope<{ isOnline: boolean }> = await response.json();
    return payload.data.isOnline;
  }

  /**
   * Accept an incoming 30-second delivery offer.
   */
  async acceptOffer(assignmentId: string): Promise<{ order: ISharedOrderDetail }> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/api/v1/delivery/offers/${assignmentId}/accept`, {
      method: 'POST',
      headers,
    });

    const payload: IApiSuccessEnvelope<{ order: ISharedOrderDetail }> = await response.json();
    return payload.data;
  }

  /**
   * Reject an offer (releases lock & triggers immediate re-dispatch).
   */
  async rejectOffer(assignmentId: string, reason?: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    await fetch(`${this.baseUrl}/api/v1/delivery/offers/${assignmentId}/reject`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason }),
    });
  }

  /**
   * Mark food picked up from canteen kitchen.
   */
  async markPickedUp(orderId: string): Promise<ISharedOrderDetail> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/api/v1/delivery/orders/${orderId}/pickup`, {
      method: 'PATCH',
      headers,
    });

    const payload: IApiSuccessEnvelope<{ order: ISharedOrderDetail }> = await response.json();
    return payload.data.order;
  }

  /**
   * Complete delivery with 6-digit OTP verification code received from customer.
   */
  async completeDelivery(orderId: string, deliveryOtp: string): Promise<ISharedOrderDetail> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/api/v1/delivery/orders/${orderId}/deliver`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ deliveryOtp }),
    });

    const payload: IApiSuccessEnvelope<{ order: ISharedOrderDetail }> = await response.json();
    return payload.data.order;
  }
}
