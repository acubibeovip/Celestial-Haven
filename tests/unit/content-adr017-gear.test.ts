import { expect, test } from 'vitest';
import type { GearItemInfo } from '@domain/player/types';
import { createContentRegistry } from '@application/ContentRegistry';
import { readBundledContent } from '../../src/infrastructure/content/readBundledContent';

type GearRow = [string, string, GearItemInfo['slot'], GearItemInfo['template'], GearItemInfo['upgradeTier'], GearItemInfo['stats'], number];

const gearRows: GearRow[] = [
  ['training_blade', 'Training Blade', 'mainHand', 'close', 'copper', { power: 3 }, 0],
  ['willow_shortbow', 'Willow Shortbow', 'mainHand', 'ranged', 'copper', { power: 3 }, 0],
  ['lantern_focus', 'Lantern Focus', 'mainHand', 'support', 'copper', { power: 1, maxMana: 10 }, 0],
  ['ironheart_blade', 'Ironheart Blade', 'mainHand', 'close', 'iron', { power: 6 }, 200],
  ['ironwood_longbow', 'Ironwood Longbow', 'mainHand', 'ranged', 'iron', { power: 6 }, 200],
  ['prism_focus', 'Prism Focus', 'mainHand', 'support', 'iron', { power: 3, maxMana: 20 }, 200],
  ['starlite_edge', 'Starlite Edge', 'mainHand', 'close', 'starlite', { power: 10 }, 400],
  ['starlite_bow', 'Starlite Bow', 'mainHand', 'ranged', 'starlite', { power: 10 }, 400],
  ['starlite_focus', 'Starlite Focus', 'mainHand', 'support', 'starlite', { power: 5, maxMana: 30 }, 400],
  ['traveler_tunic', "Traveler's Tunic", 'body', null, 'copper', { guard: 2, maxHp: 10 }, 0],
  ['woven_jerkin', 'Woven Jerkin', 'body', null, 'copper', { guard: 3, maxHp: 15 }, 60],
  ['copper_ring_coat', 'Copper Ring Coat', 'body', null, 'copper', { guard: 5, maxHp: 10 }, 120],
  ['mossweave_robe', 'Mossweave Robe', 'body', null, 'iron', { guard: 2, maxHp: 10, maxMana: 15 }, 180],
  ['iron_guard_mail', 'Iron Guard Mail', 'body', null, 'iron', { guard: 8, maxHp: 20 }, 260],
  ['starlite_mantle', 'Starlite Mantle', 'body', null, 'starlite', { guard: 10, maxHp: 30, maxMana: 10 }, 450],
  ['copper_band', 'Copper Band', 'accessory', null, 'copper', { power: 1, guard: 1 }, 50],
  ['feather_charm', 'Feather Charm', 'accessory', null, 'copper', { maxHp: 15 }, 80],
  ['silverleaf_pendant', 'Silverleaf Pendant', 'accessory', null, 'iron', { maxHp: 10, maxMana: 10 }, 160],
  ['moonpetal_brooch', 'Moonpetal Brooch', 'accessory', null, 'iron', { maxMana: 20 }, 150],
  ['star_compass', 'Star Compass', 'accessory', null, 'starlite', { power: 2, guard: 2, maxHp: 10, maxMana: 10 }, 450],
];

test('all 20 gear definitions, the slot split, and display names match ADR-017 and D38', () => {
  const result = createContentRegistry(readBundledContent());
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  const { items, text } = result.value;
  const gear = [...items.values()].filter((item) => item.kind === 'gear');
  expect(gear).toHaveLength(20);
  for (const [slot, count] of [['mainHand', 9], ['body', 6], ['accessory', 5]] as const) {
    expect(gear.filter((item) => item.gear?.slot === slot)).toHaveLength(count);
  }
  for (const [suffix, name, slot, template, upgradeTier, stats, price] of gearRows) {
    const nameKey = `item.${suffix}.name`;
    const id = `item_${suffix}`;
    expect(items.get(id), id).toEqual({
      id, nameKey, kind: 'gear', stackMax: 1, icon: `icon_${suffix}`, price,
      gear: { slot, template, upgradeTier, stats },
    });
    expect(text(nameKey), id).toBe(name);
  }
});
