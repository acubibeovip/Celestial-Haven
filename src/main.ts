import Phaser from 'phaser';
import { createContentRegistry } from './application/ContentRegistry';
import { createNewGameCatalog } from './application/createNewGameCatalog';
import { LocalSession } from './application/LocalSession';
import { mapNameKey } from './content/validateMap';
import { readBundledContent } from './infrastructure/content/readBundledContent';
import { loadWorldMaps, readBundledMaps } from './infrastructure/maps/loadWorldMaps';
import { Boot } from './game/scenes/Boot';
import { World } from './game/scenes/World';
import { mountMenu, showContentError } from './ui/menu';
import { heroViewModels } from './ui/selection';
import './ui/menu.css';
import './game/scenes/world.css';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing menu root.');

if (import.meta.env.DEV && new URLSearchParams(location.search).has('proto')) {
  void import('./game/dev/mapPrototype').then(({ startMapPrototype }) => startMapPrototype(root));
} else {
  startGame(root);
}

function startGame(root: HTMLElement): void {
  const files = readBundledContent();
  const registry = createContentRegistry(files);
  const maps = registry.ok ? loadWorldMaps(readBundledMaps(), registry.value.resourceNodes) : registry;
  if (!registry.ok || !maps.ok) {
    const strings = files['strings.en.json'];
    const title = typeof strings === 'object' && strings !== null && 'ui.content_error' in strings
      ? strings['ui.content_error']
      : undefined;
    showContentError(root, typeof title === 'string' && title.trim() ? title : document.title, [
      ...(registry.ok ? [] : registry.error), ...(!registry.ok || maps.ok ? [] : maps.error),
    ]);
    return;
  }

  const gameRoot = document.querySelector<HTMLElement>('#game');
  if (!gameRoot) throw new Error('Missing game root.');
  const host: HTMLElement = gameRoot;
  const content = registry.value;
  const session = new LocalSession(createNewGameCatalog(content), maps.value);
  mountMenu(root, {
    registry: content,
    session,
    initialReducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  });

  const game = new Phaser.Game({
    type: Phaser.CANVAS,
    parent: host,
    width: 480,
    height: 270,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: '#161b2d',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: Boot,
  });

  function blockWorld(): void {
    root.hidden = false;
    host.classList.remove('world-active');
    host.setAttribute('aria-hidden', 'true');
    showContentError(root, content.text('ui.content_error'), [
      { file: 'world', path: '$', code: 'MISSING_REF', message: content.text('ui.session_error.missing_checkpoint') },
    ]);
    game.scene.stop('World');
  }

  session.subscribe((event) => {
    if (event.type !== 'GameStarted') return;
    const hero = heroViewModels(content).find(({ id }) => id === event.heroId);
    if (!hero) {
      blockWorld();
      return;
    }

    host.classList.add('world-active');
    host.removeAttribute('aria-hidden');
    host.tabIndex = -1;
    host.focus();
    game.scene.stop('Boot');
    game.scene.add('World', new World({
      session,
      maps: maps.value,
      host,
      hero,
      reducedMotion: root.dataset.reducedMotion === 'true',
      canCapture: () => root.hidden && host.classList.contains('world-active')
        && !document.activeElement?.closest('#app, dialog, [role="dialog"], [role="menu"]'),
      content,
      nameMap: (mapId) => content.text(mapNameKey(mapId)),
      onInvalidState: blockWorld,
    }), true);
  });
}
