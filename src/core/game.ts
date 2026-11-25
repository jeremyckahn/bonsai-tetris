import {
  BOARD_COLS,
  BOARD_ROWS,
  HARD_DROP_POINTS,
  LINES_PER_LEVEL,
  LINE_SCORES,
  SOFT_DROP_POINTS,
} from '../constants';
import type { Action, Cell, GameState, Piece, PieceType } from './types';

/**
 * Base shape of each tetromino as [col, row] offsets inside a `size` x `size`
 * bounding box, in the rotation-0 orientation.
 */
const SHAPES: Record<PieceType, { size: number; cells: [number, number][] }> = {
  I: { size: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  O: { size: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  T: { size: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  S: { size: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  Z: { size: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  J: { size: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  L: { size: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
};

export const PIECE_TYPES: PieceType[] = Object.keys(SHAPES) as PieceType[];

/**
 * The occupied cells of a piece type at a given rotation, as [col, row]
 * offsets normalized so the minimum col and row are both 0.
 */
export function pieceCells(type: PieceType, rotation: number): [number, number][] {
  const { size, cells } = SHAPES[type];
  let current: [number, number][] = cells.map(([x, y]) => [x, y]);
  const steps = ((rotation % 4) + 4) % 4;
  for (let i = 0; i < steps; i++) {
    // 90deg clockwise within the size x size box: (col, row) -> (size-1-row, col)
    current = current.map(([x, y]) => [size - 1 - y, x]);
  }
  const minX = Math.min(...current.map(([x]) => x));
  const minY = Math.min(...current.map(([, y]) => y));
  return current.map(([x, y]) => [x - minX, y - minY]);
}

/** Is the piece (at its current x/y/rotation) fully inside the board and free of collisions? */
export function canPlace(board: Cell[][], piece: Piece): boolean {
  const cells = pieceCells(piece.type, piece.rotation);
  for (const [dx, dy] of cells) {
    const x = piece.x + dx;
    const y = piece.y + dy;
    if (x < 0 || x >= BOARD_COLS || y < 0 || y >= BOARD_ROWS) return false;
    if (board[y][x] !== null) return false;
  }
  return true;
}

function rotatePiece(piece: Piece): Piece {
  return { ...piece, rotation: (piece.rotation + 1) % 4 };
}

function spawnPiece(rng: () => number): Piece {
  const type = PIECE_TYPES[Math.floor(rng() * PIECE_TYPES.length)];
  const size = SHAPES[type].size;
  const x = Math.floor((BOARD_COLS - size) / 2);
  return { type, x, y: 0, rotation: 0 };
}

function scoreForLines(cleared: number, level: number): number {
  return LINE_SCORES[cleared] * level;
}

/**
 * Lock the current piece into the board, clear complete lines, score, and
 * spawn the next pieces. Returns the updated game state.
 */
function lockPiece(game: GameState): GameState {
  const cells = pieceCells(game.current.type, game.current.rotation);
  const board = game.board.map((row) => row.slice());
  for (const [dx, dy] of cells) {
    const x = game.current.x + dx;
    const y = game.current.y + dy;
    if (x >= 0 && x < BOARD_COLS && y >= 0 && y < BOARD_ROWS) {
      board[y][x] = game.current.type;
    }
  }

  const { board: clearedBoard, cleared } = clearLines(board);
  const score = game.score + scoreForLines(cleared, game.level);
  const lines = game.lines + cleared;
  const level = Math.floor(lines / LINES_PER_LEVEL) + 1;
  const current = spawnPiece(game.rng);
  const next = spawnPiece(game.rng);
  const over = !canPlace(clearedBoard, current);

  return {
    board: clearedBoard,
    current,
    next,
    score,
    lines,
    level,
    over,
    paused: game.paused,
    rng: game.rng,
  };
}

/** Remove complete rows; empty rows are added at the top. Returns the new board and how many were cleared. */
export function clearLines(board: Cell[][]): { board: Cell[][]; cleared: number } {
  const newBoard: Cell[][] = [];
  let cleared = 0;
  for (let y = 0; y < BOARD_ROWS; y++) {
    const row = board[y];
    if (row.every((cell) => cell !== null)) {
      cleared++;
    } else {
      newBoard.push(row);
    }
  }
  while (newBoard.length < BOARD_ROWS) {
    newBoard.unshift(Array(BOARD_COLS).fill(null));
  }
  return { board: newBoard, cleared };
}

/** Create a fresh game. `rng` drives deterministic piece spawning (testable). */
export function createGame(rng: () => number): GameState {
  const board: Cell[][] = Array.from(
    { length: BOARD_ROWS },
    () => Array(BOARD_COLS).fill(null)
  );
  return {
    board,
    current: spawnPiece(rng),
    next: spawnPiece(rng),
    score: 0,
    lines: 0,
    level: 1,
    over: false,
    paused: false,
    rng,
  };
}

/**
 * Apply a single action to a game state. Pure: returns a new state, never
 * mutates the input.
 */
export function apply(game: GameState, action: Action): GameState {
  if (game.over) {
    return action.kind === 'start' ? createGame(game.rng) : game;
  }
  if (game.paused) {
    if (action.kind === 'pause') return { ...game, paused: false };
    if (action.kind === 'start') return createGame(game.rng);
    return game;
  }

  switch (action.kind) {
    case 'left': {
      const p = { ...game.current, x: game.current.x - 1 };
      return canPlace(game.board, p) ? { ...game, current: p } : game;
    }
    case 'right': {
      const p = { ...game.current, x: game.current.x + 1 };
      return canPlace(game.board, p) ? { ...game, current: p } : game;
    }
    case 'down': {
      const p = { ...game.current, y: game.current.y + 1 };
      if (canPlace(game.board, p)) {
        return { ...game, current: p, score: game.score + SOFT_DROP_POINTS };
      }
      return lockPiece(game);
    }
    case 'rotate': {
      const p = rotatePiece(game.current);
      return canPlace(game.board, p) ? { ...game, current: p } : game;
    }
    case 'hardDrop': {
      let p = game.current;
      let dropped = 0;
      while (canPlace(game.board, { ...p, y: p.y + 1 })) {
        p = { ...p, y: p.y + 1 };
        dropped++;
      }
      const locked = lockPiece({ ...game, current: p });
      return { ...locked, score: locked.score + dropped * HARD_DROP_POINTS };
    }
    case 'tick': {
      const p = { ...game.current, y: game.current.y + 1 };
      if (canPlace(game.board, p)) return { ...game, current: p };
      return lockPiece(game);
    }
    case 'pause':
      return { ...game, paused: true };
    case 'start':
      return createGame(game.rng);
  }
}
