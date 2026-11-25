import Phaser from 'phaser';

export class Boot extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.add.text(240, 135, 'Celestial Haven', {
      fontFamily: 'sans-serif',
      fontSize: '24px',
      color: '#ffffff',
    }).setOrigin(0.5);
  }
}
