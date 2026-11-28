import { expect, expectTypeOf, test } from 'vitest';
import { createContentRegistry } from '@application/ContentRegistry';
import { createNewGameCatalog } from '@application/createNewGameCatalog';
import { createNewGame } from '@domain/player/newGame';
import { gainXp } from '@domain/progression/gainXp';
import { projectStats } from '@domain/progression/projectStats';
import type { Progression } from '@domain/progression/types';
import type { ProgressionDef } from '../../src/content/schema/progression';
import { readBundledContent } from '../../src/infrastructure/content/readBundledContent';

const registry = createContentRegistry(readBundledContent());
if (!registry.ok) throw new Error(JSON.stringify(registry.error));
const catalog = createNewGameCatalog(registry.value);
const { progression } = catalog;

function start(heroId = 'hero_storm_monk') {
  const result = createNewGame(
    { heroId, mode: 'peaceful' }, catalog, { mapId: 'map_starbrook_village', x: 784, y: 280 },
  );
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function applyXp(state: ReturnType<typeof start>, amount: number) {
  const result = gainXp(state, amount, progression);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

test('progression schema is assignable to the domain and the catalog matches ADR-017 exactly', () => {
  expectTypeOf<ProgressionDef>().toExtend<Progression>();
  expect(progression).toEqual({
    levelCap: 10,
    xpToNext: [100, 150, 220, 300, 400, 520, 660, 820, 1000],
    xpSources: { gather: 4, mine: 6, harvest: 4, craft: 10, craftFirstBonus: 20, upgrade: 15, befriend: 40 },
  });
});

test('99 XP stays at level 1 and the next point reaches level 2', () => {
  const first = applyXp(start(), 99);
  expect(first).toMatchObject({ state: { level: 1, xp: 99 }, levelsGained: 0 });
  expect(applyXp(first.state, 1)).toMatchObject({ state: { level: 2, xp: 0 }, levelsGained: 1 });
});

test('one gain crosses three levels and preserves the XP remainder', () => {
  const state = { ...start(), xp: 80 };
  expect(applyXp(state, 400)).toMatchObject({ state: { level: 4, xp: 10 }, levelsGained: 3 });
});

test('reaching the cap discards overflow and later gains preserve the state reference', () => {
  const belowCap = { ...start(), level: 9, xp: 999 };
  const capped = applyXp(belowCap, Number.MAX_SAFE_INTEGER);
  expect(capped).toMatchObject({ state: { level: 10, xp: 0 }, levelsGained: 1 });
  const next = applyXp(capped.state, 100);
  expect(next.state).toBe(capped.state);
  expect(next.levelsGained).toBe(0);
});

test('4170 cumulative XP reaches exactly level 10', () => {
  expect(applyXp(start(), 4170)).toMatchObject({ state: { level: 10, xp: 0 }, levelsGained: 9 });
});

test.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
  'rejects XP amount %s without replacing or altering the original state',
  (amount) => {
    const state = start();
    const original = structuredClone(state);
    const holder = { state };
    const result = gainXp(holder.state, amount, progression);
    if (result.ok) holder.state = result.value.state;
    expect(result).toEqual({ ok: false, error: 'INVALID_XP_AMOUNT' });
    expect(holder.state).toBe(state);
    expect(state).toEqual(original);
  },
);

function deepFreeze<T extends object>(value: T): T {
  for (const child of Object.values(value) as unknown[]) {
    if (child !== null && typeof child === 'object') deepFreeze(child);
  }
  return Object.freeze(value);
}

test('gaining XP leaves deeply frozen state and progression intact', () => {
  const state = deepFreeze(start());
  const rules = deepFreeze(structuredClone(progression));
  const result = gainXp(state, 120, rules);
  expect(result).toEqual({ ok: true, value: { state: { ...state, level: 2, xp: 20 }, levelsGained: 1 } });
  expect(state).toMatchObject({ level: 1, xp: 0 });
  expect(rules).toEqual(progression);
});

test('every gain from 1 to 5000 agrees with awarding one XP at a time', () => {
  const initial = start();
  let incremental = initial;
  for (let amount = 1; amount <= 5000; amount++) {
    incremental = applyXp(incremental, 1).state;
    const bulk = applyXp(initial, amount);
    expect(bulk.state.level, `level at ${amount} XP`).toBe(incremental.level);
    expect(bulk.state.xp, `remainder at ${amount} XP`).toBe(incremental.xp);
    expect(bulk.levelsGained).toBe(incremental.level - 1);
    expect(bulk.state.xp).toBeGreaterThanOrEqual(0);
    if (bulk.state.level === progression.levelCap) expect(bulk.state.xp).toBe(0);
    else expect(bulk.state.xp).toBeLessThan(progression.xpToNext[bulk.state.level - 1]!);
  }
});

test.each([
  ['hero_storm_monk', 1, { maxHp: 130, maxMana: 30, power: 15, guard: 12 }],
  ['hero_storm_monk', 5, { maxHp: 162, maxMana: 38, power: 19, guard: 16 }],
  ['hero_storm_monk', 10, { maxHp: 202, maxMana: 48, power: 24, guard: 21 }],
  ['hero_frostfox_sorceress', 1, { maxHp: 100, maxMana: 50, power: 14, guard: 8 }],
  ['hero_frostfox_sorceress', 5, { maxHp: 124, maxMana: 66, power: 18, guard: 12 }],
  ['hero_frostfox_sorceress', 10, { maxHp: 154, maxMana: 86, power: 23, guard: 17 }],
  ['hero_aurora_priestess', 1, { maxHp: 110, maxMana: 80, power: 9, guard: 10 }],
  ['hero_aurora_priestess', 5, { maxHp: 134, maxMana: 104, power: 13, guard: 14 }],
  ['hero_aurora_priestess', 10, { maxHp: 164, maxMana: 134, power: 18, guard: 19 }],
] as const)('projects %s at level %i with starter gear', (heroId, level, stats) => {
  expect(projectStats({ ...start(heroId), level }, catalog)).toEqual({ ok: true, value: stats });
});
