import { z } from 'zod';

export const ingestLocationSchema = z.object({
  body: z.object({
    orderId: z.string().min(12, 'Invalid orderId'),
    longitude: z.number().min(-180).max(180),
    latitude: z.number().min(-90).max(90),
    speedKmh: z.number().min(0).max(150).optional(),
    headingDegrees: z.number().min(0).max(360).optional(),
    accuracyMeters: z.number().min(0).max(500).optional(),
  }),
});

export const getTrackingSchema = z.object({
  params: z.object({
    orderId: z.string().min(12, 'Invalid orderId'),
  }),
});
