# ADR-016 Blockout maps and world checkpoints

Status: Proposed

## D28 Generated blockouts

The provisional ASCII layouts and marker tables in `tools/blockouts/` generate deterministic D19/D20 Tiled JSON. CI checks that regeneration matches the committed maps. When an owner replaces a generated map with a Tiled-authored file, remove that map's ASCII layout so the generator leaves the replacement alone.

## D29 Map graph

The four links are two-way: Starbrook Village–Farm, Starbrook Village–Whisperwood, Whisperwood–Crystal Hollow, and Crystal Hollow–Star Shrine. Each direction names an arrival spawn on the destination map. Exit locks arrive in M3. Village's default spawn and farm exit sit on row 8, five tiles apart with a clear path to the right.

## D30 Bundled maps

JSON lives in `src/content/maps/`. The infrastructure adapter imports it directly, validates the complete graph at boot, then builds collision and checkpoint indexes. This keeps loading local to the bundle. The map CLI validates the same directory by default.

## D31 Checkpoints and transitions

`PlayerState.location` stores a map ID and feet position in pixels. Movement is local to the World scene between checkpoints. New Game checkpoints Starbrook Village's `default` at the D23 feet position. `EnterExit` looks up the named exit on the current map and commits the target spawn before emitting `MapChanged`. Rejected commands preserve state and emit nothing. The command switch is exhaustive.

The scene dispatches when the feet box begins overlapping an exit tile. The validator rejects spawns on exit tiles. With motion enabled, transitions pause movement for a 100 ms fade out and 100 ms fade in. Reduced motion swaps maps immediately.

## D32 Scene lifecycle

New Game hides the menu and shows World in place of Ready. World owns the input adapter, enables gameplay input only while visible with no focused menu or dialog, and removes listeners and controls on shutdown. The view uses the provisional placeholder art, D26 camera and D24/D25 movement.
