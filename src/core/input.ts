import { KEY_REPEAT_INTERVAL_MS } from '../constants';
import type { Action } from './types';

/** Map of keyboard `event.code` to the game action it triggers. */
export const KEY_BINDINGS: Record<string, Action> = {
  ArrowLeft: { kind: 'left' },
  ArrowRight: { kind: 'right' },
  ArrowUp: { kind: 'rotate' },
  ArrowDown: { kind: 'down' },
  Space: { kind: 'hardDrop' },
  KeyP: { kind: 'pause' },
  KeyR: { kind: 'start' },
};

/** Keys that repeat while held (continuous motion). Everything else fires once per keydown. */
export const CONTINUOUS_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowDown']);

/**
 * Maps keyboard events to game actions with hold-to-repeat semantics:
 *  - discrete keys fire exactly once on keydown;
 *  - continuous keys fire once on keydown, then repeat every `repeatIntervalMs`
 *    while held, and stop on keyup.
 *
 * `apply` is the callback that performs the action; `now` is an injectable
 * clock so repeat timing is deterministic in tests.
 */
export class InputController {
  private held = new Map<string, { lastRepeat: number }>();

  constructor(
    private readonly apply: (action: Action) => void,
    private readonly now: () => number,
    private readonly repeatIntervalMs = KEY_REPEAT_INTERVAL_MS
  ) {}

  keydown(code: string): void {
    const action = KEY_BINDINGS[code];
    if (!action) return;
    if (CONTINUOUS_KEYS.has(code)) {
      if (this.held.has(code)) return; // already held; debounce
      this.held.set(code, { lastRepeat: this.now() });
      this.apply(action); // initial fire
    } else {
      this.apply(action); // discrete: fire once
    }
  }

  keyup(code: string): void {
    this.held.delete(code);
  }

  /** Call once per frame from the game loop to fire held-key repeats. */
  tick(): void {
    const t = this.now();
    for (const [code, info] of this.held) {
      if (t - info.lastRepeat >= this.repeatIntervalMs) {
        const action = KEY_BINDINGS[code];
        if (action) this.apply(action);
        info.lastRepeat = t;
      }
    }
  }

  get heldKeys(): ReadonlySet<string> {
    return new Set(this.held.keys());
  }
}
