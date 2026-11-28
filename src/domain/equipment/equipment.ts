import { getEntry } from '@domain/player/catalog';
import type { GearSlot, NewGameCatalog, PlayerState } from '@domain/player/types';
import { err, ok, type Result } from '@shared/result';

export type EquipError = 'GEAR_NOT_IN_BAG' | 'GEAR_INSTANCE_MISSING' | 'UNKNOWN_ITEM' |
  'WRONG_ITEM_KIND' | 'UNKNOWN_HERO' | 'WRONG_TEMPLATE';
export type UnequipError = 'SLOT_EMPTY' | 'BAG_FULL';

export function equip(
  state: Readonly<PlayerState>, gearId: string, catalog: NewGameCatalog,
): Result<PlayerState, EquipError> {
  const index = state.bag.findIndex((slot) => slot?.kind === 'gear' && slot.gearId === gearId);
  if (index < 0) return err('GEAR_NOT_IN_BAG');
  const instance = state.gear.find(({ id }) => id === gearId);
  if (!instance) return err('GEAR_INSTANCE_MISSING');

  const item = getEntry(catalog.items, instance.defId);
  if (!item) return err('UNKNOWN_ITEM');
  if (item.kind !== 'gear' || item.stackMax !== 1 || !item.gear) return err('WRONG_ITEM_KIND');
  const hero = getEntry(catalog.heroes, state.heroId);
  if (!hero) return err('UNKNOWN_HERO');
  const { slot, template } = item.gear;
  if (template !== null && template !== hero.template) return err('WRONG_TEMPLATE');

  const previous = state.equipped[slot];
  const bag = [...state.bag];
  bag[index] = previous === undefined ? null : { kind: 'gear', gearId: previous };
  return ok({ ...state, bag, equipped: { ...state.equipped, [slot]: gearId } });
}

export function unequip(state: Readonly<PlayerState>, slot: GearSlot): Result<PlayerState, UnequipError> {
  const gearId = getEntry(state.equipped, slot);
  if (gearId === undefined) return err('SLOT_EMPTY');
  const index = state.bag.indexOf(null);
  if (index < 0) return err('BAG_FULL');

  const bag = [...state.bag];
  bag[index] = { kind: 'gear', gearId };
  const equipped = { ...state.equipped };
  delete equipped[slot];
  return ok({ ...state, bag, equipped });
}
