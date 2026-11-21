// The world: one level's state and the fixed-step simulation. The thief moves,
// guards and cameras watch, noise travels, loot is lifted and the exit opens.
// The world knows nothing about drawing or keys; input arrives as a plain object.

import { FIELD, GUARD, NOISE, PLAYER, SCORES, STEP, VISION } from './config.js';
import { LEVELS, parseLevel } from './levels.js';
import { inShadow } from './vision.js';
import {
  GUARD_CHASE,
  hearNoise,
  makeCamera,
  makeGuard,
  updateCamera,
  updateGuard,
  visibilityTo,
} from './guards.js';

export const EVENT_NONE = 0;
export const EVENT_CAUGHT = 1;
export const EVENT_WIN = 2;
export const EVENT_PICKUP = 4;
export const EVENT_MOONSTONE = 8;
export const EVENT_ALARM = 16;
export const EVENT_COIN = 32;

/** A fresh, empty input frame. */
export function emptyInput() {
  return { up: false, down: false, left: false, right: false, run: false, sneak: false, throwCoin: null };
}

/**
 * A world for level `levelIndex`, seeded for deterministic play. `random` is
 * only used for cosmetic variation (floor speckle); the rules never roll dice.
 */
export class World {
  constructor(levelIndex, random) {
    this.levelIndex = levelIndex;
    this.level = LEVELS[levelIndex];
    this.parsed = parseLevel(this.level);
    this.random = random;
    this.reset();
  }

  reset() {
    const start = this.parsed.player;
    this.player = {
      x: start.x,
      y: start.y,
      radius: PLAYER.radius,
      facing: -Math.PI / 2,
      running: false,
      sneaking: false,
      moving: false,
      coins: PLAYER.coins,
      hasMoonstone: false,
      score: 0,
      inShadow: false,
    };
    this.guards = this.level.guards.map((g) => makeGuard(g.waypoints));
    this.cameras = this.level.cameras.map((c) => makeCamera(c));
    this.moonstone = { ...this.parsed.moonstone, taken: false };
    this.exit = { ...this.parsed.exit };
    this.coins = this.parsed.coins.map((c) => ({ ...c, taken: false }));
    this.relics = this.parsed.relics.map((r) => ({ ...r, taken: false }));
    this.time = 0;
    this.elapsed = 0;
    this.over = false;
    this.won = false;
    this.caughtBy = null;
    this.maxDetection = 0;
    this.everSuspicious = false;
    this.everAlerted = false;
    this.alarm = 0;
    this.noiseEvents = [];
    this.runNoiseTimer = 0;
    this.coinFlight = null;
    this.thrownCoins = 0;
    this.pickups = 0;
    this.events = EVENT_NONE;
    this.footstepTimer = 0;
    this.footstep = false;
  }

  /** True when a circle at (x,y) with `radius` would overlap a blocker. */
  collide(x, y, radius) {
    if (x - radius < 0 || x + radius > FIELD.width || y - radius < 0 || y + radius > FIELD.height) return true;
    for (let i = 0; i < this.parsed.blockers.length; i += 1) {
      const b = this.parsed.blockers[i];
      const cx = Math.max(b.x, Math.min(x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(y, b.y + b.h));
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy < radius * radius) return true;
    }
    return false;
  }

  /** The loudest detection across guards and cameras right now. */
  loudestDetection() {
    let loudest = 0;
    for (const guard of this.guards) loudest = Math.max(loudest, guard.detection);
    for (const camera of this.cameras) loudest = Math.max(loudest, camera.alarm);
    return loudest;
  }

  /** The current alarm level: calm, suspicious or alert. */
  alarmLevel() {
    if (this.guards.some((g) => g.state === GUARD_CHASE) || this.alarm >= 100) return 'alert';
    if (this.loudestDetection() >= VISION.suspiciousAt) return 'suspicious';
    return 'calm';
  }

  /** Throw a noise coin toward (tx,ty); guards come to hear it land. */
  throwCoin(tx, ty) {
    if (this.player.coins <= 0 || this.coinFlight) return false;
    const dx = tx - this.player.x;
    const dy = ty - this.player.y;
    const dist = Math.hypot(dx, dy);
    const range = Math.min(dist, NOISE.coinRange);
    const landX = this.player.x + (dist === 0 ? 0 : (dx / dist) * range);
    const landY = this.player.y + (dist === 0 ? 0 : (dy / dist) * range);
    this.player.coins -= 1;
    this.thrownCoins += 1;
    this.coinFlight = { x: this.player.x, y: this.player.y, tx: landX, ty: landY, t: 0, duration: 0.35 };
    return true;
  }

  /** A noise at (x,y) that reaches `radius`: nearby guards investigate it. */
  emitNoise(x, y, radius, kind) {
    this.noiseEvents.push({ x, y, radius, kind, age: 0 });
    for (const guard of this.guards) {
      if (guard.state === GUARD_CHASE) continue;
      if (Math.hypot(guard.x - x, guard.y - y) < radius) hearNoise(guard, x, y);
    }
  }

  /**
   * Step the simulation by `dt` seconds with the given input. Returns a bit
   * mask of events (EVENT_CAUGHT, EVENT_WIN, ...) that happened this step.
   */
  step(dt, input) {
    this.events = EVENT_NONE;
    if (this.over) return this.events;
    this.time += dt;
    this.elapsed += dt;

    const player = this.player;
    let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const moving = dx !== 0 || dy !== 0;
    player.moving = moving;
    player.running = Boolean(input.run) && moving && !input.sneak;
    player.sneaking = Boolean(input.sneak) && moving;
    if (moving) {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
      const speed = player.running ? PLAYER.runSpeed : player.sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
      player.facing = Math.atan2(dy, dx);
      const nx = player.x + dx * speed * dt;
      const ny = player.y + dy * speed * dt;
      if (!this.collide(nx, player.y, player.radius)) player.x = nx;
      if (!this.collide(player.x, ny, player.radius)) player.y = ny;
      // Running is loud: every few steps the guards hear where you are.
      this.runNoiseTimer += dt;
      if (player.running && this.runNoiseTimer > NOISE.runInterval) {
        this.runNoiseTimer = 0;
        this.emitNoise(player.x, player.y, NOISE.runRadius, 'steps');
      }
      this.footstepTimer += dt;
      const stride = player.running ? 0.22 : player.sneaking ? 0.5 : 0.32;
      if (this.footstepTimer > stride) {
        this.footstepTimer = 0;
        this.footstep = true;
      }
    } else {
      this.runNoiseTimer = 0;
    }
    player.inShadow = inShadow(player.x, player.y, this.parsed.shadows);

    // A coin in flight lands with a clink and draws the guards to it.
    if (this.coinFlight) {
      const flight = this.coinFlight;
      flight.t += dt;
      const k = Math.min(1, flight.t / flight.duration);
      flight.x = player.x + (flight.tx - player.x) * k;
      flight.y = player.y + (flight.ty - player.y) * k;
      if (k >= 1) {
        this.emitNoise(flight.tx, flight.ty, NOISE.coinRadius, 'coin');
        this.coinFlight = null;
        this.events |= EVENT_COIN;
      }
    }

    // Guards watch, think and move.
    for (const guard of this.guards) {
      const seen = visibilityTo(guard, player, this.parsed.blockers, this.parsed.shadows);
      const result = updateGuard(guard, dt, seen, player, (x, y, r) => this.collide(x, y, r), (kind) => {
        if (kind === 'alarm') this.events |= EVENT_ALARM;
      });
      if (result === 'caught') {
        this.over = true;
        this.won = false;
        this.caughtBy = guard;
        this.events |= EVENT_CAUGHT;
        return this.events;
      }
      if (guard.everSuspicious) this.everSuspicious = true;
      if (guard.everAlerted) this.everAlerted = true;
    }

    // Cameras sweep; a camera that fills its alarm raises the whole level.
    this.alarm = 0;
    for (const camera of this.cameras) {
      this.alarm = Math.max(this.alarm, updateCamera(camera, dt, player, this.parsed.blockers, this.parsed.shadows));
    }
    if (this.alarm >= 100 && !this.everAlerted) {
      this.everAlerted = true;
      this.events |= EVENT_ALARM;
      for (const guard of this.guards) {
        if (guard.state !== GUARD_CHASE) {
          guard.state = GUARD_CHASE;
          guard.stateTime = 0;
          guard.loseSight = 0;
          guard.everAlerted = true;
        }
      }
    }

    this.maxDetection = Math.max(this.maxDetection, this.loudestDetection());

    // Pickups: coins, relics and the Moonstone itself.
    for (const coin of this.coins) {
      if (!coin.taken && Math.hypot(coin.x - player.x, coin.y - player.y) < 26) {
        coin.taken = true;
        player.coins += 1;
        this.pickups += 1;
        this.events |= EVENT_PICKUP;
      }
    }
    for (const relic of this.relics) {
      if (!relic.taken && Math.hypot(relic.x - player.x, relic.y - player.y) < 26) {
        relic.taken = true;
        player.score += SCORES.relic;
        this.pickups += 1;
        this.events |= EVENT_PICKUP;
      }
    }
    if (!this.moonstone.taken && Math.hypot(this.moonstone.x - player.x, this.moonstone.y - player.y) < 28) {
      this.moonstone.taken = true;
      player.hasMoonstone = true;
      player.score += SCORES.moonstone;
      this.events |= EVENT_MOONSTONE;
    }

    // The exit only counts once the Moonstone is in hand.
    if (player.hasMoonstone && Math.hypot(this.exit.x - player.x, this.exit.y - player.y) < 30) {
      this.over = true;
      this.won = true;
      this.events |= EVENT_WIN;
      const timeBonus = Math.max(0, Math.round((300 - this.elapsed) * SCORES.timeBonusPerSecond));
      player.score += timeBonus;
      if (this.maxDetection < VISION.suspiciousAt) player.score += SCORES.ghostBonus;
      return this.events;
    }

    // Noise ripples fade.
    for (const noise of this.noiseEvents) noise.age += dt;
    this.noiseEvents = this.noiseEvents.filter((n) => n.age < 0.8);
    return this.events;
  }

  /** The win rating: Ghost (never even half-seen), Shadow (never chased), Seen. */
  rating() {
    if (!this.won) return null;
    if (this.maxDetection < VISION.suspiciousAt) return 'Ghost';
    if (!this.everAlerted) return 'Shadow';
    return 'Seen';
  }

  /** How many of the level's relics the thief has lifted. */
  relicsTaken() {
    return this.relics.filter((r) => r.taken).length;
  }
}

/** The fixed step the loop and the screenshot scenes share. */
export { STEP };
