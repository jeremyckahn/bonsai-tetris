import {
  BG_COLOR,
  BOARD_COLS,
  BOARD_ROWS,
  CELL_SIZE,
  EMPTY_COLOR,
  GRID_COLOR,
  NEXT_CELL_SIZE,
  PIECE_COLORS,
} from '../constants';
import type { GameState, Piece, PieceType } from '../core/types';
import { pieceCells } from '../core/game';

/**
 * Draw a single cell at board coordinates (col, row) with the given color.
 */
function drawCell(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  color: string,
  size: number
) {
  const x = col * size;
  const y = row * size;
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
}

/** Draw a piece (at board coordinates) onto the board canvas. */
function drawPiece(ctx: CanvasRenderingContext2D, piece: Piece, size: number): void {
  const cells = pieceCells(piece.type, piece.rotation);
  const color = PIECE_COLORS[piece.type];
  for (const [dx, dy] of cells) {
    const x = piece.x + dx;
    const y = piece.y + dy;
    if (y < 0 || y >= BOARD_ROWS || x < 0 || x >= BOARD_COLS) continue;
    drawCell(ctx, x, y, color, size);
  }
}

/** Draw the board (locked cells + current piece) onto the main canvas. */
export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  const size = CELL_SIZE;
  const width = BOARD_COLS * size;
  const height = BOARD_ROWS * size;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, width, height);

  // Subtle grid.
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  for (let x = 0; x <= BOARD_COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * size + 0.5, 0);
    ctx.lineTo(x * size + 0.5, height);
    ctx.stroke();
  }
  for (let y = 0; y <= BOARD_ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * size + 0.5);
    ctx.lineTo(width, y * size + 0.5);
    ctx.stroke();
  }

  // Locked cells.
  for (let y = 0; y < BOARD_ROWS; y++) {
    for (let x = 0; x < BOARD_COLS; x++) {
      const cell = state.board[y][x];
      if (cell !== null) {
        drawCell(ctx, x, y, PIECE_COLORS[cell], size);
      }
    }
  }

  // Current piece (unless the game is over).
  if (!state.over) {
    drawPiece(ctx, state.current, size);
  }

  // Overlay: game over / pause.
  if (state.over || state.paused) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#e8ecf4';
    ctx.font = '28px "SF Mono", ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.over ? 'GAME OVER' : 'PAUSED', width / 2, height / 2);
    ctx.font = '14px "SF Mono", ui-monospace, Menlo, Consolas, monospace';
    ctx.fillStyle = '#8b93a7';
    ctx.fillText(state.over ? 'Press R to restart' : 'Press P to resume', width / 2, height / 2 + 32);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}

/**
 * Draw the "next" piece preview, centered in its own canvas.
 */
export function renderNext(ctx: CanvasRenderingContext2D, piece: Piece): void {
  const size = NEXT_CELL_SIZE;
  const box = 4 * size; // largest piece is 4 cells wide
  ctx.clearRect(0, 0, box, box);
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, box, box);

  const cells = pieceCells(piece.type, piece.rotation);
  const minCol = Math.min(...cells.map(([x]) => x));
  const minRow = Math.min(...cells.map(([, y]) => y));
  const maxCol = Math.max(...cells.map(([x]) => x));
  const maxRow = Math.max(...cells.map(([, y]) => y));
  const w = maxCol - minCol + 1;
  const h = maxRow - minRow + 1;
  const offsetX = Math.floor((box - w * size) / 2);
  const offsetY = Math.floor((box - h * size) / 2);
  const color = PIECE_COLORS[piece.type];

  for (const [dx, dy] of cells) {
    const col = dx - minCol;
    const row = dy - minRow;
    const x = offsetX + col * size;
    const y = offsetY + row * size;
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
  }
}
