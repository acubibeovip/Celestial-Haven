# ADR-008 Content IDs and validation

Status: Proposed

Date: 2026-11-25

## IDs

Definition IDs match `^[a-z][a-z0-9_]{1,47}$` and are globally unique. Required prefixes are `elem_`, `hero_`, `item_`, `recipe_`, and `q_`. Future kinds reserve `creature_`, `npc_`, `res_`, `crop_`, `map_`, and `enc_`.

## Schema location and shapes

Under decision D2, Zod schemas and their inferred content types live in `src/content/schema/`. Domain code receives validated plain objects via the future mapping in M1-02. The five supported files are arrays of strict definitions.

| Kind | Fields chosen where the plan leaves the shape open |
| --- | --- |
| Elements | `label` is non-empty text, `active` is boolean, `color` is a six-digit hex string, and `modifiers` is a map of non-empty keys to finite numbers. |
| Heroes | `atlas` and `portrait` are non-empty asset keys. |
| Items | `kind` and `icon` are non-empty strings. `price` is a non-negative integer. `stackMax` is 1–99. Stats and recipe backrefs are deferred. |
| Recipes | `station` is a non-empty string. `inputs` and `outputs` are arrays of `{ itemId, quantity }`. `requirement` is a non-empty string or null. |
| Quests | `prereqs` and `next` are arrays of quest IDs. `objectives` contains `{ kind, count }`. `reward` contains `{ coins, items }`, with items using the recipe stack shape. `peacefulAlternative` is a non-empty string or null. |

Counts and prices are non-negative safe integers. Item quantities are positive safe integers. The string descriptors for recipe requirements and peaceful alternatives are opaque for this milestone.

## Validator contract

`validateContent(files)` accepts a filename-keyed record of parsed JSON and returns `Result<Summary, ValidationError[]>`. A successful summary includes counts for every kind and lists absent kinds separately from present empty arrays. An error has `file`, a JSON path rooted at `$`, `code`, and `message`. Codes are `SCHEMA`, `ID_FORMAT`, `ID_PREFIX`, `DUPLICATE_ID`, `MISSING_REF`, `QUEST_CYCLE`, and `UNKNOWN_FILE`.

The validator checks definition IDs, references from structurally valid entries, and cycles in quest prerequisites. The CLI reads top-level JSON files, reports counts and absent kinds, and exits 1 on an error. `npm run build` invokes it first. Production content may be absent at M0-05. Game data for these kinds is decided in later tasks.
