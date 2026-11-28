# ADR-017 M2 content budget

Status: Accepted (owner-approved 2026-11-28)

All numbers are provisional and will be balanced through playtesting. Item IDs use the `item_` prefix. The tables omit that prefix from item names for readability.

## 1. Principles

- Gathering and mining use a button interaction. v0.1 has no tools.
- Every material is obtainable without combat. Raw materials come from gathering, mining, or Neris's shop. Neris sells raw materials, and processed materials are craft-only. Encounters may award bonus materials, and none are exclusive to encounters.
- Item kinds are `material`, `gear`, `consumable`, and `quest`. Quest items cannot be sold or dropped.
- `price` is the reference value. Buying costs `price` and is available only for items in Neris's stock (M3-02). Selling pays `floor(price / 2)`. Items with `price` 0 cannot be sold.
- Orin's forge handles smelting, weapon crafting, and upgrades. The workbench handles the other recipes.

## 2. Materials (20)

| Item ID suffix | Source | Price |
| --- | --- | ---: |
| `oak_log` | Gather in Whisperwood | 6 |
| `resin` | Gather in Whisperwood | 8 |
| `silverleaf` | Gather in Whisperwood | 8 |
| `moonpetal` | Gather in Whisperwood | 12 |
| `reed_fiber` | Gather in Whisperwood | 6 |
| `glow_moss` | Gather in Whisperwood | 10 |
| `soft_feather` | Gather in Whisperwood | 12 |
| `clay` | Gather in Whisperwood | 6 |
| `stone` | Mine in Crystal Hollow | 4 |
| `coal` | Mine in Crystal Hollow | 8 |
| `copper_ore` | Mine in Crystal Hollow | 10 |
| `iron_ore` | Mine in Crystal Hollow | 16 |
| `quartz` | Mine in Crystal Hollow | 18 |
| `starlite_ore` | Mine in Crystal Hollow | 30 |
| `plank` | Craft only | 15 |
| `woven_cloth` | Craft only | 20 |
| `quartz_lens` | Craft only | 45 |
| `copper_ingot` | Craft only | 35 |
| `iron_ingot` | Craft only | 55 |
| `starlite_ingot` | Craft only | 100 |

## 3. Recipes (15)

| Ref | Recipe | Station | Inputs | Output |
| --- | --- | --- | --- | --- |
| R01 | `plank` | Workbench | 2 `oak_log` | 1 `plank` |
| R02 | `woven_cloth` | Workbench | 3 `reed_fiber` | 1 `woven_cloth` |
| R03 | `quartz_lens` | Workbench | 2 `quartz` + 1 `resin` | 1 `quartz_lens` |
| R04 | `copper_ingot` | Forge | 3 `copper_ore` + 1 `coal` | 1 `copper_ingot` |
| R05 | `iron_ingot` | Forge | 3 `iron_ore` + 1 `coal` | 1 `iron_ingot` |
| R06 | `starlite_ingot` | Forge | 3 `starlite_ore` + 2 `coal` | 1 `starlite_ingot` |
| R07 | `ironheart_blade` | Forge | 3 `iron_ingot` + 1 `plank` | 1 `ironheart_blade` |
| R08 | `ironwood_longbow` | Forge | 2 `iron_ingot` + 2 `plank` + 1 `woven_cloth` | 1 `ironwood_longbow` |
| R09 | `prism_focus` | Forge | 2 `iron_ingot` + 2 `quartz` + 1 `glow_moss` | 1 `prism_focus` |
| R10 | `starlite_edge` | Forge | 3 `starlite_ingot` + 1 `iron_ingot` + 1 `quartz_lens` | 1 `starlite_edge` |
| R11 | `starlite_bow` | Forge | 2 `starlite_ingot` + 2 `plank` + 1 `woven_cloth` + 1 `soft_feather` | 1 `starlite_bow` |
| R12 | `starlite_focus` | Forge | 2 `starlite_ingot` + 1 `quartz_lens` + 2 `moonpetal` | 1 `starlite_focus` |
| R13 | `star_lantern` | Workbench | 1 `starlite_ingot` + 1 `quartz_lens` + 2 `glow_moss` + 1 `clay` | 1 `star_lantern` |
| R14 | `silverleaf_tonic` | Workbench | 2 `silverleaf` + 1 `clay` | 2 `silverleaf_tonic` |
| R15 | `moonpetal_draught` | Workbench | 2 `moonpetal` + 1 `clay` | 2 `moonpetal_draught` |

- `star_lantern` is a quest item for the Peaceful shrine route with price 0.
- `silverleaf_tonic` restores HP and has price 15. `moonpetal_draught` restores mana and has price 20. Both are consumables.
- Tests must verify that every material is used by at least one recipe or upgrade cost.

## 4. Gear (20)

The split is 9 `mainHand`, 6 `body`, and 5 `accessory`. M3 finalizes sources. Starter gear keeps price 0.

D38 assigns the six reward items prices as `gear`. They can be sold for `floor(price / 2)`.

### mainHand (9)

| Item ID suffix | Template | Upgrade tier | Stats | Source | Price |
| --- | --- | --- | --- | --- | ---: |
| `training_blade` | close | copper | power 3 | Starter | 0 |
| `willow_shortbow` | ranged | copper | power 3 | Starter | 0 |
| `lantern_focus` | support | copper | power 1, maxMana 10 | Starter | 0 |
| `ironheart_blade` | close | iron | power 6 | R07 | 200 |
| `ironwood_longbow` | ranged | iron | power 6 | R08 | 200 |
| `prism_focus` | support | iron | power 3, maxMana 20 | R09 | 200 |
| `starlite_edge` | close | starlite | power 10 | R10 | 400 |
| `starlite_bow` | ranged | starlite | power 10 | R11 | 400 |
| `starlite_focus` | support | starlite | power 5, maxMana 30 | R12 | 400 |

### body (6)

All templates are `null`.

| Item ID suffix | Upgrade tier | Stats | Source | Price |
| --- | --- | --- | --- | ---: |
| `traveler_tunic` | copper | guard 2, maxHp 10 | Starter | 0 |
| `woven_jerkin` | copper | guard 3, maxHp 15 | Shop | 60 |
| `copper_ring_coat` | copper | guard 5, maxHp 10 | Shop | 120 |
| `mossweave_robe` | iron | guard 2, maxHp 10, maxMana 15 | Quest reward | 180 |
| `iron_guard_mail` | iron | guard 8, maxHp 20 | Quest reward | 260 |
| `starlite_mantle` | starlite | guard 10, maxHp 30, maxMana 10 | `q_restore` reward | 450 |

### accessory (5)

All templates are `null`.

| Item ID suffix | Upgrade tier | Stats | Source | Price |
| --- | --- | --- | --- | ---: |
| `copper_band` | copper | power 1, guard 1 | Shop | 50 |
| `feather_charm` | copper | maxHp 15 | `q_pet` reward | 80 |
| `silverleaf_pendant` | iron | maxHp 10, maxMana 10 | `q_farm` reward | 160 |
| `moonpetal_brooch` | iron | maxMana 20 | Shop | 150 |
| `star_compass` | starlite | power 2, guard 2, maxHp 10, maxMana 10 | Chapter reward | 450 |

## 5. Upgrades

Upgrades run at the forge, are deterministic, and cannot fail. Gear goes from +0 through +3. Each level adds `max(1, ceil(base × 0.15))` to each stat the item has. For example, `starlite_edge` starts at power 10, gains 2 per upgrade level, and reaches power 16 at +3.

In the cost table, `T` is the ingot for the item's upgrade tier, one of `copper_ingot`, `iron_ingot`, or `starlite_ingot`.

| Upgrade | Materials | Coins |
| --- | --- | ---: |
| +1 | 2 `T` + 2 `stone` | 20 |
| +2 | 3 `T` + 1 `quartz` | 50 |
| +3 | 4 `T` + 1 `quartz_lens` | 100 |

The preview shows the cost and resulting stats before confirmation (master plan §3.3).

## 6. Levels and XP

| Level transition | XP to next level |
| --- | ---: |
| 1 → 2 | 100 |
| 2 → 3 | 150 |
| 3 → 4 | 220 |
| 4 → 5 | 300 |
| 5 → 6 | 400 |
| 6 → 7 | 520 |
| 7 → 8 | 660 |
| 8 → 9 | 820 |
| 9 → 10 | 1000 |

Level 10 requires 4170 cumulative XP. XP stops accruing at level 10, with no overflow.

| Provisional source | XP |
| --- | ---: |
| Gather | 4 |
| Mine | 6 |
| Harvest | 4 |
| Craft | 10, plus 20 the first time per recipe |
| Upgrade | 15 |
| Befriend a creature | 40 |
| Quest (M3) | 40–250 |
| Adventure encounter win (M4) | 20 |

M4 defines Peaceful equivalents for encounter XP and adds a test for parity. Completing the chapter on either route yields total XP within ±10%.

## Out of scope

Data files, schemas, quest reward wiring (M3), shop stock (M3-02), encounter XP implementation (M4), and crop items (M5).
