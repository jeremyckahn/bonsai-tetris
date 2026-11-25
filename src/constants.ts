import type { PieceType } from './core/types';

// ---- Board geometry -------------------------------------------------------
export const BOARD_COLS = 10;
export const BOARD_ROWS = 20;

// ---- Rendering ------------------------------------------------------------
export const CELL_SIZE = 30;
export const NEXT_CELL_SIZE = 20;

// ---- Gravity ----------------------------------------------------------------
export const DROP_BASE_MS = 500;
export const DROP_DECREASE_PER_LEVEL = 40;
export const DROP_MIN_MS = 100;

// ---- Scoring ----------------------------------------------------------------
// Index = number of lines cleared in one lock.
export const LINE_SCORES = [0, 100, 300, 500, 800];
export const SOFT_DROP_POINTS = 1;
export const HARD_DROP_POINTS = 2;
export const LINES_PER_LEVEL = 10;

// ---- Input -------------------------------------------------------------------
export const KEY_REPEAT_INTERVAL_MS = 100;

// ---- Colors ------------------------------------------------------------------
export const BG_COLOR = '#0f1117';
export const EMPTY_COLOR = 'rgba(255, 255, 255, 0.04)';
export const GRID_COLOR = 'rgba(255, 255, 255, 0.06)';
export const PIECE_COLORS: Record<PieceType, string> = {
  I: '#00d7d7',
  O: '#fcd600',
  T: '#b165f4',
  S: '#00e676',
  Z: '#ef4444',
  J: '#436eff',
  L: '#ff9500',
};

export function dropIntervalMs(level: number): number {
  return Math.max(DROP_MIN_MS, DROP_BASE_MS - (level - 1) * DROP_DECREASE_PER_LEVEL);
}
