import type { CraftStation } from '@domain/crafting/craft';
import type { PlayerLocation } from '@domain/player/types';

export const START_MAP_ID = 'map_starbrook_village';

export type MapExit = Readonly<{
  name: string;
  tileX: number;
  tileY: number;
  targetMap: string;
  targetSpawn: string;
}>;

export interface CheckpointMap {
  spawns: ReadonlyMap<string, Readonly<PlayerLocation>>;
  exits: ReadonlyMap<string, MapExit>;
  stations: ReadonlySet<CraftStation>;
  hasBed: boolean;
  resourceNodeIds: ReadonlySet<string>;
}

export type MapCatalog = ReadonlyMap<string, CheckpointMap>;
