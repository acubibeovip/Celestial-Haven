import { BAG_CAPACITY, HOTBAR_CAPACITY } from '@domain/inventory/types';
import { err, ok, type Result } from '@shared/result';
import { gearForSlot, getEntry } from './catalog';
import type { NewGameCatalog, NewGameRequest, PlayerLocation, PlayerState } from './types';

export { projectStats, type ProjectStatsError } from '@domain/progression/projectStats';

export type NewGameError = 'UNKNOWN_HERO' | 'UNKNOWN_TEMPLATE' | 'MISSING_STARTER_ITEM' | 'STARTER_ITEM_INVALID';

const starterSlots = ['mainHand', 'body'] as const;

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
    bag: Array<null>(BAG_CAPACITY).fill(null),
    hotbar: Array<null>(HOTBAR_CAPACITY).fill(null),
    gear,
    equipped,
    nextGearSeq: gear.length + 1,
    rewardLedger: ['starter_kit'],
    quests: {},
    npcBond: {},
  });
}
