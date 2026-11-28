import { err, ok, type Result } from '../shared/result.ts';
import { mapSchema, TILE_SIZE, type MapMarker } from './schema/map.ts';
import type { ResourceNodeDef } from './schema/resourceNode.ts';
import type { ValidationError } from './validate.ts';

export type KnownNodes = ReadonlyMap<string, Pick<ResourceNodeDef, 'kind'>>;
export type KnownMaps = ReadonlyMap<string, ReadonlySet<string>>;
export type MapSummary = { mapId: string; width: number; height: number; spawns: number; exits: number };

const mapSizes = new Map<string, readonly [number, number]>([
  ['map_starbrook_village', [40, 32]],
  ['map_farm', [32, 24]],
  ['map_whisperwood', [40, 32]],
  ['map_crystal_hollow', [40, 32]],
  ['map_star_shrine', [20, 16]],
]);

export const requiredMapIds = [...mapSizes.keys()];
export const mapNameKey = (mapId: string): string => `map.${mapId.slice(4)}.name`;

function property(marker: MapMarker, name: string, path: string) {
  const index = marker.properties?.findIndex((value) => value.name === name) ?? -1;
  const entry = marker.properties?.[index];
  return {
    path: index === -1 ? `${path}.properties` : `${path}.properties[${index}].value`,
    value: entry?.type === 'string' && typeof entry.value === 'string' && entry.value.trim()
      ? entry.value
      : undefined,
  };
}

function spawnNames(markers: readonly MapMarker[]): Set<string> {
  return new Set(markers.filter((marker) => property(marker, 'type', '').value === 'spawn' && marker.name.trim())
    .map(({ name }) => name));
}

export function indexMapSpawns(maps: ReadonlyMap<string, unknown>): KnownMaps {
  const index = new Map<string, ReadonlySet<string>>();
  for (const [id, json] of maps) {
    const parsed = mapSchema.safeParse(json);
    index.set(id, parsed.success ? spawnNames(parsed.data.layers[3].objects) : new Set());
  }
  return index;
}

function reachableTiles(start: number, width: number, height: number, collision: readonly number[]): Uint8Array {
  const visited = new Uint8Array(collision.length);
  const pending = [start];
  visited[start] = 1;

  function visit(index: number): void {
    if (visited[index] || collision[index] !== 0) return;
    visited[index] = 1;
    pending.push(index);
  }

  for (let current = pending.pop(); current !== undefined; current = pending.pop()) {
    const x = current % width;
    if (x > 0) visit(current - 1);
    if (x + 1 < width) visit(current + 1);
    if (current >= width) visit(current - width);
    if (current < (height - 1) * width) visit(current + width);
  }
  return visited;
}

export function validateMap(mapId: string, json: unknown, knownMaps: KnownMaps, nodes: KnownNodes = new Map()): Result<MapSummary, ValidationError[]> {
  const file = `${mapId}.json`;
  const errors: ValidationError[] = [];
  const issue = (path: string, message: string, code: ValidationError['code'] = 'SCHEMA') => {
    errors.push({ file, path, code, message });
  };
  const parsed = mapSchema.safeParse(json);
  if (!parsed.success) {
    for (const { path, message } of parsed.error.issues) {
      const location = path.reduce<string>((base, key) => typeof key === 'number' ? `${base}[${key}]` : `${base}.${String(key)}`, '$');
      issue(location, message);
    }
    return err(errors);
  }

  const { width, height, layers } = parsed.data;
  const expected = mapSizes.get(mapId);
  if (expected) {
    const shrine = mapId === 'map_star_shrine';
    for (const [key, actual, limit] of [['width', width, expected[0]], ['height', height, expected[1]]] as const) {
      if (shrine ? actual > limit : actual !== limit) {
        issue(`$.${key}`, shrine ? `Expected ${key} at most ${limit} tiles.` : `Expected ${key} of ${limit} tiles.`);
      }
    }
  }

  const cellCount = width * height;
  layers.slice(0, 3).forEach((layer, index) => {
    if (layer.type !== 'tilelayer') return;
    const path = `$.layers[${index}]`;
    if (layer.width !== width) issue(`${path}.width`, 'Layer width must match the map.');
    if (layer.height !== height) issue(`${path}.height`, 'Layer height must match the map.');
    if (layer.data.length !== cellCount) issue(`${path}.data`, `Expected ${cellCount} tile entries.`);
  });

  const collision = layers[2].data;
  const markers = layers[3].objects;
  const localSpawns = spawnNames(markers);
  const seenSpawns = new Set<string>();
  const seenExits = new Set<string>();
  const exitTiles = markers.filter((marker) => property(marker, 'type', '').value === 'exit')
    .map(({ x, y }) => ({ x: Math.floor(x / TILE_SIZE), y: Math.floor(y / TILE_SIZE) }));
  const reservedTiles = new Set(markers.filter((marker) => {
    const type = property(marker, 'type', '').value;
    return type === 'spawn' || type === 'exit';
  }).map(({ x, y }) => `${Math.floor(x / TILE_SIZE)},${Math.floor(y / TILE_SIZE)}`));
  const walkableMarkers: { path: string; tile: number }[] = [];
  const objectsPath = '$.layers[3].objects';
  let defaultTile: number | undefined;
  let exits = 0;

  markers.forEach((marker, index) => {
    const path = `${objectsPath}[${index}]`;
    const type = property(marker, 'type', path);
    const names = new Set<string>();
    marker.properties?.forEach(({ name }, propertyIndex) => {
      if (names.has(name)) issue(`${path}.properties[${propertyIndex}].name`, `Duplicate property "${name}".`);
      names.add(name);
    });

    if (type.value === 'spawn') {
      if (!marker.name.trim()) issue(`${path}.name`, 'Spawn names must be non-empty.');
      if (seenSpawns.has(marker.name)) issue(`${path}.name`, `Duplicate spawn "${marker.name}".`);
      seenSpawns.add(marker.name);
    } else if (type.value === 'exit') {
      exits++;
      if (!marker.name.trim()) issue(`${path}.name`, 'Exit names must be non-empty.');
      if (seenExits.has(marker.name)) issue(`${path}.name`, `Duplicate exit "${marker.name}".`);
      seenExits.add(marker.name);
      const map = property(marker, 'targetMap', path);
      const spawn = property(marker, 'targetSpawn', path);
      if (!map.value) issue(map.path, 'An exit requires a non-empty string targetMap.');
      if (!spawn.value) issue(spawn.path, 'An exit requires a non-empty string targetSpawn.');
      if (map.value) {
        const targets = map.value === mapId ? localSpawns : knownMaps.get(map.value);
        if (!targets) issue(map.path, `Unknown target map "${map.value}".`, 'MISSING_REF');
        else if (spawn.value && !targets.has(spawn.value)) {
          issue(spawn.path, `Unknown spawn "${spawn.value}" in "${map.value}".`, 'MISSING_REF');
        }
      }
    } else if (type.value === 'resource') {
      const node = property(marker, 'node', path);
      if (!node.value || !/^res_[a-z0-9_]+$/.test(node.value)) {
        issue(node.path, 'A resource marker requires a res_ node ID.');
      } else {
        const definition = nodes.get(node.value);
        if (!definition) issue(node.path, `Unknown resource node "${node.value}".`, 'MISSING_REF');
        else {
          const expectedMap = definition.kind === 'gather' ? 'map_whisperwood' : 'map_crystal_hollow';
          if (mapId !== expectedMap) issue(path, `Resource node "${node.value}" belongs on "${expectedMap}".`, 'MARKER_WRONG_MAP');
        }
      }
    } else if (type.value === 'bed') {
      if (names.size !== 1) issue(`${path}.properties`, 'A bed has no custom properties beyond its type.');
      if (mapId !== 'map_farm') issue(path, 'The bed belongs on map_farm.', 'MARKER_WRONG_MAP');
    } else {
      issue(type.path, 'Marker type must be spawn, exit, resource, or bed.');
      return;
    }

    const x = Math.floor(marker.x / TILE_SIZE);
    const y = Math.floor(marker.y / TILE_SIZE);
    if (x < 0 || x >= width || y < 0 || y >= height) {
      issue(path, 'Marker must be within map bounds.');
      return;
    }
    if (type.value === 'spawn') {
      if (exitTiles.some((tile) => tile.x === x && tile.y === y)) {
        issue(path, 'A spawn may not share a tile with an exit.', 'SPAWN_ON_EXIT');
      } else if (exitTiles.some((tile) => Math.max(Math.abs(tile.x - x), Math.abs(tile.y - y)) < 3)) {
        issue(path, 'A spawn must be at least three tiles from every exit, including diagonally.', 'SPAWN_NEAR_EXIT');
      }
    }
    if ((type.value === 'resource' || type.value === 'bed') && reservedTiles.has(`${x},${y}`)) {
      issue(path, 'An interactable may not share a tile with a spawn or exit.', 'MARKER_ON_CHECKPOINT');
    }
    if (collision.length !== cellCount) return;
    const tile = y * width + x;
    if (collision[tile] !== 0) {
      issue(path, 'Marker must be on a non-solid tile.');
      return;
    }
    walkableMarkers.push({ path, tile });
    if (type.value === 'spawn' && marker.name === 'default') defaultTile ??= tile;
  });

  if (!localSpawns.has('default')) issue(objectsPath, 'A spawn named "default" is required.');
  if (defaultTile !== undefined) {
    const visited = reachableTiles(defaultTile, width, height, collision);
    for (const { path, tile } of walkableMarkers) {
      if (!visited[tile]) issue(path, 'Marker is unreachable from the default spawn.', 'UNREACHABLE');
    }
  }
  return errors.length ? err(errors) : ok({ mapId, width, height, spawns: localSpawns.size, exits });
}

export function validateInteractionPlacements(maps: ReadonlyMap<string, unknown>, nodes: KnownNodes): ValidationError[] {
  const errors: ValidationError[] = [];
  const seen = new Set<string>();
  let hasBed = false;
  for (const [mapId, json] of maps) {
    const parsed = mapSchema.safeParse(json);
    if (!parsed.success) continue;
    for (const [index, marker] of parsed.data.layers[3].objects.entries()) {
      const path = `$.layers[3].objects[${index}]`;
      const type = property(marker, 'type', path).value;
      const node = property(marker, 'node', path).value;
      const key = type === 'bed' ? 'bed' : type === 'resource' ? node : undefined;
      if (!key) continue;
      if (seen.has(key)) {
        errors.push({ file: `${mapId}.json`, path, code: 'DUPLICATE_PLACEMENT', message: `Duplicate placement for "${key}".` });
      }
      seen.add(key);
      if (type === 'bed' && mapId === 'map_farm') hasBed = true;
    }
  }
  for (const id of nodes.keys()) {
    if (!seen.has(id)) errors.push({ file: 'resourceNodes.json', path: '$', code: 'MISSING_PLACEMENT', message: `No map marker for "${id}".` });
  }
  if (!hasBed) errors.push({ file: 'map_farm.json', path: '$.layers[3].objects', code: 'MISSING_PLACEMENT', message: 'Farm requires one bed marker.' });
  return errors;
}
