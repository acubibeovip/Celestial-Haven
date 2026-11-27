import { describe, expect, test } from 'vitest';
import {
  MOVEMENT_SPEED_PX_PER_SECOND,
  spawnPosition,
  stepMovement,
  type CollisionGrid,
  type MovementIntent,
  type Position,
} from '../../src/domain/world/movement';

function grid(width: number, height: number, solids: readonly [number, number][] = []): CollisionGrid {
  const solid = Array<boolean>(width * height).fill(false);
  for (const [x, y] of solids) solid[y * width + x] = true;
  return { width, height, tileSize: 32, solid };
}

function run(position: Position, intent: MovementIntent, collision: CollisionGrid, steps = 60): Position {
  let result = position;
  for (let index = 0; index < steps; index++) result = stepMovement(result, intent, collision, 1000 / 60);
  return result;
}

describe('stepMovement', () => {
  test('moves 128 px per second on each free axis', () => {
    const collision = grid(20, 20);
    expect(run({ x: 200, y: 200 }, { x: 1, y: 0 }, collision).x).toBeCloseTo(200 + MOVEMENT_SPEED_PX_PER_SECOND, 9);
    expect(run({ x: 200, y: 200 }, { x: 0, y: 1 }, collision).y).toBeCloseTo(200 + MOVEMENT_SPEED_PX_PER_SECOND, 9);
  });

  test('normalizes diagonal movement to the same distance per second', () => {
    const start = { x: 200, y: 200 };
    const end = run(start, { x: 1, y: 1 }, grid(20, 20));
    expect(Math.hypot(end.x - start.x, end.y - start.y)).toBeCloseTo(MOVEMENT_SPEED_PX_PER_SECOND, 9);
  });

  test('slides along vertical and horizontal walls', () => {
    const vertical = grid(8, 8, [[4, 2], [4, 3], [4, 4]]);
    const alongVertical = run({ x: 110, y: 96 }, { x: 1, y: 1 }, vertical, 30);
    expect(alongVertical.x).toBe(118);
    expect(alongVertical.y).toBeGreaterThan(96);

    const horizontal = grid(8, 8, [[2, 4], [3, 4], [4, 4]]);
    const alongHorizontal = run({ x: 96, y: 120 }, { x: 1, y: 1 }, horizontal, 30);
    expect(alongHorizontal.x).toBeGreaterThan(96);
    expect(alongHorizontal.y).toBe(128);
  });

  test('stops at a blocked corner', () => {
    const collision = grid(8, 8, [[4, 3], [3, 4], [4, 4]]);
    expect(run({ x: 110, y: 116 }, { x: 1, y: 1 }, collision, 30)).toEqual({ x: 118, y: 128 });
  });

  test('passes through a one-tile-wide corridor', () => {
    const solids: [number, number][] = [];
    for (let y = 0; y < 8; y++) solids.push([2, y], [4, y]);
    const end = run(spawnPosition(3, 1), { x: 0, y: 1 }, grid(7, 8, solids), 60);
    expect(end.y).toBeCloseTo(spawnPosition(3, 1).y + 128, 9);
  });

  test('does not enter a solid tile by even one pixel', () => {
    const end = stepMovement({ x: 117, y: 96 }, { x: 1, y: 0 }, grid(8, 8, [[4, 2]]), 1000 / 60);
    expect(end.x).toBe(118);
  });

  test('treats out-of-bounds as solid', () => {
    expect(run(spawnPosition(0, 0), { x: -1, y: -1 }, grid(2, 2), 60)).toEqual({ x: 10, y: 12 });
  });

  test('cannot tunnel through a one-tile wall over five maximum-sized steps', () => {
    const collision = grid(8, 4, [[3, 1]]);
    expect(run({ x: 70, y: 56 }, { x: 1, y: 0 }, collision, 5).x).toBeLessThanOrEqual(86);
  });

  test('non-finite input is a no-op and inputs are not mutated', () => {
    const position = Object.freeze({ x: 64, y: 64 });
    const intent = Object.freeze({ x: 1, y: 0 });
    const collision = grid(4, 4);
    expect(stepMovement(position, { x: Number.NaN, y: 0 }, collision, 16)).toBe(position);
    expect(stepMovement(position, intent, collision, Number.POSITIVE_INFINITY)).toBe(position);
    stepMovement(position, intent, collision, 16);
    expect(position).toEqual({ x: 64, y: 64 });
    expect(intent).toEqual({ x: 1, y: 0 });
  });
});
