import { z } from 'zod';
import { text } from './common.ts';

export const heroSchema = z.strictObject({
  id: z.string(),
  nameKey: text,
  archetypeKey: text,
  template: z.enum(['close', 'ranged', 'support']),
  elementId: text,
  atlas: text,
  portrait: text,
});

export type HeroDef = z.infer<typeof heroSchema>;
