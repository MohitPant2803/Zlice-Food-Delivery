import { Types } from 'mongoose';
import { cache } from '../../config/redis.js';
import { Order } from '../orders/order.model.js';
import { DeliveryTracking } from './tracking.model.js';
import { DispatchService } from '../delivery/dispatch.service.js';
import { ApiError } from '../../utils/apiError.js';
import { logger } from '../../utils/logger.js';
import { UserRole } from '../../constants/roles.js';

export interface IGpsLocationPayload {
  orderId: string;
  partnerId: string;
  coordinates: [number, number]; // [lng, lat]
  speedKmh?: number;
  headingDegrees?: number;
  accuracyMeters?: number;
  timestamp?: number;
}

export interface ILiveTrackingState {
  orderId: string;
  orderNumber: string;
  status: string;
  partnerId: string;
  canteenId: string;
  currentLocation: [number, number];
  canteenLocation: [number, number];
  dropLocation: [number, number];
  distanceRemainingMeters: number;
  estimatedArrivalMinutes: number;
  speedKmh?: number;
  headingDegrees?: number;
  lastUpdated: string;
}

export class TrackingService {
  /**
   * Redis cache key for latest partner location on active order.
   */
  private static liveTrackingKey(orderId: string): string {
    return `tracking:live:${orderId}`;
  }

  private static lastDbWriteKey(orderId: string): string {
    return `tracking:last_db_write:${orderId}`;
  }

  /**
   * Calculate Estimated Time of Arrival (ETA) in minutes based on campus transit model.
   */
  static calculateEtaMinutes(distanceMeters: number, vehicleType = 'bicycle'): number {
    // Average speeds on campus
    // Bicycle/E-bike: ~15 km/h = 250 meters/minute
    // Walking: ~4.5 km/h = 75 meters/minute
    // Scooter: ~20 km/h = 333 meters/minute
    let metersPerMinute = 250;
    if (vehicleType === 'walking') metersPerMinute = 75;
    if (vehicleType === 'scooter') metersPerMinute = 330;

    const transitMinutes = distanceMeters / metersPerMinute;
    const buildingBufferMinutes = 3; // Time to park and walk up stairs/dorm hallway

    return Math.max(1, Math.round(transitMinutes + buildingBufferMinutes));
  }

  /**
   * Authorize tracking channel subscription.
   * Only Customer, Assigned Delivery Partner, Canteen Owner/Staff, and Admin can track!
   */
  static async verifyTrackingAccess(
    orderId: string,
    user: { userId: string; role: UserRole; canteenId?: string }
  ): Promise<boolean> {
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    const order = await Order.findById(orderId);
    if (!order) {
      throw ApiError.notFound('Order not found');
    }

    // 1. Customer who owns the order
    if (user.role === UserRole.CUSTOMER && order.customerId.toString() === user.userId) {
      return true;
    }

    // 2. Delivery Partner assigned to the order
    if (
      user.role === UserRole.DELIVERY_PARTNER &&
      order.deliveryPartnerId?.toString() === user.userId
    ) {
      return true;
    }

    // 3. Canteen operator for this order's canteen
    if (
      (user.role === UserRole.CANTEEN_OWNER || user.role === UserRole.CANTEEN_STAFF) &&
      user.canteenId &&
      order.canteenId.toString() === user.canteenId
    ) {
      return true;
    }

    throw ApiError.forbidden(
      'Unauthorized: You do not have permission to view live tracking for this order.',
      'UNAUTHORIZED_TRACKING_CHANNEL'
    );
  }

  /**
   * Ingest GPS coordinates, validate, cache in Redis, and throttle MongoDB persistent writes.
   */
  static async ingestLocation(payload: IGpsLocationPayload): Promise<ILiveTrackingState> {
    const { orderId, partnerId, coordinates, speedKmh, headingDegrees, accuracyMeters } = payload;

    // 1. Accuracy validation (reject GPS fixes with > 50m error margin)
    if (accuracyMeters && accuracyMeters > 50) {
      logger.warn(`⚠️ GPS update rejected for Order [${orderId}]: Accuracy too low (${accuracyMeters}m)`);
      throw ApiError.badRequest('Inaccurate GPS location fix rejected');
    }

    const order = await Order.findById(orderId);
    if (!order) {
      throw ApiError.notFound('Order not found');
    }

    if (order.deliveryPartnerId?.toString() !== partnerId) {
      throw ApiError.forbidden('You are not the assigned delivery partner for this order');
    }

    const dropCoords: [number, number] = order.deliveryDrop.location.coordinates;
    const distanceRemainingMeters = DispatchService.calculateDistanceMeters(coordinates, dropCoords);
    const estimatedArrivalMinutes = this.calculateEtaMinutes(distanceRemainingMeters);

    const liveState: ILiveTrackingState = {
      orderId,
      orderNumber: order.orderNumber,
      status: order.status,
      partnerId,
      canteenId: order.canteenId.toString(),
      currentLocation: coordinates,
      canteenLocation: [0, 0], // populated if needed
      dropLocation: dropCoords,
      distanceRemainingMeters,
      estimatedArrivalMinutes,
      speedKmh,
      headingDegrees,
      lastUpdated: new Date().toISOString(),
    };

    // 2. Hot-Path Write to Redis (Sub-millisecond access for WebSockets and API)
    await cache.setex(
      this.liveTrackingKey(orderId),
      600, // 10 minutes TTL
      JSON.stringify(liveState)
    );

    // 3. Throttled Cold-Path Persistent Write to MongoDB
    // Prevents database disk I/O bottlenecks and 2dsphere index churn
    await this.throttlePersistToDb(order, payload, distanceRemainingMeters, estimatedArrivalMinutes);

    return liveState;
  }

  /**
   * Throttles MongoDB disk writes:
   * Writes to database only if moved > 40m OR > 45 seconds elapsed.
   */
  private static async throttlePersistToDb(
    order: any,
    payload: IGpsLocationPayload,
    distanceRemainingMeters: number,
    estimatedArrivalMinutes: number
  ): Promise<void> {
    const rawLastWrite = await cache.get(this.lastDbWriteKey(payload.orderId));
    const now = Date.now();
    let shouldWriteToDb = true;

    if (rawLastWrite) {
      const lastWrite = JSON.parse(rawLastWrite);
      const distanceSinceLastWrite = DispatchService.calculateDistanceMeters(
        payload.coordinates,
        lastWrite.coordinates
      );
      const elapsedMs = now - lastWrite.timestamp;

      // Threshold: Moved > 40m OR > 45 seconds elapsed
      if (distanceSinceLastWrite < 40 && elapsedMs < 45000) {
        shouldWriteToDb = false;
      }
    }

    if (shouldWriteToDb) {
      // Async update to MongoDB tracking collection
      DeliveryTracking.findOneAndUpdate(
        { orderId: order._id },
        {
          $set: {
            partnerId: new Types.ObjectId(payload.partnerId),
            canteenId: order.canteenId,
            currentLocation: {
              type: 'Point',
              coordinates: payload.coordinates,
            },
            lastUpdated: new Date(),
            distanceRemainingMeters,
            estimatedArrivalMinutes,
          },
          $push: {
            breadcrumbs: {
              location: {
                type: 'Point',
                coordinates: payload.coordinates,
              },
              speedKmh: payload.speedKmh,
              headingDegrees: payload.headingDegrees,
              accuracyMeters: payload.accuracyMeters,
              timestamp: new Date(),
            },
          },
        },
        { upsert: true, new: true }
      ).catch((err) => logger.error('MongoDB tracking record write error:', err));

      // Cache the last written coordinate and timestamp
      await cache.setex(
        this.lastDbWriteKey(payload.orderId),
        3600,
        JSON.stringify({
          coordinates: payload.coordinates,
          timestamp: now,
        })
      );
    }
  }

  /**
   * Retrieves latest tracking state (Redis cache-aside).
   */
  static async getLatestTracking(orderId: string): Promise<ILiveTrackingState> {
    // 1. Try Redis cache first (Hot Path)
    const cached = await cache.get(this.liveTrackingKey(orderId));
    if (cached) {
      return JSON.parse(cached);
    }

    // 2. Cache miss -> query MongoDB
    const order = await Order.findById(orderId).populate('canteenId');
    if (!order) {
      throw ApiError.notFound('Order not found');
    }

    const tracking = await DeliveryTracking.findOne({ orderId });
    const currentCoords = tracking?.currentLocation.coordinates || [0, 0];
    const dropCoords: [number, number] = order.deliveryDrop.location.coordinates;
    const distanceRemainingMeters = DispatchService.calculateDistanceMeters(currentCoords, dropCoords);

    const state: ILiveTrackingState = {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      status: order.status,
      partnerId: order.deliveryPartnerId?.toString() || '',
      canteenId: order.canteenId._id.toString(),
      currentLocation: currentCoords,
      canteenLocation: (order.canteenId as any).location.coordinates,
      dropLocation: dropCoords,
      distanceRemainingMeters,
      estimatedArrivalMinutes: this.calculateEtaMinutes(distanceRemainingMeters),
      lastUpdated: tracking?.lastUpdated.toISOString() || new Date().toISOString(),
    };

    // Repopulate cache
    await cache.setex(this.liveTrackingKey(orderId), 300, JSON.stringify(state));

    return state;
  }
}
