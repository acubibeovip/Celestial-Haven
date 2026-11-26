import type { PlayerState } from '@domain/player/types';
export { createNewGame } from '../domain/player/newGame';
export type Direct = import('@domain/player/types').Mode;
export const lazy = import('../domain/player/newGame');
export type State = PlayerState;
