# ADR-010 MVP scope

Status: Accepted (owner-approved 2026-11-26)

## 1. Maps

Four areas use 32 × 32 pixel tiles and a top-down 3/4 view.

| ID | Size (tiles) | Notes |
| --- | --- | --- |
| `map_starbrook_village` | 40 × 32 | NPCs, shop, quest board, forge |
| `map_farm` | 32 × 24 | House, 12 plots, chest, well |
| `map_whisperwood` | 40 × 32 | Trees, herbs, lake, creatures |
| `map_crystal_hollow` | 40 × 32 | Ore, caves, shrine entrance |
| `map_star_shrine` | At most 20 × 16 | Boss and puzzle sub-map counted within the Crystal Hollow area |

## 2. Heroes

All ten heroes are selectable from New Game and use three shared gameplay templates.

| Hero ID | Template | Element ID |
| --- | --- | --- |
| `hero_storm_monk` | close | `elem_thunder` |
| `hero_aurora_priestess` | support | `elem_light` |
| `hero_frostfox_sorceress` | ranged | `elem_ice` |
| `hero_earthshaker_sentinel` | close | `elem_earth` |
| `hero_galeblade_wanderer` | close | `elem_wind` |
| `hero_eclipse_reaper` | close | `elem_dark` |
| `hero_tidebound_dragon_general` | close | `elem_water` |
| `hero_phoenix_blade_dancer` | close | `elem_fire` |
| `hero_starfall_archer` | ranged | `elem_astral` |
| `hero_spirit_beast_warden` | support | `elem_nature` |

## 3. Elements

- The game owns its element IDs independently of the vendor catalog IDs. M0-02 records the mapping to the 13 catalog elements in asset metadata. The three remaining catalog elements receive game IDs after the audit.
- v0.1 defines ten elements: `elem_thunder`, `elem_light`, `elem_ice`, `elem_earth`, `elem_wind`, `elem_dark`, `elem_water`, `elem_fire`, `elem_astral`, and `elem_nature`.
- The provisional active elements in v0.1 are `elem_fire`, `elem_water`, and `elem_nature`. The cycle is fire > nature > water > fire.
- Modifiers apply only between active elements and only in Adventure encounters against the eight creatures. The boss, Void Devourer, is element-neutral.
- All other affinities are neutral and carry no penalty. M4-01 sets and caps modifier values so that every hero can win the chapter.
- Confirm the active set after M0-02. Each active element requires at least two usable VFX and two fitting creature species. If an element falls short, substitute it and amend this ADR.

## 4. Routes

Peaceful and Adventure both call `completeShrine()`, set the `shrine_restored` flag, and give equivalent progression. Players choose a mode at New Game and can change it outside encounters. In Peaceful, creatures and the boss are neutral, deal no damage, and never force an encounter.

## 5. Content budget for v0.1

These are targets [T] for definitions. Upgrade levels are instance state.

| Content | Target [T] |
| --- | --- |
| Heroes and templates | 10 heroes across 3 templates |
| Levels | 1–10 |
| Gear definitions | 20 total, with 9 `mainHand`, 6 `body`, and 5 `accessory` per [ADR-017](ADR-017-m2-content.md#4-gear-20) |
| Gear upgrade | +0 through +3 on each instance |
| Materials | 20 |
| Recipes | 15 |
| NPCs | 5 |
| Quests | 10, with IDs from master plan §3.7 |
| Creatures | 8 species, at most 16 variants, and 3 pets chosen from those species |
| Farm | 6 crop definitions and 12 plots |
| Weather | Clear, rain, and mist |
| Boss | 1 |
| VFX | 6–10 |
| Maps | As listed in §1 of this ADR |

Apply scope cuts in the order defined in [master plan §4](../master-plan.md#4-phạm-vi-mvp-và-acceptance).

## 6. Asset gate

A hero that has yet to pass the M0-02 top-down audit remains selectable in development builds with a clearly marked placeholder. Public release materials claim only audited heroes. If fewer than ten heroes pass, record a blocker and update the store copy to avoid implying that ten heroes are available.

## Out of scope

Content JSON files, element modifier values, balance numbers, and asset mapping.
