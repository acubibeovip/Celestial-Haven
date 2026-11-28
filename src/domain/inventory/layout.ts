import { getEntry } from '@domain/player/catalog';
import type { PlayerState } from '@domain/player/types';
import { err, ok, type Result } from '@shared/result';
import { BAG_CAPACITY, HOTBAR_CAPACITY, type ItemCatalog } from './types';

type LayoutError = 'INVALID_SLOT' | 'UNKNOWN_ITEM' | 'WRONG_ITEM_KIND';

function validIndex(index: number, capacity: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < capacity;
}

export function moveSlot(
  state: Readonly<PlayerState>, from: number, to: number, catalog: ItemCatalog,
): Result<PlayerState, LayoutError> {
  if (!validIndex(from, BAG_CAPACITY) || !validIndex(to, BAG_CAPACITY)) return err('INVALID_SLOT');
  const source = state.bag[from];
  if (source == null || from === to) return ok(state);

  const target = state.bag[to] ?? null;
  const bag = [...state.bag];
  if (source.kind === 'stack' && target?.kind === 'stack' && source.itemId === target.itemId) {
    const item = getEntry(catalog.items, source.itemId);
    if (!item) return err('UNKNOWN_ITEM');
    if (item.kind === 'gear') return err('WRONG_ITEM_KIND');

    const moved = Math.min(source.quantity, item.stackMax - target.quantity);
    if (moved === 0) return ok(state);
    bag[to] = { ...target, quantity: target.quantity + moved };
    bag[from] = moved === source.quantity ? null : { ...source, quantity: source.quantity - moved };
  } else {
    bag[to] = source;
    bag[from] = target;
  }
  return ok({ ...state, bag });
}

export function assignHotbar(
  state: Readonly<PlayerState>, index: number, itemId: string | null, catalog: ItemCatalog,
): Result<PlayerState, LayoutError> {
  if (!validIndex(index, HOTBAR_CAPACITY)) return err('INVALID_SLOT');
  if (itemId !== null) {
    const item = getEntry(catalog.items, itemId);
    if (!item) return err('UNKNOWN_ITEM');
    if (item.kind !== 'consumable') return err('WRONG_ITEM_KIND');
  }
  if (state.hotbar[index] === itemId) return ok(state);
  const hotbar = [...state.hotbar];
  hotbar[index] = itemId;
  return ok({ ...state, hotbar });
}
