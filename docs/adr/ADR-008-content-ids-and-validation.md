# ADR-008 Content IDs and validation

Status: Accepted (2026-11-26, reviewed in PR #3)

Date: 2026-11-25

## IDs

Definition IDs match `^[a-z][a-z0-9_]{1,47}$` and are globally unique. Required prefixes are `elem_`, `hero_`, `item_`, `recipe_`, `q_`, and `res_`. Future kinds reserve `creature_`, `npc_`, `crop_`, `map_`, and `enc_`.

## Schema location and shapes

Under decision D2, Zod schemas and their inferred content types live in `src/content/schema/`. Domain code receives validated plain objects via the future mapping in M1-02. The definition files are arrays of strict definitions. The strings kind uses a flat object in `strings.en.json`. The templates kind uses an object with exactly the three v0.1 template keys in `templates.json`. The progression kind uses one strict object in `progression.json`.

| Kind | Fields chosen where the plan leaves the shape open |
| --- | --- |
| Elements | `nameKey` references an English string, `active` is boolean, `color` is a six-digit hex string, and `modifiers` is a map from existing element IDs to finite non-negative numbers. Multiplier semantics are deferred to M4-01. |
| Heroes | `nameKey` and `archetypeKey` reference English strings. `atlas` and `portrait` are non-empty asset keys. |
| Items | `nameKey` references an English string. `kind` is one of `material`, `gear`, `consumable`, and `quest`. `icon` is non-empty. `price` is a non-negative integer and must be 0 for quest items. `stackMax` is 1–99. Gear requires a `gear` object and `stackMax: 1`. Other kinds forbid that object. Recipe backrefs are deferred. |
| Templates | `close`, `ranged`, and `support` each have a `nameKey`, positive integer base stats, non-negative integer growth for the same four stats, and `mainHand` and `body` starter item IDs. Starter references must point to gear in the matching slot whose template matches or is null. |
| Progression | `levelCap` is a positive safe integer. `xpToNext` has exactly `levelCap - 1` positive safe integers. `xpSources` contains positive safe integers for `gather`, `mine`, `harvest`, `craft`, `craftFirstBonus`, `upgrade`, and `befriend`. See [ADR-018](ADR-018-player-progression.md). |
| Resource nodes | `resourceNodes.json` lists `gather` and `mine` nodes. Each references an existing ADR-017 raw material of the corresponding source, yields 1–9 items, and respawns after 1–7 game days. |
| Recipes | `station` is a non-empty string. `inputs` and `outputs` are non-empty arrays of `{ itemId, quantity }`, with unique item IDs within each array. `requirement` is a non-empty string or null. |
| Quests | `prereqs` and `next` are arrays of quest IDs. `objectives` contains `{ kind, count }`. `reward` contains `{ coins, items }`, with items using the recipe stack shape. `peacefulAlternative` is a non-empty string or null. |

Objective counts and item quantities are positive safe integers. Prices and reward coins are non-negative safe integers. Gameplay caps for prices and coins are deferred to balance work. The string descriptors for recipe requirements and peaceful alternatives are opaque for this milestone.

## Validator contract

`validateContent(files)` accepts a filename-keyed record of parsed JSON and returns `Result<Summary, ValidationError[]>`. A successful summary includes counts for every kind and lists absent kinds separately from present empty arrays. A valid progression object counts as one. An error has `file`, a JSON path rooted at `$`, `code`, and `message`. Codes are `SCHEMA`, `ID_FORMAT`, `ID_PREFIX`, `DUPLICATE_ID`, `MISSING_REF`, `QUEST_CYCLE`, `UNKNOWN_FILE`, `PARSE` (CLI JSON syntax errors), and `UNREACHABLE`, `SPAWN_ON_EXIT`, and `SPAWN_NEAR_EXIT` (maps).

The validator checks definition IDs, references from structurally valid entries, modifier keys even when their values are invalid, and cycles in quest prerequisites. The CLI checks top-level files against the exact supported filenames, including case and extension. The CLI defaults to `src/content/data/` and skips the repository's `.gitkeep` marker there. It reports counts and absent kinds, and exits 1 on an error. `npm run build` invokes it first. Production content may be absent at M0-05. Game data for these kinds is decided in later tasks.

CI is deferred to a separate task under decision D5. A cross-kind duplicate also reports `ID_PREFIX` under decision D6 because the required prefixes are disjoint.

Under decision D7, game content JSON lives in `src/content/data/`. Content code, including the validator and any future registry, lives outside the data directory.

## D9 Player-facing strings

Definition files use fields ending in `Key` for player-facing text. The validator checks these fields recursively within schema-valid content. Each key reference must be present in `src/content/data/strings.en.json`. A missing entry reports `MISSING_REF` at the referring field. The element label is stored as a `nameKey` reference. Heroes carry `nameKey` and `archetypeKey` references.

`strings.en.json` is a flat object. Keys match `^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$` and values are non-empty strings. An invalid object, key, or value reports `SCHEMA`. Unused keys are allowed for UI text. Other locales are deferred. Element and hero keys use the definition ID without its kind prefix in `element.<id>.name`, `hero.<id>.name`, and `hero.<id>.archetype`.

Gear data records its slot, its upgrade tier (`copper`, `iron`, or `starlite`), a template ID or null, and at least one non-negative integer stat among `power`, `guard`, `maxHp`, and `maxMana`. Starting content and state semantics are recorded in [ADR-012](ADR-012-templates-and-starter-gear.md).

## Map validation

`validateMap(mapId, json, knownMaps)` accepts a Tiled map and an index of known map IDs to spawn names. `npm run validate:maps` indexes the maps under `src/content/maps/` (or `--dir`) before it validates each file. It uses `SCHEMA` for invalid structure or marker placement, `MISSING_REF` for unknown exit targets, and `UNREACHABLE` when a walkable marker cannot be reached by four-neighbour flood fill from the default spawn. It reports `SPAWN_ON_EXIT` at a spawn sharing a tile with an exit, and `SPAWN_NEAR_EXIT` at Chebyshev distance 1 or 2. The CLI also reports `PARSE` for malformed JSON and `UNKNOWN_FILE` for unsupported file types. See [ADR-014](ADR-014-map-conventions.md).
