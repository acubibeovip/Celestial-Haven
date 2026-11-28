import { applyBagChange } from '@domain/inventory/applyBagChange';
import type { BagError, ItemCatalog, ItemStack } from '@domain/inventory/types';
import { getEntry } from '@domain/player/catalog';
import type { ItemInfo, PlayerState } from '@domain/player/types';
import { gainXp, type XpError } from '@domain/progression/gainXp';
import type { Progression } from '@domain/progression/types';
import { err, ok, type Result } from '@shared/result';

export type CraftStation = 'forge' | 'workbench';

export interface RecipeInfo {
  readonly id: string;
  readonly station: CraftStation;
  readonly inputs: readonly ItemStack[];
  readonly outputs: readonly ItemStack[];
  readonly requirement: string | null;
}

export type CraftError = BagError | XpError;

interface CraftResult {
  state: PlayerState;
  createdGearIds: string[];
  xp: number;
  levelsGained: number;
  firstTime: boolean;
}

export function craft(
  state: Readonly<PlayerState>, recipe: RecipeInfo, catalog: ItemCatalog & { progression: Progression },
): Result<CraftResult, CraftError> {
  const add: ItemStack[] = [];
  const addGear: ItemInfo[] = [];
  for (const output of recipe.outputs) {
    const item = getEntry(catalog.items, output.itemId);
    if (!item) return err('UNKNOWN_ITEM');
    if (item.kind === 'gear') {
      if (output.quantity !== 1) return err('INVALID_QUANTITY');
      addGear.push(item);
    } else {
      add.push(output);
    }
  }

  const bag = applyBagChange(state, { remove: recipe.inputs, add, addGear }, catalog);
  if (!bag.ok) return bag;

  const firstTime = !state.craftedRecipes.includes(recipe.id);
  const { craft: baseXp, craftFirstBonus } = catalog.progression.xpSources;
  const xp = baseXp + (firstTime ? craftFirstBonus : 0);
  const gained = gainXp(bag.value.state, xp, catalog.progression);
  if (!gained.ok) return gained;

  const craftedRecipes = firstTime ? [...state.craftedRecipes, recipe.id].sort() : state.craftedRecipes;
  return ok({
    state: { ...gained.value.state, craftedRecipes },
    createdGearIds: bag.value.createdGearIds,
    xp,
    levelsGained: gained.value.levelsGained,
    firstTime,
  });
}
