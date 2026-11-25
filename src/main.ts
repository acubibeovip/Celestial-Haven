import Phaser from 'phaser';
import { Boot } from './game/scenes/Boot';

new Phaser.Game({
  type: Phaser.CANVAS,
  parent: 'game',
  width: 480,
  height: 270,
  backgroundColor: '#161b2d',
  scene: Boot,
});
