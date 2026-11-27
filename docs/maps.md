# Author a Tiled map

1. Create a finite, orthogonal map with a 32 × 32 pixel tile size. Use the map ID as the JSON filename, such as `map_farm.json`. Use the dimensions in [ADR-010](adr/ADR-010-mvp-scope.md). Star Shrine may be up to 20 × 16 tiles.
2. Embed the tilesets in the map in Tiled. Export Tiled JSON with tile data stored as an uncompressed array. Create `ground`, `decor`, and `collision` tile layers, then a `markers` object layer in that order. Keep the layers aligned to the origin. Each tile layer must cover the full map. Leave `decor` empty if needed. In `collision`, zero is walkable and every non-zero tile is solid.
3. In `markers`, use Tiled’s **Insert Point** tool. Set the point object's **Name** and add a **string custom property** named `type`, distinct from Tiled’s built-in object type. Set it to `spawn` or `exit`. Give spawns unique names and name one `default`. On exits, add the string custom properties `targetMap` and `targetSpawn`, using the target map’s filename stem and the target spawn's exact name.
4. Put each point inside the map on a walkable tile. Make each spawn and exit reachable from `default` through tiles sharing an edge. Save the exported map files together under `public/maps/` so the validator can resolve cross-map exits.

Run `npm run validate:maps` from the repository root. To validate a map set in a separate folder, run `npm run validate:maps -- --dir <folder>`. Errors identify the file, JSON path, and diagnostic code. The build rejects wrong dimensions or layer order, missing tile data, infinite chunks, external tilesets, unsupported markers, solid or unreachable marker placements, and broken exit targets.

For the scale prototype, run `npm run dev` and open the dev URL with `?proto`. Click or tap a walkable tile to place the hero. Press **G** for grid, **C** for solid tiles, **S** to swap 48/64 px sprite cells, and **B** for the 20 × 12 px feet box. The cell comparison is temporary, pending the real-art check in M0-03b.
