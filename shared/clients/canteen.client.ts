/**
 * Canteen Web Dashboard (React) - Client Integration Architecture
 * 
 * Demonstrates:
 * 1. Web cookie-based credential handling (credentials: 'include')
 * 2. Multi-tenant kitchen ticket stream & status advancement
 * 3. Menu item availability toggling (Sold out / In stock)
 * 4. Daily aggregation analytics metrics
 */

import { SharedOrderStatus, ISharedOrderDetail } from '../contracts/domain.contracts.js';
import { IApiSuccessEnvelope } from '../contracts/common.contracts.js';

export class CanteenApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Fetch live incoming orders for this authorized canteen.
   */
  async getLiveOrders(canteenId: string, status?: SharedOrderStatus): Promise<ISharedOrderDetail[]> {
    const url = new URL(`${this.baseUrl}/api/v1/orders/canteen/${canteenId}`);
    if (status) url.searchParams.append('status', status);

    const response = await fetch(url.toString(), {
      credentials: 'include', // Automatically passes HttpOnly auth cookie on web
      headers: { 'Content-Type': 'application/json' },
    });

    const payload: IApiSuccessEnvelope<{ orders: ISharedOrderDetail[] }> = await response.json();
    return payload.data.orders;
  }

  /**
   * Advance order status through kitchen lifecycle (e.g. ACCEPTED -> PREPARING -> READY_FOR_PICKUP).
   */
  async advanceOrderStatus(
    canteenId: string,
    orderId: string,
    newStatus: SharedOrderStatus,
    notes?: string
  ): Promise<ISharedOrderDetail> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/orders/canteen/${canteenId}/${orderId}/status`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, notes }),
      }
    );

    const payload: IApiSuccessEnvelope<{ order: ISharedOrderDetail }> = await response.json();
    return payload.data.order;
  }

  /**
   * Toggle food item availability instantly.
   */
  async toggleItemAvailability(canteenId: string, itemId: string, isAvailable: boolean): Promise<void> {
    await fetch(`${this.baseUrl}/api/v1/menu/canteens/${canteenId}/items/${itemId}/availability`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAvailable }),
    });
  }

  /**
   * Retrieve MongoDB Aggregation metrics (Revenue, top-selling items, cancellation rate).
   */
  async getAnalytics(canteenId: string, days = 7) {
    const response = await fetch(
      `${this.baseUrl}/api/v1/orders/canteen/${canteenId}/metrics?days=${days}`,
      {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const payload: IApiSuccessEnvelope<{ metrics: any }> = await response.json();
    return payload.data.metrics;
  }
}
