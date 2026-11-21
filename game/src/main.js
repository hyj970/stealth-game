// Shadow Lantern: boot, the fixed-step game loop, screen flow (title, play, win,
// caught, pause) and the ?shot= scene mode the screenshots are taken in.

import { BEST_KEY, FIELD, STEP } from './config.js';
import { makeRandom } from './random.js';
import { World, emptyInput, EVENT_ALARM, EVENT_COIN, EVENT_MOONSTONE, EVENT_PICKUP } from './world.js';
import { makeInput } from './input.js';
import { makeAudio } from './audio.js';
import { makeRenderer, SCREEN_LOSE, SCREEN_PAUSE, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const statusLine = document.getElementById('status');
canvas.width = FIELD.width;
canvas.height = FIELD.height;

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || '1') || 1;
const shotName = params.get('shot');
const random = makeRandom(seed);

const audio = makeAudio();
const renderer = makeRenderer(canvas, random);
const input = makeInput(canvas, {
  onEnter: () => enterPressed(),
  onRestart: () => restartPressed(),
  onPause: () => pausePressed(),
  onMute: () => {
    audio.setMuted(!audio.isMuted());
  },
});

let levelIndex = 0;
let world = new World(levelIndex, random);
let screen = SCREEN_TITLE;
let shotScreen = null;
let banner = '';
let bannerUntil = 0;
let lastAlarm = 'calm';
let enterQueued = false;
let statusText = '';

function nowSeconds() {
  // Screenshot scenes freeze time so the same seed renders the same frame.
  return shotName ? 1.234 : performance.now() / 1000;
}

function readBest() {
  try {
    return window.localStorage.getItem(BEST_KEY);
  } catch {
    return null;
  }
}

function saveBest(rating) {
  try {
    const best = readBest();
    const order = { Ghost: 3, Shadow: 2, Seen: 1 };
    if (!best || (order[rating] || 0) > (order[best] || 0)) {
      window.localStorage.setItem(BEST_KEY, rating);
    }
  } catch {
    // Storage is a nicety, not a rule: play on without it.
  }
}

function setBanner(text) {
  banner = text;
  bannerUntil = nowSeconds() + 2.5;
}

function enterPressed() {
  enterQueued = true;
}

function restartPressed() {
  if (screen === SCREEN_WIN && world.levelIndex + 1 < 2) {
    levelIndex = world.levelIndex + 1;
    world = new World(levelIndex, random);
    screen = SCREEN_TITLE;
  } else {
    world.reset();
    screen = SCREEN_PLAY;
  }
  banner = '';
}

function pausePressed() {
  if (screen === SCREEN_PLAY) screen = SCREEN_PAUSE;
  else if (screen === SCREEN_PAUSE) screen = SCREEN_PLAY;
}

function startLevel() {
  audio.unlock();
  world.reset();
  screen = SCREEN_PLAY;
  banner = '';
  lastAlarm = 'calm';
}

function announce(text) {
  if (text === statusText) return;
  statusText = text;
  statusLine.textContent = text;
}

/** One fixed simulation step while playing. */
function stepPlay(frame) {
  const events = world.step(STEP, frame);
  if (world.footstep) {
    world.footstep = false;
    audio.footstep(world.player.sneaking, world.player.running);
  }
  if (events & EVENT_PICKUP) audio.pickup();
  if (events & EVENT_MOONSTONE) { // the Moonstone, lifted
    audio.moonstone();
    setBanner('Moonstone taken — reach the green exit!');
  }
  if (events & EVENT_COIN) audio.coinClink();
  if (events & EVENT_ALARM) { // a guard raised the alarm
    audio.alarm();
    setBanner('SPOTTED! Break line of sight!');
  }
  const alarm = world.alarmLevel();
  if (alarm === 'suspicious' && lastAlarm === 'calm') audio.suspicious();
  lastAlarm = alarm;
  if (world.over) {
    if (world.won) {
      audio.win();
      saveBest(world.rating());
      screen = SCREEN_WIN;
    } else {
      audio.caught();
      screen = SCREEN_LOSE;
    }
  }
  return events;
}

let lastTime = performance.now();
let accumulator = 0;

/** The main loop: fixed steps for the rules, one draw per frame. */
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  accumulator += dt;

  const frameInput = input.read();
  const clicked = frameInput.throwCoin;
  if (clicked && screen === SCREEN_TITLE) {
    startLevel();
  } else if (clicked && screen === SCREEN_PLAY) {
    world.throwCoin(clicked.x, clicked.y);
  }
  if (enterQueued) {
    enterQueued = false;
    if (screen === SCREEN_TITLE) startLevel();
    else if (screen === SCREEN_WIN || screen === SCREEN_LOSE) {
      world.reset();
      screen = SCREEN_PLAY;
    }
  }

  if (screen === SCREEN_PLAY) {
    let guard = 0;
    while (accumulator >= STEP && guard < 5) {
      stepPlay(frameInput);
      accumulator -= STEP;
      guard += 1;
      if (world.over) break;
    }
    if (accumulator > STEP * 5) accumulator = 0;
    const alarm = world.alarmLevel();
    announce(
      alarm === 'alert'
        ? 'Alert! A guard is chasing you. Break line of sight.'
        : alarm === 'suspicious'
          ? 'A guard is suspicious. Stay out of the cones.'
          : world.player.hasMoonstone
            ? 'Moonstone taken. Reach the green exit.'
            : 'Steal the Moonstone, then reach the exit unseen.',
    );
  } else {
    accumulator = 0;
    if (screen === SCREEN_TITLE) announce('Shadow Lantern. Press Enter to begin.');
    if (screen === SCREEN_WIN) announce(`Clean getaway. Rating ${world.rating()}. Press R for the next gallery.`);
    if (screen === SCREEN_LOSE) announce('Caught. Press R to try again.');
  }

  renderer.draw(world, screen, {
    now: nowSeconds(),
    banner,
    bannerUntil,
    best: readBest(),
  });
  requestAnimationFrame(frame);
}

// Screenshot mode: stage the named scene and render it, frozen in time.
if (shotName) {
  const staged = stageShot(shotName, world);
  shotScreen = staged.screen;
  screen = staged.screen;
  renderer.draw(world, screen, {
    now: 1.234,
    banner: shotName === 'exit' ? '' : '',
    bannerUntil: 0,
    best: null,
  });
} else {
  requestAnimationFrame(frame);
}

// A small handle for automated playtests; the game itself never reads it.
window.__shadowLantern = {
  get world() {
    return world;
  },
  get screen() {
    return screen;
  },
  get levelIndex() {
    return levelIndex;
  },
  startLevel,
  restartPressed,
  stepPlay,
  emptyInput,
};
