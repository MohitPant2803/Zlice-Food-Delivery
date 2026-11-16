import { Request, Response, NextFunction } from 'express';
import { Canteen } from './canteen.model.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { ApiError } from '../../utils/apiError.js';

export class CanteenController {
  /**
   * Fetches canteen profile. Publicly viewable by customers.
   */
  static async getCanteenById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { canteenId } = req.params;
      const canteen = await Canteen.findById(canteenId).populate('ownerId', 'name email phone');
      if (!canteen) {
        throw ApiError.notFound('Canteen not found');
      }
      ApiResponse.success(res, 'Canteen details retrieved', { canteen });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Scoped endpoint: Returns orders belonging strictly to THIS canteen.
   * Demonstrates strict multi-tenant boundary.
   */
  static async getCanteenOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // NOTE: req.canteenId is guaranteed to be validated by requireCanteenScope middleware!
      const targetCanteenId = req.canteenId;

      ApiResponse.success(res, 'Orders for authorized canteen retrieved', {
        canteenId: targetCanteenId,
        orders: [], // In Module 2 this queries Order.find({ canteenId: req.canteenId })
        notice: 'Tenant isolation verified: Access restricted to authorized canteen boundary.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Scoped endpoint: Toggle open/closed status for the canteen.
   */
  static async toggleStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const targetCanteenId = req.canteenId;
      const { isOpen } = req.body;

      const canteen = await Canteen.findByIdAndUpdate(
        targetCanteenId,
        { isOpen: Boolean(isOpen) },
        { new: true }
      );

      ApiResponse.success(res, `Canteen is now ${canteen?.isOpen ? 'OPEN' : 'CLOSED'}`, { canteen });
    } catch (error) {
      next(error);
    }
  }
}
