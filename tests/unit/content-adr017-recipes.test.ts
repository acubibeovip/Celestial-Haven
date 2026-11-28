import { expect, expectTypeOf, test } from 'vitest';
import { createContentRegistry } from '@application/ContentRegistry';
import type { CraftStation, RecipeInfo } from '@domain/crafting/craft';
import type { RecipeDef } from '../../src/content/schema/recipe';
import { validateContent } from '../../src/content/validate';
import { readBundledContent } from '../../src/infrastructure/content/readBundledContent';

const files = readBundledContent();
const registry = createContentRegistry(files);
if (!registry.ok) throw new Error(JSON.stringify(registry.error));
const { items, recipes, text } = registry.value;

test('all nine crafting items match the ADR-017 kinds and reference prices', () => {
  const rows = [
    ['plank', 'Plank', 'material', 15], ['woven_cloth', 'Woven Cloth', 'material', 20],
    ['quartz_lens', 'Quartz Lens', 'material', 45], ['copper_ingot', 'Copper Ingot', 'material', 35],
    ['iron_ingot', 'Iron Ingot', 'material', 55], ['starlite_ingot', 'Starlite Ingot', 'material', 100],
    ['silverleaf_tonic', 'Silverleaf Tonic', 'consumable', 15],
    ['moonpetal_draught', 'Moonpetal Draught', 'consumable', 20],
    ['star_lantern', 'Star Lantern', 'quest', 0],
  ] as const;
  expect(items.size).toBe(43);
  for (const [suffix, name, kind, price] of rows) {
    const id = `item_${suffix}`;
    const nameKey = `item.${suffix}.name`;
    expect(items.get(id), id).toEqual({
      id, nameKey, kind, price, icon: `icon_${suffix}`, stackMax: kind === 'quest' ? 1 : 99,
    });
    expect(text(nameKey)).toBe(name);
  }
});

test('R01–R15 match the ADR-017 stations, inputs, outputs, quantities and null requirements', () => {
  expectTypeOf<RecipeDef>().toExtend<RecipeInfo>();
  const rows: [string, CraftStation, number, [string, number][]][] = [
    ['plank', 'workbench', 1, [['oak_log', 2]]],
    ['woven_cloth', 'workbench', 1, [['reed_fiber', 3]]],
    ['quartz_lens', 'workbench', 1, [['quartz', 2], ['resin', 1]]],
    ['copper_ingot', 'forge', 1, [['copper_ore', 3], ['coal', 1]]],
    ['iron_ingot', 'forge', 1, [['iron_ore', 3], ['coal', 1]]],
    ['starlite_ingot', 'forge', 1, [['starlite_ore', 3], ['coal', 2]]],
    ['ironheart_blade', 'forge', 1, [['iron_ingot', 3], ['plank', 1]]],
    ['ironwood_longbow', 'forge', 1, [['iron_ingot', 2], ['plank', 2], ['woven_cloth', 1]]],
    ['prism_focus', 'forge', 1, [['iron_ingot', 2], ['quartz', 2], ['glow_moss', 1]]],
    ['starlite_edge', 'forge', 1, [['starlite_ingot', 3], ['iron_ingot', 1], ['quartz_lens', 1]]],
    ['starlite_bow', 'forge', 1, [['starlite_ingot', 2], ['plank', 2], ['woven_cloth', 1], ['soft_feather', 1]]],
    ['starlite_focus', 'forge', 1, [['starlite_ingot', 2], ['quartz_lens', 1], ['moonpetal', 2]]],
    ['star_lantern', 'workbench', 1, [['starlite_ingot', 1], ['quartz_lens', 1], ['glow_moss', 2], ['clay', 1]]],
    ['silverleaf_tonic', 'workbench', 2, [['silverleaf', 2], ['clay', 1]]],
    ['moonpetal_draught', 'workbench', 2, [['moonpetal', 2], ['clay', 1]]],
  ];
  expect(recipes.size).toBe(15);
  for (const [suffix, station, quantity, inputs] of rows) {
    const id = `recipe_${suffix}`;
    expect(recipes.get(id), id).toEqual({
      id, station, inputs: inputs.map(([itemId, amount]) => ({ itemId: `item_${itemId}`, quantity: amount })),
      outputs: [{ itemId: `item_${suffix}`, quantity }], requirement: null,
    });
  }
});

test.each([
  [{ station: 'anvil' }, '$[0].station'],
  [{ outputs: [{ itemId: 'item_ironheart_blade', quantity: 2 }] }, '$[0].outputs[0].quantity'],
])('rejects recipe constraint %j at %s', (override, path) => {
  const recipe = recipes.get('recipe_ironheart_blade');
  expect(validateContent({ ...files, 'recipes.json': [{ ...recipe, ...override }] })).toEqual({
    ok: false, error: [expect.objectContaining({ file: 'recipes.json', code: 'SCHEMA', path })],
  });
});
