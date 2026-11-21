// Guard and camera behaviour. A guard walks a patrol loop until something catches
// its eye, then works through: suspicious (pause and stare), investigate (walk to
// the spot it saw or heard), chase (run at the thief), search (sweep the last
// known area), and back to patrol. A camera sweeps its arc and feeds the alarm.

import { GUARD, CAMERA, VISION } from './config.js';
import { coneVisibility, hasLineOfSight, inShadow, wrapAngle } from './vision.js';

export const GUARD_PATROL = 'patrol';
export const GUARD_SUSPICIOUS = 'suspicious';
export const GUARD_INVESTIGATE = 'investigate';
export const GUARD_CHASE = 'chase';
export const GUARD_SEARCH = 'search';
export const GUARD_RETURN = 'return';

/** Build a guard from a patrol route given in tile coordinates. */
export function makeGuard(waypoints) {
  const points = waypoints.map(([tx, ty]) => ({ x: tx * 40 + 20, y: ty * 40 + 20 }));
  const start = points[0];
  return {
    x: start.x,
    y: start.y,
    angle: 0,
    state: GUARD_PATROL,
    waypointIndex: 1 % points.length,
    waypoints: points,
    detection: 0,
    stateTime: 0,
    loseSight: 0,
    investigateX: 0,
    investigateY: 0,
    searchIndex: 0,
    searchPoints: [],
    heardX: 0,
    heardY: 0,
    everAlerted: false,
    everSuspicious: false,
  };
}

/** Build a security camera from its level definition. */
export function makeCamera(def) {
  const [tx, ty] = def.tile;
  const x = tx * 40 + 20;
  const y = ty * 40 + 20;
  // Step out of the wall the camera is mounted in, toward the room it watches.
  const ox = Math.cos(def.baseAngle) * 18;
  const oy = Math.sin(def.baseAngle) * 18;
  return {
    x: x + ox,
    y: y + oy,
    baseAngle: def.baseAngle,
    sweep: def.sweep,
    angle: def.baseAngle - def.sweep,
    sweepDir: 1,
    alarm: 0,
  };
}

/** Move a walker toward (tx,ty) at `speed`, sliding along walls. Returns arrived. */
export function moveToward(body, tx, ty, speed, dt, collide) {
  const dx = tx - body.x;
  const dy = ty - body.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return true;
  const step = Math.min(dist, speed * dt);
  const nx = body.x + (dx / dist) * step;
  const ny = body.y + (dy / dist) * step;
  body.angle = Math.atan2(dy, dx);
  if (!collide(nx, body.y, body.radius)) body.x = nx;
  if (!collide(body.x, ny, body.radius)) body.y = ny;
  return Math.hypot(tx - body.x, ty - body.y) < 4;
}

/** Face a point smoothly, turning at most `turnRate` radians a second. */
export function turnToward(body, tx, ty, turnRate, dt) {
  const wanted = Math.atan2(ty - body.y, tx - body.x);
  const diff = wrapAngle(wanted - body.angle);
  const turn = Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
  body.angle += turn;
}

/**
 * One guard's tick. `seen` says how well it sees the thief right now (0 to 1)
 * and `player` is the thief's body. Returns 'caught' when it grabs the thief.
 */
export function updateGuard(guard, dt, seen, player, collide, onNoise) {
  guard.stateTime += dt;
  const wasAlerted = guard.state === GUARD_CHASE;

  // Detection rises while the thief is in the cone and falls away out of sight.
  if (seen > 0) {
    const rate = VISION.rateFar + (VISION.rateClose - VISION.rateFar) * seen;
    guard.detection = Math.min(100, guard.detection + rate * dt);
    guard.loseSight = 0;
  } else {
    guard.detection = Math.max(0, guard.detection - VISION.decay * dt);
    guard.loseSight += dt;
  }

  if (guard.detection >= VISION.alertAt && guard.state !== GUARD_CHASE) {
    guard.state = GUARD_CHASE;
    guard.stateTime = 0;
    guard.loseSight = 0;
    guard.everAlerted = true;
    onNoise('alarm');
  } else if (
    guard.detection >= VISION.suspiciousAt &&
    (guard.state === GUARD_PATROL || guard.state === GUARD_RETURN)
  ) {
    guard.state = GUARD_SUSPICIOUS;
    guard.stateTime = 0;
    guard.everSuspicious = true;
    guard.investigateX = player.x;
    guard.investigateY = player.y;
  }

  switch (guard.state) {
    case GUARD_PATROL: {
      const target = guard.waypoints[guard.waypointIndex];
      if (moveToward(guard, target.x, target.y, GUARD.patrolSpeed, dt, collide)) {
        guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
      }
      break;
    }
    case GUARD_SUSPICIOUS: {
      turnToward(guard, guard.investigateX, guard.investigateY, 4, dt);
      if (guard.detection < VISION.suspiciousAt * 0.5 && guard.stateTime > GUARD.suspiciousPause) {
        guard.state = GUARD_PATROL;
        guard.stateTime = 0;
      } else if (guard.stateTime > GUARD.suspiciousPause) {
        guard.state = GUARD_INVESTIGATE;
        guard.stateTime = 0;
      }
      break;
    }
    case GUARD_INVESTIGATE: {
      if (moveToward(guard, guard.investigateX, guard.investigateY, GUARD.investigateSpeed, dt, collide)) {
        guard.state = GUARD_SEARCH;
        guard.stateTime = 0;
        guard.searchIndex = 0;
        guard.searchPoints = [
          { x: guard.investigateX - 70, y: guard.investigateY },
          { x: guard.investigateX + 70, y: guard.investigateY },
          { x: guard.investigateX, y: guard.investigateY - 70 },
          { x: guard.investigateX, y: guard.investigateY + 70 },
        ];
      }
      break;
    }
    case GUARD_CHASE: {
      moveToward(guard, player.x, player.y, GUARD.chaseSpeed, dt, collide);
      if (Math.hypot(player.x - guard.x, player.y - guard.y) < GUARD.catchDistance) return 'caught';
      if (guard.loseSight > GUARD.loseSightTime) {
        guard.state = GUARD_SEARCH;
        guard.stateTime = 0;
        guard.searchIndex = 0;
        guard.investigateX = player.x;
        guard.investigateY = player.y;
        guard.searchPoints = [
          { x: player.x - 80, y: player.y },
          { x: player.x + 80, y: player.y },
          { x: player.x, y: player.y - 80 },
          { x: player.x, y: player.y + 80 },
        ];
      }
      break;
    }
    case GUARD_SEARCH: {
      const point = guard.searchPoints[guard.searchIndex % guard.searchPoints.length];
      if (point && moveToward(guard, point.x, point.y, GUARD.investigateSpeed, dt, collide)) {
        guard.searchIndex += 1;
        guard.stateTime = 0;
      }
      if (guard.searchIndex >= guard.searchPoints.length || guard.stateTime > GUARD.searchPause * 4) {
        guard.state = GUARD_RETURN;
        guard.stateTime = 0;
      }
      break;
    }
    case GUARD_RETURN: {
      // Walk back to the nearest patrol waypoint, then resume the loop.
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < guard.waypoints.length; i += 1) {
        const d = Math.hypot(guard.waypoints[i].x - guard.x, guard.waypoints[i].y - guard.y);
        if (d < bestDist) { bestDist = d; best = i; }
      }
      const target = guard.waypoints[best];
      if (moveToward(guard, target.x, target.y, GUARD.patrolSpeed, dt, collide)) {
        guard.waypointIndex = (best + 1) % guard.waypoints.length;
        guard.state = GUARD_PATROL;
        guard.stateTime = 0;
      }
      break;
    }
    default:
      break;
  }

  // A guard that calmed down on its own patrols again.
  if (!wasAlerted && guard.state !== GUARD_CHASE && guard.detection <= 0 && guard.state === GUARD_SUSPICIOUS) {
    guard.state = GUARD_PATROL;
  }
  return null;
}

/** Send a guard to investigate a noise at (x, y). */
export function hearNoise(guard, x, y) {
  if (guard.state === GUARD_CHASE) return;
  guard.heardX = x;
  guard.heardY = y;
  guard.investigateX = x;
  guard.investigateY = y;
  guard.state = GUARD_INVESTIGATE;
  guard.stateTime = 0;
  guard.everSuspicious = true;
}

/** One camera's tick. Returns how much alarm it adds this tick. */
export function updateCamera(camera, dt, player, blockers, shadows) {
  camera.angle += camera.sweepDir * CAMERA.sweepSpeed * dt;
  if (camera.angle > camera.baseAngle + camera.sweep) {
    camera.angle = camera.baseAngle + camera.sweep;
    camera.sweepDir = -1;
  } else if (camera.angle < camera.baseAngle - camera.sweep) {
    camera.angle = camera.baseAngle - camera.sweep;
    camera.sweepDir = 1;
  }
  const seen = coneVisibility(
    camera.x, camera.y, camera.angle, CAMERA.range, CAMERA.halfAngle,
    player.x, player.y, blockers,
  );
  if (seen > 0) {
    let rate = CAMERA.rate * seen;
    if (inShadow(player.x, player.y, shadows)) rate *= VISION.shadowFactor;
    if (player.sneaking) rate *= VISION.sneakFactor;
    camera.alarm = Math.min(100, camera.alarm + rate * dt);
  } else {
    camera.alarm = Math.max(0, camera.alarm - VISION.decay * dt);
  }
  return camera.alarm;
}

/** How visible the thief is to one watcher right now, before state changes. */
export function visibilityTo(watcher, player, blockers, shadows) {
  const seen = coneVisibility(
    watcher.x, watcher.y, watcher.angle, VISION.range, VISION.halfAngle,
    player.x, player.y, blockers,
  );
  if (seen <= 0) return 0;
  let factor = 1;
  if (inShadow(player.x, player.y, shadows)) factor *= VISION.shadowFactor;
  if (player.sneaking) factor *= VISION.sneakFactor;
  if (player.running) factor *= VISION.runFactor;
  return seen * factor;
}

/** True when a straight walk from (x1,y1) to (x2,y2) crosses no blocker. */
export function clearPath(x1, y1, x2, y2, blockers) {
  return hasLineOfSight(x1, y1, x2, y2, blockers);
}
