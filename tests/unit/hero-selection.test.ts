import { expect, test } from 'vitest';
import { confirmSelection, initialSelection, reduceSelection } from '../../src/ui/selection';

test('wraps focus both ways without selecting the focused hero', () => {
  const last = reduceSelection(initialSelection, { type: 'move', offset: -1, count: 10 });
  expect(last).toEqual({ focusedIndex: 9, heroId: null, mode: null });
  expect(reduceSelection(last, { type: 'move', offset: 1, count: 10 })).toEqual(initialSelection);
  expect(reduceSelection(last, { type: 'focus', index: 4, count: 10 }).focusedIndex).toBe(4);
  expect(reduceSelection(last, { type: 'move', offset: 1, count: 0 })).toBe(last);
});

test('requires both a selected hero and mode to produce a NewGameRequest', () => {
  const heroId = 'hero_starfall_archer';
  const select = { type: 'select', heroId, index: 8 } as const;
  const mode = { type: 'mode', mode: 'peaceful' } as const;

  expect(confirmSelection(initialSelection)).toBeNull();
  expect(confirmSelection(reduceSelection(initialSelection, mode))).toBeNull();

  const selected = reduceSelection(initialSelection, select);
  expect(selected.focusedIndex).toBe(8);
  expect(confirmSelection(selected)).toBeNull();

  const complete = reduceSelection(selected, mode);
  expect(confirmSelection(complete)).toEqual({ heroId, mode: 'peaceful' });
  expect(confirmSelection(reduceSelection(complete, { type: 'mode', mode: 'adventure' }))).toEqual({
    heroId,
    mode: 'adventure',
  });
});
