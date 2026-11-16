import mongoose, { Types } from 'mongoose';
import crypto from 'crypto';
import { Order } from './order.model.js';
import { MenuItem } from '../catalog/menu.model.js';
import { Canteen } from '../canteens/canteen.model.js';
import { CartService } from '../cart/cart.service.js';
import {
  IOrder,
  IOrderItemSnapshot,
  IOrderPricing,
  OrderStatus,
} from './order.interface.js';
import { ApiError } from '../../utils/apiError.js';
import { logger } from '../../utils/logger.js';
import { UserRole } from '../../constants/roles.js';

export interface IOrderItemRequest {
  menuItemId: string;
  quantity: number;
  customizationNotes?: string;
}

export interface ICreateOrderDTO {
  canteenId: string;
  items: IOrderItemRequest[];
  deliveryDrop: {
    campusBlock: string;
    roomNumber: string;
    longitude: number;
    latitude: number;
    deliveryInstructions?: string;
  };
  specialInstructions?: string;
}

// Strict State Transition Matrix for Order Lifecycle
const VALID_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PLACED]: [OrderStatus.ACCEPTED_BY_CANTEEN, OrderStatus.CANCELLED],
  [OrderStatus.ACCEPTED_BY_CANTEEN]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY_FOR_PICKUP, OrderStatus.CANCELLED],
  [OrderStatus.READY_FOR_PICKUP]: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

export class OrderService {
  /**
   * Generates a unique, human-friendly order identifier (e.g. ZL-K9M2-4F8A).
   */
  private static generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
    const randomHex = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `ZL-${timestamp}-${randomHex}`;
  }

  /**
   * Generates a secure 6-digit delivery verification OTP.
   */
  private static generateDeliveryOtp(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Enterprise Pricing Engine: Calculates order total strictly on the server.
   * NEVER trust client-provided totals, sub-totals, or unit prices.
   */
  static async calculateOrderPricing(
    canteenId: string,
    itemsInput: IOrderItemRequest[]
  ): Promise<{ snapshots: IOrderItemSnapshot[]; pricing: IOrderPricing }> {
    // 1. Validate Canteen state
    const canteen = await Canteen.findById(canteenId);
    if (!canteen) {
      throw ApiError.notFound('Target canteen not found');
    }

    if (!canteen.isOpen) {
      throw ApiError.badRequest(
        `'${canteen.name}' is currently closed and not accepting new orders.`
      );
    }

    if (!itemsInput || itemsInput.length === 0) {
      throw ApiError.badRequest('Order must contain at least one item');
    }

    // 2. Fetch current prices & availability from Database
    const itemIds = itemsInput.map((i) => new Types.ObjectId(i.menuItemId));
    const dbMenuItems = await MenuItem.find({
      _id: { $in: itemIds },
      canteenId: new Types.ObjectId(canteenId),
    });

    if (dbMenuItems.length !== itemsInput.length) {
      throw ApiError.badRequest(
        'One or more items do not belong to this canteen or no longer exist.'
      );
    }

    const itemMap = new Map(dbMenuItems.map((m) => [m._id.toString(), m]));
    const snapshots: IOrderItemSnapshot[] = [];
    let itemsTotal = 0;

    // 3. Validate availability and freeze price snapshots
    for (const input of itemsInput) {
      if (input.quantity <= 0 || !Number.isInteger(input.quantity)) {
        throw ApiError.badRequest(`Invalid quantity for item ${input.menuItemId}`);
      }

      const dbItem = itemMap.get(input.menuItemId);
      if (!dbItem) {
        throw ApiError.badRequest(`Item ${input.menuItemId} not found`);
      }

      if (!dbItem.isAvailable) {
        throw ApiError.badRequest(
          `'${dbItem.name}' is currently out of stock and cannot be ordered.`
        );
      }

      const unitPrice = dbItem.price;
      const subtotal = Number((unitPrice * input.quantity).toFixed(2));
      itemsTotal += subtotal;

      snapshots.push({
        menuItemId: dbItem._id,
        name: dbItem.name,
        unitPrice,
        quantity: input.quantity,
        subtotal,
        customizationNotes: input.customizationNotes,
      });
    }

    itemsTotal = Number(itemsTotal.toFixed(2));
    const taxAmount = Number((itemsTotal * 0.05).toFixed(2)); // 5% campus tax
    const packagingFee = 10.0; // Standard packaging fee
    const deliveryFee = 25.0; // Standard campus delivery fee
    const discountAmount = 0.0;
    const totalAmount = Number((itemsTotal + taxAmount + packagingFee + deliveryFee).toFixed(2));

    const pricing: IOrderPricing = {
      itemsTotal,
      taxAmount,
      packagingFee,
      deliveryFee,
      discountAmount,
      totalAmount,
    };

    return { snapshots, pricing };
  }

  /**
   * Places an order using MongoDB Multi-Document ACID Transactions.
   */
  static async createOrder(customerId: string, dto: ICreateOrderDTO): Promise<IOrder> {
    const mongoSession = await mongoose.startSession();
    let createdOrder: IOrder;

    try {
      await mongoSession.withTransaction(async () => {
        // 1. Calculate pricing server-side within transaction boundary
        const { snapshots, pricing } = await this.calculateOrderPricing(dto.canteenId, dto.items);

        const orderNumber = this.generateOrderNumber();
        const deliveryOtp = this.generateDeliveryOtp();

        const [order] = await Order.create(
          [
            {
              orderNumber,
              customerId: new Types.ObjectId(customerId),
              canteenId: new Types.ObjectId(dto.canteenId),
              items: snapshots,
              pricing,
              deliveryDrop: {
                location: {
                  type: 'Point',
                  coordinates: [dto.deliveryDrop.longitude, dto.deliveryDrop.latitude],
                },
                campusBlock: dto.deliveryDrop.campusBlock,
                roomNumber: dto.deliveryDrop.roomNumber,
                deliveryInstructions: dto.deliveryDrop.deliveryInstructions,
              },
              status: OrderStatus.PLACED,
              statusHistory: [
                {
                  status: OrderStatus.PLACED,
                  timestamp: new Date(),
                  updatedBy: new Types.ObjectId(customerId),
                  notes: 'Order placed by customer',
                },
              ],
              deliveryOtp,
              specialInstructions: dto.specialInstructions,
            },
          ],
          { session: mongoSession }
        );

        createdOrder = order;
      });
    } finally {
      await mongoSession.endSession();
    }

    // 4. Asynchronously clear user's cart in background
    CartService.clearCart(customerId).catch((err) =>
      logger.warn('Failed to clear cart after order placement:', err)
    );

    // 5. Trigger real-time canteen notification (Event hook for WebSocket/Push)
    logger.info(`🔔 [NOTIFICATION] New Order [${createdOrder!.orderNumber}] placed at Canteen [${dto.canteenId}] for amount ₹${createdOrder!.pricing.totalAmount}`);

    return createdOrder!;
  }

  /**
   * Advance Order Status according to strict State Machine rules.
   */
  static async updateOrderStatus(
    orderId: string,
    canteenId: string,
    newStatus: OrderStatus,
    updatedByUserId: string,
    notes?: string
  ): Promise<IOrder> {
    const order = await Order.findOne({
      _id: orderId,
      canteenId: new Types.ObjectId(canteenId), // Enforces tenant boundary
    });

    if (!order) {
      throw ApiError.notFound('Order not found for your canteen');
    }

    // Verify state transition validity
    const allowedNextStatuses = VALID_STATUS_TRANSITIONS[order.status];
    if (!allowedNextStatuses || !allowedNextStatuses.includes(newStatus)) {
      throw ApiError.badRequest(
        `Invalid status transition: Cannot move order from '${order.status}' to '${newStatus}'.`
      );
    }

    order.status = newStatus;
    order.statusHistory.push({
      status: newStatus,
      timestamp: new Date(),
      updatedBy: new Types.ObjectId(updatedByUserId),
      notes: notes || `Status updated to ${newStatus}`,
    });

    await order.save();
    logger.info(`Order [${order.orderNumber}] status transitioned: ${order.status}`);

    return order;
  }

  /**
   * Cancel an order with strict business rule validation.
   */
  static async cancelOrder(
    orderId: string,
    userContext: { userId: string; role: UserRole; canteenId?: string },
    reason: string
  ): Promise<IOrder> {
    const order = await Order.findById(orderId);
    if (!order) {
      throw ApiError.notFound('Order not found');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw ApiError.badRequest('Order is already cancelled');
    }

    if (order.status === OrderStatus.DELIVERED) {
      throw ApiError.badRequest('Delivered orders cannot be cancelled');
    }

    // Role-specific cancellation rules
    let cancelledBy: 'customer' | 'canteen' | 'admin' = 'customer';

    if (userContext.role === UserRole.CUSTOMER) {
      if (order.customerId.toString() !== userContext.userId) {
        throw ApiError.forbidden('You can only cancel your own orders');
      }

      // Customer can ONLY cancel before the kitchen accepts it!
      if (order.status !== OrderStatus.PLACED) {
        throw ApiError.badRequest(
          `Cannot cancel order. The canteen has already accepted and started preparing your food (${order.status}).`
        );
      }
      cancelledBy = 'customer';
    } else if (
      userContext.role === UserRole.CANTEEN_OWNER ||
      userContext.role === UserRole.CANTEEN_STAFF
    ) {
      if (order.canteenId.toString() !== userContext.canteenId) {
        throw ApiError.forbidden('You cannot cancel an order belonging to another canteen');
      }
      cancelledBy = 'canteen';
    } else if (userContext.role === UserRole.ADMIN) {
      cancelledBy = 'admin';
    }

    order.status = OrderStatus.CANCELLED;
    order.cancellation = {
      cancelledBy,
      reason,
      cancelledAt: new Date(),
    };

    order.statusHistory.push({
      status: OrderStatus.CANCELLED,
      timestamp: new Date(),
      updatedBy: new Types.ObjectId(userContext.userId),
      notes: `Order cancelled by ${cancelledBy}: ${reason}`,
    });

    await order.save();
    logger.warn(`Order [${order.orderNumber}] CANCELLED by ${cancelledBy}. Reason: ${reason}`);

    return order;
  }

  /**
   * Customer Order History.
   */
  static async getCustomerOrders(customerId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find({ customerId: new Types.ObjectId(customerId) })
        .populate('canteenId', 'name campusZone contactPhone bannerImage')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments({ customerId: new Types.ObjectId(customerId) }),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Canteen Live Orders Dashboard.
   */
  static async getCanteenOrders(
    canteenId: string,
    statusFilter?: OrderStatus,
    page = 1,
    limit = 20
  ) {
    const query: any = {
      canteenId: new Types.ObjectId(canteenId),
    };

    if (statusFilter) {
      query.status = statusFilter;
    }

    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('customerId', 'name phone roomNumber campusBlock')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(query),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * MongoDB Aggregation Pipeline: Daily Canteen Metrics & Order Summaries.
   */
  static async getCanteenDailyMetrics(canteenId: string, days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const metrics = await Order.aggregate([
      {
        $match: {
          canteenId: new Types.ObjectId(canteenId),
          createdAt: { $gte: startDate },
        },
      },
      {
        $facet: {
          overview: [
            {
              $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                completedOrders: {
                  $sum: { $cond: [{ $eq: ['$status', OrderStatus.DELIVERED] }, 1, 0] },
                },
                cancelledOrders: {
                  $sum: { $cond: [{ $eq: ['$status', OrderStatus.CANCELLED] }, 1, 0] },
                },
                grossRevenue: {
                  $sum: {
                    $cond: [
                      { $eq: ['$status', OrderStatus.DELIVERED] },
                      '$pricing.totalAmount',
                      0,
                    ],
                  },
                },
                averageOrderValue: {
                  $avg: {
                    $cond: [
                      { $eq: ['$status', OrderStatus.DELIVERED] },
                      '$pricing.totalAmount',
                      null,
                    ],
                  },
                },
              },
            },
          ],
          popularItems: [
            { $unwind: '$items' },
            {
              $group: {
                _id: '$items.name',
                unitsSold: { $sum: '$items.quantity' },
                totalRevenue: { $sum: '$items.subtotal' },
              },
            },
            { $sort: { unitsSold: -1 } },
            { $limit: 5 },
          ],
          ordersByStatus: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]);

    return metrics[0];
  }
}
