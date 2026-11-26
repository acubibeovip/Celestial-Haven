import { createNewGame } from '@domain/player/newGame';
import type { NewGameCatalog } from '@domain/player/types';
import { err, ok, type Result } from '@shared/result';
import type { GameSession, SessionCommand, SessionError, SessionEvent, SessionListener, SessionState } from './GameSession';

function freezeTree<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
}

export class LocalSession implements GameSession {
  private state: Readonly<SessionState> = Object.freeze({ phase: 'menu' });
  private readonly listeners = new Set<SessionListener>();

  private readonly catalog: NewGameCatalog;
  private readonly reportError: (error: unknown) => void;

  constructor(catalog: NewGameCatalog, reportError: (error: unknown) => void = (error) => console.error(error)) {
    this.catalog = catalog;
    this.reportError = reportError;
  }

  snapshot(): Readonly<SessionState> {
    return this.state;
  }

  subscribe(listener: SessionListener): () => void {
    const subscription: SessionListener = (event) => listener(event);
    this.listeners.add(subscription);
    return () => { this.listeners.delete(subscription); };
  }

  dispatch(command: SessionCommand): Result<void, SessionError> {
    if (this.state.phase === 'playing') return err('ALREADY_PLAYING');
    const result = createNewGame(command, this.catalog);
    if (!result.ok) return result;

    this.state = freezeTree({ phase: 'playing', player: result.value });
    this.emit(Object.freeze({
      type: 'GameStarted',
      heroId: result.value.heroId,
      mode: result.value.mode,
    }));
    return ok(undefined);
  }

  private emit(event: SessionEvent): void {
    // Snapshot the order. Skip removed listeners and defer new subscriptions.
    for (const listener of [...this.listeners]) {
      if (!this.listeners.has(listener)) continue;
      try {
        listener(event);
      } catch (error) {
        try {
          this.reportError(error);
        } catch {
          // A faulty reporter must not interrupt other listeners or dispatch.
        }
      }
    }
  }
}
