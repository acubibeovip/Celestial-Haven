import { expect, expectTypeOf, test } from 'vitest';
import type { ItemDef } from '../../src/content/schema/item';
import type { itemStack } from '../../src/content/schema/common';
import type { z } from 'zod';
import { applyBagChange } from '@domain/inventory/applyBagChange';
import { checkBagInvariants, countItem } from '@domain/inventory/checkBagInvariants';
import { assignHotbar, moveSlot } from '@domain/inventory/layout';
import { BAG_CAPACITY, HOTBAR_CAPACITY, type BagChange, type BagSlot, type ItemStack } from '@domain/inventory/types';
import type { ItemInfo, PlayerState } from '@domain/player/types';
import { randomForSeed } from '../helpers/seededRandom';

const items = {
  ore: { id: 'ore', kind: 'material', stackMax: 99 },
  bark: { id: 'bark', kind: 'material', stackMax: 3 },
  tonic: { id: 'tonic', kind: 'consumable', stackMax: 10 },
  lantern: { id: 'lantern', kind: 'quest', stackMax: 1 },
  blade: { id: 'blade', kind: 'gear', stackMax: 1 },
  coat: { id: 'coat', kind: 'gear', stackMax: 1 },
} as const satisfies Record<string, ItemInfo>;
const catalog = { items };
const itemIds = Object.keys(items) as (keyof typeof items)[];
const stack = (itemId: string, quantity: number) => ({ kind: 'stack', itemId, quantity } as const);
const ref = (gearId: string) => ({ kind: 'gear', gearId } as const);

function player(slots: readonly BagSlot[] = []): PlayerState {
  const bag = Array<BagSlot>(BAG_CAPACITY).fill(null);
  for (const [index, slot] of slots.entries()) bag[index] = slot;
  return {
    location: { mapId: 'test_map', x: 0, y: 0 }, heroId: 'test_hero', mode: 'peaceful',
    level: 1, xp: 0, coins: 0, bag, hotbar: Array<null>(HOTBAR_CAPACITY).fill(null),
    gear: [{ id: 'g1', defId: 'blade', upgrade: 0 }], equipped: { mainHand: 'g1' },
    nextGearSeq: 2, rewardLedger: [], quests: {}, npcBond: {},
  };
}

function transact(state: PlayerState, change: Partial<BagChange>) {
  return applyBagChange(state, { remove: [], add: [], ...change }, catalog);
}

function changed(state: PlayerState, change: Partial<BagChange>) {
  const result = transact(state, change);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

test('content item and stack types match the domain contract', () => {
  expectTypeOf<ItemDef>().toExtend<ItemInfo>();
  expectTypeOf<ItemDef['kind']>().toEqualTypeOf<ItemInfo['kind']>();
  expectTypeOf<z.infer<typeof itemStack>>().toExtend<ItemStack>();
});

test('tops up stacks in slot order, spills beyond 99, and removes from the end without compacting', () => {
  const initial = player([stack('ore', 97), null, stack('ore', 98), stack('bark', 1)]);
  const added = changed(initial, { add: [{ itemId: 'ore', quantity: 2 }, { itemId: 'ore', quantity: 102 }] }).state;
  expect(added.bag.slice(0, 5)).toEqual([stack('ore', 99), stack('ore', 99), stack('ore', 99), stack('bark', 1), stack('ore', 2)]);
  const removed = changed(added, { remove: [{ itemId: 'ore', quantity: 1 }, { itemId: 'ore', quantity: 4 }] }).state;
  expect(removed.bag.slice(0, 5)).toEqual([stack('ore', 99), stack('ore', 99), stack('ore', 96), stack('bark', 1), null]);
});

test('removes three inputs before filling a freed slot in a full bag', () => {
  const original = player([...Array<BagSlot>(21).fill(stack('ore', 99)), ...Array<BagSlot>(3).fill(stack('lantern', 1))]);
  const { state } = changed(original, { remove: [{ itemId: 'lantern', quantity: 3 }], add: [{ itemId: 'tonic', quantity: 1 }] });
  expect(state.bag.slice(21)).toEqual([stack('tonic', 1), null, null]);
  expect(countItem(original, 'lantern')).toBe(3);
});

test('BAG_FULL rolls back a partial removal and top-up with no spare slot', () => {
  const original = player([...Array<BagSlot>(23).fill(stack('ore', 99)), stack('bark', 2)]);
  const before = structuredClone(original);
  let current = original;
  const result = transact(current, { remove: [{ itemId: 'ore', quantity: 1 }], add: [{ itemId: 'bark', quantity: 2 }] });
  if (result.ok) current = result.value.state;
  expect(result).toEqual({ ok: false, error: 'BAG_FULL' });
  expect(current).toBe(original);
  expect(original).toEqual(before);
});

test.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid quantity %s', (quantity) => {
  expect(transact(player(), { add: [{ itemId: 'ore', quantity }] })).toEqual({ ok: false, error: 'INVALID_QUANTITY' });
});

test('rejects unsafe merged totals and invalid lines hidden among valid duplicates', () => {
  for (const [a, b] of [[Number.MAX_SAFE_INTEGER, 1], [-1, 2]] as const) {
    expect(transact(player(), { add: [{ itemId: 'ore', quantity: a }, { itemId: 'ore', quantity: b }] }))
      .toEqual({ ok: false, error: 'INVALID_QUANTITY' });
  }
});

test.each([
  [{ add: [{ itemId: '__proto__', quantity: 1 }] }, 'UNKNOWN_ITEM'],
  [{ addGear: [{ id: 'missing' }] }, 'UNKNOWN_ITEM'],
  [{ add: [{ itemId: 'blade', quantity: 1 }] }, 'WRONG_ITEM_KIND'],
  [{ addGear: [items.ore] }, 'WRONG_ITEM_KIND'],
  [{ remove: [{ itemId: 'ore', quantity: 2 }, { itemId: 'ore', quantity: 3 }] }, 'INSUFFICIENT_ITEMS'],
  [{ removeGearIds: ['g1'] }, 'GEAR_NOT_IN_BAG'],
] as const)('rejects %j with %s', (change, error) => {
  const original = player([stack('ore', 4)]);
  const before = structuredClone(original);
  expect(transact(original, change)).toEqual({ ok: false, error });
  expect(original).toEqual(before);
});

test('allocates consecutive gear IDs, uses bag slots, and keeps equipped gear outside the count', () => {
  const initial = player([null, stack('ore', 1)]);
  const { state, createdGearIds } = changed(initial, { addGear: [items.blade, items.coat] });
  expect(createdGearIds).toEqual(['g2', 'g3']);
  expect(state.bag.slice(0, 3)).toEqual([ref('g2'), stack('ore', 1), ref('g3')]);
  expect(state.gear.slice(1)).toEqual([{ id: 'g2', defId: 'blade', upgrade: 0 }, { id: 'g3', defId: 'coat', upgrade: 0 }]);
  expect(countItem(state, 'blade')).toBe(1);
  expect(state.nextGearSeq).toBe(4);
  const swapped = moveSlot(state, 0, 1, catalog);
  if (!swapped.ok) throw new Error(swapped.error);
  expect(swapped.value.bag.slice(0, 3)).toEqual([stack('ore', 1), ref('g2'), ref('g3')]);
  expect(checkBagInvariants(swapped.value, catalog)).toEqual([]);
  expect(transact(state, { removeGearIds: ['g2', 'g2'] })).toEqual({ ok: false, error: 'GEAR_NOT_IN_BAG' });

  const removed = changed(state, { removeGearIds: ['g2'], add: [{ itemId: 'bark', quantity: 1 }] }).state;
  expect(removed.bag[0]).toEqual(stack('bark', 1));
  expect(removed.gear.map(({ id }) => id)).toEqual(['g1', 'g3']);
  expect(removed.equipped).toEqual({ mainHand: 'g1' });
  expect(removed.nextGearSeq).toBe(4);
});

test('rejects full-bag gear allocation without advancing its sequence or consuming a staged input', () => {
  const state = player(Array<BagSlot>(24).fill(stack('ore', 99)));
  expect(transact(state, { remove: [{ itemId: 'ore', quantity: 1 }], addGear: [items.blade] }))
    .toEqual({ ok: false, error: 'BAG_FULL' });
  expect(state.nextGearSeq).toBe(2);
  expect(state.gear).toEqual([{ id: 'g1', defId: 'blade', upgrade: 0 }]);
  expect(countItem(state, 'ore')).toBe(2376);
});

test('moves into empty slots, merges with a remainder, merges completely, and swaps other items', () => {
  const initial = player([stack('ore', 10), stack('ore', 97), null, stack('bark', 2), stack('ore', 1)]);
  const apply = (state: PlayerState, from: number, to: number) => {
    const result = moveSlot(state, from, to, catalog);
    if (!result.ok) throw new Error(result.error);
    return result.value;
  };
  const moved = apply(initial, 3, 2);
  expect(moved.bag.slice(2, 4)).toEqual([stack('bark', 2), null]);
  const merged = apply(moved, 0, 1);
  expect(merged.bag.slice(0, 2)).toEqual([stack('ore', 8), stack('ore', 99)]);
  const all = apply(merged, 4, 0);
  expect(all.bag[4]).toBeNull();
  expect(all.bag[0]).toEqual(stack('ore', 9));
  const swapped = apply(all, 0, 2);
  expect(swapped.bag.slice(0, 3)).toEqual([stack('bark', 2), stack('ore', 99), stack('ore', 9)]);
  expect(apply(swapped, 4, 5)).toBe(swapped);
  expect(apply(swapped, 0, 0)).toBe(swapped);
  expect(initial.bag[3]).toEqual(stack('bark', 2));
});

test.each([[-1, 0], [0, 24], [1.5, 0], [0, NaN]])('rejects slot move from %s to %s', (from, to) => {
  expect(moveSlot(player(), from, to, catalog)).toEqual({ ok: false, error: 'INVALID_SLOT' });
});

test('hotbar accepts an unowned consumable and null, and rejects other items and invalid slots', () => {
  const state = player();
  const assigned = assignHotbar(state, 3, 'tonic', catalog);
  if (!assigned.ok) throw new Error(assigned.error);
  expect(countItem(state, 'tonic')).toBe(0);
  expect(assigned.value.hotbar).toEqual([null, null, null, 'tonic']);
  expect(assignHotbar(assigned.value, 3, null, catalog)).toEqual({ ok: true, value: state });
  for (const item of ['ore', 'blade', 'lantern']) {
    expect(assignHotbar(state, 0, item, catalog)).toEqual({ ok: false, error: 'WRONG_ITEM_KIND' });
  }
  expect(assignHotbar(state, 0, 'missing', catalog)).toEqual({ ok: false, error: 'UNKNOWN_ITEM' });
  expect(assignHotbar(state, 4, 'tonic', catalog)).toEqual({ ok: false, error: 'INVALID_SLOT' });
  expect(state.hotbar).toEqual([null, null, null, null]);
});

test('checks fixed lengths, stack limits, hotbar items, and exclusive gear ownership', () => {
  const state = player([stack('ore', 100), stack('blade', 1), ref('g1'), ref('missing')]);
  state.gear.push({ id: 'g2', defId: 'coat', upgrade: 0 });
  state.bag.pop();
  state.hotbar = ['ore'];
  expect(checkBagInvariants(state, catalog)).toEqual([
    'Expected 24 bag slots.',
    'Invalid quantity at bag slot 0.',
    'Invalid stack item at bag slot 1.',
    'Gear g1 must occupy exactly one bag or equipped slot.',
    'Gear g2 must occupy exactly one bag or equipped slot.',
    'Missing gear instance missing.',
    'Expected 4 hotbar slots.',
    'Invalid hotbar item at slot 0.',
  ]);
});

const operations = ['add', 'remove', 'addGear', 'removeGear', 'move'] as const;
type Operation = typeof operations[number];

function randomAction(state: PlayerState, operation: Operation, random: ReturnType<typeof randomForSeed>) {
  const itemId = itemIds[random(itemIds.length)]!;
  switch (operation) {
    case 'add': {
      const quantity = random(6) === 0 ? random(3) - 1 : random(180) + 1;
      const result = transact(state, { add: [{ itemId, quantity }] });
      return { next: result.ok ? result.value.state : null, itemId, delta: quantity };
    }
    case 'remove': {
      const quantity = random(60) + 1;
      const result = transact(state, { remove: [{ itemId, quantity }] });
      return { next: result.ok ? result.value.state : null, itemId, delta: -quantity };
    }
    case 'addGear': {
      const result = transact(state, { addGear: [items[itemId]] });
      return { next: result.ok ? result.value.state : null, itemId, delta: 1 };
    }
    case 'removeGear': {
      const knownSlots = state.bag.filter((slot) => slot?.kind === 'gear');
      const gearId = random(4) === 0 ? 'g1' : knownSlots[random(knownSlots.length)]?.gearId ?? 'missing';
      const defId = state.gear.find(({ id }) => id === gearId)?.defId;
      const result = transact(state, { removeGearIds: [gearId] });
      return { next: result.ok ? result.value.state : null, itemId: defId, delta: -1 };
    }
    case 'move': {
      const result = moveSlot(state, random(26) - 1, random(26) - 1, catalog);
      return { next: result.ok ? result.value : null, itemId: null, delta: 0 };
    }
  }
}

test('checks inventory invariants, deltas and rollback over 2000 seeded sequences of 50 operations', () => {
  const summary = Object.fromEntries(operations.map((op) => [op, { success: 0, rejected: 0 }])) as
    Record<Operation, { success: number; rejected: number }>;
  for (let seed = 1; seed <= 2000; seed++) {
    const random = randomForSeed(seed);
    let current = player();
    for (let step = 1; step <= 50; step++) {
      const operation = operations[random(operations.length)]!;
      try {
        const original = current;
        const before = JSON.stringify(original);
        const expected = itemIds.map((id) => countItem(original, id));
        const { next, itemId, delta } = randomAction(original, operation, random);
        if (next) {
          summary[operation].success++;
          current = next;
          for (const [index, id] of itemIds.entries()) {
            if (id === itemId) expected[index] = expected[index]! + delta;
          }
        } else {
          summary[operation].rejected++;
          if (current !== original) throw new Error('Rejection replaced the state.');
        }
        if (JSON.stringify(original) !== before) throw new Error('An operation changed the input state.');
        const violations = checkBagInvariants(current, catalog);
        if (violations.length) throw new Error(violations.join(' '));
        for (const [index, id] of itemIds.entries()) {
          const actual = countItem(current, id);
          if (actual !== expected[index]) throw new Error(`${id}: expected ${expected[index]}, received ${actual}.`);
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
  console.log('Inventory: 2000 sequences × 50 operations (100000 steps).', JSON.stringify(summary));
}, 20_000);
