# ADR-019 Inventory and hotbar

Status: Accepted (2026-11-28, reviewed in PR #18)

## D39 Bag model

The bag has 24 fixed slots. Each slot holds null, a stack `{ kind: 'stack', itemId, quantity }`, or a gear reference `{ kind: 'gear', gearId }`. A stack holds 1 through the item's `stackMax`, capped at 99. Gear definitions cannot appear in stacks. Each gear instance is referenced exactly once, in the bag or in an equipment slot. Equipped gear takes no bag space.

## D40 Stack order

Additions top up matching stacks in ascending slot order, then use the earliest empty slots. Removals start at the last matching slot. Empty slots become null and the bag never compacts automatically.

## D41 Atomic bag transactions

`applyBagChange(state, { remove, add, addGear?, removeGearIds? }, catalog)` returns a new state and the created gear IDs on success. Stack quantities are positive safe integers. Repeated item IDs are combined per list, preserving first appearance. The total for each item must be a safe integer.

The rule resolves item definitions from the catalog, stages all removals before additions, and publishes the result only after all checks pass. That allows outputs to fill slots freed by inputs. Any failure leaves the original untouched. New gear starts at upgrade 0 and takes IDs from `nextGearSeq` in request order. Gear removals require distinct IDs present in the bag.

Errors are `UNKNOWN_ITEM`, `INVALID_QUANTITY`, `WRONG_ITEM_KIND`, `INSUFFICIENT_ITEMS`, `GEAR_NOT_IN_BAG`, and `BAG_FULL`. `countItem` counts bag stacks and unequipped instances by definition ID. `checkBagInvariants` checks the slot, gear ownership, and hotbar rules. The pure operations take valid player state and catalog data.

## D42 Layout and hotbar

`moveSlot(state, from, to, catalog)` moves a slot into an empty slot, merges matching stacks up to the item's stack limit, or swaps other occupied slots. Any remainder stays in the source slot. An empty source and a move to the same slot are no-ops. The catalog supplies the stack limit.

The hotbar has four item ID or null entries. `assignHotbar(state, index, itemId, catalog)` accepts only consumable IDs, including consumables the player has zero of. Assign null to clear a slot. Bag indices are 0–23 and hotbar indices are 0–3. Out-of-range indices return `INVALID_SLOT`. Item use arrives in M4.
