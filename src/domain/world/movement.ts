export const TILE_SIZE = 32;
export const PLAYER_WIDTH = 20;
export const PLAYER_HEIGHT = 12;
export const MOVEMENT_SPEED_PX_PER_SECOND = 128;

export type Position = Readonly<{ x: number; y: number }>;
export type MovementIntent = Readonly<{ x: number; y: number }>;

export type CollisionGrid = Readonly<{
  width: number;
  height: number;
  tileSize: number;
  solid: readonly boolean[];
}>;

export function spawnPosition(tileX: number, tileY: number): Position {
  return { x: tileX * TILE_SIZE + 16, y: tileY * TILE_SIZE + 24 };
}

function isFinitePosition(value: Position | MovementIntent): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y);
}

function isUsableGrid(grid: CollisionGrid): boolean {
  return Number.isInteger(grid.width) && grid.width > 0
    && Number.isInteger(grid.height) && grid.height > 0
    && Number.isFinite(grid.tileSize) && grid.tileSize > 0
    && grid.solid.length >= grid.width * grid.height;
}

function isSolid(grid: CollisionGrid, x: number, y: number): boolean {
  return x < 0 || x >= grid.width || y < 0 || y >= grid.height
    || grid.solid[y * grid.width + x] !== false;
}

function occupiedRange(minInclusive: number, maxExclusive: number, tileSize: number): readonly [number, number] {
  return [Math.floor(minInclusive / tileSize), Math.ceil(maxExclusive / tileSize) - 1];
}

function moveX(position: Position, distance: number, grid: CollisionGrid): number {
  if (distance === 0) return position.x;
  const halfWidth = PLAYER_WIDTH / 2;
  const [firstRow, lastRow] = occupiedRange(position.y - PLAYER_HEIGHT, position.y, grid.tileSize);

  if (distance > 0) {
    const currentLast = Math.ceil((position.x + halfWidth) / grid.tileSize) - 1;
    const target = position.x + distance;
    const targetLast = Math.ceil((target + halfWidth) / grid.tileSize) - 1;
    for (let column = currentLast + 1; column <= targetLast; column++) {
      for (let row = firstRow; row <= lastRow; row++) {
        if (isSolid(grid, column, row)) return column * grid.tileSize - halfWidth;
      }
    }
    return target;
  }

  const currentFirst = Math.floor((position.x - halfWidth) / grid.tileSize);
  const target = position.x + distance;
  const targetFirst = Math.floor((target - halfWidth) / grid.tileSize);
  for (let column = currentFirst - 1; column >= targetFirst; column--) {
    for (let row = firstRow; row <= lastRow; row++) {
      if (isSolid(grid, column, row)) return (column + 1) * grid.tileSize + halfWidth;
    }
  }
  return target;
}

function moveY(position: Position, distance: number, grid: CollisionGrid): number {
  if (distance === 0) return position.y;
  const [firstColumn, lastColumn] = occupiedRange(
    position.x - PLAYER_WIDTH / 2,
    position.x + PLAYER_WIDTH / 2,
    grid.tileSize,
  );

  if (distance > 0) {
    const currentLast = Math.ceil(position.y / grid.tileSize) - 1;
    const target = position.y + distance;
    const targetLast = Math.ceil(target / grid.tileSize) - 1;
    for (let row = currentLast + 1; row <= targetLast; row++) {
      for (let column = firstColumn; column <= lastColumn; column++) {
        if (isSolid(grid, column, row)) return row * grid.tileSize;
      }
    }
    return target;
  }

  const currentFirst = Math.floor((position.y - PLAYER_HEIGHT) / grid.tileSize);
  const target = position.y + distance;
  const targetFirst = Math.floor((target - PLAYER_HEIGHT) / grid.tileSize);
  for (let row = currentFirst - 1; row >= targetFirst; row--) {
    for (let column = firstColumn; column <= lastColumn; column++) {
      if (isSolid(grid, column, row)) return (row + 1) * grid.tileSize + PLAYER_HEIGHT;
    }
  }
  return target;
}

export function stepMovement(
  position: Position,
  intent: MovementIntent,
  grid: CollisionGrid,
  dtMs: number,
): Position {
  if (!isFinitePosition(position) || !isFinitePosition(intent) || !Number.isFinite(dtMs)
    || dtMs <= 0 || !isUsableGrid(grid)) return position;

  const magnitude = Math.hypot(intent.x, intent.y);
  if (!Number.isFinite(magnitude)) return position;
  const scale = magnitude > 1 ? 1 / magnitude : 1;
  const distanceScale = MOVEMENT_SPEED_PX_PER_SECOND * dtMs / 1000;
  const dx = intent.x * scale * distanceScale;
  const dy = intent.y * scale * distanceScale;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return position;
  const x = moveX(position, dx, grid);
  const y = moveY({ x, y: position.y }, dy, grid);
  return { x, y };
}
