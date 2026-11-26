# ADR-008 Content IDs and validation

Status: Accepted (2026-11-26, reviewed in PR #3)

Date: 2026-11-25

## IDs

Definition IDs match `^[a-z][a-z0-9_]{1,47}$` and are globally unique. Required prefixes are `elem_`, `hero_`, `item_`, `recipe_`, and `q_`. Future kinds reserve `creature_`, `npc_`, `res_`, `crop_`, `map_`, and `enc_`.

## Schema location and shapes

Under decision D2, Zod schemas and their inferred content types live in `src/content/schema/`. Domain code receives validated plain objects via the future mapping in M1-02. The five supported files are arrays of strict definitions.

| Kind | Fields chosen where the plan leaves the shape open |
| --- | --- |
| Elements | `label` is non-empty text, `active` is boolean, `color` is a six-digit hex string, and `modifiers` is a map from existing element IDs to finite non-negative numbers. Multiplier semantics are deferred to M4-01. |
| Heroes | `atlas` and `portrait` are non-empty asset keys. |
| Items | `kind` and `icon` are non-empty strings. `price` is a non-negative integer. `stackMax` is 1–99. Stats and recipe backrefs are deferred. |
| Recipes | `station` is a non-empty string. `inputs` and `outputs` are non-empty arrays of `{ itemId, quantity }`, with unique item IDs within each array. `requirement` is a non-empty string or null. |
| Quests | `prereqs` and `next` are arrays of quest IDs. `objectives` contains `{ kind, count }`. `reward` contains `{ coins, items }`, with items using the recipe stack shape. `peacefulAlternative` is a non-empty string or null. |

Objective counts and item quantities are positive safe integers. Prices and reward coins are non-negative safe integers. Gameplay caps for prices and coins are deferred to balance work. The string descriptors for recipe requirements and peaceful alternatives are opaque for this milestone.

## Validator contract

`validateContent(files)` accepts a filename-keyed record of parsed JSON and returns `Result<Summary, ValidationError[]>`. A successful summary includes counts for every kind and lists absent kinds separately from present empty arrays. An error has `file`, a JSON path rooted at `$`, `code`, and `message`. Codes are `SCHEMA`, `ID_FORMAT`, `ID_PREFIX`, `DUPLICATE_ID`, `MISSING_REF`, `QUEST_CYCLE`, `UNKNOWN_FILE`, and `PARSE` (CLI JSON syntax errors).

The validator checks definition IDs, references from structurally valid entries, modifier keys even when their values are invalid, and cycles in quest prerequisites. The CLI checks top-level files against the exact supported filenames, including case and extension. The CLI defaults to `src/content/data/` and skips the repository's `.gitkeep` marker there. It reports counts and absent kinds, and exits 1 on an error. `npm run build` invokes it first. Production content may be absent at M0-05. Game data for these kinds is decided in later tasks.

CI is deferred to a separate task under decision D5. A cross-kind duplicate also reports `ID_PREFIX` under decision D6 because the required prefixes are disjoint.

Under decision D7, game content JSON lives in `src/content/data/`. Content code, including the validator and any future registry, lives outside the data directory.
