export type Mode = 'peaceful' | 'adventure';
export type TemplateId = 'close' | 'ranged' | 'support';
export type GearSlot = 'mainHand' | 'body' | 'accessory';

export const BAG_CAPACITY = 24;

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
  starterGear: { mainHand: string; body: string };
}

export interface GearItemInfo {
  slot: GearSlot;
  stats: { [Stat in keyof Stats]?: number | undefined };
  template: TemplateId | null;
}

export interface ItemInfo {
  id: string;
  kind: string;
  stackMax: number;
  gear?: GearItemInfo | undefined;
}

export interface NewGameCatalog {
  heroes: Readonly<Record<string, HeroInfo | undefined>>;
  templates: Readonly<Partial<Record<TemplateId, TemplateInfo>>>;
  items: Readonly<Record<string, ItemInfo | undefined>>;
}

export interface GearInstance {
  id: string;
  defId: string;
  upgrade: number;
}

export interface PlayerState {
  heroId: string;
  mode: Mode;
  level: number;
  xp: number;
  coins: number;
  bag: { itemId: string; quantity: number }[];
  gear: GearInstance[];
  equipped: Partial<Record<GearSlot, string>>;
  nextGearSeq: number;
  rewardLedger: string[];
  quests: Record<string, { stage: number; completed: boolean }>;
  npcBond: Record<string, number>;
}
