import { expect, test, vi } from 'vitest';
import { createContentRegistry } from '../../src/application/ContentRegistry';
import { createNewGameCatalog } from '../../src/application/createNewGameCatalog';
import type { Mode, SessionCommand } from '../../src/application/GameSession';
import { LocalSession } from '../../src/application/LocalSession';
import { createReadyView } from '../../src/application/readyView';
import { readBundledContent } from '../../src/infrastructure/content/readBundledContent';
import { createNewGame } from '@domain/player/newGame';

const result = createContentRegistry(readBundledContent());
if (!result.ok) throw new Error(JSON.stringify(result.error));
const registry = result.value;
const catalog = createNewGameCatalog(registry);
const modes: Mode[] = ['peaceful', 'adventure'];
const start = { type: 'NewGame', heroId: 'hero_storm_monk', mode: 'peaceful' } as const;

test.each(registry.heroes.flatMap(({ id }) => modes.map((mode) => ({ id, mode }))))(
  'commits the domain state for $id in $mode',
  ({ id, mode }) => {
    const command: SessionCommand = { type: 'NewGame', heroId: id, mode };
    const session = new LocalSession(catalog);
    const expected = createNewGame(command, catalog);
    expect(expected.ok).toBe(true);
    if (!expected.ok) throw new Error(expected.error);

    expect(session.dispatch(command)).toEqual({ ok: true, value: undefined });
    expect(session.snapshot()).toEqual({ phase: 'playing', player: expected.value });
  },
);

test('emits one GameStarted event after the new snapshot is committed', () => {
  const session = new LocalSession(catalog);
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
  const session = new LocalSession(catalog);
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
  const session = new LocalSession(badCatalog);
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
  const session = new LocalSession(catalog);
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
  const session = new LocalSession(catalog, reportError);
  session.subscribe(() => { calls.push('first'); throw failure; });
  session.subscribe(() => { calls.push(session.snapshot().phase); });
  session.subscribe(() => { calls.push('last'); });

  expect(session.dispatch(start).ok).toBe(true);
  expect(calls).toEqual(['first', 'report', 'playing', 'last']);
  expect(reportError).toHaveBeenCalledExactlyOnceWith(failure);
});

test('allows self-unsubscription and removing a later listener during emission', () => {
  const session = new LocalSession(catalog);
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

test('derives Ready details from the committed snapshot', () => {
  const session = new LocalSession(catalog);
  expect(createReadyView(session.snapshot(), registry, catalog)).toBeNull();
  session.dispatch(start);
  expect(createReadyView(session.snapshot(), registry, catalog)).toEqual({
    hero: 'Storm Monk',
    mode: 'Peaceful',
    level: 1,
    equipped: ['Training Blade', "Traveler's Tunic"],
    stats: { maxHp: 130, maxMana: 30, power: 15, guard: 12 },
  });
});
