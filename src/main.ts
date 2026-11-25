import { BOARD_COLS, BOARD_ROWS, CELL_SIZE, dropIntervalMs } from './constants';
import { apply, createGame } from './core/game';
import { InputController, KEY_BINDINGS } from './core/input';
import type { Action } from './core/types';
import { render, renderNext } from './render/canvas';

function el(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element: #${id}`);
  return node;
}

const boardCanvas = el('board') as HTMLCanvasElement;
const nextCanvas = el('next') as HTMLCanvasElement;
const scoreEl = el('score');
const levelEl = el('level');
const linesEl = el('lines');

boardCanvas.width = BOARD_COLS * CELL_SIZE;
boardCanvas.height = BOARD_ROWS * CELL_SIZE;
nextCanvas.width = 80;
nextCanvas.height = 80;

const boardCtx = getCtx(boardCanvas);
const nextCtx = getCtx(nextCanvas);

function getCtx(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const c = canvas.getContext('2d');
  if (!c) throw new Error('Canvas 2D context unavailable');
  return c;
}

const rng = Math.random;
let game = createGame(rng);

function handleAction(action: Action): void {
  game = apply(game, action);
}

const input = new InputController(handleAction, () => performance.now());

window.addEventListener('keydown', (e) => {
  if (KEY_BINDINGS[e.code]) {
    e.preventDefault();
    input.keydown(e.code);
  }
});
window.addEventListener('keyup', (e) => {
  input.keyup(e.code);
});

let lastFrame = performance.now();
let accumulator = 0;

function frame(now: number): void {
  const dt = now - lastFrame;
  lastFrame = now;

  if (!game.over && !game.paused) {
    accumulator += dt;
    const dropMs = dropIntervalMs(game.level);
    // Clamp so an inactive tab doesn't dump dozens of ticks at once.
    accumulator = Math.min(accumulator, dropMs * 5);
    while (accumulator >= dropMs) {
      game = apply(game, { kind: 'tick' });
      accumulator -= dropMs;
    }
  } else {
    accumulator = 0;
  }

  input.tick();

  render(boardCtx, game);
  renderNext(nextCtx, game.next);

  scoreEl.textContent = String(game.score);
  levelEl.textContent = String(game.level);
  linesEl.textContent = String(game.lines);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
