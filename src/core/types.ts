export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

/** A board cell: either a locked piece type or empty (null). */
export type Cell = PieceType | null;

export interface Piece {
  type: PieceType;
  /** Column of the piece's bounding-box top-left corner. */
  x: number;
  /** Row of the piece's bounding-box top-left corner. */
  y: number;
  /** Rotation state, 0..3 (90deg clockwise steps). */
  rotation: number;
}

export interface GameState {
  /** [row][col], null = empty. */
  board: Cell[][];
  current: Piece;
  next: Piece;
  score: number;
  lines: number;
  level: number;
  over: boolean;
  paused: boolean;
  /** Runtime-only: piece-spawning RNG. Excluded from data comparisons. */
  rng: () => number;
}

export type Action =
  | { kind: 'left' }
  | { kind: 'right' }
  | { kind: 'down' }
  | { kind: 'rotate' }
  | { kind: 'hardDrop' }
  | { kind: 'tick' }
  | { kind: 'start' }
  | { kind: 'pause' };
