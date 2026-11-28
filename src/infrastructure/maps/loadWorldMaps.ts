import type { CheckpointMap, MapExit } from '../../application/MapCatalog';
import { mapSchema, type TiledMap } from '../../content/schema/map';
import type { ValidationError } from '../../content/validate';
import { indexMapSpawns, requiredMapIds, validateMap } from '../../content/validateMap';
import type { PlayerLocation } from '../../domain/player/types';
import { spawnPosition, type CollisionGrid } from '../../domain/world/movement';
import { err, ok, type Result } from '../../shared/result';
import { tiledCollisionGrid } from './tiledCollisionGrid';

export interface WorldMap extends CheckpointMap {
  data: TiledMap;
  collision: CollisionGrid;
}

export function readBundledMaps(): Map<string, unknown> {
  const modules = import.meta.glob('../../content/maps/*.json', { eager: true, import: 'default' });
  return new Map(Object.entries(modules).map(([path, data]) => [path.slice(path.lastIndexOf('/') + 1, -5), data]));
}

export function loadWorldMaps(files: ReadonlyMap<string, unknown>): Result<ReadonlyMap<string, WorldMap>, ValidationError[]> {
  const index = indexMapSpawns(files);
  const errors: ValidationError[] = [];
  for (const mapId of requiredMapIds) {
    if (!files.has(mapId)) errors.push({ file: `${mapId}.json`, path: '$', code: 'MISSING_REF', message: 'Required map is missing.' });
  }

  const maps = new Map<string, WorldMap>();
  for (const [mapId, json] of files) {
    const validated = validateMap(mapId, json, index);
    if (!validated.ok) {
      errors.push(...validated.error);
      continue;
    }

    const data = mapSchema.parse(json);
    const spawns = new Map<string, PlayerLocation>();
    const exits = new Map<string, MapExit>();
    for (const marker of data.layers[3].objects) {
      const props = new Map(marker.properties?.map(({ name, value }) => [name, value]));
      const tileX = Math.floor(marker.x / data.tilewidth);
      const tileY = Math.floor(marker.y / data.tileheight);
      if (props.get('type') === 'spawn') {
        spawns.set(marker.name, { mapId, ...spawnPosition(tileX, tileY) });
      } else {
        // validateMap checks both exit references and their types.
        exits.set(marker.name, {
          name: marker.name, tileX, tileY,
          targetMap: props.get('targetMap') as string, targetSpawn: props.get('targetSpawn') as string,
        });
      }
    }
    maps.set(mapId, { data, collision: tiledCollisionGrid(data), spawns, exits });
  }
  return errors.length ? err(errors) : ok(maps);
}
