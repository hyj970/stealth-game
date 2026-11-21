// Keyboard and mouse state for the thief: WASD or arrows to move, Shift to run,
// C (or Ctrl) to sneak, click to throw a noise coin toward the pointer, Enter to
// start, R to restart, P or Escape to pause, M to mute.

import { emptyInput } from './world.js';

const KEYMAP = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'run',
  ShiftRight: 'run',
  KeyC: 'sneak',
  ControlLeft: 'sneak',
  ControlRight: 'sneak',
};

/** Build an input tracker bound to the window; call `read()` once a frame. */
export function makeInput(canvas, callbacks) {
  const keys = new Set();
  const state = {
    pressed: emptyInput(),
    mouse: { x: 0, y: 0, clicked: null },
  };

  function onKeyDown(event) {
    if (event.repeat) return;
    const action = KEYMAP[event.code];
    if (action) {
      keys.add(event.code);
      event.preventDefault();
    }
    if (event.code === 'Enter' && callbacks.onEnter) callbacks.onEnter();
    if (event.code === 'KeyR' && callbacks.onRestart) callbacks.onRestart();
    if ((event.code === 'KeyP' || event.code === 'Escape') && callbacks.onPause) callbacks.onPause();
    if (event.code === 'KeyM' && callbacks.onMute) callbacks.onMute();
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    state.mouse.x = ((event.clientX - rect.left) / rect.width) * 1280;
    state.mouse.y = ((event.clientY - rect.top) / rect.height) * 720;
  }

  function onMouseDown(event) {
    onMouseMove(event);
    state.mouse.clicked = { x: state.mouse.x, y: state.mouse.y };
  }

  function onBlur() {
    keys.clear();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);

  return {
    /** The current input frame; consumes the click so it fires once. */
    read() {
      const frame = emptyInput();
      for (const code of keys) {
        const action = KEYMAP[code];
        if (action) frame[action] = true;
      }
      if (state.mouse.clicked) {
        frame.throwCoin = state.mouse.clicked;
        state.mouse.clicked = null;
      }
      return frame;
    },
    /** The pointer's position in game coordinates. */
    mouse() {
      return { x: state.mouse.x, y: state.mouse.y };
    },
  };
}
