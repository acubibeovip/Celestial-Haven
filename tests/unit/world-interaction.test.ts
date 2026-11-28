import { expect, test } from 'vitest';
import { createContentRegistry } from '@application/ContentRegistry';
import { resourcePrompt } from '@application/worldFeedback';
import { pickInteraction, type Interactable } from '@domain/world/pickInteraction';
import { indexMapSpawns, validateInteractionPlacements, validateMap } from '../../src/content/validateMap';
import { readBundledContent } from '../../src/infrastructure/content/readBundledContent';
import { readBundledMaps, loadWorldMaps } from '../../src/infrastructure/maps/loadWorldMaps';
import { mapSchema } from '../../src/content/schema/map';

const registry = createContentRegistry(readBundledContent());
if (!registry.ok) throw new Error(JSON.stringify(registry.error));
const { resourceNodes, text } = registry.value;
const bundledMaps = readBundledMaps();
const knownMaps = indexMapSpawns(bundledMaps);
const farmId = 'map_farm';
const woodsId = 'map_whisperwood';
const oakId = 'res_oak_log_01';
const oak = resourceNodes.get(oakId)!;

test('picks range by Chebyshev tiles, nearest by feet distance, and ties by marker order', () => {
  const center = { x: 48, y: 48 };
  const diagonal = { type: 'bed', tileX: 2, tileY: 2 } as const;
  const near = { type: 'resource', tileX: 2, tileY: 1, nodeId: oakId } as const;
  const tied = { type: 'bed', tileX: 0, tileY: 1 } as const;
  const out = { type: 'bed', tileX: 3, tileY: 1 } as const;
  expect(pickInteraction(center, [out])).toBeUndefined();
  expect(pickInteraction(center, [diagonal])).toBe(diagonal);
  expect(pickInteraction(center, [diagonal, near])).toBe(near);
  expect(pickInteraction(center, [tied, near])).toBe(tied);
  expect(pickInteraction({ x: 59, y: 48 }, [tied, near])).toBe(near);
  const sameTile: Interactable = { type: 'bed', tileX: 1, tileY: 1 };
  expect(pickInteraction(center, [near, sameTile])).toBe(sameTile);
});

test('resource prompts reflect availability and remaining days from the snapshot', () => {
  const moonpetal = resourceNodes.get('res_moonpetal_01')!;
  const mined = resourceNodes.get('res_stone_01')!;
  const harvested = { [moonpetal.id]: { harvestedDay: 1 } };
  expect(resourcePrompt({ day: 1, resourceNodes: {} }, oak, 'Oak Log', text)).toBe('E Gather Oak Log');
  expect(resourcePrompt({ day: 1, resourceNodes: {} }, mined, 'Stone', text)).toBe('E Mine Stone');
  expect(resourcePrompt({ day: 1, resourceNodes: harvested }, moonpetal, 'Moonpetal', text)).toBe('Regrows in 2 days');
  expect(resourcePrompt({ day: 2, resourceNodes: harvested }, moonpetal, 'Moonpetal', text)).toBe('Regrows in 1 day');
  expect(resourcePrompt({ day: 3, resourceNodes: harvested }, moonpetal, 'Moonpetal', text)).toBe('E Gather Moonpetal');
});

test('loads every node once on its ADR map and a bed only on Farm', () => {
  const result = loadWorldMaps(bundledMaps, resourceNodes);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  const placements = new Map<string, string[]>();
  for (const [id, map] of result.value) {
    expect(map.hasBed).toBe(id === farmId);
    const markers = map.interactables.flatMap((marker) => marker.type === 'resource' ? [marker.nodeId] : []);
    expect(map.resourceNodeIds).toEqual(new Set(markers));
    for (const nodeId of markers) placements.set(nodeId, [...placements.get(nodeId) ?? [], id]);
  }
  expect(placements.size).toBe(resourceNodes.size);
  for (const [id, node] of resourceNodes) {
    expect(placements.get(id)).toEqual([node.kind === 'gather' ? woodsId : 'map_crystal_hollow']);
  }
});

function mapWithMarkers(id: string) {
  return mapSchema.parse(bundledMaps.get(id));
}

function resourceFixture() {
  const map = mapWithMarkers(woodsId);
  const index = map.layers[3].objects.findIndex((marker) => marker.name === oakId);
  return { map, index, oakMarker: map.layers[3].objects[index]! };
}

test('MARKER_WRONG_MAP rejects a gather node in Crystal Hollow and a bed in Whisperwood', () => {
  const { oakMarker } = resourceFixture();
  const mine = mapWithMarkers('map_crystal_hollow');
  const farm = mapWithMarkers(farmId);
  const bed = farm.layers[3].objects.find(({ name }) => name === 'farmhouse_bed')!;
  // Limit each fixture to the marker under test and the existing valid checkpoints.
  mine.layers[3].objects.push(oakMarker);
  const woods = mapWithMarkers(woodsId);
  woods.layers[3].objects.push({ ...bed, x: 48, y: 48 });
  for (const [id, map] of [['map_crystal_hollow', mine], [woodsId, woods]] as const) {
    const result = validateMap(id, map, knownMaps, resourceNodes);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContainEqual(expect.objectContaining({
      code: 'MARKER_WRONG_MAP', path: `$.layers[3].objects[${map.layers[3].objects.length - 1}]`,
    }));
  }
});

test('MARKER_ON_CHECKPOINT rejects an interactable on a spawn tile', () => {
  const { map, index, oakMarker } = resourceFixture();
  const spawn = map.layers[3].objects[0]!;
  Object.assign(oakMarker, { x: spawn.x, y: spawn.y });
  const result = validateMap(woodsId, map, knownMaps, resourceNodes);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toContainEqual(expect.objectContaining({
    code: 'MARKER_ON_CHECKPOINT', path: `$.layers[3].objects[${index}]`,
  }));
});

test('UNREACHABLE rejects an enclosed resource', () => {
  const { map, index, oakMarker } = resourceFixture();
  Object.assign(oakMarker, { x: 16 + 5 * 32, y: 16 + 2 * 32 });
  for (const [x, y] of [[4, 2], [6, 2], [5, 1], [5, 3]] as const) map.layers[2].data[y * map.width + x] = 1;
  const result = validateMap(woodsId, map, knownMaps, resourceNodes);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toContainEqual(expect.objectContaining({
    code: 'UNREACHABLE', path: `$.layers[3].objects[${index}]`,
  }));
});

test('DUPLICATE_PLACEMENT rejects a repeated resource and a second bed', () => {
  const { map, oakMarker } = resourceFixture();
  const farm = mapWithMarkers(farmId);
  map.layers[3].objects.push(oakMarker);
  farm.layers[3].objects.push(farm.layers[3].objects.find(({ name }) => name === 'farmhouse_bed')!);
  const variants = new Map(bundledMaps).set(woodsId, map).set(farmId, farm);
  expect(validateInteractionPlacements(variants, resourceNodes)).toEqual([
    expect.objectContaining({ file: 'map_farm.json', code: 'DUPLICATE_PLACEMENT' }),
    expect.objectContaining({ file: 'map_whisperwood.json', code: 'DUPLICATE_PLACEMENT' }),
  ]);
});

test('MISSING_PLACEMENT rejects a missing resource and missing Farm bed', () => {
  const { map, index } = resourceFixture();
  const farm = mapWithMarkers(farmId);
  map.layers[3].objects.splice(index, 1);
  farm.layers[3].objects = farm.layers[3].objects.filter(({ name }) => name !== 'farmhouse_bed');
  const variants = new Map(bundledMaps).set(woodsId, map).set(farmId, farm);
  expect(validateInteractionPlacements(variants, resourceNodes)).toEqual([
    expect.objectContaining({ file: 'resourceNodes.json', code: 'MISSING_PLACEMENT', message: expect.stringContaining(oakId) }),
    expect.objectContaining({ file: 'map_farm.json', code: 'MISSING_PLACEMENT' }),
  ]);
});

test('rejects a bed on a solid tile and a resource with an unknown node ID', () => {
  const farm = mapWithMarkers(farmId);
  const bedIndex = farm.layers[3].objects.findIndex(({ name }) => name === 'farmhouse_bed');
  Object.assign(farm.layers[3].objects[bedIndex]!, { x: 16, y: 16 });
  const solid = validateMap(farmId, farm, knownMaps, resourceNodes);
  expect(solid).toEqual({ ok: false, error: [
    expect.objectContaining({ code: 'SCHEMA', path: `$.layers[3].objects[${bedIndex}]`, message: 'Marker must be on a non-solid tile.' }),
  ] });

  const { map, index, oakMarker } = resourceFixture();
  const node = oakMarker.properties?.find(({ name }) => name === 'node');
  if (!node) throw new Error('Expected the oak resource property.');
  node.value = 'res_unknown';
  expect(validateMap(woodsId, map, knownMaps, resourceNodes)).toEqual({ ok: false, error: [
    expect.objectContaining({ code: 'MISSING_REF', path: `$.layers[3].objects[${index}].properties[1].value` }),
  ] });
});
