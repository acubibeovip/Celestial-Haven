# ADR-020 Equipment and session inventory commands

Status: Proposed

## D43 Gear upgrade tiers

Every gear definition has an `upgradeTier` of `copper`, `iron`, or `starlite`. The twenty definitions and their prices follow [ADR-017 §4 and D38](ADR-017-m2-content.md#4-gear-20). M2-06 uses the tier for upgrade costs and adds upgrade bonuses to stat projection.

## D44 Equip and unequip

`equip(state, gearId, catalog)` requires a gear instance in the bag. The definition supplies the equipment slot and can restrict the hero template. A mismatch returns `WRONG_TEMPLATE`. If the slot is occupied, the displaced instance takes the exact bag slot the new gear vacated, even when the bag is full.

`unequip(state, slot)` moves gear to the first empty bag slot. An empty equipment slot returns `SLOT_EMPTY`. A full bag returns `BAG_FULL`. Both rules preserve each instance and its upgrade level. Equipped gear supplies its stats to the player projection.

## D45 Session commands and events

`Equip` and `Unequip` emit `EquipmentChanged`. `MoveBagSlot` and `AssignHotbar` emit `InventoryChanged`. Each command requires the playing phase. Domain error codes pass through to the caller. Rejections and successful no-ops keep the same snapshot reference and emit no event. For a state change, the session commits the frozen snapshot before emitting its one event.
