import { Request, Response, NextFunction } from 'express';
import { CartService } from './cart.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { ApiError } from '../../utils/apiError.js';

export class CartController {
  static async getCart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const cart = await CartService.getCart(req.user.userId);
      ApiResponse.success(res, 'Active cart retrieved', { cart });
    } catch (error) {
      next(error);
    }
  }

  static async addItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const { menuItemId, quantity, customizationNotes, replaceCartIfDifferentCanteen } = req.body;
      const cart = await CartService.addItem(
        req.user.userId,
        { menuItemId, quantity, customizationNotes },
        Boolean(replaceCartIfDifferentCanteen)
      );

      ApiResponse.success(res, 'Cart updated successfully', { cart });
    } catch (error) {
      next(error);
    }
  }

  static async clearCart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      await CartService.clearCart(req.user.userId);
      ApiResponse.success(res, 'Cart cleared successfully');
    } catch (error) {
      next(error);
    }
  }
}
