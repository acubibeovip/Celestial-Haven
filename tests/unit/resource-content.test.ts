import { expect, expectTypeOf, test } from 'vitest';
import { createContentRegistry } from '@application/ContentRegistry';
import type { ResourceNode } from '@domain/gathering/harvest';
import type { ResourceNodeDef } from '../../src/content/schema/resourceNode';
import { validateContent } from '../../src/content/validate';
import { readBundledContent } from '../../src/infrastructure/content/readBundledContent';

const files = readBundledContent();
const registry = createContentRegistry(files);
if (!registry.ok) throw new Error(JSON.stringify(registry.error));

const materials = [
  ['oak_log', 'Oak Log', 6, 'gather', 3],
  ['resin', 'Resin', 8, 'gather', 2],
  ['silverleaf', 'Silverleaf', 8, 'gather', 1],
  ['moonpetal', 'Moonpetal', 12, 'gather', 1],
  ['reed_fiber', 'Reed Fiber', 6, 'gather', 2],
  ['glow_moss', 'Glow Moss', 10, 'gather', 1],
  ['soft_feather', 'Soft Feather', 12, 'gather', 1],
  ['clay', 'Clay', 6, 'gather', 1],
  ['stone', 'Stone', 4, 'mine', 3],
  ['coal', 'Coal', 8, 'mine', 3],
  ['copper_ore', 'Copper Ore', 10, 'mine', 2],
  ['iron_ore', 'Iron Ore', 16, 'mine', 2],
  ['quartz', 'Quartz', 18, 'mine', 1],
  ['starlite_ore', 'Starlite Ore', 30, 'mine', 1],
] as const;

test('all 14 raw materials match ADR-017 and each has its assigned deterministic nodes', () => {
  expectTypeOf<ResourceNodeDef>().toExtend<ResourceNode>();
  const { items, text, resourceNodes } = registry.value;
  const nodes = [...resourceNodes.values()];
  expect(nodes.filter(({ kind }) => kind === 'gather')).toHaveLength(12);
  expect(nodes.filter(({ kind }) => kind === 'mine')).toHaveLength(12);
  const rare = new Set(['moonpetal', 'soft_feather', 'quartz', 'starlite_ore']);
  for (const [suffix, name, price, kind, count] of materials) {
    const id = `item_${suffix}`;
    const nameKey = `item.${suffix}.name`;
    expect(items.get(id)).toEqual({ id, nameKey, kind: 'material', stackMax: 99, price, icon: `icon_${suffix}` });
    expect(text(nameKey)).toBe(name);
    expect(nodes.filter(({ itemId }) => itemId === id)).toEqual(Array.from({ length: count }, (_, index) => ({
      id: `res_${suffix}_${String(index + 1).padStart(2, '0')}`, itemId: id, kind,
      quantity: rare.has(suffix) ? 1 : 2, respawnDays: rare.has(suffix) ? 2 : 1,
    })));
  }
});

test.each([
  [{ id: 'node_test' }, 'ID_PREFIX', '$[0].id'],
  [{ itemId: 'item_missing' }, 'MISSING_REF', '$[0].itemId'],
  [{ itemId: 'item_training_blade' }, 'SCHEMA', '$[0].itemId'],
  [{ kind: 'mine' }, 'SCHEMA', '$[0].kind'],
  [{ quantity: 0 }, 'SCHEMA', '$[0].quantity'],
  [{ quantity: 10 }, 'SCHEMA', '$[0].quantity'],
  [{ respawnDays: 0 }, 'SCHEMA', '$[0].respawnDays'],
  [{ respawnDays: 8 }, 'SCHEMA', '$[0].respawnDays'],
  [{ extra: true }, 'SCHEMA', '$[0].extra'],
] as const)('resource node override %j is rejected with %s at %s', (override, code, path) => {
  const node = { id: 'res_test', itemId: 'item_oak_log', kind: 'gather', quantity: 1, respawnDays: 1, ...override };
  const result = validateContent({ ...files, 'resourceNodes.json': [node] });
  expect(result).toEqual({ ok: false, error: [
    expect.objectContaining({ file: 'resourceNodes.json', code, path }),
  ] });
});
