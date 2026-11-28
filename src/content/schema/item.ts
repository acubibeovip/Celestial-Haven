import { z } from 'zod';
import { count, templateId, text } from './common.ts';

export const gearSchema = z.strictObject({
  slot: z.enum(['mainHand', 'body', 'accessory']),
  upgradeTier: z.enum(['copper', 'iron', 'starlite']),
  stats: z.strictObject({
    power: count.optional(),
    guard: count.optional(),
    maxHp: count.optional(),
    maxMana: count.optional(),
  }).refine((stats) => Object.values(stats).some((value) => value !== undefined), 'Expected at least one gear stat.'),
  template: templateId.nullable(),
});

export const itemSchema = z.strictObject({
  id: z.string(),
  nameKey: text,
  kind: z.enum(['material', 'gear', 'consumable', 'quest']),
  stackMax: z.int().min(1).max(99),
  icon: text,
  price: count,
  gear: gearSchema.optional(),
}).superRefine((item, context) => {
  if (item.kind === 'quest' && item.price !== 0) {
    context.addIssue({ code: 'custom', path: ['price'], message: 'Quest items have price 0.' });
  }
  if (item.kind === 'gear') {
    if (!item.gear) context.addIssue({ code: 'custom', path: ['gear'], message: 'Gear items require gear data.' });
    if (item.stackMax !== 1) context.addIssue({ code: 'custom', path: ['stackMax'], message: 'Gear items have stackMax 1.' });
  } else if (item.gear) {
    context.addIssue({ code: 'custom', path: ['gear'], message: 'Only gear items may have gear data.' });
  }
});

export type ItemDef = z.infer<typeof itemSchema>;
