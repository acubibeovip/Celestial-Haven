import { z } from 'zod';
import { count, text } from './common.ts';

export const itemSchema = z.strictObject({
  id: z.string(),
  kind: text,
  stackMax: z.int().min(1).max(99),
  icon: text,
  price: count,
});

export type ItemDef = z.infer<typeof itemSchema>;
