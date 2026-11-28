import type { ItemInfo, NewGameCatalog } from '@domain/player/types';

export const BAG_CAPACITY = 24;
export const HOTBAR_CAPACITY = 4;

export interface ItemStack {
  readonly itemId: string;
  readonly quantity: number;
}

export type BagSlot = null | (ItemStack & { readonly kind: 'stack' }) |
  { readonly kind: 'gear'; readonly gearId: string };

export type ItemCatalog = Pick<NewGameCatalog, 'items'>;

export interface BagChange {
  readonly remove: readonly ItemStack[];
  readonly add: readonly ItemStack[];
  readonly addGear?: readonly Pick<ItemInfo, 'id'>[];
  readonly removeGearIds?: readonly string[];
}

export type BagError = 'UNKNOWN_ITEM' | 'INVALID_QUANTITY' | 'WRONG_ITEM_KIND' |
  'INSUFFICIENT_ITEMS' | 'GEAR_NOT_IN_BAG' | 'BAG_FULL';
