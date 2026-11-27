import { expect, test } from 'vitest';
import {
  advanceFixedStep,
  createFixedStepState,
  FIXED_STEP_MS,
  MAX_STEPS_PER_FRAME,
} from '../../src/shared/fixedStep';

function simulatedSteps(fps: number): number {
  let state = createFixedStepState();
  let steps = 0;
  for (let frame = 0; frame < fps * 2; frame++) {
    const result = advanceFixedStep(state, 1000 / fps);
    state = result.state;
    steps += result.steps;
  }
  return steps;
}

test('simulates identical time at 30, 60, and 144 fps over two seconds', () => {
  expect([30, 60, 144].map(simulatedSteps)).toEqual([120, 120, 120]);
});

test('caps a frame at five steps and drops excess time', () => {
  const result = advanceFixedStep(createFixedStepState(), FIXED_STEP_MS * 20);
  expect(result.steps).toBe(MAX_STEPS_PER_FRAME);
  expect(result.state.accumulatorMs).toBe(0);
});

test('clamps deltas above 250 ms', () => {
  expect(advanceFixedStep(createFixedStepState(), 251)).toEqual(advanceFixedStep(createFixedStepState(), 250));
});

test('runs no hidden steps and resets once on resume', () => {
  const partial = advanceFixedStep(createFixedStepState(), FIXED_STEP_MS / 2).state;
  const hidden = advanceFixedStep(partial, 200, true);
  expect(hidden.steps).toBe(0);
  expect(hidden.state.accumulatorMs).toBe(0);
  const resumed = advanceFixedStep(hidden.state, 200, false);
  expect(resumed.steps).toBe(0);
  expect(resumed.state).toEqual(createFixedStepState());
});
