export const FIXED_STEP_MS = 1000 / 60;
export const MAX_STEPS_PER_FRAME = 5;
export const MAX_FRAME_DELTA_MS = 250;

export type FixedStepState = Readonly<{
  accumulatorMs: number;
  hidden: boolean;
}>;

export type FixedStepResult = Readonly<{
  state: FixedStepState;
  steps: number;
}>;

export function createFixedStepState(): FixedStepState {
  return { accumulatorMs: 0, hidden: false };
}

export function advanceFixedStep(
  state: FixedStepState,
  frameDeltaMs: number,
  hidden = false,
): FixedStepResult {
  if (hidden) return { state: { accumulatorMs: 0, hidden: true }, steps: 0 };
  if (state.hidden) return { state: { accumulatorMs: 0, hidden: false }, steps: 0 };
  if (!Number.isFinite(frameDeltaMs) || frameDeltaMs <= 0
    || !Number.isFinite(state.accumulatorMs) || state.accumulatorMs < 0) {
    return { state: { accumulatorMs: 0, hidden: false }, steps: 0 };
  }

  const elapsed = Math.min(frameDeltaMs, MAX_FRAME_DELTA_MS);
  const available = state.accumulatorMs + elapsed;
  // Frame sequences such as 144 Hz accumulate a few ulps below an exact step.
  const steps = Math.min(MAX_STEPS_PER_FRAME, Math.floor(available / FIXED_STEP_MS + 1e-12));
  const accumulatorMs = steps === MAX_STEPS_PER_FRAME && available >= FIXED_STEP_MS * MAX_STEPS_PER_FRAME
    ? 0
    : Math.max(0, available - steps * FIXED_STEP_MS);
  return { state: { accumulatorMs, hidden: false }, steps };
}
