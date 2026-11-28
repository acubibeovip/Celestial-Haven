import Phaser from 'phaser';
import { sessionErrorKeys, type ContentRegistry } from '../../application/ContentRegistry';
import { formatWorldText, resourcePrompt } from '../../application/worldFeedback';
import { isNodeAvailable } from '../../domain/gathering/harvest';
import { pickInteraction } from '../../domain/world/pickInteraction';
import { mountWorldPanel } from '../../ui/worldPanel';
import type { GameSession, SessionEvent } from '../../application/GameSession';
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
  content: ContentRegistry;
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
  private bed: Phaser.GameObjects.Container | undefined;
  private panel?: ReturnType<typeof mountWorldPanel>;
  private readonly resources = new Map<string, Phaser.GameObjects.Shape>();
  private transitioning = false;

  constructor(options: WorldOptions) {
    super('World');
    this.options = options;
  }

  create(): void {
    const { host, session, hero } = this.options;
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
    const canvas = this.game.canvas;
    canvas.dataset.heroInitials = hero.initials;
    canvas.dataset.heroElementColor = hero.color;
    this.marker = this.add.container(0, 0, [chip, initials]).setDepth(1);

    const panel = mountWorldPanel(host, this.options.content.text, () => this.interact());
    this.panel = panel;
    host.dataset.reducedMotion = String(this.options.reducedMotion);
    const controls = new InputAdapter(host, () => this.canInteract());
    this.controls = controls;
    const key = (event: KeyboardEvent) => {
      if (event.code !== 'KeyE' || event.repeat || !this.canInteract()) return;
      event.preventDefault();
      this.interact();
    };
    window.addEventListener('keydown', key);
    const unsubscribe = session.subscribe((event) => {
      const current = session.snapshot();
      if (current.phase !== 'playing') return;
      if (event.type === 'MapChanged') this.fade(() => this.place(current.player.location, panel.mapName));
      else if (event.type === 'ResourceGathered' || event.type === 'DayEnded') this.feedback(event);
    });
    const resetTiming = () => { this.timing = { accumulatorMs: 0, hidden: true }; };
    document.addEventListener('visibilitychange', resetTiming);
    this.events.once('shutdown', () => {
      unsubscribe();
      controls.destroy();
      panel.destroy();
      this.resources.clear();
      window.removeEventListener('keydown', key);
      delete host.dataset.reducedMotion;
      delete canvas.dataset.heroInitials;
      delete canvas.dataset.heroElementColor;
      host.removeAttribute('aria-busy');
      document.removeEventListener('visibilitychange', resetTiming);
      this.cameras.main.resetFX();
    });

    this.place(state.player.location, panel.mapName);
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
    this.refreshPrompt();
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
    for (const shape of this.resources.values()) shape.destroy();
    this.resources.clear();
    this.bed?.destroy();
    this.bed = undefined;
    for (const marker of map.interactables) {
      const x = (marker.tileX + 0.5) * map.collision.tileSize;
      const y = (marker.tileY + 0.5) * map.collision.tileSize;
      if (marker.type === 'bed') {
        const frame = this.add.rectangle(0, 0, 18, 24, 0x945e57).setStrokeStyle(2, 0x232332);
        const pillow = this.add.rectangle(0, -7, 12, 6, 0xf5ebd8);
        const blanket = this.add.rectangle(0, 3, 14, 10, 0x718bc1);
        this.bed = this.add.container(x, y, [frame, pillow, blanket]);
        continue;
      }
      const node = this.options.content.resourceNodes.get(marker.nodeId);
      if (!node) continue;
      const shape = node.kind === 'gather'
        ? this.add.circle(x, y, 11, 0x64b47a)
        : this.add.rectangle(x, y, 16, 16, 0x9daab7).setAngle(45);
      shape.setStrokeStyle(2, 0x232332);
      this.resources.set(marker.nodeId, shape);
    }
    this.feet = { x: location.x, y: location.y };
    this.marker?.setPosition(this.feet.x, this.feet.y);
    this.activeExits = this.exitsAtFeet();
    this.timing = createFixedStepState();
    this.cameras.main.setBounds(0, 0, this.backdrop.width, this.backdrop.height);
    this.cameras.main.centerOn(this.feet.x, this.feet.y);
    if (this.marker) this.cameras.main.startFollow(this.marker, true);

    label.textContent = this.options.nameMap(location.mapId);
    this.refreshWorld();
  }

  private fade(atMidpoint: () => void): void {
    if (this.options.reducedMotion) {
      atMidpoint();
      return;
    }

    this.transitioning = true;
    this.panel?.showPrompt(undefined);
    this.options.host.setAttribute('aria-busy', 'true');
    const camera = this.cameras.main;
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      atMidpoint();
      camera.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
        this.transitioning = false;
        this.options.host.removeAttribute('aria-busy');
      });
      camera.fadeIn(100);
    });
    camera.fadeOut(100);
  }

  private canInteract(): boolean {
    return !this.transitioning && !this.panel?.isDialogOpen() && this.options.canCapture();
  }

  private itemName(itemId: string): string {
    const { content } = this.options;
    const item = content.items.get(itemId);
    return item ? content.text(item.nameKey) : itemId;
  }

  private interact(): void {
    if (!this.map || !this.canInteract()) return;
    const marker = pickInteraction(this.feet, this.map.interactables);
    if (marker?.type === 'resource') {
      const result = this.options.session.dispatch({ type: 'Gather', nodeId: marker.nodeId });
      if (!result.ok) this.panel?.announce(this.options.content.text(sessionErrorKeys[result.error]));
    } else if (marker?.type === 'bed') {
      this.panel?.confirmSleep(() => {
        const result = this.options.session.dispatch({ type: 'EndDay' });
        if (!result.ok) this.panel?.announce(this.options.content.text(sessionErrorKeys[result.error]));
      });
    }
  }

  private refreshWorld(): void {
    const { content, session } = this.options;
    const state = session.snapshot();
    if (state.phase !== 'playing' || !this.panel) return;
    this.panel.day.textContent = formatWorldText(content.text, 'ui.world.day', { day: state.world.day });
    const { level, xp } = state.player;
    this.panel.xp.textContent = formatWorldText(
      content.text, level === content.progression.levelCap ? 'ui.world.xp_max' : 'ui.world.xp',
      { level, xp, next: content.progression.xpToNext[level - 1] ?? 0 },
    );
    for (const [id, shape] of this.resources) {
      const node = content.resourceNodes.get(id);
      if (node) shape.setAlpha(isNodeAvailable(state.world, node) ? 1 : 0.4);
    }
    this.refreshPrompt();
  }

  private refreshPrompt(): void {
    const { session, content } = this.options;
    const state = session.snapshot();
    const marker = this.map && !this.transitioning ? pickInteraction(this.feet, this.map.interactables) : undefined;
    if (state.phase !== 'playing' || !marker) {
      this.panel?.showPrompt(undefined);
      return;
    }

    const node = marker.type === 'resource' ? content.resourceNodes.get(marker.nodeId) : undefined;
    const message = node ? resourcePrompt(state.world, node, this.itemName(node.itemId), content.text) : content.text('ui.world.sleep');
    const canvas = this.game.canvas;
    const camera = this.cameras.main;
    this.panel?.showPrompt(
      message,
      canvas.offsetLeft + (this.feet.x - camera.scrollX) * canvas.clientWidth / canvas.width,
      canvas.offsetTop + (this.feet.y - camera.scrollY - 50) * canvas.clientHeight / canvas.height,
    );
  }

  private feedback(event: Extract<SessionEvent, { type: 'ResourceGathered' | 'DayEnded' }>): void {
    const { content, session } = this.options;
    if (event.type === 'DayEnded') {
      this.fade(() => this.refreshWorld());
      this.panel?.announce(formatWorldText(content.text, 'ui.world.day', { day: event.day }));
      return;
    }
    this.refreshWorld();
    const state = session.snapshot();
    const message = formatWorldText(content.text, 'ui.world.yield', {
      item: this.itemName(event.itemId), quantity: event.quantity, xp: event.xp,
    });
    const levelUp = event.levelsGained > 0 && state.phase === 'playing'
      ? formatWorldText(content.text, 'ui.world.level_up', { level: state.player.level }) : '';
    this.panel?.announce(levelUp ? `${message} ${levelUp}` : message);
  }
}
