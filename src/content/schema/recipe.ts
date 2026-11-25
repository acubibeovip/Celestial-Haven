import { z } from 'zod';
import { itemStack, text } from './common.ts';

export const recipeSchema = z.strictObject({
  id: z.string(),
  station: text,
  inputs: z.array(itemStack),
  outputs: z.array(itemStack),
  requirement: text.nullable(),
});

export type RecipeDef = z.infer<typeof recipeSchema>;
