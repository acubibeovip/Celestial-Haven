import { expect, test, vi } from 'vitest';
import { createContentRegistry } from '@application/ContentRegistry';
import { createNewGameCatalog } from '@application/createNewGameCatalog';
import type { SessionCommand } from '@application/GameSession';
import { LocalSession } from '@application/LocalSession';
import { START_MAP_ID, type MapCatalog } from '@application/MapCatalog';
import { isNodeAvailable, type ResourceNode } from '@domain/gathering/harvest';
import { countItem } from '@domain/inventory/checkBagInvariants';
import type { Result } from '@shared/result';
import { readBundledContent } from '../../src/infrastructure/content/readBundledContent';
import { loadWorldMaps, readBundledMaps } from '../../src/infrastructure/maps/loadWorldMaps';

function valueOf<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

const catalog = createNewGameCatalog(valueOf(createContentRegistry(readBundledContent())));
const maps = valueOf(loadWorldMaps(readBundledMaps()));
const oak = catalog.resourceNodes.res_oak_log_01!;
const moonpetal = catalog.resourceNodes.res_moonpetal_01!;
const stone = catalog.resourceNodes.res_stone_01!;
const endDay = { type: 'EndDay' } as const;
const gather = ({ id }: ResourceNode): SessionCommand => ({ type: 'Gather', nodeId: id });

function mapsWithStartingNodes(nodeIds: readonly string[]) {
  const checkpoints = new Map(maps);
  const startingMap = checkpoints.get(START_MAP_ID);
  if (!startingMap) throw new Error('Expected the starting map.');
  checkpoints.set(START_MAP_ID, { ...startingMap, resourceNodeIds: new Set(nodeIds), hasBed: true });
  return checkpoints;
}

function start(content = catalog, checkpoints: MapCatalog = mapsWithStartingNodes([oak.id, moonpetal.id, stone.id])) {
  const session = new LocalSession(content, checkpoints);
  valueOf(session.dispatch({ type: 'NewGame', heroId: 'hero_storm_monk', mode: 'peaceful' }));
  return session;
}

function playing(session: LocalSession) {
  const snapshot = session.snapshot();
  if (snapshot.phase !== 'playing') throw new Error('Expected a playing snapshot.');
  return snapshot;
}

test('T03 rejects a second harvest on day 1 and 100 spam commands grant yield and XP only once', () => {
  const session = start();
  const listener = vi.fn(() => session.snapshot());
  session.subscribe(listener);
  let successes = 0;
  for (let i = 0; i < 100; i++) {
    const before = session.snapshot();
    const result = session.dispatch(gather(oak));
    if (result.ok) successes++;
    if (i > 0) {
      expect(result).toEqual({ ok: false, error: 'NODE_DEPLETED' });
      expect(session.snapshot()).toBe(before);
    }
  }
  expect(successes).toBe(1);
  const snapshot = playing(session);
  expect(countItem(snapshot.player, oak.itemId)).toBe(2);
  expect(snapshot.player.xp).toBe(4);
  expect(snapshot.world).toEqual({ day: 1, resourceNodes: { [oak.id]: { harvestedDay: 1 } } });
  expect(Object.isFrozen(snapshot.world.resourceNodes[oak.id])).toBe(true);
  expect(listener).toHaveBeenCalledExactlyOnceWith({
    type: 'ResourceGathered', nodeId: oak.id, itemId: oak.itemId, quantity: 2, xp: 4, levelsGained: 0,
  });
  expect(listener.mock.results[0]?.value).toBe(snapshot);
});

test.each([oak, moonpetal])('T04 $id respawns exactly after $respawnDays game days', (node) => {
  const session = start();
  valueOf(session.dispatch(gather(node)));
  expect(isNodeAvailable(playing(session).world, node)).toBe(false);
  for (let elapsed = 1; elapsed <= node.respawnDays; elapsed++) {
    valueOf(session.dispatch(endDay));
    const before = playing(session);
    expect(before.world.resourceNodes[node.id]).toEqual({ harvestedDay: 1 });
    const result = session.dispatch(gather(node));
    if (elapsed < node.respawnDays) {
      expect(result).toEqual({ ok: false, error: 'NODE_DEPLETED' });
      expect(session.snapshot()).toBe(before);
    } else {
      expect(result.ok).toBe(true);
      expect(playing(session).world.resourceNodes[node.id]).toEqual({ harvestedDay: 1 + elapsed });
    }
  }
});

test('a full bag leaves the node available and keeps inventory, XP, snapshot and events unchanged', () => {
  const filler = { id: 'item_test_filler', kind: 'material', stackMax: 1 } as const;
  const fillerNodes = Object.fromEntries([1, 2, 3].map((id) => [`res_filler_${id}`, {
    id: `res_filler_${id}`, kind: 'gather', itemId: filler.id, quantity: 8, respawnDays: 1,
  } satisfies ResourceNode]));
  const session = start({
    ...catalog, items: { ...catalog.items, [filler.id]: filler },
    resourceNodes: { ...catalog.resourceNodes, ...fillerNodes },
  }, mapsWithStartingNodes([oak.id, ...Object.keys(fillerNodes)]));
  for (const node of Object.values(fillerNodes)) valueOf(session.dispatch(gather(node)));
  const before = playing(session);
  expect(countItem(before.player, filler.id)).toBe(24);
  const listener = vi.fn();
  session.subscribe(listener);
  expect(session.dispatch(gather(oak))).toEqual({ ok: false, error: 'BAG_FULL' });
  const after = playing(session);
  expect(after.world.resourceNodes[oak.id]).toBeUndefined();
  expect(isNodeAvailable(after.world, oak)).toBe(true);
  expect(after).toBe(before);
  expect(countItem(after.player, oak.itemId)).toBe(0);
  expect(after.player.xp).toBe(12);
  expect(listener).not.toHaveBeenCalled();
});

test('mining awards 6 XP and a harvest crossing a threshold emits levelsGained', () => {
  const session = start();
  for (let day = 1; day <= 9; day++) {
    valueOf(session.dispatch(gather(oak)));
    valueOf(session.dispatch(gather(stone)));
    valueOf(session.dispatch(endDay));
  }
  valueOf(session.dispatch(gather(oak)));
  expect(playing(session).player).toMatchObject({ level: 1, xp: 94 });
  const listener = vi.fn(() => session.snapshot());
  session.subscribe(listener);
  valueOf(session.dispatch(gather(stone)));
  const after = playing(session);
  expect(after.player).toMatchObject({ level: 2, xp: 0 });
  expect(after.world.resourceNodes[stone.id]).toEqual({ harvestedDay: 10 });
  expect(listener).toHaveBeenCalledExactlyOnceWith({
    type: 'ResourceGathered', nodeId: stone.id, itemId: stone.itemId, quantity: 2, xp: 6, levelsGained: 1,
  });
  expect(listener.mock.results[0]?.value).toBe(after);
});

test('10 EndDay commands commit exactly 10 increments and one event per command', () => {
  const session = start();
  const initial = playing(session);
  const listener = vi.fn(() => playing(session));
  session.subscribe(listener);
  for (let day = 2; day <= 11; day++) {
    valueOf(session.dispatch(endDay));
    const after = playing(session);
    expect(after.world.day).toBe(day);
    expect(after.player).toBe(initial.player);
    expect(after.world.resourceNodes).toBe(initial.world.resourceNodes);
    expect(listener).toHaveBeenNthCalledWith(day - 1, { type: 'DayEnded', day });
    expect(listener.mock.results[day - 2]?.value).toBe(after);
  }
  expect(listener).toHaveBeenCalledTimes(10);
});

test('Gather and EndDay reject in the menu without state or event changes', () => {
  const session = new LocalSession(catalog, maps);
  const before = session.snapshot();
  const listener = vi.fn();
  session.subscribe(listener);
  for (const command of [gather(oak), endDay]) {
    expect(session.dispatch(command)).toEqual({ ok: false, error: 'NOT_PLAYING' });
    expect(session.snapshot()).toBe(before);
  }
  expect(listener).not.toHaveBeenCalled();
});

test('Gather rejects unknown nodes and nodes excluded by the current map, preserving world across moves', () => {
  const session = start(catalog, mapsWithStartingNodes([oak.id]));
  const listener = vi.fn();
  session.subscribe(listener);
  const before = session.snapshot();
  expect(session.dispatch({ type: 'Gather', nodeId: 'constructor' })).toEqual({ ok: false, error: 'UNKNOWN_NODE' });
  expect(session.dispatch(gather(stone))).toEqual({ ok: false, error: 'NODE_NOT_ON_MAP' });
  expect(session.snapshot()).toBe(before);
  expect(listener).not.toHaveBeenCalled();
  valueOf(session.dispatch(gather(oak)));
  valueOf(session.dispatch(endDay));
  const world = playing(session).world;
  valueOf(session.dispatch({ type: 'Unequip', slot: 'mainHand' }));
  expect(playing(session).world).toBe(world);
  valueOf(session.dispatch({ type: 'EnterExit', exitName: 'to_farm' }));
  expect(playing(session).world).toBe(world);
  const inFarm = session.snapshot();
  listener.mockClear();
  expect(session.dispatch(gather(oak))).toEqual({ ok: false, error: 'NODE_NOT_ON_MAP' });
  expect(session.snapshot()).toBe(inFarm);
  expect(listener).not.toHaveBeenCalled();
});

test.each([
  ['missing current map entry', true],
  ['empty current map node set', false],
] as const)('Gather returns NODE_NOT_ON_MAP for a %s', (_, removeMap) => {
  const checkpoints = mapsWithStartingNodes([]);
  const session = start(catalog, checkpoints);
  if (removeMap) checkpoints.delete(START_MAP_ID);
  const before = playing(session);
  const listener = vi.fn();
  session.subscribe(listener);

  expect(session.dispatch(gather(oak))).toEqual({ ok: false, error: 'NODE_NOT_ON_MAP' });
  expect(session.snapshot()).toBe(before);
  expect(listener).not.toHaveBeenCalled();
});

test('EndDay returns NO_BED_ON_MAP outside Farm without changing snapshot or emitting', () => {
  const session = start(catalog, maps);
  const before = session.snapshot();
  const listener = vi.fn();
  session.subscribe(listener);

  expect(session.dispatch(endDay)).toEqual({ ok: false, error: 'NO_BED_ON_MAP' });
  expect(session.snapshot()).toBe(before);
  expect(listener).not.toHaveBeenCalled();

  valueOf(session.dispatch({ type: 'EnterExit', exitName: 'to_farm' }));
  valueOf(session.dispatch(endDay));
  expect(playing(session).world.day).toBe(2);
});
