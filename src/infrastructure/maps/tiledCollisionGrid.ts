import type { TiledMap } from '../../content/schema/map';
import type { CollisionGrid } from '../../domain/world/movement';

export function tiledCollisionGrid(map: TiledMap): CollisionGrid {
  // The map validator enforces the collision layer at index 2.
  const collision = map.layers[2];
  return {
    width: map.width,
    height: map.height,
    tileSize: map.tilewidth,
    solid: collision.data.map((tile) => tile !== 0),
  };
}
