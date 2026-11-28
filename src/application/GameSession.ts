import type { EquipError, UnequipError } from '@domain/equipment/equipment';
import type { LayoutError } from '@domain/inventory/layout';
import type { NewGameError } from '@domain/player/newGame';
import type { GearSlot, NewGameRequest, PlayerState } from '@domain/player/types';
import type { Result } from '@shared/result';

export type { GearSlot, Mode, NewGameRequest } from '@domain/player/types';

export type SessionState = { phase: 'menu' } | { phase: 'playing'; player: PlayerState };
export type SessionCommand = Readonly<
  ({ type: 'NewGame' } & NewGameRequest) | { type: 'EnterExit'; exitName: string } |
  { type: 'Equip'; gearId: string } | { type: 'Unequip'; slot: GearSlot } |
  { type: 'MoveBagSlot'; from: number; to: number } |
  { type: 'AssignHotbar'; index: number; itemId: string | null }
>;
export type SessionEvent = Readonly<
  ({ type: 'GameStarted' } & NewGameRequest) | { type: 'MapChanged'; mapId: string } |
  { type: 'EquipmentChanged' } | { type: 'InventoryChanged' }
>;
export type SessionError = NewGameError | EquipError | UnequipError | LayoutError |
  'ALREADY_PLAYING' | 'NOT_PLAYING' | 'UNKNOWN_EXIT' | 'MISSING_CHECKPOINT';
export type SessionListener = (event: SessionEvent) => void;

export interface GameSession {
  snapshot(): Readonly<SessionState>;
  subscribe(listener: SessionListener): () => void;
  dispatch(command: SessionCommand): Result<void, SessionError>;
}
