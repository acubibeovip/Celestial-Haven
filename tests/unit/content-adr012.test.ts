import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { z } from 'zod';
import { itemSchema } from '../../src/content/schema/item';
import { templatesSchema } from '../../src/content/schema/template';

const data = new URL('../../src/content/data/', import.meta.url);

function readData(file: string): unknown {
  return JSON.parse(readFileSync(new URL(file, data), 'utf8'));
}

test('real templates match ADR-012 base stats, starter gear mappings, and D35 growth', () => {
  expect(templatesSchema.parse(readData('templates.json'))).toEqual({
    close: {
      nameKey: 'ui.template.close',
      base: { maxHp: 120, maxMana: 30, power: 12, guard: 10 },
      growth: { maxHp: 8, maxMana: 2, power: 1, guard: 1 },
      starterGear: { mainHand: 'item_training_blade', body: 'item_traveler_tunic' },
    },
    ranged: {
      nameKey: 'ui.template.ranged',
      base: { maxHp: 90, maxMana: 50, power: 11, guard: 6 },
      growth: { maxHp: 6, maxMana: 4, power: 1, guard: 1 },
      starterGear: { mainHand: 'item_willow_shortbow', body: 'item_traveler_tunic' },
    },
    support: {
      nameKey: 'ui.template.support',
      base: { maxHp: 100, maxMana: 70, power: 8, guard: 8 },
      growth: { maxHp: 6, maxMana: 6, power: 1, guard: 1 },
      starterGear: { mainHand: 'item_lantern_focus', body: 'item_traveler_tunic' },
    },
  });
});

test('real starter gear matches ADR-012 slots, template restrictions, and bonuses', () => {
  const starterIds = new Set(['item_training_blade', 'item_willow_shortbow', 'item_lantern_focus', 'item_traveler_tunic']);
  const items = z.array(itemSchema).parse(readData('items.json')).filter(({ id }) => starterIds.has(id));
  expect(items.map(({ id, gear }) => [id, gear])).toEqual([
    ['item_training_blade', { slot: 'mainHand', upgradeTier: 'copper', template: 'close', stats: { power: 3 } }],
    ['item_willow_shortbow', { slot: 'mainHand', upgradeTier: 'copper', template: 'ranged', stats: { power: 3 } }],
    ['item_lantern_focus', { slot: 'mainHand', upgradeTier: 'copper', template: 'support', stats: { power: 1, maxMana: 10 } }],
    ['item_traveler_tunic', { slot: 'body', upgradeTier: 'copper', template: null, stats: { guard: 2, maxHp: 10 } }],
  ]);
  for (const { id, kind, stackMax, icon, price } of items) {
    expect({ kind, stackMax, icon, price }).toEqual({
      kind: 'gear', stackMax: 1, icon: `icon_${id.slice('item_'.length)}`, price: 0,
    });
  }
});
