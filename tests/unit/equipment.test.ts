import { expect, test } from 'vitest';
import { createContentRegistry } from '@application/ContentRegistry';
import { createNewGameCatalog } from '@application/createNewGameCatalog';
import { equip, unequip } from '@domain/equipment/equipment';
import { applyBagChange } from '@domain/inventory/applyBagChange';
import { checkBagInvariants } from '@domain/inventory/checkBagInvariants';
import { moveSlot } from '@domain/inventory/layout';
import { BAG_CAPACITY, type BagChange, type BagSlot } from '@domain/inventory/types';
import { createNewGame } from '@domain/player/newGame';
import type { GearSlot, NewGameCatalog, PlayerState } from '@domain/player/types';
import { projectStats } from '@domain/progression/projectStats';
import type { Result } from '@shared/result';
import { randomForSeed } from '../helpers/seededRandom';
import { readBundledContent } from '../../src/infrastructure/content/readBundledContent';

const material = { id: 'item_fixture_bark', kind: 'material', stackMax: 3 } as const;
function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(String(result.error));
  return result.value;
}

const content = unwrap(createContentRegistry(readBundledContent()));
const realCatalog = createNewGameCatalog(content);
const catalog: NewGameCatalog = { ...realCatalog, items: { ...realCatalog.items, [material.id]: material } };
const heroIds = ['hero_storm_monk', 'hero_frostfox_sorceress', 'hero_aurora_priestess'] as const;
const weaponIds = ['item_ironheart_blade', 'item_ironwood_longbow', 'item_prism_focus'] as const;
const gearSlots = ['mainHand', 'body', 'accessory'] as const satisfies readonly GearSlot[];

function start(heroId: string = heroIds[0]): PlayerState {
  return unwrap(createNewGame({ heroId, mode: 'peaceful' }, catalog, {
    mapId: 'map_starbrook_village', x: 784, y: 280,
  }));
}

function bagChange(state: PlayerState, change: Partial<BagChange>) {
  return applyBagChange(state, { add: [], remove: [], ...change }, catalog);
}

const gearRef = (gearId: string) => ({ kind: 'gear', gearId }) as const;
function fullBag(): PlayerState {
  return unwrap(bagChange(start(), {
    add: [{ itemId: material.id, quantity: (BAG_CAPACITY - 1) * material.stackMax }],
    addGear: [{ id: weaponIds[0] }],
  })).state;
}

test('equips an empty slot and projects exactly the accessory stats until unequipped', () => {
  const initial = unwrap(bagChange(start(), { addGear: [{ id: 'item_star_compass' }] })).state;
  const base = unwrap(projectStats(initial, catalog));
  const equipped = unwrap(equip(initial, 'g3', catalog));
  expect(equipped.equipped.accessory).toBe('g3');
  expect(equipped.bag[0]).toBeNull();
  expect(equipped.gear).toBe(initial.gear);
  expect(checkBagInvariants(equipped, catalog)).toEqual([]);
  expect(unwrap(projectStats(equipped, catalog))).toEqual({
    maxHp: base.maxHp + 10, maxMana: base.maxMana + 10, power: base.power + 2, guard: base.guard + 2,
  });
  const restored = unwrap(unequip(equipped, 'accessory'));
  expect(restored).toEqual(initial);
  expect(unwrap(projectStats(restored, catalog))).toEqual(base);
});

test('swaps the old weapon into the exact vacated slot even when the bag is full', () => {
  const initial = fullBag();
  expect(initial.bag.every((slot) => slot !== null)).toBe(true);
  const upgraded = { ...initial, gear: initial.gear.map((gear) => gear.id === 'g1' ? { ...gear, upgrade: 2 } : gear) };
  const result = unwrap(equip(upgraded, 'g3', catalog));
  expect(result.equipped.mainHand).toBe('g3');
  expect(result.bag).toEqual([...initial.bag.slice(0, -1), gearRef('g1')]);
  expect(result.gear).toBe(upgraded.gear);
  expect(checkBagInvariants(result, catalog)).toEqual([]);
  expect(upgraded.bag.at(-1)).toEqual(gearRef('g3'));
});

test('swaps gear into its vacated slot even when an earlier bag slot is empty', () => {
  const initial = unwrap(bagChange(start(), { addGear: [{ id: weaponIds[0] }] })).state;
  const moved = unwrap(moveSlot(initial, 0, 4, catalog));
  const swapped = unwrap(equip(moved, 'g3', catalog));
  expect(swapped.bag.slice(0, 5)).toEqual([null, null, null, null, gearRef('g1')]);
});

test.each(heroIds.flatMap((heroId, index) => weaponIds.filter((_, weapon) => weapon !== index)
  .map((weaponId) => [heroId, weaponId] as const)))('%s rejects mismatched weapon %s', (heroId, weaponId) => {
  const initial = unwrap(bagChange(start(heroId), { addGear: [{ id: weaponId }] })).state;
  const before = structuredClone(initial);
  expect(equip(initial, 'g3', catalog)).toEqual({ ok: false, error: 'WRONG_TEMPLATE' });
  expect(initial).toEqual(before);
});

test.each(heroIds)('%s can equip template-null body and accessory gear', (heroId) => {
  const initial = unwrap(bagChange(start(heroId), {
    addGear: [{ id: 'item_mossweave_robe' }, { id: 'item_copper_band' }],
  })).state;
  const equipped = unwrap(equip(unwrap(equip(initial, 'g3', catalog)), 'g4', catalog));
  expect(equipped.equipped).toEqual({ mainHand: 'g1', body: 'g3', accessory: 'g4' });
  expect(equipped.bag.slice(0, 2)).toEqual([gearRef('g2'), null]);
  expect(checkBagInvariants(equipped, catalog)).toEqual([]);
});

test('unequips into the first empty slot and rejects empty equipment slots and equipped gear IDs', () => {
  const initial = unwrap(bagChange(start(), { add: [{ itemId: material.id, quantity: 3 }] })).state;
  const result = unwrap(unequip(initial, 'mainHand'));
  expect(result.bag.slice(0, 3)).toEqual([
    { kind: 'stack', itemId: material.id, quantity: 3 }, gearRef('g1'), null,
  ]);
  expect(result.equipped).toEqual({ body: 'g2' });
  expect(checkBagInvariants(result, catalog)).toEqual([]);
  expect(unequip(result, 'mainHand')).toEqual({ ok: false, error: 'SLOT_EMPTY' });
  expect(equip(result, 'g2', catalog)).toEqual({ ok: false, error: 'GEAR_NOT_IN_BAG' });
});

test('unequip rejects a full bag without replacing or mutating the input state', () => {
  const original = fullBag();
  const before = structuredClone(original);
  let current = original;
  const result = unequip(current, 'mainHand');
  if (result.ok) current = result.value;
  expect(result).toEqual({ ok: false, error: 'BAG_FULL' });
  expect(current).toBe(original);
  expect(original).toEqual(before);
});

const operations = ['add', 'remove', 'addGear', 'removeGear', 'move', 'equip', 'unequip'] as const;
type Operation = typeof operations[number];

function randomAction(
  state: PlayerState, operation: Operation, random: ReturnType<typeof randomForSeed>, expectedIds: Set<string>,
): Result<PlayerState, string> {
  switch (operation) {
    case 'add':
    case 'remove': {
      const result = bagChange(state, { [operation]: [{ itemId: material.id, quantity: random(30) }] });
      return result.ok ? { ok: true, value: result.value.state } : result;
    }
    case 'addGear': {
      const definitions = [...weaponIds, 'item_mossweave_robe', 'item_copper_band'];
      const result = bagChange(state, { addGear: [{ id: definitions[random(definitions.length)]! }] });
      if (!result.ok) return result;
      expectedIds.add(`g${state.nextGearSeq}`);
      return { ok: true, value: result.value.state };
    }
    case 'removeGear':
    case 'equip': {
      const ids = state.gear.map(({ id }) => id);
      const gearId = ids[random(ids.length + 1)] ?? 'missing';
      if (operation === 'equip') return equip(state, gearId, catalog);
      const result = bagChange(state, { removeGearIds: [gearId] });
      if (!result.ok) return result;
      expectedIds.delete(gearId);
      return { ok: true, value: result.value.state };
    }
    case 'move':
      return moveSlot(state, random(BAG_CAPACITY + 2) - 1, random(BAG_CAPACITY + 2) - 1, catalog);
    case 'unequip':
      return unequip(state, gearSlots[random(gearSlots.length)]!);
  }
}

function locationGearId(slot: BagSlot): string[] {
  return slot?.kind === 'gear' ? [slot.gearId] : [];
}

test('T07 preserves every gear instance across 1000 seeded sequences of 60 operations', () => {
  const summary = Object.fromEntries(operations.map((operation) => [operation, { success: 0, rejected: 0 }])) as
    Record<Operation, { success: number; rejected: number }>;
  for (let seed = 1; seed <= 1000; seed++) {
    const random = randomForSeed(seed);
    let current = start(heroIds[random(heroIds.length)]);
    const expectedIds = new Set(current.gear.map(({ id }) => id));
    for (let step = 1; step <= 60; step++) {
      const operation = operations[random(operations.length)]!;
      try {
        const original = current;
        const before = JSON.stringify(original);
        const result = randomAction(original, operation, random, expectedIds);
        if (result.ok) {
          summary[operation].success++;
          current = result.value;
        } else {
          summary[operation].rejected++;
          if (current !== original) throw new Error('Rejection replaced the state.');
        }
        if (JSON.stringify(original) !== before) throw new Error('Input state was mutated.');
        const violations = checkBagInvariants(current, catalog);
        if (violations.length) throw new Error(violations.join(' '));
        const expected = [...expectedIds].sort().join(',');
        const instances = current.gear.map(({ id }) => id).sort().join(',');
        const locations = [...current.bag.flatMap(locationGearId), ...Object.values(current.equipped)].sort().join(',');
        if (expected !== instances || expected !== locations) {
          throw new Error(`Expected IDs [${expected}], found instances [${instances}] and locations [${locations}].`);
        }
      } catch (error) {
        throw new Error(`Seed ${seed}, step ${step} (${operation}): ${String(error)}`, { cause: error });
      }
    }
  }
  for (const { success, rejected } of Object.values(summary)) {
    expect(success).toBeGreaterThan(0);
    expect(rejected).toBeGreaterThan(0);
  }
  console.log('T07: 1000 sequences × 60 operations (60000 steps).', JSON.stringify(summary));
}, 20_000);
