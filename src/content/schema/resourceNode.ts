import { z } from 'zod';
import { text } from './common.ts';

export const resourceNodeSchema = z.strictObject({
  id: z.string(),
  kind: z.enum(['gather', 'mine']),
  itemId: text,
  quantity: z.int().min(1).max(9),
  respawnDays: z.int().min(1).max(7),
});

export type ResourceNodeDef = z.infer<typeof resourceNodeSchema>;
