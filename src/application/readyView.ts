import { projectStats } from '@domain/player/newGame';
import type { NewGameCatalog, Stats } from '@domain/player/types';
import type { ContentRegistry } from './ContentRegistry';
import type { SessionState } from './GameSession';

export type ReadyView = {
  hero: string;
  mode: string;
  level: number;
  equipped: readonly string[];
  stats: Stats;
};

export function createReadyView(
  state: Readonly<SessionState>,
  registry: ContentRegistry,
  catalog: NewGameCatalog,
): ReadyView | null {
  if (state.phase !== 'playing') return null;
  const { player } = state;
  const hero = registry.heroes.find(({ id }) => id === player.heroId);
  const stats = projectStats(player, catalog);
  if (!hero || !stats.ok) return null;

  const equipped: string[] = [];
  for (const id of Object.values(player.equipped)) {
    const instance = player.gear.find((item) => item.id === id);
    const item = instance && registry.items.get(instance.defId);
    if (!item) return null;
    equipped.push(registry.text(item.nameKey));
  }
  return {
    hero: registry.text(hero.nameKey),
    mode: registry.text(`ui.mode.${player.mode}`),
    level: player.level,
    equipped,
    stats: stats.value,
  };
}
