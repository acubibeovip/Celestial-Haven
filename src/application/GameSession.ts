import type { NewGameError } from '@domain/player/newGame';
import type { NewGameRequest, PlayerState } from '@domain/player/types';
import type { Result } from '@shared/result';

export type { Mode, NewGameRequest } from '@domain/player/types';

export type SessionState = { phase: 'menu' } | { phase: 'playing'; player: PlayerState };
export type SessionCommand = Readonly<{ type: 'NewGame' } & NewGameRequest>;
export type SessionEvent = Readonly<{ type: 'GameStarted' } & NewGameRequest>;
export type SessionError = NewGameError | 'ALREADY_PLAYING';
export type SessionListener = (event: SessionEvent) => void;

export interface GameSession {
  snapshot(): Readonly<SessionState>;
  subscribe(listener: SessionListener): () => void;
  dispatch(command: SessionCommand): Result<void, SessionError>;
}
