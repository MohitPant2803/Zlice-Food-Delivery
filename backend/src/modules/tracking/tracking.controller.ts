import { Request, Response, NextFunction } from 'express';
import { TrackingService } from './tracking.service.js';
import { SocketGateway } from './socket.gateway.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { ApiError } from '../../utils/apiError.js';
import { UserRole } from '../../constants/roles.js';

export class TrackingController {
  /**
   * REST endpoint: Ingest GPS location update (Fallback when WebSocket in-flight is paused).
   */
  static async updateLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== UserRole.DELIVERY_PARTNER) {
        throw ApiError.forbidden('Only delivery partners can update delivery location');
      }

      const { orderId, longitude, latitude, speedKmh, headingDegrees, accuracyMeters } = req.body;

      const liveState = await TrackingService.ingestLocation({
        orderId,
        partnerId: req.user.userId,
        coordinates: [longitude, latitude],
        speedKmh,
        headingDegrees,
        accuracyMeters,
      });

      // Broadcast update over WebSockets as well
      try {
        const io = SocketGateway.getIO();
        io.to(`order:${orderId}:tracking`).emit('order:tracking:update', liveState);
      } catch {
        // Socket broadcast optional in REST fallback
      }

      ApiResponse.success(res, 'Location ingested and broadcast successfully', { liveState });
    } catch (error) {
      next(error);
    }
  }

  /**
   * REST endpoint: Fetch current live tracking state & breadcrumbs.
   */
  static async getOrderTracking(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const orderId = req.params.orderId as string;

      // Channel Access Authorization
      await TrackingService.verifyTrackingAccess(orderId, req.user);

      const trackingState = await TrackingService.getLatestTracking(orderId);
      ApiResponse.success(res, 'Live order tracking state retrieved', { trackingState });
    } catch (error) {
      next(error);
    }
  }
}
