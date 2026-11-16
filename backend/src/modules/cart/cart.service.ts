import { Types } from 'mongoose';
import { cache } from '../../config/redis.js';
import { MenuItem } from '../catalog/menu.model.js';
import { Canteen } from '../canteens/canteen.model.js';
import { ICartItemDetailed, ICartItemInput, ICartSummary } from './cart.interface.js';
import { ApiError } from '../../utils/apiError.js';

interface IStoredCart {
  canteenId: string;
  items: ICartItemInput[];
}

export class CartService {
  private static cartKey(customerId: string): string {
    return `cart:${customerId}`;
  }

  /**
   * Add or update an item in the customer's cart.
   * Enforces the Single-Canteen Cart constraint.
   */
  static async addItem(
    customerId: string,
    itemInput: ICartItemInput,
    replaceCartIfDifferentCanteen = false
  ): Promise<ICartSummary> {
    // 1. Fetch menu item details from DB
    const menuItem = await MenuItem.findById(itemInput.menuItemId);
    if (!menuItem) {
      throw ApiError.notFound('Menu item not found');
    }

    if (!menuItem.isAvailable) {
      throw ApiError.badRequest(`'${menuItem.name}' is currently sold out and unavailable`);
    }

    const itemCanteenId = menuItem.canteenId.toString();

    // 2. Fetch existing cart from cache
    const existingRaw = await cache.get(this.cartKey(customerId));
    let storedCart: IStoredCart = existingRaw
      ? JSON.parse(existingRaw)
      : { canteenId: itemCanteenId, items: [] };

    // 3. Enforce Single-Canteen Cart Constraint
    if (storedCart.items.length > 0 && storedCart.canteenId !== itemCanteenId) {
      if (!replaceCartIfDifferentCanteen) {
        const existingCanteen = await Canteen.findById(storedCart.canteenId);
        throw ApiError.conflict(
          `Your cart contains items from '${existingCanteen?.name || 'another canteen'}'. Clear your cart to add items from this canteen.`,
          'CROSS_CANTEEN_CART_CONFLICT'
        );
      }
      // User opted to replace existing cart
      storedCart = { canteenId: itemCanteenId, items: [] };
    }

    // 4. Update or add item in cart
    storedCart.canteenId = itemCanteenId;
    const existingIndex = storedCart.items.findIndex((i) => i.menuItemId === itemInput.menuItemId);

    if (existingIndex > -1) {
      if (itemInput.quantity <= 0) {
        storedCart.items.splice(existingIndex, 1);
      } else {
        storedCart.items[existingIndex].quantity = itemInput.quantity;
        if (itemInput.customizationNotes) {
          storedCart.items[existingIndex].customizationNotes = itemInput.customizationNotes;
        }
      }
    } else if (itemInput.quantity > 0) {
      storedCart.items.push(itemInput);
    }

    // 5. Persist updated cart with 24h TTL
    if (storedCart.items.length === 0) {
      await cache.del(this.cartKey(customerId));
    } else {
      await cache.setex(this.cartKey(customerId), 86400, JSON.stringify(storedCart));
    }

    return this.getCart(customerId);
  }

  /**
   * Retrieves the customer's cart, calculating live server-side prices and availability.
   */
  static async getCart(customerId: string): Promise<ICartSummary> {
    const raw = await cache.get(this.cartKey(customerId));
    if (!raw) {
      return {
        canteenId: null,
        canteenName: null,
        items: [],
        itemsCount: 0,
        itemsTotal: 0,
        taxAmount: 0,
        packagingFee: 0,
        deliveryFee: 0,
        totalAmount: 0,
      };
    }

    const storedCart: IStoredCart = JSON.parse(raw);
    const canteen = await Canteen.findById(storedCart.canteenId);

    const itemIds = storedCart.items.map((i) => new Types.ObjectId(i.menuItemId));
    const dbItems = await MenuItem.find({ _id: { $in: itemIds } });
    const dbItemMap = new Map(dbItems.map((item) => [item._id.toString(), item]));

    const detailedItems: ICartItemDetailed[] = [];
    let itemsTotal = 0;

    for (const storedItem of storedCart.items) {
      const dbItem = dbItemMap.get(storedItem.menuItemId);
      if (!dbItem) continue;

      const unitPrice = dbItem.price;
      const subtotal = Number((unitPrice * storedItem.quantity).toFixed(2));
      itemsTotal += subtotal;

      detailedItems.push({
        menuItemId: dbItem._id.toString(),
        name: dbItem.name,
        unitPrice,
        quantity: storedItem.quantity,
        subtotal,
        imageUrl: dbItem.imageUrl,
        isVeg: dbItem.isVeg,
        isAvailable: dbItem.isAvailable,
        customizationNotes: storedItem.customizationNotes,
      });
    }

    itemsTotal = Number(itemsTotal.toFixed(2));
    const taxAmount = Number((itemsTotal * 0.05).toFixed(2)); // 5% GST/tax
    const packagingFee = itemsTotal > 0 ? 10.0 : 0; // Flat packaging
    const deliveryFee = itemsTotal > 0 ? 25.0 : 0; // Campus delivery flat fee
    const totalAmount = Number((itemsTotal + taxAmount + packagingFee + deliveryFee).toFixed(2));

    return {
      canteenId: storedCart.canteenId,
      canteenName: canteen?.name || null,
      items: detailedItems,
      itemsCount: detailedItems.reduce((acc, curr) => acc + curr.quantity, 0),
      itemsTotal,
      taxAmount,
      packagingFee,
      deliveryFee,
      totalAmount,
    };
  }

  /**
   * Clears the customer's cart.
   */
  static async clearCart(customerId: string): Promise<void> {
    await cache.del(this.cartKey(customerId));
  }
}
