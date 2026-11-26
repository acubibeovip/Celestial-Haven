import Phaser from 'phaser';
import { createContentRegistry } from './application/ContentRegistry';
import { createNewGameCatalog } from './application/createNewGameCatalog';
import { LocalSession } from './application/LocalSession';
import { createReadyView } from './application/readyView';
import { readBundledContent } from './infrastructure/content/readBundledContent';
import { Boot } from './game/scenes/Boot';
import { mountMenu, showContentError } from './ui/menu';
import './ui/menu.css';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing menu root.');

const files = readBundledContent();
const registry = createContentRegistry(files);

if (registry.ok) {
  const content = registry.value;
  const catalog = createNewGameCatalog(content);
  const session = new LocalSession(catalog);
  mountMenu(root, {
    registry: content,
    session,
    readyView: (state) => createReadyView(state, content, catalog),
    initialReducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  });

  new Phaser.Game({
    // Temporary for smoke-test pixel sampling. Decide the renderer in M6-03 after measuring FPS.
    type: Phaser.CANVAS,
    parent: 'game',
    width: 480,
    height: 270,
    backgroundColor: '#161b2d',
    scene: Boot,
  });
} else {
  const strings = files['strings.en.json'];
  const title = typeof strings === 'object' && strings !== null && 'ui.content_error' in strings
    ? strings['ui.content_error']
    : undefined;
  showContentError(root, typeof title === 'string' && title.trim() ? title : document.title, registry.error);
}
