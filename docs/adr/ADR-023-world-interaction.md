# ADR-023 World interactions

Status: Accepted (2026-11-28, reviewed in PR #21)

## D54 Resource and bed markers

Tiled point markers accept `resource` with a string `node` property containing a `res_` ID, and `bed` with only the marker type. Each node appears once across the production maps. Gather nodes belong to Whisperwood and mine nodes to Crystal Hollow. Farm has one bed. Resource and bed tiles are walkable and reachable from the default spawn, and must not share a spawn or exit tile. The blockout generator uses `R` and `D` with row-major marker records.

## D55 Interaction target

The player can interact within one tile of a marker, including diagonals. Among markers in range, the nearest tile center to the player's feet wins. Marker order breaks ties.

## D56 Location checks

The validated map loader derives node membership and bed presence from markers. Gather requires a node belonging to the current map. EndDay requires a bed on the current map and otherwise returns `NO_BED_ON_MAP`. The world scene checks range before dispatch. A future server must verify proximity independently.

## D57 Feedback and controls

The scene routes E and the touch Interact button through GameSession. The button appears within range and has a minimum 56 CSS pixel target. Prompts, node opacity, the day and XP HUD, and regrow text reflect session snapshots. Feedback uses localized strings in a polite live region.

The bed opens a modal confirmation. No is focused by default, Tab stays inside the dialog, Esc cancels, and world input is suspended. Yes dispatches EndDay and fades the view. With reduced motion enabled, the change appears immediately.
