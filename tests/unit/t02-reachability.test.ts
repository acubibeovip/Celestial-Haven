import { expect, test } from 'vitest';
import { createContentRegistry } from '@application/ContentRegistry';
import { createNewGameCatalog } from '@application/createNewGameCatalog';
import { LocalSession } from '@application/LocalSession';
import { START_MAP_ID } from '@application/MapCatalog';
import {
  MOVEMENT_SPEED_PX_PER_SECOND, PLAYER_HEIGHT, PLAYER_WIDTH, stepMovement, type CollisionGrid, type Position,
} from '@domain/world/movement';
import { FIXED_STEP_MS } from '@shared/fixedStep';
import { readBundledContent } from '../../src/infrastructure/content/readBundledContent';
import { loadWorldMaps, readBundledMaps } from '../../src/infrastructure/maps/loadWorldMaps';

const loaded = loadWorldMaps(readBundledMaps());
if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
const maps = loaded.value;
const maxStep = MOVEMENT_SPEED_PX_PER_SECOND * FIXED_STEP_MS / 1000;
const tolerance = 1e-7;

function tileOf(position: Position, tileSize: number): Position {
  return { x: Math.floor(position.x / tileSize), y: Math.floor(position.y / tileSize) };
}

function shortestPath(grid: CollisionGrid, start: Position, end: Position): Position[] {
  const index = ({ x, y }: Position) => y * grid.width + x;
  const queue = [start];
  const parents = new Map<number, Position | null>([[index(start), null]]);
  for (const tile of queue) {
    if (tile.x === end.x && tile.y === end.y) {
      const path = [tile];
      let previous = parents.get(index(tile));
      while (previous) {
        path.push(previous);
        previous = parents.get(index(previous));
      }
      return path.reverse();
    }

    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const next = { x: tile.x + dx, y: tile.y + dy };
      const key = index(next);
      if (next.x < 0 || next.x >= grid.width || next.y < 0 || next.y >= grid.height
        || grid.solid[key] !== false || parents.has(key)) continue;
      parents.set(key, tile);
      queue.push(next);
    }
  }
  return [];
}

function feetTiles(feet: Position, size: number): Position[] {
  const occupied: Position[] = [];
  const right = Math.ceil((feet.x + PLAYER_WIDTH / 2) / size);
  const bottom = Math.ceil(feet.y / size);
  for (let y = Math.floor((feet.y - PLAYER_HEIGHT) / size); y < bottom; y++) {
    for (let x = Math.floor((feet.x - PLAYER_WIDTH / 2) / size); x < right; x++) occupied.push({ x, y });
  }
  return occupied;
}

function assertClear(feet: Position, grid: CollisionGrid, route: string): void {
  for (const { x, y } of feetTiles(feet, grid.tileSize)) {
    if (x < 0 || x >= grid.width || y < 0 || y >= grid.height || grid.solid[y * grid.width + x] !== false) {
      throw new Error(`${route}: feet at (${feet.x}, ${feet.y}) overlap solid or out-of-bounds tile (${x}, ${y}).`);
    }
  }
}

test('T02 walks every spawn-to-exit and spawn-to-interactable BFS route with the D23 feet box', () => {
  let routes = 0;
  let maxSteps = 0;
  for (const [mapId, map] of maps) {
    const size = map.collision.tileSize;
    for (const [spawnName, spawn] of map.spawns) {
      const targets = [
        ...map.exits.values(),
        ...map.interactables.map((marker) => ({
          ...marker, name: marker.type === 'resource' ? marker.nodeId : 'bed',
        })),
      ];
      for (const target of targets) {
        const route = `${mapId}: ${spawnName} -> ${target.name}`;
        const end = { x: target.tileX, y: target.tileY };
        const path = shortestPath(map.collision, tileOf(spawn, size), end);
        expect(path.length, route).toBeGreaterThan(0);
        let feet: Position = spawn;
        let steps = 0;
        for (const tile of path) {
          // Center the box on the tile, with the feet a half-box below its center.
          const target = { x: (tile.x + 0.5) * size, y: (tile.y + 0.5) * size + PLAYER_HEIGHT / 2 };
          const budget = Math.ceil(size / maxStep) + 1;
          let remaining = Math.hypot(target.x - feet.x, target.y - feet.y);
          for (let i = 0; i < budget && remaining > tolerance; i++) {
            const scale = Math.max(remaining, maxStep);
            feet = stepMovement(feet, {
              x: (target.x - feet.x) / scale, y: (target.y - feet.y) / scale,
            }, map.collision, FIXED_STEP_MS);
            steps++;
            assertClear(feet, map.collision, route);
            remaining = Math.hypot(target.x - feet.x, target.y - feet.y);
          }
          expect(remaining, `${route}, waypoint (${tile.x}, ${tile.y})`).toBeLessThanOrEqual(tolerance);
        }
        expect(feetTiles(feet, size), route).toEqual([end]);
        routes++;
        maxSteps = Math.max(maxSteps, steps);
      }
    }
  }
  expect(maps.size).toBe(5);
  expect(routes).toBeGreaterThan(0);
  console.log(`T02: ${maps.size} maps, ${routes} spawn-to-marker routes, max ${maxSteps} fixed steps.`);
});

test('T02 EnterExit commits every clear arrival at least three tiles from every exit', () => {
  const registry = createContentRegistry(readBundledContent());
  if (!registry.ok) throw new Error(JSON.stringify(registry.error));
  const catalog = createNewGameCatalog(registry.value);

  const queue = [{ mapId: START_MAP_ID, path: [] as string[] }];
  const seen = new Set([START_MAP_ID]);
  let arrivals = 0;
  for (const { mapId, path } of queue) {
    const map = maps.get(mapId);
    if (!map) throw new Error(`Missing map ${mapId}.`);
    for (const exit of map.exits.values()) {
      const route = `${mapId}: ${exit.name}`;
      const session = new LocalSession(catalog, maps);
      expect(session.dispatch({ type: 'NewGame', heroId: 'hero_storm_monk', mode: 'peaceful' }).ok).toBe(true);
      const nextPath = [...path, exit.name];
      for (const exitName of nextPath) {
        expect(session.dispatch({ type: 'EnterExit', exitName }).ok, route).toBe(true);
      }
      const state = session.snapshot();
      const target = maps.get(exit.targetMap);
      if (state.phase !== 'playing' || !target) throw new Error(`Missing arrival for ${route}.`);
      const arrival = state.player.location;
      expect(arrival.mapId, route).toBe(exit.targetMap);
      expect(arrival, route).toEqual(target.spawns.get(exit.targetSpawn));
      assertClear(arrival, target.collision, route);
      const tile = tileOf(arrival, target.collision.tileSize);
      for (const { tileX, tileY, name } of target.exits.values()) {
        expect(Math.max(Math.abs(tile.x - tileX), Math.abs(tile.y - tileY)), `${route} near ${name}`)
          .toBeGreaterThanOrEqual(3);
      }
      arrivals++;
      if (!seen.has(exit.targetMap)) {
        seen.add(exit.targetMap);
        queue.push({ mapId: exit.targetMap, path: nextPath });
      }
    }
  }
  expect(seen).toEqual(new Set(maps.keys()));
  console.log(`T02: ${arrivals} LocalSession arrivals checked.`);
});
