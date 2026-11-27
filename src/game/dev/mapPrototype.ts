import Phaser from 'phaser';
import { mapSchema, TILE_SIZE } from '../../content/schema/map';
import source from './prototype-map.json';
import './mapPrototype.css';

const map = mapSchema.parse(source);
const width = map.width * TILE_SIZE;
const height = map.height * TILE_SIZE;
const footWidth = 20;
const footHeight = 12;
const [ground, decor, collision, markers] = map.layers;
const start = markers.objects.find((marker) => marker.name === 'default');

function tileKey(index: number): string {
  return `placeholder-tile-${index}`;
}

function makeTileTextures(scene: Phaser.Scene): void {
  const graphics = scene.add.graphics();
  const palettes = [
    { index: 1, base: 0x24463a, light: 0x365c45, dark: 0x1c382f },
    { index: 2, base: 0x61583d, light: 0x80714c, dark: 0x4d4833 },
    { index: 3, base: 0x41495d, light: 0x6c778a, dark: 0x2a3042 },
    { index: 4, base: 0x55445d, light: 0x826583, dark: 0x382d48 },
  ];
  for (const { index, base, light, dark } of palettes) {
    graphics.clear();
    graphics.fillStyle(base).fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    if (index <= 2) {
      graphics.fillStyle(light).fillRect(7, 9, 4, 2).fillRect(22, 24, 3, 3);
      graphics.fillStyle(dark).fillRect(25, 7, 3, 2).fillRect(13, 20, 4, 2);
    } else {
      graphics.fillStyle(light).fillRect(1, 1, 30, 3).fillRect(1, 17, 30, 1);
      graphics.fillStyle(dark).fillRect(0, 30, 32, 2).fillRect(16, 4, 2, 13).fillRect(8, 18, 2, 12);
    }
    graphics.generateTexture(tileKey(index), TILE_SIZE, TILE_SIZE);
  }
  graphics.destroy();
}

export function startMapPrototype(root: HTMLElement): void {
  const spawn = start;
  if (!spawn) throw new Error('Prototype map has no default spawn.');
  const { x: spawnX, y: spawnY } = spawn;
  const heading = document.createElement('h1');
  heading.textContent = 'Tile-scale prototype';
  const screen = document.createElement('section');
  screen.className = 'map-prototype';
  const controls = document.createElement('p');
  controls.className = 'prototype-controls';
  controls.textContent = 'G grid · C collision · S cell 48 / 64 · B feet box · Click or tap to place';
  const status = document.createElement('output');
  status.className = 'prototype-status';
  const stage = document.createElement('div');
  stage.className = 'prototype-stage';
  screen.append(heading, controls, status, stage);
  root.replaceChildren(screen);

  function create(this: Phaser.Scene): void {
    makeTileTextures(this);
    for (const layer of [ground, decor]) {
      layer.data.forEach((index, cell) => {
        if (index === 0) return;
        const x = cell % map.width * TILE_SIZE;
        const y = Math.floor(cell / map.width) * TILE_SIZE;
        this.add.image(x, y, tileKey(index)).setOrigin(0);
      });
    }

    const grid = this.add.graphics().setDepth(2);
    grid.lineStyle(1, 0xc4ded0, 0.24).beginPath();
    for (let x = 0; x <= width; x += TILE_SIZE) grid.moveTo(x, 0).lineTo(x, height);
    for (let y = 0; y <= height; y += TILE_SIZE) grid.moveTo(0, y).lineTo(width, y);
    grid.strokePath();

    const solids = this.add.graphics().setDepth(1).setVisible(false);
    collision.data.forEach((index, cell) => {
      if (index === 0) return;
      const x = cell % map.width * TILE_SIZE;
      const y = Math.floor(cell / map.width) * TILE_SIZE;
      solids.fillStyle(0xe46976, 0.28).fillRect(x, y, TILE_SIZE, TILE_SIZE);
      solids.lineStyle(1, 0xff8792, 0.65).strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    });

    const sprite = this.add.graphics().setDepth(3);
    const feetBox = this.add.graphics().setDepth(4).setVisible(false);
    let feet = { x: spawnX, y: spawnY };
    let cellSize = 48;

    function drawHero(): void {
      const { x, y } = feet;
      // The cell and hero both use the feet as a bottom-center pivot.
      sprite.clear()
        .lineStyle(1, 0xf4d090, 0.75).strokeRect(x - cellSize / 2, y - cellSize, cellSize, cellSize)
        .fillStyle(0xf4d090, 0.88).fillRect(x - cellSize / 4, y - cellSize + 4, cellSize / 2, cellSize - 4)
        .fillStyle(0xfff3d7).fillCircle(x, y, 2);
      feetBox.clear()
        .fillStyle(0x65ffcb, 0.28).fillRect(x - footWidth / 2, y - footHeight / 2, footWidth, footHeight)
        .lineStyle(2, 0x65ffcb).strokeRect(x - footWidth / 2, y - footHeight / 2, footWidth, footHeight);
      status.textContent = `Cell ${cellSize} px · Feet ${x}, ${y} · Grid ${grid.visible ? 'on' : 'off'} · Collision ${solids.visible ? 'on' : 'off'} · Box ${feetBox.visible ? 'on' : 'off'}`;
    }

    function toggle(event: KeyboardEvent): void {
      if (event.repeat) return;
      switch (event.code) {
        case 'KeyG': grid.setVisible(!grid.visible); break;
        case 'KeyC': solids.setVisible(!solids.visible); break;
        case 'KeyB': feetBox.setVisible(!feetBox.visible); break;
        case 'KeyS': cellSize = cellSize === 48 ? 64 : 48; break;
        default: return;
      }
      drawHero();
    }

    function place(pointer: Phaser.Input.Pointer): void {
      const x = Math.floor(pointer.x / TILE_SIZE);
      const y = Math.floor(pointer.y / TILE_SIZE);
      if (x < 0 || x >= map.width || y < 0 || y >= map.height || collision.data[y * map.width + x] !== 0) return;
      feet = { x: (x + 0.5) * TILE_SIZE, y: (y + 0.5) * TILE_SIZE };
      drawHero();
    }

    window.addEventListener('keydown', toggle);
    this.input.on('pointerdown', place);
    this.events.once('shutdown', () => {
      window.removeEventListener('keydown', toggle);
      this.input.off('pointerdown', place);
    });
    drawHero();
  }

  new Phaser.Game({
    type: Phaser.CANVAS,
    parent: stage,
    width,
    height,
    pixelArt: true,
    backgroundColor: '#121824',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: { key: 'M0_03A_MAP_PROTOTYPE_DEV_ONLY', create },
  });
}
