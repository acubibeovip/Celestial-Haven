import { z } from 'zod';
import { text } from './common.ts';

export const elementSchema = z.strictObject({
  id: z.string(),
  label: text,
  active: z.boolean(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  modifiers: z.record(text, z.number()),
});

export type ElementDef = z.infer<typeof elementSchema>;
