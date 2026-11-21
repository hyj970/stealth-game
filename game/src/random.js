// A tiny seeded random generator (mulberry32) so a screenshot scene staged from a
// seed always plays out the same way, and so the game never needs Math.random.

/** Make a generator that returns a float in [0, 1) from the given integer seed. */
export function makeRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick an integer in [min, max] from a generator. */
export function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

/** Pick one item from a list with a generator. */
export function randomPick(random, list) {
  return list[Math.floor(random() * list.length)];
}
