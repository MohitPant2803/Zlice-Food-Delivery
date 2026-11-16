import { z } from 'zod';

export const toggleOnlineSchema = z.object({
  body: z.object({
    isOnline: z.boolean(),
  }),
});

export const updateLocationSchema = z.object({
  body: z.object({
    longitude: z.number().min(-180).max(180),
    latitude: z.number().min(-90).max(90),
  }),
});

export const acceptOfferSchema = z.object({
  params: z.object({
    assignmentId: z.string().min(12, 'Invalid assignmentId'),
  }),
});

export const rejectOfferSchema = z.object({
  params: z.object({
    assignmentId: z.string().min(12, 'Invalid assignmentId'),
  }),
  body: z.object({
    reason: z.string().max(300).optional(),
  }),
});

export const pickupOrderSchema = z.object({
  params: z.object({
    orderId: z.string().min(12, 'Invalid orderId'),
  }),
});

export const completeDeliverySchema = z.object({
  params: z.object({
    orderId: z.string().min(12, 'Invalid orderId'),
  }),
  body: z.object({
    deliveryOtp: z.string().length(6, 'Delivery OTP must be 6 digits'),
  }),
});

export const triggerDispatchSchema = z.object({
  params: z.object({
    orderId: z.string().min(12, 'Invalid orderId'),
  }),
});
