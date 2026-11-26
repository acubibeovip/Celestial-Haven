import { z } from 'zod';
import { templateId, text } from './common.ts';

export const heroSchema = z.strictObject({
  id: z.string(),
  nameKey: text,
  archetypeKey: text,
  template: templateId,
  elementId: text,
  atlas: text,
  portrait: text,
});

export type HeroDef = z.infer<typeof heroSchema>;
