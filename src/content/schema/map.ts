import { z } from 'zod';

export const TILE_SIZE = 32;
const dimension = z.int().positive();
const noOffset = {
  x: z.literal(0).optional(),
  y: z.literal(0).optional(),
  offsetx: z.literal(0).optional(),
  offsety: z.literal(0).optional(),
};
const tileLayer = z.object({
  ...noOffset,
  type: z.literal('tilelayer'),
  width: dimension,
  height: dimension,
  data: z.array(z.int().min(0).max(0xffffffff)),
  chunks: z.never().optional(),
});

const markerSchema = z.object({
  name: z.string(),
  x: z.number(),
  y: z.number(),
  point: z.literal(true),
  width: z.literal(0).optional(),
  height: z.literal(0).optional(),
  properties: z.array(z.object({
    name: z.string(),
    type: z.string(),
    value: z.unknown(),
  })).optional(),
});

// Tiled adds editor metadata. Validate the fields needed by this runtime subset.
export const mapSchema = z.object({
  type: z.literal('map'),
  orientation: z.literal('orthogonal'),
  infinite: z.literal(false),
  width: dimension,
  height: dimension,
  tilewidth: z.literal(TILE_SIZE),
  tileheight: z.literal(TILE_SIZE),
  layers: z.tuple([
    tileLayer.extend({ name: z.literal('ground') }),
    tileLayer.extend({ name: z.literal('decor') }),
    tileLayer.extend({ name: z.literal('collision') }),
    z.object({
      ...noOffset,
      name: z.literal('markers'),
      type: z.literal('objectgroup'),
      objects: z.array(markerSchema),
    }),
  ]),
  tilesets: z.array(z.object({
    firstgid: dimension,
    name: z.string().min(1),
    source: z.never().optional(),
  })),
});

export type TiledMap = z.infer<typeof mapSchema>;
export type MapMarker = z.infer<typeof markerSchema>;
