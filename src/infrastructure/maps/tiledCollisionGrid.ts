import type { TiledMap } from '../../content/schema/map';
import type { CollisionGrid } from '../../domain/world/movement';

export function tiledCollisionGrid(map: TiledMap): CollisionGrid {
  const collision = map.layers[2];
  return {
    width: map.width,
    height: map.height,
    tileSize: map.tilewidth,
    solid: collision.data.map((tile) => tile !== 0),
  };
}
