import { z } from 'zod';
import { count, text } from './common.ts';

const positive = z.int().positive();

export const templateSchema = z.strictObject({
  nameKey: text,
  base: z.strictObject({ maxHp: positive, maxMana: positive, power: positive, guard: positive }),
  growth: z.strictObject({ maxHp: count, maxMana: count, power: count, guard: count }),
  starterGear: z.strictObject({ mainHand: text, body: text }),
});

export const templatesSchema = z.strictObject({
  close: templateSchema,
  ranged: templateSchema,
  support: templateSchema,
});

export type TemplateDef = z.infer<typeof templateSchema>;
export type Templates = z.infer<typeof templatesSchema>;
