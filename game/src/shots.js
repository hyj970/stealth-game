// The screenshot scenes behind ?shot=start|play|alert|exit. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by a
// scripted input sequence, so the frame is what a short game really looks like
// and the same seed always gives the same frame.

import { STEP } from './config.js';
import { emptyInput } from './world.js';
import { SCREEN_LOSE, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

/** One leg of a scripted run: hold these keys for `seconds` of play. */
function leg(keys, seconds) {
  return { keys, ticks: Math.round(seconds / STEP) };
}

const PLAY_SCRIPT = [
  // Slip through the row-13 gap (column 4), then wait one tile below the
  // third guard's patrol row: its cone sweeps just overhead, unseen.
  leg({ right: true }, 0.5),
  leg({ up: true }, 1.3),
  leg({ down: true }, 0.6),
  leg({}, 1.75),
];

const ALERT_SCRIPT = [
  // Step into the third guard's patrol row, freeze, and let it half-see you:
  // detection climbs into the suspicious band and the guard turns with a "?".
  leg({ right: true }, 0.5),
  leg({ up: true }, 1.3),
  leg({ down: true }, 0.35),
  leg({}, 2.0),
];

/** Play a scripted input sequence through the world, one fixed step at a time. */
function runScript(world, script) {
  for (const item of script) {
    for (let i = 0; i < item.ticks; i += 1) {
      const input = emptyInput();
      Object.assign(input, item.keys);
      world.step(STEP, input);
      if (world.over) return;
    }
  }
}

/**
 * Set `world` to the named scene (start, play, alert or exit; any other name is
 * start) and return the screen to draw over it.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    runScript(world, PLAY_SCRIPT);
    return { screen: world.over ? SCREEN_LOSE : SCREEN_PLAY };
  }
  if (name === 'alert') {
    runScript(world, ALERT_SCRIPT);
    return { screen: world.over ? SCREEN_LOSE : SCREEN_PLAY };
  }
  if (name === 'exit') {
    // Walk the last few steps into the exit with the Moonstone already lifted,
    // so the win screen is reached through the game's own rules.
    world.player.x = 1100;
    world.player.y = 620;
    world.player.hasMoonstone = true;
    world.moonstone.taken = true;
    runScript(world, [leg({ right: true }, 0.6)]);
    return { screen: world.over && world.won ? SCREEN_WIN : SCREEN_PLAY };
  }
  // Title: let the guards patrol a little behind the title screen.
  runScript(world, [leg({}, 2.0)]);
  return { screen: SCREEN_TITLE };
}
