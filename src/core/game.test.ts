import { describe, expect, it } from 'vitest';
import {
  apply,
  canPlace,
  clearLines,
  createGame,
  pieceCells,
  PIECE_TYPES,
} from './game';
import type { Action, Cell, GameState, PieceType } from './types';
import {
  BOARD_COLS,
  BOARD_ROWS,
  HARD_DROP_POINTS,
  LINE_SCORES,
} from '../constants';

// ---- deterministic RNG helpers -------------------------------------------
/** Returns an rng that cycles through the given piece types in order. */
function rngFor(types: PieceType[]): () => number {
  const index = (t: PieceType) => PIECE_TYPES.indexOf(t) / PIECE_TYPES.length;
  let i = 0;
  return () => index(types[i++ % types.length]);
}

/** Returns an rng that always spawns the given piece type. */
function always(type: PieceType): () => number {
  return () => PIECE_TYPES.indexOf(type) / PIECE_TYPES.length;
}

function sorted(cells: [number, number][]): [number, number][] {
  return cells.slice().sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
}

function makeBoard(withRows: (y: number, x: number) => PieceType | null): Cell[][] {
  return Array.from({ length: BOARD_ROWS }, (_, y) =>
    Array.from({ length: BOARD_COLS }, (_, x) => withRows(y, x))
  );
}

describe('createGame', () => {
  it('creates an empty board with the correct dimensions', () => {
    const game = createGame(always('T'));
    expect(game.board).toHaveLength(BOARD_ROWS);
    for (const row of game.board) {
      expect(row).toHaveLength(BOARD_COLS);
      expect(row.every((c) => c === null)).toBe(true);
    }
  });

  it('spawns current and next pieces from the rng', () => {
    const game = createGame(rngFor(['T', 'I']));
    expect(game.current.type).toBe('T');
    expect(game.next.type).toBe('I');
    expect(game.current.rotation).toBe(0);
    expect(game.current.y).toBe(0);
  });

  it('starts at score 0, lines 0, level 1, not over, not paused', () => {
    const game = createGame(always('T'));
    expect(game.score).toBe(0);
    expect(game.lines).toBe(0);
    expect(game.level).toBe(1);
    expect(game.over).toBe(false);
    expect(game.paused).toBe(false);
  });
});

describe('pieceCells', () => {
  it('returns exactly 4 cells for every piece type and rotation', () => {
    for (const type of PIECE_TYPES) {
      for (let r = 0; r < 4; r++) {
        expect(pieceCells(type, r)).toHaveLength(4);
      }
    }
  });

  it('returns normalized offsets (min col and min row are 0)', () => {
    for (const type of PIECE_TYPES) {
      for (let r = 0; r < 4; r++) {
        const cells = pieceCells(type, r);
        expect(Math.min(...cells.map(([x]) => x))).toBe(0);
        expect(Math.min(...cells.map(([, y]) => y))).toBe(0);
      }
    }
  });

  it('rotating four times returns to the base shape', () => {
    for (const type of PIECE_TYPES) {
      expect(sorted(pieceCells(type, 4))).toEqual(sorted(pieceCells(type, 0)));
    }
  });

  it('produces the expected T shapes', () => {
    // Rotation 0: bar on row 1, stem on row 0 (stem points up).
    expect(sorted(pieceCells('T', 0))).toEqual([
      [0, 1],
      [1, 0],
      [1, 1],
      [2, 1],
    ]);
    // Rotation 1: bar on col 0, stem on col 1 (stem points right).
    expect(sorted(pieceCells('T', 1))).toEqual([
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 1],
    ]);
  });
});

describe('movement', () => {
  it('moves left when possible', () => {
    const game = createGame(always('T'));
    const after = apply(game, { kind: 'left' });
    expect(after.current.x).toBe(game.current.x - 1);
  });

  it('does not move left past the left wall', () => {
    let g = createGame(always('T'));
    for (let i = 0; i < 20; i++) g = apply(g, { kind: 'left' });
    const after = apply(g, { kind: 'left' });
    expect(after.current.x).toBe(g.current.x);
  });

  it('moves right when possible', () => {
    const game = createGame(always('T'));
    const after = apply(game, { kind: 'right' });
    expect(after.current.x).toBe(game.current.x + 1);
  });

  it('does not move right past the right wall', () => {
    let g = createGame(always('T'));
    for (let i = 0; i < 20; i++) g = apply(g, { kind: 'right' });
    const after = apply(g, { kind: 'right' });
    expect(after.current.x).toBe(g.current.x);
  });

  it('soft drop moves down and scores 1 point', () => {
    const game = createGame(always('T'));
    const after = apply(game, { kind: 'down' });
    expect(after.current.y).toBe(game.current.y + 1);
    expect(after.score).toBe(game.score + 1);
  });

  it('locks the piece when it reaches the bottom', () => {
    const game = createGame(always('T'));
    let g = game;
    let guard = 0;
    do {
      g = apply(g, { kind: 'down' });
      guard++;
    } while (guard < 100 && g.board.every((r) => r.every((c) => c === null)));
    const lockedCount = g.board.flatMap((r) => r).filter((c) => c === 'T').length;
    expect(lockedCount).toBe(4);
    expect(g.current.y).toBe(0);
  });

  it('hard drop locks the piece at the bottom and scores 2 per cell dropped', () => {
    const game = createGame(always('T'));
    const after = apply(game, { kind: 'hardDrop' });
    // The dropped T (rot 0) locks at the lowest valid position: x=3, y=18.
    expect(after.board[18][4]).toBe('T');
    expect(after.board[19][3]).toBe('T');
    expect(after.board[19][4]).toBe('T');
    expect(after.board[19][5]).toBe('T');
    // Score = 18 cells * 2 points.
    expect(after.score).toBe(18 * HARD_DROP_POINTS);
    // Current piece respawned at the top.
    expect(after.current.y).toBe(0);
  });
});

describe('rotation', () => {
  it('increments rotation on rotate', () => {
    const game = createGame(always('T'));
    const after = apply(game, { kind: 'rotate' });
    expect(after.current.rotation).toBe(1);
  });

  it('does not rotate when the rotated position collides', () => {
    const game = createGame(always('T'));
    // Rot-1 T at (3,0) occupies (3,0),(3,1),(3,2),(4,1); block (3,2) to forbid it.
    const board = makeBoard((y, x) => (y === 2 && x === 3 ? 'I' : null));
    const state: GameState = { ...game, board, current: { type: 'T', x: 3, y: 0, rotation: 0 } };
    expect(canPlace(state.board, state.current)).toBe(true);
    const after = apply(state, { kind: 'rotate' });
    expect(after.current.rotation).toBe(0); // unchanged
  });
});

describe('line clearing', () => {
  it('clears one complete row and scores 100 * level', () => {
    const game = createGame(always('T'));
    const board = makeBoard((y, x) => (y === 19 && x !== 3 && x !== 4 && x !== 5 ? 'I' : null));
    const state: GameState = { ...game, board, current: { type: 'T', x: 3, y: 0, rotation: 0 } };
    const after = apply(state, { kind: 'hardDrop' });
    // The bottom row cleared; a fresh empty row appears at the top.
    expect(after.board[0]).toEqual(Array(BOARD_COLS).fill(null));
    expect(after.lines).toBe(1);
    expect(after.score).toBe(LINE_SCORES[1] * 1 + 18 * HARD_DROP_POINTS);
    // The T cell that was at row 18 shifted down to row 19.
    expect(after.board[19][4]).toBe('T');
  });

  it('clears four lines at once and scores 800 * level', () => {
    const game = createGame(always('T'));
    const board = makeBoard((y, x) => (y >= 16 ? 'I' : null));
    const state: GameState = { ...game, board, current: { type: 'O', x: 4, y: 0, rotation: 0 } };
    const after = apply(state, { kind: 'hardDrop' });
    expect(after.lines).toBe(4);
    // O drops from row 0 to row 14 (its bottom would hit the filled row 16).
    expect(after.score).toBe(LINE_SCORES[4] * 1 + 14 * HARD_DROP_POINTS);
  });

  it('increases level after 10 lines', () => {
    const game = createGame(always('T'));
    const board = makeBoard((y, x) => (y >= 10 ? 'I' : null));
    const state: GameState = { ...game, board, current: { type: 'O', x: 4, y: 0, rotation: 0 } };
    const after = apply(state, { kind: 'hardDrop' });
    expect(after.lines).toBe(10);
    expect(after.level).toBe(2);
  });
});

describe('clearLines', () => {
  it('returns the cleared count and a same-sized board', () => {
    const board = makeBoard((y, x) => (y === 19 ? 'I' : null));
    const { board: next, cleared } = clearLines(board);
    expect(cleared).toBe(1);
    expect(next).toHaveLength(BOARD_ROWS);
    expect(next[0]).toEqual(Array(BOARD_COLS).fill(null));
    // The old row 18 (empty) is now the bottom row.
    expect(next[19]).toEqual(Array(BOARD_COLS).fill(null));
  });

  it('clears nothing when no row is complete', () => {
    const board = makeBoard((y, x) => (y === 19 && x === 0 ? 'I' : null));
    const { cleared } = clearLines(board);
    expect(cleared).toBe(0);
  });
});

describe('game over', () => {
  it('ends the game when a new piece cannot spawn', () => {
    const game = createGame(always('T'));
    const board = makeBoard((y, x) => (y === 0 && x === 4 ? 'I' : null));
    const state: GameState = { ...game, board, current: { type: 'T', x: 3, y: 5, rotation: 0 } };
    expect(canPlace(state.board, state.current)).toBe(true);
    const after = apply(state, { kind: 'hardDrop' });
    expect(after.over).toBe(true);
  });

  it('ignores all actions except start when over', () => {
    const game = createGame(always('T'));
    const board = makeBoard((y, x) => (y === 0 && x === 4 ? 'I' : null));
    const state: GameState = { ...game, board, current: { type: 'T', x: 3, y: 5, rotation: 0 } };
    const over = apply(state, { kind: 'hardDrop' });
    expect(over.over).toBe(true);
    const after = apply(over, { kind: 'left' });
    expect(after).toBe(over); // unchanged reference
  });
});

describe('pause and restart', () => {
  it('pauses and unpauses', () => {
    const game = createGame(always('T'));
    const paused = apply(game, { kind: 'pause' });
    expect(paused.paused).toBe(true);
    const resumed = apply(paused, { kind: 'pause' });
    expect(resumed.paused).toBe(false);
  });

  it('ignores movement while paused', () => {
    const game = createGame(always('T'));
    const paused = apply(game, { kind: 'pause' });
    const after = apply(paused, { kind: 'left' });
    expect(after).toBe(paused); // unchanged reference
  });

  it('restarts the game on start', () => {
    const game = createGame(always('T'));
    const progressed = apply(apply(game, { kind: 'hardDrop' }), { kind: 'hardDrop' });
    expect(progressed.score).toBeGreaterThan(0);
    const restarted = apply(progressed, { kind: 'start' });
    expect(restarted.score).toBe(0);
    expect(restarted.lines).toBe(0);
    expect(restarted.level).toBe(1);
    expect(restarted.over).toBe(false);
    expect(restarted.paused).toBe(false);
    expect(restarted.board[0]).toEqual(Array(BOARD_COLS).fill(null));
  });
});
