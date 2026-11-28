import { getEntry } from '@domain/player/catalog';
import type { PlayerState } from '@domain/player/types';
import { err, ok, type Result } from '@shared/result';
import type { BagChange, BagError, BagSlot, ItemCatalog, ItemStack } from './types';

type StackChange = ItemStack & { stackMax: number };

interface BagChangeResult {
  state: PlayerState;
  createdGearIds: string[];
}

function validateStacks(
  entries: readonly ItemStack[], catalog: ItemCatalog,
): Result<StackChange[], BagError> {
  const totals = new Map<string, number>();
  for (const { itemId, quantity } of entries) {
    // Bad lines cannot cancel out as a result of merging.
    if (!Number.isSafeInteger(quantity) || quantity <= 0) return err('INVALID_QUANTITY');
    const total = (totals.get(itemId) ?? 0) + quantity;
    if (!Number.isSafeInteger(total)) return err('INVALID_QUANTITY');
    totals.set(itemId, total);
  }

  const changes: StackChange[] = [];
  for (const [itemId, quantity] of totals) {
    const item = getEntry(catalog.items, itemId);
    if (!item) return err('UNKNOWN_ITEM');
    if (item.kind === 'gear') return err('WRONG_ITEM_KIND');
    changes.push({ itemId, quantity, stackMax: item.stackMax });
  }
  return ok(changes);
}

function removeStack(bag: BagSlot[], { itemId, quantity }: StackChange): boolean {
  let remaining = quantity;
  for (let index = bag.length - 1; index >= 0 && remaining > 0; index--) {
    const slot = bag[index];
    if (slot?.kind !== 'stack' || slot.itemId !== itemId) continue;
    const removed = Math.min(slot.quantity, remaining);
    bag[index] = removed === slot.quantity ? null : { ...slot, quantity: slot.quantity - removed };
    remaining -= removed;
  }
  return remaining === 0;
}

function addStack(bag: BagSlot[], { itemId, quantity, stackMax }: StackChange): boolean {
  let remaining = quantity;
  const empty: number[] = [];
  for (const [index, slot] of bag.entries()) {
    if (slot === null) {
      empty.push(index);
    } else if (slot.kind === 'stack' && slot.itemId === itemId && remaining > 0) {
      const added = Math.min(remaining, stackMax - slot.quantity);
      if (added > 0) bag[index] = { ...slot, quantity: slot.quantity + added };
      remaining -= added;
    }
  }

  const needed = Math.ceil(remaining / stackMax);
  if (needed > empty.length) return false;

  for (const index of empty.slice(0, needed)) {
    const added = Math.min(remaining, stackMax);
    bag[index] = { kind: 'stack', itemId, quantity: added };
    remaining -= added;
  }
  return true;
}

export function applyBagChange(
  state: Readonly<PlayerState>, change: BagChange, catalog: ItemCatalog,
): Result<BagChangeResult, BagError> {
  const removals = validateStacks(change.remove, catalog);
  if (!removals.ok) return removals;
  const additions = validateStacks(change.add, catalog);
  if (!additions.ok) return additions;

  const addGear = change.addGear ?? [];
  for (const { id } of addGear) {
    const item = getEntry(catalog.items, id);
    if (!item) return err('UNKNOWN_ITEM');
    if (item.kind !== 'gear') return err('WRONG_ITEM_KIND');
  }

  const removedGear = new Map<string, number>();
  for (const gearId of change.removeGearIds ?? []) {
    const index = state.bag.findIndex((slot) => slot?.kind === 'gear' && slot.gearId === gearId);
    if (index < 0 || removedGear.has(gearId)) return err('GEAR_NOT_IN_BAG');
    removedGear.set(gearId, index);
  }

  // Stage the whole transaction on a private copy. Rejected plans never reach the caller.
  const bag = [...state.bag];
  for (const removal of removals.value) {
    if (!removeStack(bag, removal)) return err('INSUFFICIENT_ITEMS');
  }
  for (const index of removedGear.values()) bag[index] = null;
  for (const addition of additions.value) {
    if (!addStack(bag, addition)) return err('BAG_FULL');
  }

  const empty = bag.flatMap((slot, index) => slot === null ? [index] : []);
  if (addGear.length > empty.length) return err('BAG_FULL');
  const instances = addGear.map(({ id: defId }, offset) => ({
    id: `g${state.nextGearSeq + offset}`, defId, upgrade: 0,
  }));
  for (const [offset, instance] of instances.entries()) {
    bag[empty[offset]!] = { kind: 'gear', gearId: instance.id };
  }
  const gear = [...state.gear.filter(({ id }) => !removedGear.has(id)), ...instances];
  return ok({
    state: { ...state, bag, gear, nextGearSeq: state.nextGearSeq + instances.length },
    createdGearIds: instances.map(({ id }) => id),
  });
}
