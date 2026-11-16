import { Request, Response, NextFunction } from 'express';
import { CatalogService } from './catalog.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { ApiError } from '../../utils/apiError.js';
import { MenuCategory } from './menu.interface.js';

export class MenuController {
  static async createMenuItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const canteenId = req.canteenId;
      if (!canteenId) {
        throw ApiError.forbidden('Canteen context required');
      }

      const item = await CatalogService.createMenuItem(canteenId, req.body);
      ApiResponse.created(res, 'Menu item created successfully', { item });
    } catch (error) {
      next(error);
    }
  }

  static async updateMenuItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const canteenId = req.canteenId;
      if (!canteenId) {
        throw ApiError.forbidden('Canteen context required');
      }

      const itemId = req.params.itemId as string;
      const updated = await CatalogService.updateMenuItem(itemId, canteenId, req.body);
      ApiResponse.success(res, 'Menu item updated successfully', { item: updated });
    } catch (error) {
      next(error);
    }
  }

  static async toggleAvailability(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const canteenId = req.canteenId;
      if (!canteenId) {
        throw ApiError.forbidden('Canteen context required');
      }

      const itemId = req.params.itemId as string;
      const { isAvailable } = req.body;
      const updated = await CatalogService.toggleAvailability(itemId, canteenId, isAvailable);

      ApiResponse.success(
        res,
        `Item '${updated.name}' is now ${updated.isAvailable ? 'AVAILABLE' : 'SOLD OUT'}`,
        { item: updated }
      );
    } catch (error) {
      next(error);
    }
  }

  static async deleteMenuItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const canteenId = req.canteenId;
      if (!canteenId) {
        throw ApiError.forbidden('Canteen context required');
      }

      const itemId = req.params.itemId as string;
      await CatalogService.deleteMenuItem(itemId, canteenId);
      ApiResponse.success(res, 'Menu item removed successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getCanteenMenu(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const canteenId = req.params.canteenId as string;
      const { category, isVeg, search, onlyAvailable } = req.query;

      const menu = await CatalogService.getCanteenMenu(canteenId, {
        category: category as MenuCategory,
        isVeg: isVeg !== undefined ? isVeg === 'true' : undefined,
        search: search as string,
        onlyAvailable: onlyAvailable !== undefined ? onlyAvailable === 'true' : false,
      });

      ApiResponse.success(res, 'Menu catalog retrieved', menu);
    } catch (error) {
      next(error);
    }
  }

  static async getMenuItemById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const itemId = req.params.itemId as string;
      const item = await CatalogService.getMenuItemById(itemId);
      ApiResponse.success(res, 'Menu item retrieved', { item });
    } catch (error) {
      next(error);
    }
  }
}
