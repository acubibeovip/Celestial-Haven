import { err, ok, type Result } from '@shared/result';
import type {
  GearItemInfo, GearSlot, ItemInfo, NewGameCatalog, NewGameRequest, PlayerLocation, PlayerState, Stats, TemplateId,
} from './types';

export type NewGameError = 'UNKNOWN_HERO' | 'UNKNOWN_TEMPLATE' | 'MISSING_STARTER_ITEM' | 'STARTER_ITEM_INVALID';
export type ProjectStatsError = 'UNKNOWN_HERO' | 'UNKNOWN_TEMPLATE' |
  'EQUIPPED_INSTANCE_MISSING' | 'EQUIPPED_ITEM_MISSING' | 'EQUIPPED_ITEM_INVALID';

const gearSlots = ['mainHand', 'body', 'accessory'] as const;
const starterSlots = ['mainHand', 'body'] as const;
const statKeys = ['maxHp', 'maxMana', 'power', 'guard'] as const;

function getEntry<T>(entries: Readonly<Partial<Record<string, T>>>, key: string): T | undefined {
  return Object.hasOwn(entries, key) ? entries[key] : undefined;
}

function gearForSlot(item: ItemInfo, slot: GearSlot, template: TemplateId): GearItemInfo | undefined {
  const gear = item.gear;
  return item.kind === 'gear' && item.stackMax === 1 && gear?.slot === slot &&
    (gear.template === null || gear.template === template) ? gear : undefined;
}

export function createNewGame(
  request: NewGameRequest, catalog: NewGameCatalog, location: Readonly<PlayerLocation>,
): Result<PlayerState, NewGameError> {
  const hero = getEntry(catalog.heroes, request.heroId);
  if (!hero) return err('UNKNOWN_HERO');
  const template = getEntry(catalog.templates, hero.template);
  if (!template) return err('UNKNOWN_TEMPLATE');

  const gear: PlayerState['gear'] = [];
  const equipped: PlayerState['equipped'] = {};
  for (const [index, slot] of starterSlots.entries()) {
    const defId = template.starterGear[slot];
    const item = getEntry(catalog.items, defId);
    if (!item) return err('MISSING_STARTER_ITEM');
    if (!gearForSlot(item, slot, hero.template)) return err('STARTER_ITEM_INVALID');

    const id = `g${index + 1}`;
    gear.push({ id, defId, upgrade: 0 });
    equipped[slot] = id;
  }

  return ok({
    location: { ...location },
    heroId: request.heroId,
    mode: request.mode,
    level: 1,
    xp: 0,
    coins: 0,
    bag: [],
    gear,
    equipped,
    nextGearSeq: gear.length + 1,
    rewardLedger: ['starter_kit'],
    quests: {},
    npcBond: {},
  });
}

export function projectStats(state: PlayerState, catalog: NewGameCatalog): Result<Stats, ProjectStatsError> {
  const hero = getEntry(catalog.heroes, state.heroId);
  if (!hero) return err('UNKNOWN_HERO');
  const template = getEntry(catalog.templates, hero.template);
  if (!template) return err('UNKNOWN_TEMPLATE');

  const stats = { ...template.base };
  for (const slot of gearSlots) {
    const id = state.equipped[slot];
    if (id === undefined) continue;
    const instance = state.gear.find((gear) => gear.id === id);
    if (!instance) return err('EQUIPPED_INSTANCE_MISSING');
    const item = getEntry(catalog.items, instance.defId);
    if (!item) return err('EQUIPPED_ITEM_MISSING');
    const gear = gearForSlot(item, slot, hero.template);
    if (!gear) return err('EQUIPPED_ITEM_INVALID');
    for (const key of statKeys) stats[key] += gear.stats[key] ?? 0;
  }

  return ok(stats);
}
