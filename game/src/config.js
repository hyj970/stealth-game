// Every tuning number and colour in one place. The playfield is a fixed 1280x720
// logical area; the renderer scales it to the window, so no rule below depends on
// the screen size. Shadow Lantern is a top-down stealth game: slip past patrolling
// guards, stay out of their vision cones, steal the Moonstone and reach the exit.

export const TILE = 40;
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  walkSpeed: 168,
  runSpeed: 252,
  sneakSpeed: 88,
  coins: 3,
};

export const GUARD = {
  radius: 15,
  patrolSpeed: 76,
  investigateSpeed: 112,
  chaseSpeed: 168,
  /** Catch the player when a chasing guard gets this close, in pixels. */
  catchDistance: 26,
  /** How long a guard stares at a half-seen player before investigating. */
  suspiciousPause: 1.1,
  /** How long a guard looks around a searched spot before giving up. */
  searchPause: 2.0,
  /** Seconds of no sight before a chasing guard drops to a search. */
  loseSightTime: 3.5,
};

export const VISION = {
  /** How far a guard can see, in pixels. */
  range: 232,
  /** Half of a guard's cone angle, in radians. */
  halfAngle: 0.31,
  /** Detection per second at point blank, scaled down with distance. */
  rateClose: 58,
  rateFar: 16,
  /** Detection per second lost while the player is out of sight. */
  decay: 30,
  /** Detection at which a guard grows suspicious and investigates. */
  suspiciousAt: 35,
  /** Detection at which a guard raises the alarm and chases. */
  alertAt: 100,
  /** Standing in a shadow patch multiplies the detection rate by this. */
  shadowFactor: 0.45,
  /** Sneaking multiplies the detection rate by this. */
  sneakFactor: 0.45,
  /** Running multiplies the detection rate by this. */
  runFactor: 1.6,
};

export const CAMERA = {
  range: 215,
  halfAngle: 0.42,
  /** Detection per second a security camera adds to the global alarm. */
  rate: 42,
  /** Sweep speed, radians per second. */
  sweepSpeed: 0.55,
};

export const NOISE = {
  /** How far a running footstep carries, in pixels. */
  runRadius: 200,
  runInterval: 0.42,
  /** How far a thrown coin's clink carries. */
  coinRadius: 270,
  /** How far a thrown coin flies, in pixels. */
  coinRange: 330,
};

export const SCORES = { relic: 250, moonstone: 500, ghostBonus: 1000, timeBonusPerSecond: 5 };

export const PALETTE = {
  backdrop: '#0d0f16',
  floorA: '#232838',
  floorB: '#1e2333',
  floorLine: '#2b3044',
  shadow: '#12162a',
  lightPool: '#3a2f1d',
  wall: '#3d4257',
  wallTop: '#565d78',
  wallSide: '#2c3040',
  cabinet: '#4a3626',
  cabinetTop: '#6b4e33',
  cabinetTrim: '#c9a227',
  player: '#37d6b6',
  playerDark: '#1d8a76',
  guard: '#e5534b',
  guardDark: '#8f2f2a',
  guardCalm: '#e8b23a',
  coneCalm: 'rgba(232, 178, 58, 0.27)',
  coneSuspicious: 'rgba(232, 120, 40, 0.36)',
  coneAlert: 'rgba(229, 83, 75, 0.40)',
  coneCamera: 'rgba(120, 180, 255, 0.28)',
  moonstone: '#7fe7ff',
  relic: '#ffd76a',
  exit: '#58d68d',
  exitGlow: 'rgba(88, 214, 141, 0.30)',
  coin: '#f2c94c',
  panel: 'rgba(13, 15, 22, 0.82)',
  text: '#eef1f5',
  muted: '#9aa1b5',
  danger: '#ff6b61',
  gold: '#e8b23a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best rating is kept between visits (this browser only). */
export const BEST_KEY = 'shadow-lantern.best';
