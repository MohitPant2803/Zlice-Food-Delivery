import { Types } from 'mongoose';
import { MenuItem } from './menu.model.js';
import { IMenuItem, MenuCategory } from './menu.interface.js';
import { ApiError } from '../../utils/apiError.js';
import { Canteen } from '../canteens/canteen.model.js';

export interface ICreateMenuItemDTO {
  name: string;
  description?: string;
  price: number;
  category: MenuCategory;
  isVeg?: boolean;
  preparationTimeMinutes?: number;
  imageUrl?: string;
  calories?: number;
  allergens?: string[];
  discountPercent?: number;
}

export interface IMenuFilterOptions {
  category?: MenuCategory;
  isVeg?: boolean;
  search?: string;
  onlyAvailable?: boolean;
}

export class CatalogService {
  /**
   * Create a new menu item scoped to a canteen.
   */
  static async createMenuItem(canteenId: string, dto: ICreateMenuItemDTO): Promise<IMenuItem> {
    const canteen = await Canteen.findById(canteenId);
    if (!canteen) {
      throw ApiError.notFound('Canteen not found');
    }

    const item = await MenuItem.create({
      ...dto,
      canteenId: new Types.ObjectId(canteenId),
      isAvailable: true,
    });

    return item;
  }

  /**
   * Update an existing menu item.
   * Guarantees item belongs strictly to the authenticated canteen.
   */
  static async updateMenuItem(
    menuItemId: string,
    canteenId: string,
    dto: Partial<ICreateMenuItemDTO>
  ): Promise<IMenuItem> {
    const item = await MenuItem.findOne({
      _id: menuItemId,
      canteenId: new Types.ObjectId(canteenId),
    });

    if (!item) {
      throw ApiError.notFound('Menu item not found in your canteen catalog');
    }

    Object.assign(item, dto);
    await item.save();

    return item;
  }

  /**
   * Quickly toggle food item availability (e.g. "Sold Out" / "Back in Stock").
   */
  static async toggleAvailability(
    menuItemId: string,
    canteenId: string,
    isAvailable: boolean
  ): Promise<IMenuItem> {
    const item = await MenuItem.findOneAndUpdate(
      {
        _id: menuItemId,
        canteenId: new Types.ObjectId(canteenId),
      },
      { isAvailable },
      { new: true }
    );

    if (!item) {
      throw ApiError.notFound('Menu item not found in your canteen catalog');
    }

    return item;
  }

  /**
   * Delete a menu item.
   */
  static async deleteMenuItem(menuItemId: string, canteenId: string): Promise<void> {
    const result = await MenuItem.findOneAndDelete({
      _id: menuItemId,
      canteenId: new Types.ObjectId(canteenId),
    });

    if (!result) {
      throw ApiError.notFound('Menu item not found in your canteen catalog');
    }
  }

  /**
   * Fetch full menu for a canteen with category grouping and optional filters.
   */
  static async getCanteenMenu(canteenId: string, filters: IMenuFilterOptions = {}) {
    const query: any = {
      canteenId: new Types.ObjectId(canteenId),
    };

    if (filters.onlyAvailable) {
      query.isAvailable = true;
    }

    if (filters.category) {
      query.category = filters.category;
    }

    if (filters.isVeg !== undefined) {
      query.isVeg = filters.isVeg;
    }

    if (filters.search) {
      query.$text = { $search: filters.search };
    }

    const items = await MenuItem.find(query).sort({ category: 1, name: 1 });

    // Group items by category for mobile/web UX
    const grouped: Record<string, IMenuItem[]> = {};
    for (const item of items) {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push(item);
    }

    return {
      canteenId,
      totalItems: items.length,
      grouped,
      items,
    };
  }

  /**
   * Fetch a single menu item by ID.
   */
  static async getMenuItemById(menuItemId: string): Promise<IMenuItem> {
    const item = await MenuItem.findById(menuItemId);
    if (!item) {
      throw ApiError.notFound('Menu item not found');
    }
    return item;
  }
}
