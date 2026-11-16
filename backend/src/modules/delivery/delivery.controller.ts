import { Request, Response, NextFunction } from 'express';
import { DispatchService } from './dispatch.service.js';
import { DeliveryAssignment } from './assignment.model.js';
import { DeliveryAssignmentStatus } from './assignment.interface.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { ApiError } from '../../utils/apiError.js';
import { Types } from 'mongoose';

export class DeliveryController {
  static async toggleOnline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const { isOnline } = req.body;
      const partner = await DispatchService.toggleOnlineStatus(req.user.userId, isOnline);

      ApiResponse.success(
        res,
        `You are now ${partner.isOnline ? 'ONLINE and ready for deliveries' : 'OFFLINE'}`,
        { isOnline: partner.isOnline }
      );
    } catch (error) {
      next(error);
    }
  }

  static async updateLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const { longitude, latitude } = req.body;
      const partner = await DispatchService.updateLocation(req.user.userId, [longitude, latitude]);

      ApiResponse.success(res, 'GPS coordinates updated', {
        location: partner?.currentLocation,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMyOffers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const offers = await DeliveryAssignment.find({
        partnerId: new Types.ObjectId(req.user.userId),
        status: DeliveryAssignmentStatus.OFFERED,
        expiresAt: { $gt: new Date() },
      })
        .populate('orderId')
        .populate('canteenId', 'name campusZone contactPhone bannerImage')
        .sort({ offeredAt: -1 })
        .lean();

      ApiResponse.success(res, 'Active delivery offers retrieved', { offers });
    } catch (error) {
      next(error);
    }
  }

  static async acceptOffer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const assignmentId = req.params.assignmentId as string;
      const result = await DispatchService.acceptAssignment(assignmentId, req.user.userId);

      ApiResponse.success(res, 'Delivery offer accepted successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async rejectOffer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const assignmentId = req.params.assignmentId as string;
      const { reason } = req.body;
      const result = await DispatchService.rejectAssignment(assignmentId, req.user.userId, reason);

      ApiResponse.success(res, 'Delivery offer declined. Reassigned to next partner.', result);
    } catch (error) {
      next(error);
    }
  }

  static async pickupOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const orderId = req.params.orderId as string;
      const order = await DispatchService.pickupOrder(orderId, req.user.userId);

      ApiResponse.success(res, 'Order marked as picked up and out for delivery', { order });
    } catch (error) {
      next(error);
    }
  }

  static async completeDelivery(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const orderId = req.params.orderId as string;
      const { deliveryOtp } = req.body;
      const order = await DispatchService.deliverOrder(orderId, req.user.userId, deliveryOtp);

      ApiResponse.success(res, 'Delivery completed successfully with OTP verification', { order });
    } catch (error) {
      next(error);
    }
  }

  static async triggerDispatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orderId = req.params.orderId as string;
      const assignment = await DispatchService.dispatchOrder(orderId);

      if (!assignment) {
        ApiResponse.success(res, 'No partner currently available or maximum attempts reached', {
          dispatched: false,
        });
        return;
      }

      ApiResponse.success(res, 'Dispatch process triggered successfully', {
        dispatched: true,
        assignment,
      });
    } catch (error) {
      next(error);
    }
  }

  static async sweepTimeouts(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const processed = await DispatchService.processTimeouts();
      ApiResponse.success(res, `Processed ${processed} timed-out dispatch offers`, { processed });
    } catch (error) {
      next(error);
    }
  }
}
