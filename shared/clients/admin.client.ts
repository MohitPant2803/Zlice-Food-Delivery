/**
 * Platform Admin Web Portal (React) - Client Integration Architecture
 * 
 * Demonstrates:
 * 1. Cross-canteen audit logging & system health
 * 2. Unrestricted order oversight
 * 3. Manual dispatch intervention & timeout sweep triggers
 */

import { IApiSuccessEnvelope } from '../contracts/common.contracts.js';

export class AdminApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * System-wide Health Check.
   */
  async getSystemHealth(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/health`);
    const payload: IApiSuccessEnvelope<any> = await response.json();
    return payload.data;
  }

  /**
   * Trigger Manual Timeout Sweep (Sweeps stuck offers and triggers reassignment).
   */
  async triggerTimeoutSweep(): Promise<{ processed: number }> {
    const response = await fetch(`${this.baseUrl}/api/v1/delivery/timeouts/sweep`, {
      method: 'POST',
      credentials: 'include',
    });

    const payload: IApiSuccessEnvelope<{ processed: number }> = await response.json();
    return payload.data;
  }

  /**
   * Manually trigger partner dispatch for an order.
   */
  async forceDispatch(orderId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/v1/delivery/orders/${orderId}/dispatch`, {
      method: 'POST',
      credentials: 'include',
    });

    const payload: IApiSuccessEnvelope<any> = await response.json();
    return payload.data;
  }
}
