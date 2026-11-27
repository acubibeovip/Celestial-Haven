import { readdir, readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';
import { mapSchema, TILE_SIZE } from '../../src/content/schema/map';
import { PLAYER_HEIGHT, PLAYER_WIDTH, spawnPosition } from '../../src/domain/world/movement';
import { tiledCollisionGrid } from '../../src/infrastructure/maps/tiledCollisionGrid';

const validFixtures = new URL('../fixtures/maps/valid/', import.meta.url);
const prototype = new URL('../../src/game/dev/prototype-map.json', import.meta.url);

test('every spawn box in valid fixtures and the prototype overlaps no solid tile', async () => {
  const fixtureNames = (await readdir(validFixtures)).filter((name) => name.endsWith('.json'));
  const files = [...fixtureNames.map((name) => new URL(name, validFixtures)), prototype];
  for (const file of files) {
    const map = mapSchema.parse(JSON.parse(await readFile(file, 'utf8')));
    const grid = tiledCollisionGrid(map);
    for (const marker of map.layers[3].objects) {
      const type = marker.properties?.find((entry) => entry.name === 'type')?.value;
      if (type !== 'spawn') continue;
      const tileX = Math.floor(marker.x / TILE_SIZE);
      const tileY = Math.floor(marker.y / TILE_SIZE);
      const feet = spawnPosition(tileX, tileY);
      const firstX = Math.floor((feet.x - PLAYER_WIDTH / 2) / TILE_SIZE);
      const lastX = Math.ceil((feet.x + PLAYER_WIDTH / 2) / TILE_SIZE) - 1;
      const firstY = Math.floor((feet.y - PLAYER_HEIGHT) / TILE_SIZE);
      const lastY = Math.ceil(feet.y / TILE_SIZE) - 1;
      for (let y = firstY; y <= lastY; y++) {
        for (let x = firstX; x <= lastX; x++) {
          expect(grid.solid[y * grid.width + x], `${file.pathname}: ${marker.name}`).toBe(false);
        }
      }
    }
  }
});
