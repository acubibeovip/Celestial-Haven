export type Mode = 'peaceful' | 'adventure';

export type NewGameRequest = {
  heroId: string;
  mode: Mode;
};
