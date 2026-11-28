import type { CraftError } from '@domain/crafting/craft';
import type { ItemStack } from '@domain/inventory/types';
import type { EquipError, UnequipError } from '@domain/equipment/equipment';
import type { HarvestError, WorldState } from '@domain/gathering/harvest';
import type { LayoutError } from '@domain/inventory/layout';
import type { NewGameError } from '@domain/player/newGame';
import type { GearSlot, NewGameRequest, PlayerState } from '@domain/player/types';
import type { Result } from '@shared/result';

export type { GearSlot, Mode, NewGameRequest } from '@domain/player/types';

export type SessionState = { phase: 'menu' } | { phase: 'playing'; player: PlayerState; world: WorldState };
export type SessionCommand = Readonly<
  ({ type: 'NewGame' } & NewGameRequest) | { type: 'EnterExit'; exitName: string } |
  { type: 'Equip'; gearId: string } | { type: 'Unequip'; slot: GearSlot } |
  { type: 'MoveBagSlot'; from: number; to: number } |
  { type: 'AssignHotbar'; index: number; itemId: string | null } |
  { type: 'Gather'; nodeId: string } | { type: 'EndDay' } | { type: 'Craft'; recipeId: string }
>;
export type SessionEvent = Readonly<
  ({ type: 'GameStarted' } & NewGameRequest) | { type: 'MapChanged'; mapId: string } |
  { type: 'EquipmentChanged' } | { type: 'InventoryChanged' } |
  { type: 'ResourceGathered'; nodeId: string; itemId: string; quantity: number; xp: number; levelsGained: number } |
  { type: 'DayEnded'; day: number } |
  {
    type: 'ItemCrafted'; recipeId: string; outputs: readonly ItemStack[]; createdGearIds: readonly string[];
    xp: number; levelsGained: number; firstTime: boolean;
  }
>;
export type SessionError = NewGameError | EquipError | UnequipError | LayoutError | HarvestError | CraftError |
  'UNKNOWN_RECIPE' | 'NO_STATION_ON_MAP' | 'UNKNOWN_NODE' | 'NODE_NOT_ON_MAP' | 'NO_BED_ON_MAP' |
  'ALREADY_PLAYING' | 'NOT_PLAYING' | 'UNKNOWN_EXIT' | 'MISSING_CHECKPOINT';
export type SessionListener = (event: SessionEvent) => void;

export interface GameSession {
  snapshot(): Readonly<SessionState>;
  subscribe(listener: SessionListener): () => void;
  dispatch(command: SessionCommand): Result<void, SessionError>;
}
