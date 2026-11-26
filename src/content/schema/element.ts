import { z } from 'zod';
import { text } from './common.ts';

export const elementSchema = z.strictObject({
  id: z.string(),
  nameKey: text,
  active: z.boolean(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  modifiers: z.record(text, z.number().nonnegative()),
});

export type ElementDef = z.infer<typeof elementSchema>;
