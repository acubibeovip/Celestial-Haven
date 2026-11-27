import { expect, test } from 'vitest';
import {
  clampIntent,
  joystickIntent,
  keyboardIntent,
  mergeIntents,
} from '../../src/game/input/InputAdapter';

test('applies the joystick dead zone and clamps full travel', () => {
  expect(joystickIntent(9.6, 0)).toEqual({ x: 0, y: 0 });
  expect(joystickIntent(48, 0)).toEqual({ x: 1, y: 0 });
  expect(joystickIntent(96, 0)).toEqual({ x: 1, y: 0 });
});

test('clamps diagonal and summed keyboard plus joystick intent', () => {
  const diagonal = clampIntent({ x: 1, y: 1 });
  expect(diagonal.x).toBeCloseTo(Math.SQRT1_2, 15);
  expect(diagonal.y).toBeCloseTo(Math.SQRT1_2, 15);
  const merged = mergeIntents({ x: 1, y: 0 }, { x: 1, y: 1 });
  expect(merged.x).toBeCloseTo(2 / Math.sqrt(5), 15);
  expect(merged.y).toBeCloseTo(1 / Math.sqrt(5), 15);
});

test('supports WASD and arrows and cancels opposite keys', () => {
  const diagonal = keyboardIntent(new Set(['KeyW', 'ArrowRight']));
  expect(diagonal.x).toBeCloseTo(Math.SQRT1_2, 15);
  expect(diagonal.y).toBeCloseTo(-Math.SQRT1_2, 15);
  expect(keyboardIntent(new Set(['KeyA', 'KeyD', 'ArrowUp', 'ArrowDown']))).toEqual({ x: 0, y: 0 });
});
