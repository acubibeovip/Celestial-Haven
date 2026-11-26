# ADR-012 Templates and starter gear

Status: Proposed

The three v0.1 gameplay templates share a starter body item and have distinct starter main-hand items. These stat values are provisional. M4-01 handles balance.

| Template | Max HP | Max mana | Power | Guard | Starter main hand | Starter body |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| close | 120 | 30 | 12 | 10 | `item_training_blade` | `item_traveler_tunic` |
| ranged | 90 | 50 | 11 | 6 | `item_willow_shortbow` | `item_traveler_tunic` |
| support | 100 | 70 | 8 | 8 | `item_lantern_focus` | `item_traveler_tunic` |

| Item | Slot | Template | Stat bonuses |
| --- | --- | --- | --- |
| Training Blade | mainHand | close | power +3 |
| Willow Shortbow | mainHand | ranged | power +3 |
| Lantern Focus | mainHand | support | power +1, maxMana +10 |
| Traveler's Tunic | body | any | guard +2, maxHp +10 |

All four items have price 0 and stackMax 1. Template labels share the existing `ui.template.*` strings. Item names use D9 keys.

New Game creates an empty bag with a capacity of 24 and equips the main hand and body as `g1` and `g2` at upgrade 0. The next gear sequence is 3. The ledger starts with `starter_kit` for the future quest hook. Projected stats add equipped bonuses to the template base. Upgrade bonuses are deferred to M2-06. A bad catalog or broken equipped reference returns a typed error.
