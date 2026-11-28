import type { GearItemInfo, GearSlot, ItemInfo, TemplateId } from './types';

export function getEntry<T>(entries: Readonly<Partial<Record<string, T>>>, key: string): T | undefined {
  return Object.hasOwn(entries, key) ? entries[key] : undefined;
}

export function gearForSlot(item: ItemInfo, slot: GearSlot, template: TemplateId): GearItemInfo | undefined {
  const gear = item.gear;
  return item.kind === 'gear' && item.stackMax === 1 && gear?.slot === slot &&
    (gear.template === null || gear.template === template) ? gear : undefined;
}
