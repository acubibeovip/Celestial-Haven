# ADR-024 Crafting rules and recipes

Status: Proposed

## D58 Recipe content

The six processed materials, two consumables, Star Lantern, and recipes R01–R15 follow [ADR-017](ADR-017-m2-content.md). Item and recipe IDs use the established prefixes. Each recipe uses `forge` or `workbench` and names its primary output in its ID. Each gear output has quantity 1. Processed materials and both consumables use stackMax 99. Star Lantern has price 0 and stackMax 1.

Every v0.1 recipe has `requirement: null`. Gating Star Lantern behind the shrine quest remains open for M4.

## D59 First-time record

New Game starts with an empty `craftedRecipes` array. Successful crafts record the recipe ID in a unique list sorted by ID.

## D60 Atomic craft

`craft(state, recipe, catalog)` stages input consumption and both stack and gear outputs through `applyBagChange`. It then calls `gainXp` with the craft award plus the bonus if the recipe was absent from the incoming state's `craftedRecipes`. The rule returns the new state, created gear IDs, configured XP award, levels gained, and first-time flag. If either step fails, the caller retains the original state.

## D61 Session command

`Craft { recipeId }` requires the playing phase, a known recipe, and a current map with the required station. An unknown recipe returns `UNKNOWN_RECIPE`. A missing map or station returns `NO_STATION_ON_MAP`. The loader supplies empty station sets until M2-05b adds markers.

LocalSession commits the new snapshot before emitting `ItemCrafted { recipeId, outputs, createdGearIds, xp, levelsGained, firstTime }`. Rejection leaves the snapshot reference intact and emits no event. The local client checks proximity when station interaction lands in M2-05b. A future NetworkSession server must verify proximity independently.
