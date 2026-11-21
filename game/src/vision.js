// Line of sight and vision cones: what a guard (or a camera) can actually see.
// Blockers are the wall and cabinet rectangles from the level; sight never passes
// through one. Angles wrap, so every comparison normalises to (-PI, PI].

/** Normalise an angle to (-PI, PI]. */
export function wrapAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle <= -Math.PI) angle += Math.PI * 2;
  return angle;
}

/** True when segment (x1,y1)-(x2,y2) touches rectangle r. */
export function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tMin = 0;
  let tMax = 1;
  if (dx === 0) {
    if (x1 < r.x || x1 > r.x + r.w) return false;
  } else {
    let t1 = (r.x - x1) / dx;
    let t2 = (r.x + r.w - x1) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  if (dy === 0) {
    if (y1 < r.y || y1 > r.y + r.h) return false;
  } else {
    let t1 = (r.y - y1) / dy;
    let t2 = (r.y + r.h - y1) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  return true;
}

/**
 * True when nothing blocks the view from (x1,y1) to (x2,y2). A blocker that
 * contains the viewer itself (a camera mounted in a wall) never blocks.
 */
export function hasLineOfSight(x1, y1, x2, y2, blockers) {
  for (let i = 0; i < blockers.length; i += 1) {
    const r = blockers[i];
    if (x1 > r.x && x1 < r.x + r.w && y1 > r.y && y1 < r.y + r.h) continue;
    if (x2 > r.x && x2 < r.x + r.w && y2 > r.y && y2 < r.y + r.h) continue;
    if (segmentHitsRect(x1, y1, x2, y2, r)) return false;
  }
  return true;
}

/**
 * How well a watcher at (x,y) facing `angle` sees a point (tx,ty): 0 when the
 * point is out of range, outside the cone or behind cover, otherwise 1 at
 * point blank falling to 0 at the edge of the range.
 */
export function coneVisibility(x, y, angle, range, halfAngle, tx, ty, blockers) {
  const dx = tx - x;
  const dy = ty - y;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return 0;
  if (dist > 1 && Math.abs(wrapAngle(Math.atan2(dy, dx) - angle)) > halfAngle) return 0;
  if (!hasLineOfSight(x, y, tx, ty, blockers)) return 0;
  return 1 - (dist / range) * 0.75;
}

/** True when a point stands inside one of the level's shadow patches. */
export function inShadow(x, y, shadows) {
  for (let i = 0; i < shadows.length; i += 1) {
    const s = shadows[i];
    if (x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h) return true;
  }
  return false;
}
