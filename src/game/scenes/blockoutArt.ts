import type { TiledMap } from '../../content/schema/map';

const palettes: Record<string, readonly [string, string]> = {
  map_starbrook_village: ['#6f936f', '#bc9b6b'],
  map_farm: ['#819657', '#c8a465'],
  map_whisperwood: ['#456d61', '#aa956a'],
  map_crystal_hollow: ['#626985', '#928eb9'],
  map_star_shrine: ['#767294', '#c2a278'],
};
const fallback = ['#6f936f', '#bc9b6b'] as const;

export function paintBlockout(mapId: string, map: TiledMap): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const size = map.tilewidth;
  canvas.width = map.width * size;
  canvas.height = map.height * size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable.');

  const [ground, path] = palettes[mapId] ?? fallback;
  const colors = [ground, path, '#55546a', '#905e65', '#4a7e98', '#caa658'];
  const tiles = colors.map((color, index) => {
    const tile = document.createElement('canvas');
    tile.width = tile.height = size;
    const drawing = tile.getContext('2d');
    if (!drawing) throw new Error('Canvas 2D is unavailable.');
    drawing.fillStyle = color;
    drawing.fillRect(0, 0, size, size);
    drawing.fillStyle = '#ffffff22';
    if (index < 2) {
      drawing.fillRect(6, 8, 4, 2);
      drawing.fillRect(23, 23, 3, 2);
    } else {
      drawing.fillRect(0, 1, size, 3);
      drawing.fillRect(0, 17, size, 1);
      drawing.fillRect(15, 5, 2, 12);
    }
    drawing.fillStyle = '#18212f44';
    if (index >= 2) drawing.fillRect(0, size - 3, size, 3);
    if (index === 5) {
      drawing.fillStyle = '#fff3c4';
      drawing.fillRect(8, 14, 16, 4);
      drawing.fillRect(14, 8, 4, 16);
    }
    return tile;
  });
  // Render the ground and decor only. The collision layer never enters the artwork.
  for (const layer of [map.layers[0], map.layers[1]]) {
    layer.data.forEach((id, index) => {
      const tile = tiles[id - 1];
      if (tile) ctx.drawImage(tile, (index % map.width) * size, Math.floor(index / map.width) * size);
    });
  }
  return canvas;
}
