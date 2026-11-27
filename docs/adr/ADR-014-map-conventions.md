# ADR-014 Maps and the tile-scale prototype

Status: Proposed

## D19 Tiled map format

Maps use finite orthogonal Tiled JSON and 32 × 32 px tiles. Tilesets are embedded. Infinite chunks and external `.tsx` tilesets are unsupported. Use these four layers in order, with unshifted coordinates:

1. `ground` tile layer
2. `decor` tile layer, which may contain only zeroes
3. `collision` tile layer, where any non-zero value is solid
4. `markers` object layer

Production map dimensions follow ADR-010. The validator checks the four layers, tile counts, marker placement, exit targets, and reachability from the default spawn over four-neighbour walkable tiles.

## D20 Point markers

Markers are point objects with a string custom property named `type`. Each map has a spawn named `default`, and all spawn names are unique within that map. Exits use string properties `targetMap` and `targetSpawn` to identify an existing spawn. Additional marker types require a milestone decision.

## D21 Feet pivot and collision

The sprite origin is at its feet, `(0.5, 1)`. The player has a 20 × 12 px collision box centered horizontally on that feet pivot, independent of the sprite cell. The prototype draws the box centered on the foot point. The canonical 48 px or 64 px sprite cell remains an owner decision for M0-03b with real art.

## D22 Placeholder tiles

The tileset name `placeholder` is reserved. Phaser generates its textures once per tile index at runtime. Real tilesets can replace the placeholder with matching tile indices or a documented remap. The dev-only prototype compares sprite sizes at the same tile scale without adding PNG art.
