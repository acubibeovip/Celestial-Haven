import { z } from 'zod';
import { itemStack } from './common.ts';

const recipeStacks = z.array(itemStack).min(1).superRefine((stacks, context) => {
  const seen = new Set<string>();

  stacks.forEach(({ itemId }, index) => {
    if (seen.has(itemId)) {
      context.addIssue({
        code: 'custom',
        path: [index, 'itemId'],
        message: `Item ID "${itemId}" appears more than once in this array.`,
      });
    }
    seen.add(itemId);
  });
});

export const recipeSchema = z.strictObject({
  id: z.string(),
  station: z.enum(['forge', 'workbench']),
  inputs: recipeStacks,
  outputs: recipeStacks,
  requirement: z.null(),
});

export type RecipeDef = z.infer<typeof recipeSchema>;
