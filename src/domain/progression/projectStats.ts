import { err, ok, type Result } from '@shared/result';
import { gearForSlot, getEntry } from '@domain/player/catalog';
import type { NewGameCatalog, PlayerState, Stats } from '@domain/player/types';

export type ProjectStatsError = 'UNKNOWN_HERO' | 'UNKNOWN_TEMPLATE' |
  'EQUIPPED_INSTANCE_MISSING' | 'EQUIPPED_ITEM_MISSING' | 'EQUIPPED_ITEM_INVALID';

const gearSlots = ['mainHand', 'body', 'accessory'] as const;
const statKeys = ['maxHp', 'maxMana', 'power', 'guard'] as const;

export function projectStats(state: PlayerState, catalog: NewGameCatalog): Result<Stats, ProjectStatsError> {
  const hero = getEntry(catalog.heroes, state.heroId);
  if (!hero) return err('UNKNOWN_HERO');
  const template = getEntry(catalog.templates, hero.template);
  if (!template) return err('UNKNOWN_TEMPLATE');

  const stats = { ...template.base };
  for (const key of statKeys) stats[key] += template.growth[key] * (state.level - 1);
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
