import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import { overlapsTile } from '@domain/world/movement';
import { loadWorldMaps, readBundledMaps } from '../../src/infrastructure/maps/loadWorldMaps';

const mapsResult = loadWorldMaps(readBundledMaps());
if (!mapsResult.ok) throw new Error(JSON.stringify(mapsResult.error));
const maps = mapsResult.value;

test('loads all five blockouts with exactly the reciprocal D29 exit graph', () => {
  const graph = Object.fromEntries([...maps].map(([id, map]) => [
    id, [...map.exits.values()].map((exit) => exit.targetMap).sort(),
  ]));
  expect(graph).toEqual({
    map_starbrook_village: ['map_farm', 'map_whisperwood'],
    map_farm: ['map_starbrook_village'],
    map_whisperwood: ['map_crystal_hollow', 'map_starbrook_village'],
    map_crystal_hollow: ['map_star_shrine', 'map_whisperwood'],
    map_star_shrine: ['map_crystal_hollow'],
  });
});

test('each exit arrives at a spawn whose box overlaps neither an exit nor solid ground', () => {
  for (const map of maps.values()) {
    for (const exit of map.exits.values()) {
      expect(maps.get(exit.targetMap)?.spawns.has(exit.targetSpawn)).toBe(true);
    }
    for (const spawn of map.spawns.values()) {
      for (const exit of map.exits.values()) {
        expect(overlapsTile(spawn, exit.tileX, exit.tileY, map.collision.tileSize)).toBe(false);
      }
      map.collision.solid.forEach((solid, index) => {
        if (!solid) return;
        const x = index % map.data.width;
        const y = Math.floor(index / map.data.width);
        expect(overlapsTile(spawn, x, y, map.data.tilewidth)).toBe(false);
      });
    }
  }
});

test('the village default has a straight unobstructed walk to the farm exit within sixteen tiles', () => {
  const map = maps.get('map_starbrook_village');
  const spawn = map?.spawns.get('default');
  const exit = map?.exits.get('to_farm');
  if (!map || !spawn || !exit) throw new Error('Village and its markers must exist.');
  const x = Math.floor(spawn.x / map.data.tilewidth);
  const y = Math.floor(spawn.y / map.data.tileheight);
  expect(exit.tileY).toBe(y);
  expect(exit.tileX - x).toBeGreaterThan(0);
  expect(exit.tileX - x).toBeLessThanOrEqual(16);
  for (let col = x; col <= exit.tileX; col++) expect(map.collision.solid[y * map.data.width + col]).toBe(false);
});

test('blockout generation is deterministic and matches committed JSON', () => {
  const script = fileURLToPath(new URL('../../tools/gen-blockout-maps.ts', import.meta.url));
  for (let attempt = 0; attempt < 2; attempt++) {
    const run = spawnSync(process.execPath, [script, '--check'], { encoding: 'utf8' });
    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('Blockouts: 5 checked.');
  }
});

test('boot rejects missing maps and broken exit references', () => {
  const files = readBundledMaps();
  files.delete('map_farm');
  const result = loadWorldMaps(files);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('Missing map was accepted.');
  expect(result.error).toEqual(expect.arrayContaining([
    expect.objectContaining({ file: 'map_farm.json', code: 'MISSING_REF' }),
    expect.objectContaining({ file: 'map_starbrook_village.json', code: 'MISSING_REF' }),
  ]));
});
