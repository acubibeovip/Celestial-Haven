import type { BagSlot } from '@domain/inventory/types';
import type { Progression } from '@domain/progression/types';

export type Mode = 'peaceful' | 'adventure';
export type TemplateId = 'close' | 'ranged' | 'support';
export type GearSlot = 'mainHand' | 'body' | 'accessory';

export { BAG_CAPACITY } from '@domain/inventory/types';

export interface NewGameRequest {
  heroId: string;
  mode: Mode;
}

export interface HeroInfo {
  id: string;
  template: TemplateId;
}

export interface Stats {
  maxHp: number;
  maxMana: number;
  power: number;
  guard: number;
}

export interface TemplateInfo {
  base: Stats;
  growth: Stats;
  starterGear: { mainHand: string; body: string };
}

export interface GearItemInfo {
  slot: GearSlot;
  stats: { [Stat in keyof Stats]?: number | undefined };
  template: TemplateId | null;
}

export type ItemKind = 'material' | 'gear' | 'consumable' | 'quest';

export interface ItemInfo {
  id: string;
  kind: ItemKind;
  stackMax: number;
  gear?: GearItemInfo | undefined;
}

export interface NewGameCatalog {
  progression: Progression;
  heroes: Readonly<Record<string, HeroInfo | undefined>>;
  templates: Readonly<Partial<Record<TemplateId, TemplateInfo>>>;
  items: Readonly<Record<string, ItemInfo | undefined>>;
}

export interface GearInstance {
  id: string;
  defId: string;
  upgrade: number;
}

export interface PlayerLocation {
  mapId: string;
  x: number;
  y: number;
}

export interface PlayerState {
  location: PlayerLocation;
  heroId: string;
  mode: Mode;
  level: number;
  xp: number;
  coins: number;
  bag: BagSlot[];
  hotbar: (string | null)[];
  gear: GearInstance[];
  equipped: Partial<Record<GearSlot, string>>;
  nextGearSeq: number;
  rewardLedger: string[];
  quests: Record<string, { stage: number; completed: boolean }>;
  npcBond: Record<string, number>;
}
