import { err, ok, type Result } from '@shared/result';
import type { PlayerState } from '@domain/player/types';
import type { Progression } from './types';

export type XpError = 'INVALID_XP_AMOUNT';

interface XpGain {
  state: PlayerState;
  levelsGained: number;
}

export function gainXp(
  state: Readonly<PlayerState>, amount: number, progression: Progression,
): Result<XpGain, XpError> {
  if (!Number.isSafeInteger(amount) || amount <= 0) return err('INVALID_XP_AMOUNT');
  if (state.level === progression.levelCap) return ok({ state, levelsGained: 0 });

  let level = state.level;
  let xp = state.xp;
  let remaining = amount;
  for (const threshold of progression.xpToNext.slice(level - 1)) {
    // Compare against the gap before adding so a large safe-integer gain cannot overflow.
    const gap = threshold - xp;
    if (remaining < gap) {
      return ok({ state: { ...state, level, xp: xp + remaining }, levelsGained: level - state.level });
    }
    remaining -= gap;
    level++;
    xp = 0;
  }

  return ok({ state: { ...state, level, xp }, levelsGained: level - state.level });
}
