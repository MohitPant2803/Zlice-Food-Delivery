import { z } from 'zod';

export const addToCartSchema = z.object({
  body: z.object({
    menuItemId: z.string().min(12, 'Invalid menuItemId'),
    quantity: z.number().int().min(0, 'Quantity cannot be negative').max(50),
    customizationNotes: z.string().max(200).optional(),
    replaceCartIfDifferentCanteen: z.boolean().default(false),
  }),
});
