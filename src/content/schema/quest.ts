import { z } from 'zod';
import { count, itemStack, text } from './common.ts';

export const questSchema = z.strictObject({
  id: z.string(),
  prereqs: z.array(text),
  objectives: z.array(z.strictObject({ kind: text, count: z.int().positive() })),
  reward: z.strictObject({ coins: count, items: z.array(itemStack) }),
  next: z.array(text),
  peacefulAlternative: text.nullable(),
});

export type QuestDef = z.infer<typeof questSchema>;
