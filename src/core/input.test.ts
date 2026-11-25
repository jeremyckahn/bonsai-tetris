import { describe, expect, it } from 'vitest';
import { InputController, KEY_BINDINGS } from './input';
import type { Action } from './types';

/** Build a controller that records actions; `now` is a controllable clock. */
function makeController(captured: Action[], now: () => number, repeatIntervalMs = 100) {
  return new InputController((a) => captured.push(a), now, repeatIntervalMs);
}

describe('InputController', () => {
  it('fires discrete keys once on keydown', () => {
    const captured: Action[] = [];
    const ctrl = makeController(captured, () => 0);
    ctrl.keydown('Space'); // hardDrop
    expect(captured).toEqual([{ kind: 'hardDrop' }]);
  });

  it('ignores unknown keys', () => {
    const captured: Action[] = [];
    const ctrl = makeController(captured, () => 0);
    ctrl.keydown('KeyX');
    expect(captured).toEqual([]);
  });

  it('fires continuous keys once on keydown (initial fire)', () => {
    const captured: Action[] = [];
    const ctrl = makeController(captured, () => 0);
    ctrl.keydown('ArrowLeft');
    expect(captured).toEqual([{ kind: 'left' }]);
  });

  it('debounces a continuous keydown that is already held', () => {
    const captured: Action[] = [];
    const ctrl = makeController(captured, () => 0);
    ctrl.keydown('ArrowLeft');
    ctrl.keydown('ArrowLeft'); // already held; should not fire again
    expect(captured).toEqual([{ kind: 'left' }]);
  });

  it('repeats a held continuous key every interval', () => {
    const captured: Action[] = [];
    let t = 0;
    const ctrl = makeController(captured, () => t, 100);
    ctrl.keydown('ArrowLeft'); // fires at t=0
    expect(captured.length).toBe(1);

    t = 100;
    ctrl.tick(); // 100 >= 100 -> repeat
    expect(captured.length).toBe(2);

    t = 199;
    ctrl.tick(); // 99 < 100 -> no repeat
    expect(captured.length).toBe(2);

    t = 200;
    ctrl.tick(); // 100 >= 100 -> repeat
    expect(captured.length).toBe(3);
  });

  it('stops repeating after keyup', () => {
    const captured: Action[] = [];
    let t = 0;
    const ctrl = makeController(captured, () => t, 100);
    ctrl.keydown('ArrowLeft');
    ctrl.keyup('ArrowLeft');
    t = 500;
    ctrl.tick();
    expect(captured).toEqual([{ kind: 'left' }]); // only the initial fire
  });

  it('a quick tap (keydown+keyup before the interval) fires only once', () => {
    const captured: Action[] = [];
    let t = 0;
    const ctrl = makeController(captured, () => t, 100);
    ctrl.keydown('ArrowLeft'); // t=0
    t = 50;
    ctrl.tick(); // 50 < 100 -> no repeat
    ctrl.keyup('ArrowLeft');
    t = 200;
    ctrl.tick(); // released -> no repeat
    expect(captured).toEqual([{ kind: 'left' }]);
  });

  it('every bound key maps to the expected action', () => {
    for (const [code, action] of Object.entries(KEY_BINDINGS)) {
      const captured: Action[] = [];
      const ctrl = makeController(captured, () => 0);
      ctrl.keydown(code);
      expect(captured).toEqual([action]);
    }
  });

  it('reports held keys', () => {
    const captured: Action[] = [];
    const ctrl = makeController(captured, () => 0);
    ctrl.keydown('ArrowLeft');
    ctrl.keydown('ArrowUp');
    expect(ctrl.heldKeys).toContain('ArrowLeft');
    expect(ctrl.heldKeys).not.toContain('ArrowUp'); // discrete, not held
    ctrl.keyup('ArrowLeft');
    expect(ctrl.heldKeys).not.toContain('ArrowLeft');
  });
});
