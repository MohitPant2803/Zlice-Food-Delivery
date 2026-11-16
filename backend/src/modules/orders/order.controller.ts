import { Request, Response, NextFunction } from 'express';
import { OrderService } from './order.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { ApiError } from '../../utils/apiError.js';
import { OrderStatus } from './order.interface.js';

export class OrderController {
  /**
   * Preview Price & Server-side Total Calculation.
   */
  static async calculatePrice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { canteenId, items } = req.body;
      const result = await OrderService.calculateOrderPricing(canteenId, items);

      ApiResponse.success(res, 'Price calculated successfully', result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Place Order with Multi-Document ACID Transaction.
   */
  static async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const order = await OrderService.createOrder(req.user.userId, req.body);
      ApiResponse.created(res, 'Order placed successfully', { order });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update Order Status (Canteen / Kitchen Staff).
   */
  static async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || !req.canteenId) {
        throw ApiError.forbidden('Canteen operator authorization required');
      }

      const orderId = req.params.orderId as string;
      const { status, notes } = req.body;

      const order = await OrderService.updateOrderStatus(
        orderId,
        req.canteenId,
        status,
        req.user.userId,
        notes
      );

      ApiResponse.success(res, `Order status advanced to '${order.status}'`, { order });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cancel an Order.
   */
  static async cancelOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const orderId = req.params.orderId as string;
      const { reason } = req.body;

      const order = await OrderService.cancelOrder(
        orderId,
        {
          userId: req.user.userId,
          role: req.user.role,
          canteenId: req.user.canteenId,
        },
        reason
      );

      ApiResponse.success(res, 'Order cancelled successfully', { order });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Customer's personal order history.
   */
  static async getMyOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

      const result = await OrderService.getCustomerOrders(req.user.userId, page, limit);
      ApiResponse.success(res, 'Order history retrieved', result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Canteen Live Orders Dashboard (Multi-tenant scoped).
   */
  static async getCanteenOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const canteenId = req.canteenId;
      if (!canteenId) {
        throw ApiError.forbidden('Canteen context required');
      }

      const status = req.query.status as OrderStatus | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const result = await OrderService.getCanteenOrders(canteenId, status, page, limit);
      ApiResponse.success(res, 'Canteen orders retrieved', result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Canteen Aggregation Metrics (Multi-tenant scoped).
   */
  static async getCanteenMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const canteenId = req.canteenId;
      if (!canteenId) {
        throw ApiError.forbidden('Canteen context required');
      }

      const days = req.query.days ? parseInt(req.query.days as string, 10) : 7;
      const metrics = await OrderService.getCanteenDailyMetrics(canteenId, days);

      ApiResponse.success(res, 'Canteen analytics metrics retrieved', { metrics });
    } catch (error) {
      next(error);
    }
  }
}
