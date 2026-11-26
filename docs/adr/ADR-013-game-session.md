# ADR-013 GameSession and the New Game flow

Status: Accepted (2026-11-26, reviewed in PR #9)

## D15 GameSession contract

The UI sends commands through the application’s `GameSession` port. `snapshot(): Readonly<SessionState>` returns either `{ phase: 'menu' }` or `{ phase: 'playing', player: PlayerState }`. `subscribe(listener)` returns an unsubscribe function. `dispatch(command)` returns `Result<void, SessionError>`. The initial command is `{ type: 'NewGame', heroId, mode }` and the initial event is `{ type: 'GameStarted', heroId, mode }`. `LocalSession` runs the domain rule using the catalog built from validated content.

## D16 Commit before events

On success, dispatch computes the next state and commits it in one assignment as a new deep-frozen snapshot. It then emits the event. On rejection, it returns an error, preserves the exact snapshot reference, and emits nothing. `NewGame` during the playing phase returns `ALREADY_PLAYING`. Domain New Game errors map directly to session errors.

## D17 Listener isolation

Listeners run in subscription order. Each emission takes a copy of the subscription order, skips listeners removed during emission, and defers new subscriptions to future events. A listener that throws leaves the committed state intact. Its error goes to the injected `reportError(error)`, which defaults to `console.error`. Exceptions from the reporter are contained, so the remaining listeners can still run.

## D18 Ready screen

Confirm dispatches `NewGame`. A rejected command displays a localized inline error and preserves the selection. On `GameStarted`, the UI renders Ready from the committed snapshot, showing the hero name, mode, level, equipped item names, and projected stats. Ready replaces the earlier selection summary until the world exists in M1-04. It shows a temporary note and has no Back button while save support is pending. Reloading returns to Title.
