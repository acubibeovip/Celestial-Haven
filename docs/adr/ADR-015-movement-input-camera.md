# ADR-015 Movement, input, and camera

Status: Accepted (2026-11-27, reviewed in PR #11)

## D23 — Spawn placement

A spawn places the player's feet at `(tileX * 32 + 16, tileY * 32 + 24)`. The
20×12 collision box is therefore wholly inside the validated non-solid spawn tile.

## D24 — Movement

Movement is a pure domain rule with a provisional speed of 128 pixels per second.
Intent is clamped to length one, X is resolved before Y to permit wall sliding,
out-of-bounds tiles are solid, and the player uses an epsilon-free half-open box.
Sub-pixel positions are retained. Non-finite input is a no-op.

## D25 — Fixed simulation step

Simulation uses a pure 60 Hz accumulator. A frame runs at most five steps, frame
deltas are clamped to 250 ms, excess time is dropped, and visibility changes reset
the accumulator so returning to the tab cannot cause a catch-up jump. Rendering may
interpolate between the previous and current simulation positions.

## D26 — Input and view

One adapter combines WASD/arrows and a touch joystick, then clamps the summed intent.
The joystick has a 0.2 dead zone, a 48 CSS-pixel thumb radius, and targets of at least
44 CSS pixels. It is shown for coarse pointers or after touch input, on the left half
of the view. The camera follows the player within map bounds at a 480×270 logical
resolution with pixel-art and rounded-pixel rendering. Revisit this in M6-02.
