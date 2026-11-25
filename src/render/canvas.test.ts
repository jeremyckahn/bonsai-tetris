import { describe, expect, it } from 'vitest';
import { render, renderNext } from './canvas';
import { createGame } from '../core/game';
import type { Piece } from '../core/types';
import {
  BOARD_COLS,
  BOARD_ROWS,
  CELL_SIZE,
  NEXT_CELL_SIZE,
  PIECE_COLORS,
} from '../constants';

/** A recording fake of CanvasRenderingContext2D. Logs method calls and property writes. */
class FakeCtx {
  calls: string[] = [];
  private _fillStyle = '';
  private _strokeStyle = '';
  font = '';
  textAlign = '';
  textBaseline = '';
  lineWidth = 0;

  get fillStyle(): string {
    return this._fillStyle;
  }
  set fillStyle(v: string) {
    this._fillStyle = v;
    this.calls.push(`fillStyle=${v}`);
  }
  get strokeStyle(): string {
    return this._strokeStyle;
  }
  set strokeStyle(v: string) {
    this._strokeStyle = v;
    this.calls.push(`strokeStyle=${v}`);
  }

  clearRect(x: number, y: number, w: number, h: number) {
    this.calls.push(`clearRect(${x},${y},${w},${h})`);
  }
  fillRect(x: number, y: number, w: number, h: number) {
    this.calls.push(`fillRect(${x},${y},${w},${h})`);
  }
  beginPath() {
    this.calls.push('beginPath');
  }
  moveTo(x: number, y: number) {
    this.calls.push(`moveTo(${x},${y})`);
  }
  lineTo(x: number, y: number) {
    this.calls.push(`lineTo(${x},${y})`);
  }
  stroke() {
    this.calls.push('stroke');
  }
  fillText(text: string, x: number, y: number) {
    this.calls.push(`fillText(${text},${x},${y})`);
  }

  fillRects(): Array<[number, number, number, number]> {
    return this.calls
      .filter((c) => c.startsWith('fillRect('))
      .map((c) => c.slice('fillRect('.length, -1).split(',').map(Number)) as Array<
        [number, number, number, number]
      >;
  }
}

function ctx(): FakeCtx & CanvasRenderingContext2D {
  return new FakeCtx() as unknown as FakeCtx & CanvasRenderingContext2D;
}

/** Deterministic rng: always returns 0, which spawns the first piece type ('I'). */
const rngI = () => 0;

describe('render', () => {
  it('clears the canvas and paints the background', () => {
    const c = ctx();
    const game = createGame(rngI);
    render(c, game);
    expect(c.calls).toContain(`clearRect(0,0,${BOARD_COLS * CELL_SIZE},${BOARD_ROWS * CELL_SIZE})`);
    expect(c.calls).toContain(`fillRect(0,0,${BOARD_COLS * CELL_SIZE},${BOARD_ROWS * CELL_SIZE})`);
  });

  it('draws a cell for each locked board cell', () => {
    const c = ctx();
    const game = createGame(rngI);
    game.board[5][3] = 'T';
    game.board[5][4] = 'T';
    render(c, game);
    const rects = c.fillRects();
    expect(rects).toContainEqual([3 * CELL_SIZE + 1, 5 * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2]);
    expect(rects).toContainEqual([4 * CELL_SIZE + 1, 5 * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2]);
  });

  it('draws the current piece cells', () => {
    const c = ctx();
    const game = createGame(rngI);
    // Force a known T at a known position.
    game.current = { type: 'T', x: 3, y: 0, rotation: 0 };
    render(c, game);
    const rects = c.fillRects();
    // T rot 0 at (3,0): cells (4,0),(3,1),(4,1),(5,1)
    expect(rects).toContainEqual([4 * CELL_SIZE + 1, 0 + 1, CELL_SIZE - 2, CELL_SIZE - 2]);
    expect(rects).toContainEqual([3 * CELL_SIZE + 1, 1 * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2]);
    expect(rects).toContainEqual([5 * CELL_SIZE + 1, 1 * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2]);
  });

  it('does not draw the current piece when the game is over', () => {
    const c = ctx();
    const game = createGame(rngI);
    game.current = { type: 'T', x: 3, y: 0, rotation: 0 };
    game.over = true;
    render(c, game);
    // The (4,0) T cell should NOT be present; the game-over text should be.
    const rects = c.fillRects();
    expect(rects).not.toContainEqual([4 * CELL_SIZE + 1, 0 + 1, CELL_SIZE - 2, CELL_SIZE - 2]);
    expect(c.calls).toContain('fillText(GAME OVER,150,300)');
  });

  it('draws a pause overlay when paused', () => {
    const c = ctx();
    const game = createGame(rngI);
    game.paused = true;
    render(c, game);
    expect(c.calls).toContain('fillText(PAUSED,150,300)');
  });

  it('sets fillStyle to the piece color for locked cells', () => {
    const c = ctx();
    const game = createGame(rngI);
    game.board[5][3] = 'T';
    render(c, game);
    // The T color must be used for the locked cell.
    expect(c.calls).toContain(`fillStyle=${PIECE_COLORS.T}`);
  });
});

describe('renderNext', () => {
  it('draws the next piece centered in the preview box', () => {
    const c = ctx();
    const piece: Piece = { type: 'O', x: 0, y: 0, rotation: 0 };
    renderNext(c, piece);
    // O is 2x2; box = 4 * NEXT_CELL_SIZE = 80; offset = (80 - 40)/2 = 20.
    const rects = c.fillRects();
    expect(rects).toContainEqual([20 + 0 + 1, 20 + 0 + 1, NEXT_CELL_SIZE - 2, NEXT_CELL_SIZE - 2]);
    expect(rects).toContainEqual([20 + NEXT_CELL_SIZE + 1, 20 + 0 + 1, NEXT_CELL_SIZE - 2, NEXT_CELL_SIZE - 2]);
    expect(rects).toContainEqual([20 + 0 + 1, 20 + NEXT_CELL_SIZE + 1, NEXT_CELL_SIZE - 2, NEXT_CELL_SIZE - 2]);
    expect(rects).toContainEqual([20 + NEXT_CELL_SIZE + 1, 20 + NEXT_CELL_SIZE + 1, NEXT_CELL_SIZE - 2, NEXT_CELL_SIZE - 2]);
  });

  it('draws the I piece as a vertical/horizontal bar of 4 cells', () => {
    const c = ctx();
    const piece: Piece = { type: 'I', x: 0, y: 0, rotation: 0 };
    renderNext(c, piece);
    const rects = c.fillRects();
    // Exclude the background fillRect (0,0,80,80).
    const cells = rects.filter((r) => !(r[0] === 0 && r[1] === 0 && r[2] === 80 && r[3] === 80));
    expect(cells).toHaveLength(4);
  });
});
