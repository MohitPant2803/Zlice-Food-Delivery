import { z } from 'zod';
import { MenuCategory } from './menu.interface.js';

export const createMenuItemSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must have at least 2 characters').max(120),
    description: z.string().max(500).optional(),
    price: z.number().min(0, 'Price cannot be negative'),
    category: z.nativeEnum(MenuCategory),
    isVeg: z.boolean().default(true),
    preparationTimeMinutes: z.number().min(1).max(120).default(15),
    imageUrl: z.string().url().optional(),
    calories: z.number().optional(),
    allergens: z.array(z.string()).optional(),
    discountPercent: z.number().min(0).max(90).optional(),
  }),
});

export const updateMenuItemSchema = z.object({
  params: z.object({
    itemId: z.string().min(12, 'Invalid itemId format'),
  }),
  body: z.object({
    name: z.string().min(2).max(120).optional(),
    description: z.string().max(500).optional(),
    price: z.number().min(0).optional(),
    category: z.nativeEnum(MenuCategory).optional(),
    isVeg: z.boolean().optional(),
    preparationTimeMinutes: z.number().min(1).max(120).optional(),
    imageUrl: z.string().url().optional(),
    calories: z.number().optional(),
    allergens: z.array(z.string()).optional(),
    discountPercent: z.number().min(0).max(90).optional(),
  }),
});

export const toggleAvailabilitySchema = z.object({
  params: z.object({
    itemId: z.string().min(12, 'Invalid itemId format'),
  }),
  body: z.object({
    isAvailable: z.boolean(),
  }),
});
