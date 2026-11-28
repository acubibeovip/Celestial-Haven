import { applyBagChange } from '@domain/inventory/applyBagChange';
import type { BagError, ItemCatalog } from '@domain/inventory/types';
import { getEntry } from '@domain/player/catalog';
import type { PlayerState } from '@domain/player/types';
import { gainXp, type XpError } from '@domain/progression/gainXp';
import type { Progression } from '@domain/progression/types';
import { err, ok, type Result } from '@shared/result';

export interface ResourceNode {
  readonly id: string;
  readonly kind: 'gather' | 'mine';
  readonly itemId: string;
  readonly quantity: number;
  readonly respawnDays: number;
}

export interface WorldState {
  readonly day: number;
  readonly resourceNodes: Readonly<Record<string, Readonly<{ harvestedDay: number }> | undefined>>;
}

export type HarvestError = 'NODE_DEPLETED' | BagError | XpError;

export function isNodeAvailable(world: WorldState, node: ResourceNode): boolean {
  const entry = getEntry(world.resourceNodes, node.id);
  return entry === undefined || world.day >= entry.harvestedDay + node.respawnDays;
}

export function harvest(
  player: Readonly<PlayerState>, world: WorldState, node: ResourceNode,
  catalog: ItemCatalog & { progression: Progression },
): Result<{ player: PlayerState; world: WorldState; xp: number; levelsGained: number }, HarvestError> {
  if (!isNodeAvailable(world, node)) return err('NODE_DEPLETED');

  const bag = applyBagChange(player, {
    remove: [], add: [{ itemId: node.itemId, quantity: node.quantity }],
  }, catalog);
  if (!bag.ok) return bag;

  const xp = catalog.progression.xpSources[node.kind];
  const gained = gainXp(bag.value.state, xp, catalog.progression);
  if (!gained.ok) return gained;

  return ok({
    player: gained.value.state,
    world: { ...world, resourceNodes: { ...world.resourceNodes, [node.id]: { harvestedDay: world.day } } },
    xp,
    levelsGained: gained.value.levelsGained,
  });
}
