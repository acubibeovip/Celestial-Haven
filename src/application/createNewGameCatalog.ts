import type { NewGameCatalog } from '@domain/player/types';
import type { ContentRegistry } from './ContentRegistry';

export function createNewGameCatalog(registry: ContentRegistry): NewGameCatalog {
  return {
    heroes: Object.fromEntries(registry.heroes.map((hero) => [hero.id, hero])),
    templates: registry.templates,
    items: Object.fromEntries(registry.items),
  };
}
