import type { ContentRegistry } from '../application/ContentRegistry';
import type { Mode, NewGameRequest } from '../application/GameSession';

export type Selection = {
  focusedIndex: number;
  heroId: string | null;
  mode: Mode | null;
};

type SelectionAction =
  | { type: 'focus'; index: number; count: number }
  | { type: 'move'; offset: number; count: number }
  | { type: 'select'; heroId: string; index: number }
  | { type: 'mode'; mode: Mode };

export const initialSelection: Selection = { focusedIndex: 0, heroId: null, mode: null };

export function reduceSelection(state: Selection, action: SelectionAction): Selection {
  switch (action.type) {
    case 'focus':
    case 'move': {
      if (action.count === 0) return state;
      const index = action.type === 'focus' ? action.index : state.focusedIndex + action.offset;
      return { ...state, focusedIndex: ((index % action.count) + action.count) % action.count };
    }
    case 'select':
      return { ...state, heroId: action.heroId, focusedIndex: action.index };
    case 'mode':
      return { ...state, mode: action.mode };
  }
}

export function confirmSelection({ heroId, mode }: Selection): NewGameRequest | null {
  return heroId && mode ? { heroId, mode } : null;
}

export function heroViewModels(registry: ContentRegistry) {
  return registry.heroes.map((hero) => {
    const element = registry.elements.get(hero.elementId);
    if (!element) throw new Error(`Element "${hero.elementId}" is missing from the validated registry.`);

    const name = registry.text(hero.nameKey);
    return {
      id: hero.id,
      name,
      initials: name.trim().split(/\s+/).map((word) => word[0]).join(''),
      archetype: registry.text(hero.archetypeKey),
      template: registry.text(`ui.template.${hero.template}`),
      element: registry.text(element.nameKey),
      color: element.color,
    };
  });
}

export type HeroViewModel = ReturnType<typeof heroViewModels>[number];
