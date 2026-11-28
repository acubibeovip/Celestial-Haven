import { expect, test, vi } from 'vitest';
import { createContentRegistry } from '../../src/application/ContentRegistry';
import { createNewGameCatalog } from '../../src/application/createNewGameCatalog';
import type { Mode, SessionCommand } from '../../src/application/GameSession';
import { LocalSession } from '../../src/application/LocalSession';
import { loadWorldMaps, readBundledMaps } from '../../src/infrastructure/maps/loadWorldMaps';
import { readBundledContent } from '../../src/infrastructure/content/readBundledContent';
import { createNewGame } from '@domain/player/newGame';

const result = createContentRegistry(readBundledContent());
if (!result.ok) throw new Error(JSON.stringify(result.error));
const registry = result.value;
const catalog = createNewGameCatalog(registry);
const loaded = loadWorldMaps(readBundledMaps());
if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
const maps = loaded.value;
const initialLocation = { mapId: 'map_starbrook_village', x: 784, y: 280 };
const modes: Mode[] = ['peaceful', 'adventure'];
const start = { type: 'NewGame', heroId: 'hero_storm_monk', mode: 'peaceful' } as const;

test.each(registry.heroes.flatMap(({ id }) => modes.map((mode) => ({ id, mode }))))(
  'commits the domain state for $id in $mode',
  ({ id, mode }) => {
    const command: SessionCommand = { type: 'NewGame', heroId: id, mode };
    const session = new LocalSession(catalog, maps);
    const expected = createNewGame(command, catalog, initialLocation);
    expect(expected.ok).toBe(true);
    if (!expected.ok) throw new Error(expected.error);

    expect(session.dispatch(command)).toEqual({ ok: true, value: undefined });
    expect(session.snapshot()).toEqual({ phase: 'playing', player: expected.value });
  },
);

test('emits one GameStarted event after the new snapshot is committed', () => {
  const session = new LocalSession(catalog, maps);
  const initial = session.snapshot();
  const listener = vi.fn(() => session.snapshot());
  session.subscribe(listener);
  session.dispatch(start);

  expect(initial.phase).toBe('menu');
  expect(listener).toHaveBeenCalledExactlyOnceWith({
    type: 'GameStarted', heroId: start.heroId, mode: start.mode,
  });
  expect(listener.mock.results[0]?.value).toBe(session.snapshot());
  expect(session.snapshot().phase).toBe('playing');
  expect(session.snapshot()).not.toBe(initial);
});

test('rejections preserve the exact snapshot and emit nothing', () => {
  const session = new LocalSession(catalog, maps);
  const listener = vi.fn();
  session.subscribe(listener);
  const menu = session.snapshot();

  expect(session.dispatch({ ...start, heroId: 'unknown' })).toEqual({ ok: false, error: 'UNKNOWN_HERO' });
  expect(session.snapshot()).toBe(menu);
  expect(listener).not.toHaveBeenCalled();

  session.dispatch(start);
  const playing = session.snapshot();
  listener.mockClear();
  expect(session.dispatch(start)).toEqual({ ok: false, error: 'ALREADY_PLAYING' });
  expect(session.snapshot()).toBe(playing);
  expect(listener).not.toHaveBeenCalled();
});

test.each([
  ['UNKNOWN_TEMPLATE', { ...catalog, templates: {} }],
  ['MISSING_STARTER_ITEM', { ...catalog, items: {} }],
  ['STARTER_ITEM_INVALID', { ...catalog, items: {
    ...catalog.items, item_training_blade: { id: 'item_training_blade', kind: 'material', stackMax: 1 },
  } }],
] as const)('propagates the %s domain error without committing or emitting', (error, badCatalog) => {
  const session = new LocalSession(badCatalog, maps);
  const menu = session.snapshot();
  const listener = vi.fn();
  session.subscribe(listener);
  expect(session.dispatch(start)).toEqual({ ok: false, error });
  expect(session.snapshot()).toBe(menu);
  expect(listener).not.toHaveBeenCalled();
});

function isFrozenTree(value: unknown): boolean {
  return typeof value !== 'object' || value === null ||
    (Object.isFrozen(value) && Object.values(value).every(isFrozenTree));
}

test('freezes the whole menu and playing snapshot tree', () => {
  const session = new LocalSession(catalog, maps);
  expect(isFrozenTree(session.snapshot())).toBe(true);
  session.dispatch(start);
  const state = session.snapshot();
  expect(state.phase).toBe('playing');
  expect(isFrozenTree(state)).toBe(true);
  if (state.phase === 'playing') {
    expect(Reflect.set(state.player.equipped, 'mainHand', 'another')).toBe(false);
    expect(state.player.equipped.mainHand).toBe('g1');
  }
});

test('reports a throwing listener once, keeps the commit, and calls others in order', () => {
  const failure = new Error('listener failed');
  const calls: string[] = [];
  const reportError = vi.fn(() => { calls.push('report'); });
  const session = new LocalSession(catalog, maps, reportError);
  session.subscribe(() => { calls.push('first'); throw failure; });
  session.subscribe(() => { calls.push(session.snapshot().phase); });
  session.subscribe(() => { calls.push('last'); });

  expect(session.dispatch(start).ok).toBe(true);
  expect(calls).toEqual(['first', 'report', 'playing', 'last']);
  expect(reportError).toHaveBeenCalledExactlyOnceWith(failure);
});

test('allows self-unsubscription and removing a later listener during emission', () => {
  const session = new LocalSession(catalog, maps);
  const calls: string[] = [];
  const addedDuringEmission = vi.fn();
  const removeFirst = session.subscribe(() => {
    calls.push('first');
    removeFirst();
    removeSecond();
    session.subscribe(addedDuringEmission);
  });
  const removeSecond = session.subscribe(() => { calls.push('second'); });
  session.subscribe(() => { calls.push('third'); });

  expect(session.dispatch(start).ok).toBe(true);
  expect(calls).toEqual(['first', 'third']);
  expect(addedDuringEmission).not.toHaveBeenCalled();
});

test('New Game checkpoints the village default at the D23 feet position', () => {
  const session = new LocalSession(catalog, maps);
  expect(session.dispatch(start).ok).toBe(true);
  expect(session.snapshot()).toMatchObject({ phase: 'playing', player: { location: initialLocation } });
});

test('EnterExit commits the destination before MapChanged and the round trip returns to the arrival spawn', () => {
  const session = new LocalSession(catalog, maps);
  session.dispatch(start);
  const before = session.snapshot();
  const listener = vi.fn(() => session.snapshot());
  session.subscribe(listener);

  expect(session.dispatch({ type: 'EnterExit', exitName: 'to_farm' }).ok).toBe(true);
  expect(listener).toHaveBeenCalledExactlyOnceWith({ type: 'MapChanged', mapId: 'map_farm' });
  expect(listener.mock.results[0]?.value).toBe(session.snapshot());
  expect(listener.mock.results[0]?.value).toMatchObject({
    phase: 'playing', player: { location: { mapId: 'map_farm', x: 112, y: 280 } },
  });
  expect(before).toMatchObject({ phase: 'playing', player: { location: initialLocation } });

  expect(session.dispatch({ type: 'EnterExit', exitName: 'to_village' }).ok).toBe(true);
  expect(listener).toHaveBeenCalledTimes(2);
  expect(session.snapshot()).toMatchObject({
    phase: 'playing', player: { location: { mapId: 'map_starbrook_village', x: 1168, y: 280 } },
  });
  expect(isFrozenTree(session.snapshot())).toBe(true);
});

test('rejects exit commands while in the menu and exits absent from the current map', () => {
  const session = new LocalSession(catalog, maps);
  const listener = vi.fn();
  session.subscribe(listener);
  const exit = { type: 'EnterExit', exitName: 'to_village' } as const;
  const menu = session.snapshot();
  expect(session.dispatch(exit)).toEqual({ ok: false, error: 'NOT_PLAYING' });
  expect(session.snapshot()).toBe(menu);
  expect(listener).not.toHaveBeenCalled();

  session.dispatch(start);
  listener.mockClear();
  const village = session.snapshot();
  expect(session.dispatch(exit)).toEqual({ ok: false, error: 'UNKNOWN_EXIT' });
  expect(session.snapshot()).toBe(village);
  expect(listener).not.toHaveBeenCalled();
});

const tonic = { id: 'item_test_tonic', kind: 'consumable', stackMax: 10 } as const;
const inventoryCatalog = { ...catalog, items: { ...catalog.items, [tonic.id]: tonic } };
const inventoryCommands = [
  { type: 'Equip', gearId: 'g1' },
  { type: 'Unequip', slot: 'mainHand' },
  { type: 'MoveBagSlot', from: 0, to: 3 },
  { type: 'AssignHotbar', index: 2, itemId: tonic.id },
] as const satisfies readonly SessionCommand[];

test.each(inventoryCommands)('$type returns NOT_PLAYING before New Game', (command) => {
  const session = new LocalSession(inventoryCatalog, maps);
  const initial = session.snapshot();
  const listener = vi.fn();
  session.subscribe(listener);
  expect(session.dispatch(command)).toEqual({ ok: false, error: 'NOT_PLAYING' });
  expect(session.snapshot()).toBe(initial);
  expect(listener).not.toHaveBeenCalled();
});

const afterUnequip = { type: 'Unequip', slot: 'mainHand' } as const satisfies SessionCommand;
const starterBagGear = { kind: 'gear', gearId: 'g1' };

test.each([
  { command: inventoryCommands[0], setup: afterUnequip, event: 'EquipmentChanged',
    expected: { equipped: { mainHand: 'g1', body: 'g2' }, bag: Array<null>(24).fill(null) } },
  { command: inventoryCommands[1], setup: null, event: 'EquipmentChanged',
    expected: { equipped: { body: 'g2' }, bag: [starterBagGear, ...Array<null>(23).fill(null)] } },
  { command: inventoryCommands[2], setup: afterUnequip, event: 'InventoryChanged',
    expected: { bag: [null, null, null, starterBagGear, ...Array<null>(20).fill(null)] } },
  { command: inventoryCommands[3], setup: null, event: 'InventoryChanged',
    expected: { hotbar: [null, null, tonic.id, null] } },
] as const)('$command.type commits before emitting exactly one $event', ({ command, setup, event, expected }) => {
  const session = new LocalSession(inventoryCatalog, maps);
  expect(session.dispatch(start).ok).toBe(true);
  if (setup) expect(session.dispatch(setup).ok).toBe(true);
  const before = session.snapshot();
  const listener = vi.fn(() => session.snapshot());
  session.subscribe(listener);

  expect(session.dispatch(command)).toEqual({ ok: true, value: undefined });
  const after = session.snapshot();
  expect(after).not.toBe(before);
  expect(after).toMatchObject({ phase: 'playing', player: expected });
  expect(listener).toHaveBeenCalledExactlyOnceWith({ type: event });
  expect(listener.mock.results[0]?.value).toBe(after);
  if (after.phase !== 'playing') throw new Error('Expected playing snapshot');
  expect(Object.isFrozen(after.player.bag)).toBe(true);
  expect(Object.isFrozen(after.player.equipped)).toBe(true);
  expect(Object.isFrozen(after.player.hotbar)).toBe(true);
});

test.each([
  [{ type: 'Equip', gearId: 'g1' }, 'GEAR_NOT_IN_BAG'],
  [{ type: 'Unequip', slot: 'accessory' }, 'SLOT_EMPTY'],
  [{ type: 'MoveBagSlot', from: 0, to: 24 }, 'INVALID_SLOT'],
  [{ type: 'AssignHotbar', index: 0, itemId: 'item_training_blade' }, 'WRONG_ITEM_KIND'],
  [{ type: 'AssignHotbar', index: 0, itemId: 'missing' }, 'UNKNOWN_ITEM'],
] as const)('inventory rejection %j propagates %s without changing the snapshot or emitting', (command, error) => {
  const session = new LocalSession(inventoryCatalog, maps);
  expect(session.dispatch(start).ok).toBe(true);
  const before = session.snapshot();
  const listener = vi.fn();
  session.subscribe(listener);

  expect(session.dispatch(command)).toEqual({ ok: false, error });
  expect(session.snapshot()).toBe(before);
  expect(listener).not.toHaveBeenCalled();
});

test('successful no-op inventory commands preserve snapshot identity and emit nothing', () => {
  const session = new LocalSession(inventoryCatalog, maps);
  expect(session.dispatch(start).ok).toBe(true);
  expect(session.dispatch(afterUnequip).ok).toBe(true);
  expect(session.dispatch(inventoryCommands[3]).ok).toBe(true);
  const before = session.snapshot();
  const listener = vi.fn();
  session.subscribe(listener);

  for (const command of [
    { type: 'MoveBagSlot', from: 0, to: 0 },
    { type: 'MoveBagSlot', from: 1, to: 0 },
    inventoryCommands[3],
    { type: 'AssignHotbar', index: 0, itemId: null },
  ] as const) {
    expect(session.dispatch(command)).toEqual({ ok: true, value: undefined });
    expect(session.snapshot()).toBe(before);
  }
  expect(listener).not.toHaveBeenCalled();
});
