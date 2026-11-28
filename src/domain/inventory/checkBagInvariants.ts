import { getEntry } from '@domain/player/catalog';
import type { PlayerState } from '@domain/player/types';
import { BAG_CAPACITY, HOTBAR_CAPACITY, type ItemCatalog } from './types';

export function countItem(state: Readonly<PlayerState>, itemId: string): number {
  const gearIds = new Set(state.gear.filter(({ defId }) => defId === itemId).map(({ id }) => id));
  let total = 0;
  for (const slot of state.bag) {
    if (slot?.kind === 'stack' && slot.itemId === itemId) total += slot.quantity;
    if (slot?.kind === 'gear' && gearIds.has(slot.gearId)) total++;
  }
  return total;
}

export function checkBagInvariants(state: Readonly<PlayerState>, catalog: ItemCatalog): readonly string[] {
  const errors: string[] = [];
  const references = new Map<string, number>();
  const recordGear = (id: string): void => {
    references.set(id, (references.get(id) ?? 0) + 1);
  };

  if (state.bag.length !== BAG_CAPACITY) errors.push(`Expected ${BAG_CAPACITY} bag slots.`);
  for (const [index, slot] of state.bag.entries()) {
    if (slot === null) continue;
    if (slot?.kind === 'gear') {
      recordGear(slot.gearId);
    } else if (slot?.kind === 'stack') {
      const item = getEntry(catalog.items, slot.itemId);
      if (!item || item.kind === 'gear') {
        errors.push(`Invalid stack item at bag slot ${index}.`);
      } else if (!Number.isSafeInteger(slot.quantity) || slot.quantity < 1 ||
        slot.quantity > Math.min(99, item.stackMax)) {
        errors.push(`Invalid quantity at bag slot ${index}.`);
      }
    } else {
      errors.push(`Invalid bag slot ${index}.`);
    }
  }

  for (const id of Object.values(state.equipped)) recordGear(id);
  const instances = new Set<string>();
  for (const { id, defId } of state.gear) {
    if (instances.has(id)) errors.push(`Duplicate gear instance ${id}.`);
    instances.add(id);
    if (getEntry(catalog.items, defId)?.kind !== 'gear') errors.push(`Invalid gear definition for ${id}.`);
    if (references.get(id) !== 1) errors.push(`Gear ${id} must occupy exactly one bag or equipped slot.`);
  }
  for (const id of references.keys()) {
    if (!instances.has(id)) errors.push(`Missing gear instance ${id}.`);
  }

  if (state.hotbar.length !== HOTBAR_CAPACITY) errors.push(`Expected ${HOTBAR_CAPACITY} hotbar slots.`);
  for (const [index, id] of state.hotbar.entries()) {
    if (id !== null && (typeof id !== 'string' || getEntry(catalog.items, id)?.kind !== 'consumable')) {
      errors.push(`Invalid hotbar item at slot ${index}.`);
    }
  }
  return errors;
}
