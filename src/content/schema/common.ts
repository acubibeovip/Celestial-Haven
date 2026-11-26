import { z } from 'zod';

export const text = z.string().min(1);
export const templateId = z.enum(['close', 'ranged', 'support']);
export const count = z.int().nonnegative();
export const itemStack = z.strictObject({
  itemId: text,
  quantity: z.int().positive(),
});
