import Phaser from 'phaser';
import { Boot } from './game/scenes/Boot';

new Phaser.Game({
  // Temporary for smoke-test pixel sampling. Decide the renderer in M6-03 after measuring FPS.
  type: Phaser.CANVAS,
  parent: 'game',
  width: 480,
  height: 270,
  backgroundColor: '#161b2d',
  scene: Boot,
});
