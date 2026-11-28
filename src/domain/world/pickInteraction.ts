import { TILE_SIZE, type Position } from './movement';

export type Interactable = Readonly<{ tileX: number; tileY: number } & (
  { type: 'resource'; nodeId: string } | { type: 'bed' }
)>;

export function pickInteraction(feet: Position, markers: readonly Interactable[]): Interactable | undefined {
  const feetTileX = Math.floor(feet.x / TILE_SIZE);
  const feetTileY = Math.floor(feet.y / TILE_SIZE);
  let nearest: Interactable | undefined;
  let bestDistance = Infinity;
  for (const marker of markers) {
    if (Math.max(Math.abs(marker.tileX - feetTileX), Math.abs(marker.tileY - feetTileY)) > 1) continue;
    const distance = (feet.x - (marker.tileX + 0.5) * TILE_SIZE) ** 2 +
      (feet.y - (marker.tileY + 0.5) * TILE_SIZE) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = marker;
    }
  }
  return nearest;
}
