import { z } from 'zod';
import { OrderStatus } from './order.interface.js';

export const calculatePriceSchema = z.object({
  body: z.object({
    canteenId: z.string().min(12, 'Invalid canteenId'),
    items: z
      .array(
        z.object({
          menuItemId: z.string().min(12, 'Invalid menuItemId'),
          quantity: z.number().int().min(1).max(20),
          customizationNotes: z.string().max(200).optional(),
        })
      )
      .min(1, 'Order must contain at least one item'),
  }),
});

export const createOrderSchema = z.object({
  body: z.object({
    canteenId: z.string().min(12, 'Invalid canteenId'),
    items: z
      .array(
        z.object({
          menuItemId: z.string().min(12, 'Invalid menuItemId'),
          quantity: z.number().int().min(1).max(20),
          customizationNotes: z.string().max(200).optional(),
        })
      )
      .min(1, 'Order must contain at least one item'),
    deliveryDrop: z.object({
      campusBlock: z.string().min(2, 'Campus block is required'),
      roomNumber: z.string().min(1, 'Room number is required'),
      longitude: z.number().min(-180).max(180),
      latitude: z.number().min(-90).max(90),
      deliveryInstructions: z.string().max(300).optional(),
    }),
    specialInstructions: z.string().max(300).optional(),
  }),
});

export const updateOrderStatusSchema = z.object({
  params: z.object({
    orderId: z.string().min(12, 'Invalid orderId'),
  }),
  body: z.object({
    status: z.nativeEnum(OrderStatus),
    notes: z.string().max(300).optional(),
  }),
});

export const cancelOrderSchema = z.object({
  params: z.object({
    orderId: z.string().min(12, 'Invalid orderId'),
  }),
  body: z.object({
    reason: z.string().min(5, 'Cancellation reason must be at least 5 characters').max(300),
  }),
});
