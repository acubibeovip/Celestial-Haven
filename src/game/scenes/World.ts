import Phaser from 'phaser';
import type { GameSession } from '../../application/GameSession';
import type { PlayerLocation } from '../../domain/player/types';
import { overlapsTile, stepMovement, type Position } from '../../domain/world/movement';
import type { WorldMap } from '../../infrastructure/maps/loadWorldMaps';
import { advanceFixedStep, createFixedStepState, FIXED_STEP_MS } from '../../shared/fixedStep';
import { InputAdapter } from '../input/InputAdapter';
import { paintBlockout } from './blockoutArt';

interface WorldOptions {
  session: GameSession;
  maps: ReadonlyMap<string, WorldMap>;
  host: HTMLElement;
  canCapture: () => boolean;
  reducedMotion: boolean;
  hero: { color: string; initials: string };
  nameMap: (mapId: string) => string;
  onInvalidState: () => void;
}

export class World extends Phaser.Scene {
  private readonly options: WorldOptions;
  private controls?: InputAdapter;
  private marker?: Phaser.GameObjects.Container;
  private backdrop?: Phaser.GameObjects.Image;
  private map?: WorldMap;
  private feet: Position = { x: 0, y: 0 };
  private timing = createFixedStepState();
  private activeExits = new Set<string>();
  private transitioning = false;

  constructor(options: WorldOptions) {
    super('World');
    this.options = options;
  }

  create(): void {
    const { host, session, hero, canCapture } = this.options;
    const state = session.snapshot();
    if (state.phase !== 'playing' || !this.options.maps.has(state.player.location.mapId)) {
      this.options.onInvalidState();
      return;
    }

    const chip = this.add.rectangle(0, -23, 34, 46, Phaser.Display.Color.HexStringToColor(hero.color).color);
    chip.setStrokeStyle(2, 0x232332);
    const initials = this.add.text(0, -23, hero.initials, {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#181823', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.marker = this.add.container(0, 0, [chip, initials]).setDepth(1);

    const name = document.createElement('p');
    name.className = 'world-map-name';
    name.dataset.testid = 'map-name';
    name.setAttribute('role', 'status');
    host.append(name);
    const controls = new InputAdapter(host, () => !this.transitioning && canCapture());
    this.controls = controls;

    const unsubscribe = session.subscribe((event) => {
      if (event.type !== 'MapChanged') return;
      const current = session.snapshot();
      if (current.phase === 'playing') this.transition(current.player.location, name);
    });
    const resetTiming = () => { this.timing = { accumulatorMs: 0, hidden: true }; };
    document.addEventListener('visibilitychange', resetTiming);
    this.events.once('shutdown', () => {
      unsubscribe();
      controls.destroy();
      name.remove();
      host.removeAttribute('aria-busy');
      document.removeEventListener('visibilitychange', resetTiming);
      this.cameras.main.resetFX();
    });

    this.place(state.player.location, name);
  }

  update(_time: number, delta: number): void {
    const { map, controls } = this;
    if (!map || !controls || this.transitioning) return;

    const tick = advanceFixedStep(this.timing, delta, document.hidden);
    this.timing = tick.state;
    const intent = controls.getIntent();
    for (let step = 0; step < tick.steps; step++) {
      this.feet = stepMovement(this.feet, intent, map.collision, FIXED_STEP_MS);
      this.marker?.setPosition(this.feet.x, this.feet.y);
      const touching = this.exitsAtFeet();
      const entered = [...touching].find((name) => !this.activeExits.has(name));
      this.activeExits = touching;
      if (entered && this.options.session.dispatch({ type: 'EnterExit', exitName: entered }).ok) break;
    }
  }

  private exitsAtFeet(): Set<string> {
    const touching = new Set<string>();
    if (this.map) {
      for (const exit of this.map.exits.values()) {
        if (overlapsTile(this.feet, exit.tileX, exit.tileY, this.map.collision.tileSize)) touching.add(exit.name);
      }
    }
    return touching;
  }

  private place(location: PlayerLocation, label: HTMLElement): void {
    const map = this.options.maps.get(location.mapId);
    if (!map) {
      this.options.onInvalidState();
      return;
    }

    this.backdrop?.destroy();
    const texture = `world:${location.mapId}`;
    if (!this.textures.exists(texture)) this.textures.addCanvas(texture, paintBlockout(location.mapId, map.data));
    this.backdrop = this.add.image(0, 0, texture).setOrigin(0);
    this.map = map;
    this.feet = { x: location.x, y: location.y };
    this.marker?.setPosition(this.feet.x, this.feet.y);
    this.activeExits = this.exitsAtFeet();
    this.timing = createFixedStepState();
    this.cameras.main.setBounds(0, 0, this.backdrop.width, this.backdrop.height);
    this.cameras.main.centerOn(this.feet.x, this.feet.y);
    if (this.marker) this.cameras.main.startFollow(this.marker, true);

    label.textContent = this.options.nameMap(location.mapId);
  }

  private transition(location: PlayerLocation, label: HTMLElement): void {
    if (this.options.reducedMotion) {
      this.place(location, label);
      return;
    }

    this.transitioning = true;
    this.options.host.setAttribute('aria-busy', 'true');
    const camera = this.cameras.main;
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.place(location, label);
      camera.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
        this.transitioning = false;
        this.options.host.removeAttribute('aria-busy');
      });
      camera.fadeIn(100);
    });
    camera.fadeOut(100);
  }
}
