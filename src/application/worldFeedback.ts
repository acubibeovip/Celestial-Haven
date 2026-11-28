import { isNodeAvailable, type ResourceNode, type WorldState } from '@domain/gathering/harvest';
import type { ContentRegistry } from './ContentRegistry';

export function formatWorldText(
  text: ContentRegistry['text'], key: string, values: Readonly<Record<string, number | string>>,
): string {
  return text(key).replace(/\{(\w+)\}/g, (placeholder, name: string) => String(values[name] ?? placeholder));
}

export function resourcePrompt(world: WorldState, node: ResourceNode, itemName: string, text: ContentRegistry['text']): string {
  const harvest = world.resourceNodes[node.id];
  if (harvest && !isNodeAvailable(world, node)) {
    const days = harvest.harvestedDay + node.respawnDays - world.day;
    return formatWorldText(text, days === 1 ? 'ui.world.regrow_one' : 'ui.world.regrow_many', { days });
  }
  return formatWorldText(text, `ui.world.${node.kind}`, { item: itemName });
}
