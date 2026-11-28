import { expect, test, vi } from 'vitest';
import { createContentRegistry } from '@application/ContentRegistry';
import { createNewGameCatalog } from '@application/createNewGameCatalog';
import { LocalSession } from '@application/LocalSession';
import { START_MAP_ID } from '@application/MapCatalog';
import { craft, type CraftStation, type RecipeInfo } from '@domain/crafting/craft';
import { applyBagChange } from '@domain/inventory/applyBagChange';
import { checkBagInvariants, countItem } from '@domain/inventory/checkBagInvariants';
import { moveSlot } from '@domain/inventory/layout';
import { BAG_CAPACITY, type BagSlot } from '@domain/inventory/types';
import { createNewGame } from '@domain/player/newGame';
import type { PlayerState } from '@domain/player/types';
import type { Result } from '@shared/result';
import { readBundledContent } from '../../src/infrastructure/content/readBundledContent';
import { loadWorldMaps, readBundledMaps } from '../../src/infrastructure/maps/loadWorldMaps';
import { randomForSeed } from '../helpers/seededRandom';

function valueOf<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

const content = valueOf(createContentRegistry(readBundledContent()));
const catalog = createNewGameCatalog(content);
const newGame = { type: 'NewGame', heroId: 'hero_storm_monk', mode: 'peaceful' } as const;
const plank = catalog.recipes.recipe_plank!;
const clothRecipe = catalog.recipes.recipe_woven_cloth!;
const blade = catalog.recipes.recipe_ironheart_blade!;
const tonic = catalog.recipes.recipe_silverleaf_tonic!;
const ingot = catalog.recipes.recipe_iron_ingot!;
const stack = (itemId: string, quantity: number) => ({ kind: 'stack', itemId, quantity } as const);
const initialLocation = { mapId: START_MAP_ID, x: 784, y: 280 };

function player(...slots: BagSlot[]): PlayerState {
  const state = valueOf(createNewGame(newGame, catalog, initialLocation));
  state.bag.splice(0, slots.length, ...slots);
  return state;
}

test('T05 full-bag craft preserves the original reference, inputs, XP and craft history', () => {
  const initial = player(stack('item_oak_log', 3), ...Array<BagSlot>(23).fill(stack('item_coal', 99)));
  const original = structuredClone(initial);
  let current = initial;
  const result = craft(current, plank, catalog);
  if (result.ok) current = result.value.state;
  expect(result).toEqual({ ok: false, error: 'BAG_FULL' });
  expect(current).toBe(initial);
  expect(initial).toEqual(original);
});

test('T05 consumes ingredients before filling the slot they free in a full bag', () => {
  const initial = player(stack('item_oak_log', 2), ...Array<BagSlot>(23).fill(stack('item_coal', 99)));
  const result = valueOf(craft(initial, plank, catalog));
  expect(result.state.bag).toEqual([stack('item_plank', 1), ...initial.bag.slice(1)]);
  expect(result.state.craftedRecipes).toEqual([plank.id]);
  expect(result.state.xp).toBe(30);
});

test('first R01 grants 30 XP, repeat grants 10, and crafted recipe IDs stay sorted and unique', () => {
  const initial = player(stack('item_oak_log', 4), stack('item_reed_fiber', 3));
  const first = valueOf(craft(initial, plank, catalog));
  expect(first).toMatchObject({ xp: 30, firstTime: true, state: { xp: 30, craftedRecipes: [plank.id] } });
  const repeat = valueOf(craft(first.state, plank, catalog));
  expect(repeat).toMatchObject({ xp: 10, firstTime: false, state: { xp: 40, craftedRecipes: [plank.id] } });
  const cloth = valueOf(craft(initial, clothRecipe, catalog));
  expect(valueOf(craft(cloth.state, plank, catalog)).state.craftedRecipes).toEqual([plank.id, clothRecipe.id]);
});

test('R07 uses nextGearSeq for a single gear output and preserves T07 instance ownership', () => {
  const initial = player(stack('item_iron_ingot', 3), stack('item_plank', 1));
  const result = valueOf(craft(initial, blade, catalog));
  expect(result.createdGearIds).toEqual(['g3']);
  expect(result.state.gear).toEqual([...initial.gear, { id: 'g3', defId: 'item_ironheart_blade', upgrade: 0 }]);
  expect(result.state.nextGearSeq).toBe(4);
  expect(result.state.bag[0]).toEqual({ kind: 'gear', gearId: 'g3' });
  expect(result.state.bag[1]).toBeNull();
  expect(checkBagInvariants(result.state, catalog)).toEqual([]);
});

test('R14 adds two consumables, tops up the existing stack and spills into the first freed slot', () => {
  const initial = player(stack('item_silverleaf', 2), stack('item_clay', 1), stack('item_silverleaf_tonic', 98));
  expect(valueOf(craft(initial, tonic, catalog)).state.bag.slice(0, 3)).toEqual([
    stack('item_silverleaf_tonic', 1), null, stack('item_silverleaf_tonic', 99),
  ]);
});

test('multi-input craft removes quantities across several stacks from the last matching slot first', () => {
  const initial = player(
    stack('item_iron_ore', 5), stack('item_coal', 8), stack('item_iron_ore', 1),
    stack('item_coal', 3), stack('item_iron_ore', 1),
  );
  const result = valueOf(craft(initial, ingot, catalog));
  expect(result.state.bag.slice(0, 5)).toEqual([
    stack('item_iron_ore', 4), stack('item_coal', 8), stack('item_iron_ingot', 1), stack('item_coal', 2), null,
  ]);
});

test('an invalid XP award rolls back an otherwise successful bag change', () => {
  const initial = player(stack('item_oak_log', 2));
  const before = structuredClone(initial);
  const xpSources = { ...catalog.progression.xpSources, craftFirstBonus: Number.MAX_SAFE_INTEGER };
  expect(craft(initial, plank, { ...catalog, progression: { ...catalog.progression, xpSources } }))
    .toEqual({ ok: false, error: 'INVALID_XP_AMOUNT' });
  expect(initial).toEqual(before);
});

const maps = valueOf(loadWorldMaps(readBundledMaps(), content.resourceNodes));
const gatherId = 'res_oak_log_01';
const craftPlank = { type: 'Craft', recipeId: plank.id } as const;
const startingMap = maps.get(START_MAP_ID)!;

function checkpoints(stations: readonly CraftStation[], nodes = [gatherId]) {
  return new Map(maps).set(START_MAP_ID, { ...startingMap, stations: new Set(stations), resourceNodeIds: new Set(nodes) });
}

test('Craft fails closed when not playing, the recipe is unknown, or the map lacks the station', () => {
  const fixture = checkpoints(['forge']);
  const session = new LocalSession(catalog, fixture);
  const listener = vi.fn();
  session.subscribe(listener);
  expect(session.dispatch(craftPlank)).toEqual({ ok: false, error: 'NOT_PLAYING' });
  valueOf(session.dispatch(newGame));
  const before = session.snapshot();
  listener.mockClear();
  expect(session.dispatch({ type: 'Craft', recipeId: 'constructor' })).toEqual({ ok: false, error: 'UNKNOWN_RECIPE' });
  expect(session.dispatch(craftPlank)).toEqual({ ok: false, error: 'NO_STATION_ON_MAP' });
  fixture.delete(START_MAP_ID);
  expect(session.dispatch(craftPlank)).toEqual({ ok: false, error: 'NO_STATION_ON_MAP' });
  expect(session.snapshot()).toBe(before);
  expect(listener).not.toHaveBeenCalled();
  for (const map of maps.values()) expect(map.stations.size).toBe(0);
});

test('Craft commits the snapshot before emitting one ItemCrafted event and preserves it on insufficient items', () => {
  const session = new LocalSession(catalog, checkpoints(['workbench']));
  valueOf(session.dispatch(newGame));
  valueOf(session.dispatch({ type: 'Gather', nodeId: gatherId }));
  const listener = vi.fn(() => session.snapshot());
  session.subscribe(listener);
  valueOf(session.dispatch(craftPlank));
  const snapshot = session.snapshot();
  if (snapshot.phase !== 'playing') throw new Error('Expected a playing snapshot.');
  expect(countItem(snapshot.player, 'item_oak_log')).toBe(0);
  expect(countItem(snapshot.player, 'item_plank')).toBe(1);
  expect(snapshot.player.xp).toBe(34);
  expect(snapshot.player.craftedRecipes).toEqual([plank.id]);
  expect(listener).toHaveBeenCalledExactlyOnceWith({
    type: 'ItemCrafted', recipeId: plank.id, outputs: plank.outputs,
    createdGearIds: [], xp: 30, levelsGained: 0, firstTime: true,
  });
  expect(listener.mock.results[0]?.value).toBe(snapshot);

  listener.mockClear();
  expect(session.dispatch(craftPlank)).toEqual({ ok: false, error: 'INSUFFICIENT_ITEMS' });
  expect(session.snapshot()).toBe(snapshot);
  expect(listener).not.toHaveBeenCalled();
});

test('T05 session does not commit XP, items, or craft history before checking full-bag capacity', () => {
  const filler = { id: 'item_test_filler', kind: 'material', stackMax: 1 } as const;
  const fixtureNodes = [8, 8, 7].map((quantity, index) => ({
    id: `res_filler_${index}`, kind: 'gather' as const, itemId: filler.id, quantity, respawnDays: 1,
  }));
  const oak = { ...catalog.resourceNodes[gatherId]!, quantity: 3 };
  const nodes = [oak, ...fixtureNodes];
  const session = new LocalSession({
    ...catalog, items: { ...catalog.items, [filler.id]: filler },
    resourceNodes: Object.fromEntries(nodes.map((node) => [node.id, node])),
  }, checkpoints(['workbench'], nodes.map(({ id }) => id)));
  valueOf(session.dispatch(newGame));
  for (const { id } of nodes) valueOf(session.dispatch({ type: 'Gather', nodeId: id }));
  const before = session.snapshot();
  const listener = vi.fn();
  session.subscribe(listener);
  expect(session.dispatch(craftPlank)).toEqual({ ok: false, error: 'BAG_FULL' });
  const after = session.snapshot();
  if (after.phase !== 'playing') throw new Error('Expected a playing snapshot.');
  expect(after.player.xp).toBe(16);
  expect(after.player.craftedRecipes).toEqual([]);
  expect(countItem(after.player, oak.itemId)).toBe(3);
  expect(after).toBe(before);
  expect(listener).not.toHaveBeenCalled();
});

const randomRecipes: readonly RecipeInfo[] = [plank, blade, tonic, ingot];
const ingredientIds = [...new Set(randomRecipes.flatMap(({ inputs }) => inputs.map(({ itemId }) => itemId)))];
const tracked = [...new Set([...ingredientIds, ...randomRecipes.flatMap(({ outputs }) => outputs.map(({ itemId }) => itemId))])];
const operations = ['craft', 'add', 'remove', 'move'] as const;
type Operation = typeof operations[number];

function randomOperation(state: PlayerState, operation: Operation, random: ReturnType<typeof randomForSeed>) {
  const delta = new Map<string, number>();
  if (operation === 'craft') {
    const recipe = randomRecipes[random(randomRecipes.length)]!;
    for (const { itemId, quantity } of recipe.inputs) delta.set(itemId, (delta.get(itemId) ?? 0) - quantity);
    for (const { itemId, quantity } of recipe.outputs) delta.set(itemId, (delta.get(itemId) ?? 0) + quantity);
    const result = craft(state, recipe, catalog);
    return { next: result.ok ? result.value.state : undefined, delta };
  }
  if (operation === 'move') {
    const result = moveSlot(state, random(BAG_CAPACITY + 1), random(BAG_CAPACITY + 1), catalog);
    return { next: result.ok ? result.value : undefined, delta };
  }
  const itemId = ingredientIds[random(ingredientIds.length)]!;
  const quantity = random(8);
  delta.set(itemId, operation === 'add' ? quantity : -quantity);
  const result = applyBagChange(state, { add: [], remove: [], [operation]: [{ itemId, quantity }] }, catalog);
  return { next: result.ok ? result.value.state : undefined, delta };
}

test('craft preserves counts, history and ownership over 1000 seeded sequences of 40 mixed operations', () => {
  const summary = Object.fromEntries(operations.map((operation) => [operation, { success: 0, rejected: 0 }])) as
    Record<Operation, { success: number; rejected: number }>;
  for (let seed = 1; seed <= 1000; seed++) {
    const random = randomForSeed(seed);
    let state = player();
    for (let step = 1; step <= 40; step++) {
      const operation = operations[random(operations.length)]!;
      try {
        const original = state;
        const before = JSON.stringify(original);
        const counts = tracked.map((itemId) => countItem(original, itemId));
        const { next, delta } = randomOperation(original, operation, random);
        if (next) {
          summary[operation].success++;
          state = next;
        } else {
          summary[operation].rejected++;
          if (state !== original) throw new Error('Rejection replaced the state.');
        }
        if (JSON.stringify(original) !== before) throw new Error('Operation mutated the input state.');
        const violations = checkBagInvariants(state, catalog);
        if (violations.length) throw new Error(violations.join(' '));
        if (state.craftedRecipes.join(',') !== [...new Set(state.craftedRecipes)].sort().join(',')) {
          throw new Error('Craft history is not sorted and unique.');
        }
        for (const [index, itemId] of tracked.entries()) {
          const expected = counts[index]! + (next ? delta.get(itemId) ?? 0 : 0);
          const actual = countItem(state, itemId);
          if (actual !== expected) throw new Error(`${itemId}: expected ${expected}, received ${actual}.`);
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
  console.log('Craft: 1000 sequences × 40 operations (40000 steps).', JSON.stringify(summary));
}, 20_000);
