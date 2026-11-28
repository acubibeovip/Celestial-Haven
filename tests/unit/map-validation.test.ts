import { readFileSync, readdirSync } from 'node:fs';
import { expect, test } from 'vitest';
import type { ValidationError } from '../../src/content/validate';
import { indexMapSpawns, validateMap } from '../../src/content/validateMap';
import prototypeMap from '../../src/game/dev/prototype-map.json';

const fixtures = new URL('../fixtures/maps/', import.meta.url);

function readMaps(folder: string): Map<string, unknown> {
  const directory = new URL(`${folder}/`, fixtures);
  return new Map(readdirSync(directory).map((file) => [
    file.slice(0, -5),
    JSON.parse(readFileSync(new URL(file, directory), 'utf8')) as unknown,
  ]));
}

const marker = '$.layers[3].objects';
const cases: Record<string, [ValidationError['code'], string][]> = {
  'tile-size': [['SCHEMA', '$.tilewidth'], ['SCHEMA', '$.tileheight']],
  orientation: [['SCHEMA', '$.orientation']],
  infinite: [['SCHEMA', '$.infinite']],
  chunks: [['SCHEMA', '$.layers[0].chunks']],
  'external-tileset': [['SCHEMA', '$.tilesets[0].source']],
  'layer-order': [['SCHEMA', '$.layers[0].name'], ['SCHEMA', '$.layers[1].name']],
  'missing-layer': [['SCHEMA', '$.layers']],
  'layer-type': [['SCHEMA', '$.layers[3].type']],
  'data-length': [['SCHEMA', '$.layers[0].data']],
  'layer-size': [['SCHEMA', '$.layers[1].width']],
  'adr-size': [['SCHEMA', '$.width'], ['SCHEMA', '$.height']],
  'shrine-size': [['SCHEMA', '$.width']],
  'marker-not-point': [['SCHEMA', `${marker}[0].point`]],
  'marker-no-type': [['SCHEMA', `${marker}[0].properties`], ['SCHEMA', marker]],
  'marker-unsupported': [['SCHEMA', `${marker}[1].properties[0].value`]],
  'duplicate-spawn': [['SCHEMA', `${marker}[1].name`]],
  'missing-default': [['SCHEMA', marker]],
  'bad-coordinate': [['SCHEMA', `${marker}[0]`]],
  'spawn-near-exit': [['SPAWN_NEAR_EXIT', `${marker}[0]`]],
  'spawn-on-exit': [['SPAWN_ON_EXIT', `${marker}[0]`]],
  'spawn-on-solid': [['SCHEMA', `${marker}[0]`]],
  'exit-on-solid': [['SCHEMA', `${marker}[1]`]],
  'unknown-map': [['MISSING_REF', `${marker}[1].properties[1].value`]],
  'unknown-spawn': [['MISSING_REF', `${marker}[1].properties[2].value`]],
  'bad-exit-properties': [['SCHEMA', `${marker}[1].properties`]],
  'enclosed-spawn': [['UNREACHABLE', `${marker}[1]`]],
  'enclosed-exit': [['UNREACHABLE', `${marker}[1]`]],
  'diagonal-only': [['UNREACHABLE', `${marker}[1]`]],
};

test('accepts two maps connected in both directions by exits', () => {
  const maps = readMaps('valid');
  const knownMaps = indexMapSpawns(maps);
  expect([...maps.keys()]).toEqual(['map_fixture_a', 'map_fixture_b']);
  for (const [mapId, json] of maps) {
    expect(validateMap(mapId, json, knownMaps)).toEqual({
      ok: true, value: { mapId, width: 4, height: 3, spawns: 1, exits: 1 },
    });
  }
});

test('allows Star Shrine below its maximum dimensions', () => {
  const maps = readMaps('valid');
  expect(validateMap('map_star_shrine', maps.get('map_fixture_a'), indexMapSpawns(maps)).ok).toBe(true);
});

test.each(Object.entries(cases))('reports exact diagnostics for %s', (name, expected) => {
  const maps = readMaps(`invalid/${name}`);
  expect(maps.size).toBe(1);
  for (const [id, json] of maps) {
    const result = validateMap(id, json, indexMapSpawns(maps));
    if (result.ok) throw new Error(`Expected ${name} to fail`);
    expect(result.error.map(({ file, code, path }) => [file, code, path])).toEqual(
      expected.map(([code, path]) => [`${id}.json`, code, path]),
    );
  }
});

test('validates the imported 20 × 15 prototype map', () => {
  expect(validateMap('map_dev_prototype', prototypeMap, new Map())).toEqual({
    ok: true, value: { mapId: 'map_dev_prototype', width: 20, height: 15, spawns: 2, exits: 0 },
  });
});
