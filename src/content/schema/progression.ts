import { z } from 'zod';

const positive = z.int().positive();

export const progressionSchema = z.strictObject({
  levelCap: positive,
  xpToNext: z.array(positive),
  xpSources: z.strictObject({
    gather: positive,
    mine: positive,
    harvest: positive,
    craft: positive,
    craftFirstBonus: positive,
    upgrade: positive,
    befriend: positive,
  }),
}).refine(({ levelCap, xpToNext }) => xpToNext.length === levelCap - 1, {
  path: ['xpToNext'],
  message: 'Expected exactly levelCap - 1 XP thresholds.',
});

export type ProgressionDef = z.infer<typeof progressionSchema>;
