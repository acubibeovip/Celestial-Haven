import { readFileSync } from 'node:fs';
import { expect, expectTypeOf, test } from 'vitest';
import { z } from 'zod';
import { heroSchema, type HeroDef } from '../../src/content/schema/hero';
import { gearSchema, itemSchema, type ItemDef } from '../../src/content/schema/item';
import { templatesSchema, type TemplateDef } from '../../src/content/schema/template';
import { createNewGame, projectStats } from '@domain/player/newGame';
import {
  BAG_CAPACITY, type GearItemInfo, type HeroInfo, type ItemInfo, type Mode, type NewGameCatalog,
  type NewGameRequest, type PlayerState, type TemplateInfo,
} from '@domain/player/types';

const data = new URL('../../src/content/data/', import.meta.url);

function readData(file: string): unknown {
  return JSON.parse(readFileSync(new URL(file, data), 'utf8'));
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

const heroes = z.array(heroSchema).parse(readData('heroes.json'));
const items = z.array(itemSchema).parse(readData('items.json'));
const templates = templatesSchema.parse(readData('templates.json'));

const catalog = deepFreeze<NewGameCatalog>({
  heroes: Object.fromEntries(heroes.map((hero) => [hero.id, hero])),
  templates,
  items: Object.fromEntries(items.map((item) => [item.id, item])),
});

const expected = {
  close: { weapon: 'item_training_blade', stats: { maxHp: 130, maxMana: 30, power: 15, guard: 12 } },
  ranged: { weapon: 'item_willow_shortbow', stats: { maxHp: 100, maxMana: 50, power: 14, guard: 8 } },
  support: { weapon: 'item_lantern_focus', stats: { maxHp: 110, maxMana: 80, power: 9, guard: 10 } },
};
const modes: Mode[] = ['peaceful', 'adventure'];

test('content-inferred types are assignable to domain-owned interfaces', () => {
  expectTypeOf<HeroDef>().toExtend<HeroInfo>();
  expectTypeOf<TemplateDef>().toExtend<TemplateInfo>();
  expectTypeOf<z.infer<typeof gearSchema>>().toExtend<GearItemInfo>();
  expectTypeOf<ItemDef>().toExtend<ItemInfo>();
});

test.each(heroes.flatMap(({ id, template }) => modes.map((mode) => ({ id, mode, template }))))(
  'creates the $template starter state for $id in $mode',
  ({ id, mode, template }) => {
    const { weapon, stats } = expected[template];
    const result = createNewGame({ heroId: id, mode }, catalog);
    if (!result.ok) throw new Error(result.error);

    expect(result.value).toEqual({
      heroId: id,
      mode,
      level: 1,
      xp: 0,
      coins: 0,
      bag: [],
      gear: [
        { id: 'g1', defId: weapon, upgrade: 0 },
        { id: 'g2', defId: 'item_traveler_tunic', upgrade: 0 },
      ],
      equipped: { mainHand: 'g1', body: 'g2' },
      nextGearSeq: 3,
      rewardLedger: ['starter_kit'],
      quests: {},
      npcBond: {},
    });
    expect(projectStats(result.value, catalog)).toEqual({ ok: true, value: stats });
  },
);

const request = deepFreeze<NewGameRequest>({ heroId: 'hero_storm_monk', mode: 'peaceful' });
const starterState = createNewGame(request, catalog);
if (!starterState.ok) throw new Error(starterState.error);
const state = deepFreeze(starterState.value);

test('creates deterministic, independent state from frozen inputs and has a 24-slot bag limit', () => {
  const before = JSON.stringify({ request, catalog });
  const first = createNewGame(request, catalog);
  const second = createNewGame(request, catalog);
  expect(first).toEqual(second);
  if (!first.ok || !second.ok) throw new Error('Expected starter states');

  expect(first.value.gear).not.toBe(second.value.gear);
  expect(first.value.bag).not.toBe(second.value.bag);
  expect(JSON.stringify({ request, catalog })).toBe(before);
  expect(BAG_CAPACITY).toBe(24);
});

const minimal: NewGameCatalog = {
  heroes: { [request.heroId]: { id: request.heroId, template: 'close' } },
  templates: {
    close: { base: { maxHp: 1, maxMana: 1, power: 1, guard: 1 }, starterGear: { mainHand: 'weapon', body: 'tunic' } },
  },
  items: {
    weapon: { id: 'weapon', kind: 'gear', stackMax: 1, gear: { slot: 'mainHand', template: 'close', stats: { power: 1 } } },
    tunic: { id: 'tunic', kind: 'gear', stackMax: 1, gear: { slot: 'body', template: null, stats: { guard: 1 } } },
  },
};

test.each([
  ['UNKNOWN_HERO', { ...minimal, heroes: {} }],
  ['UNKNOWN_TEMPLATE', { ...minimal, templates: {} }],
  ['MISSING_STARTER_ITEM', { ...minimal, items: { weapon: minimal.items.weapon } }],
  ['STARTER_ITEM_INVALID', { ...minimal, items: { ...minimal.items, tunic: minimal.items.weapon } }],
] as const)('rejects bad New Game catalogs with %s', (error, badCatalog) => {
  expect(createNewGame(request, deepFreeze(badCatalog))).toEqual({ ok: false, error });
});

test('does not count unequipped gear or upgrade levels in projected stats', () => {
  const partial: PlayerState = {
    ...state,
    equipped: { mainHand: 'g1' },
    gear: state.gear.map((gear) => ({ ...gear, upgrade: 3 })),
  };
  expect(projectStats(deepFreeze(partial), catalog)).toEqual({
    ok: true, value: { maxHp: 120, maxMana: 30, power: 15, guard: 10 },
  });
});

test.each([
  ['UNKNOWN_HERO', state, { ...catalog, heroes: {} }],
  ['UNKNOWN_TEMPLATE', state, { ...catalog, templates: {} }],
  ['EQUIPPED_INSTANCE_MISSING', { ...state, equipped: { body: 'g999' } }, catalog],
  ['EQUIPPED_ITEM_MISSING', state, { ...catalog, items: {} }],
  ['EQUIPPED_ITEM_INVALID', { ...state, equipped: { body: 'g1' } }, catalog],
] as const)('rejects bad stat projections with %s', (error, badState, badCatalog) => {
  expect(projectStats(deepFreeze(badState), deepFreeze(badCatalog))).toEqual({ ok: false, error });
});
