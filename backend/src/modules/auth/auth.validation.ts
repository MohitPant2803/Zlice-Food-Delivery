import { z } from 'zod';

export const customerRegisterSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must have at least 2 characters').max(100),
    email: z.string().email('Invalid email address').toLowerCase(),
    phone: z.string().min(10, 'Phone number must be at least 10 digits'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    campusBlock: z.string().optional(),
    roomNumber: z.string().optional(),
    defaultDeliveryInstructions: z.string().optional(),
  }),
});

export const canteenOwnerRegisterSchema = z.object({
  body: z.object({
    // Owner User Details
    name: z.string().min(2).max(100),
    email: z.string().email().toLowerCase(),
    phone: z.string().min(10),
    password: z.string().min(6),

    // Canteen Profile
    canteenName: z.string().min(2, 'Canteen name is required'),
    campusZone: z.string().min(2, 'Campus zone is required (e.g. Science Block, South Cafeteria)'),
    contactPhone: z.string().min(10),
    description: z.string().optional(),
    longitude: z.number().min(-180).max(180),
    latitude: z.number().min(-90).max(90),
  }),
});

export const canteenStaffCreateSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100),
    email: z.string().email().toLowerCase(),
    phone: z.string().min(10),
    password: z.string().min(6),
  }),
});

export const deliveryPartnerRegisterSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100),
    email: z.string().email().toLowerCase(),
    phone: z.string().min(10),
    password: z.string().min(6),
    vehicleType: z.enum(['bicycle', 'ebike', 'scooter', 'walking']).default('bicycle'),
    vehicleNumber: z.string().optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format').toLowerCase(),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().optional(),
  }),
});

export const revokeSessionSchema = z.object({
  params: z.object({
    sessionId: z.string().min(12, 'Invalid sessionId format'),
  }),
});
