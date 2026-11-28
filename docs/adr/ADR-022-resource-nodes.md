# ADR-022 Resource nodes and game days

Status: Proposed

Yields and respawn intervals are provisional. Raw material sources, prices, and XP follow [ADR-017](ADR-017-m2-content.md).

## D50 Resource node definitions

Each `res_` ID identifies one node in `resourceNodes.json`. A node has kind `gather` or `mine`, an existing raw material `itemId` with the matching ADR-017 source, a fixed yield of 1–9 items, and a respawn interval of 1–7 game days. Gathering uses no RNG. Map markers in M2-04b will reference these IDs.

## D51 World state

New Game starts with `world = { day: 1, resourceNodes: {} }`. The record stores `{ harvestedDay }` for each harvested node. A node is available if it has no entry or the current day is at least `harvestedDay + respawnDays`.

## D52 Gather

`Gather { nodeId }` checks that the node exists and is available, stages its yield in the bag, and applies the XP source for its kind. Only after those steps succeed does LocalSession commit player and world together and emit `ResourceGathered { nodeId, itemId, quantity, xp, levelsGained }`. The event's `xp` is the configured award before the level cap is applied. A rejection leaves the snapshot and node availability intact and emits no event.

Every map supplies a set of placed node IDs. LocalSession returns `NODE_NOT_ON_MAP` if the current map is missing or its set excludes the node. The map loader derives these sets from resource markers. A future NetworkSession server must verify the player's proximity to the node itself.

## D53 EndDay

Each successful `EndDay` increments `world.day` exactly once, commits, and emits `DayEnded { day }`. Crops, weather, and the time-of-day clock follow in M5.
