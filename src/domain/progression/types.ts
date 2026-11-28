export interface Progression {
  readonly levelCap: number;
  readonly xpToNext: readonly number[];
  readonly xpSources: Readonly<{
    gather: number;
    mine: number;
    harvest: number;
    craft: number;
    craftFirstBonus: number;
    upgrade: number;
    befriend: number;
  }>;
}
