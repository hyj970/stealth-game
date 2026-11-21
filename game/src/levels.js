// The levels. Each map is 32 by 18 tiles of 40 pixels, drawn as text:
//   #  wall (blocks movement and sight)
//   C  display cabinet (cover: blocks movement and sight)
//   s  shadow patch (dark floor: guards spot you slower here)
//   .  open floor
//   P  where the thief starts
//   M  the Moonstone, the prize of the level
//   R  a small relic, optional loot worth points
//   o  a spare noise coin to pick up
//   E  the exit (only opens once the Moonstone is taken)
//   1-5  a guard's starting tile; its patrol waypoints are listed below in tiles.

export const LEVELS = [
  {
    name: 'The Quiet Gallery',
    intro: 'Lift the Moonstone from the east wing and slip out the south door unseen.',
    map: [
      '################################',
      '#.......#.......#.......#..ss..#',
      '#.......#.......#...........M..#',
      '#..C............#..C....#......#',
      '#.......#....C..#.......#ss....#',
      '#.......#.1.........2...#......#',
      '#...C...#.......#.C.....#..C...#',
      '####.#######.#######.#######.###',
      '#.......#..C............#..C...#',
      '#.3.....#....C..#...C...#......#',
      '#...............#.ss....#...C..#',
      '#.......#.....C.#.....C.#......#',
      '#.......#.C.....#.........ss...#',
      '####.#######.#######.#######.###',
      '#..C....#............C..#......#',
      '#.P.............#.......#....E.#',
      '#.....C.#...C...#..ss..........#',
      '################################',
    ],
    guards: [
      { waypoints: [[10, 2], [14, 2], [14, 5], [10, 5]] },
      { waypoints: [[18, 2], [22, 2], [22, 5], [18, 5]] },
      { waypoints: [[2, 9], [6, 9], [6, 11], [2, 11]] },
    ],
    cameras: [],
    coins: [[12, 10], [26, 15]],
    relics: [[5, 2], [27, 10]],
  },
  {
    name: 'The Vault Wing',
    intro: 'Cameras watch the vault now. Mind the sweeping lenses as well as the boots.',
    map: [
      '################################',
      '#..M....#.......#.......#......#',
      '#.......#..C....#...C....C.....#',
      '#..C............#.......#......#',
      '#.......#....C..#..C....#..C...#',
      '#...1...#...............#...2..#',
      '#.......#..C....#...C...#......#',
      '####.#######.#######.#######.###',
      '#.......#...............#......#',
      '#..C....#..C....#..C....#..C...#',
      '#...............#....3..#......#',
      '#...C...#.......#.......#..C...#',
      '#.......#..C....#..C...........#',
      '####.#######.#######.#######.###',
      '#.......#...............#......#',
      '#..C.......C....#...4...#..C.P.#',
      '#..E....#.......#..............#',
      '################################',
    ],
    guards: [
      { waypoints: [[4, 5], [6, 5], [6, 2], [4, 2]] },
      { waypoints: [[26, 5], [29, 5], [29, 2], [26, 2]] },
      { waypoints: [[20, 10], [23, 10], [23, 8], [20, 8]] },
      { waypoints: [[19, 15], [22, 15], [22, 14], [19, 14]] },
    ],
    cameras: [
      // Mounted on the row-7 wall above an open column, sweeping the middle band.
      { tile: [5, 7], baseAngle: Math.PI / 2, sweep: 0.7 },
      // Mounted on the row-13 wall above an open column, sweeping the bottom band.
      { tile: [21, 13], baseAngle: Math.PI / 2, sweep: 0.7 },
    ],
    coins: [[13, 9], [10, 15]],
    relics: [[28, 3], [6, 11]],
  },
];

/** Tiles that block movement and sight. */
export function isBlocker(ch) {
  return ch === '#' || ch === 'C';
}

/** Tiles the thief and the guards can stand on. */
export function isWalkable(ch) {
  return ch !== '#' && ch !== 'C';
}

/**
 * Turn a level's text map into the pieces the world and renderer need: the
 * blocker rectangles, shadow patches, spawn points, pickups and the exit.
 */
export function parseLevel(level) {
  const blockers = [];
  const shadows = [];
  let player = null;
  let moonstone = null;
  let exit = null;
  const coins = [];
  const relics = [];
  const guardStarts = [];
  for (let row = 0; row < level.map.length; row += 1) {
    const line = level.map[row];
    for (let col = 0; col < line.length; col += 1) {
      const ch = line[col];
      const x = col * 40;
      const y = row * 40;
      if (ch === '#' || ch === 'C') blockers.push({ x, y, w: 40, h: 40, kind: ch === '#' ? 'wall' : 'cabinet' });
      else if (ch === 's') shadows.push({ x, y, w: 40, h: 40 });
      else if (ch === 'P') player = { x: x + 20, y: y + 20 };
      else if (ch === 'M') moonstone = { x: x + 20, y: y + 20 };
      else if (ch === 'E') exit = { x: x + 20, y: y + 20 };
      else if (ch === 'o') coins.push({ x: x + 20, y: y + 20 });
      else if (ch === 'R') relics.push({ x: x + 20, y: y + 20 });
      else if (ch >= '1' && ch <= '9') guardStarts.push({ x: x + 20, y: y + 20 });
    }
  }
  for (const [tx, ty] of level.coins) coins.push({ x: tx * 40 + 20, y: ty * 40 + 20 });
  for (const [tx, ty] of level.relics) relics.push({ x: tx * 40 + 20, y: ty * 40 + 20 });
  return { blockers, shadows, player, moonstone, exit, coins, relics, guardStarts };
}

/** The tile character at a pixel position, or '#' outside the map. */
export function tileAt(level, px, py) {
  const col = Math.floor(px / 40);
  const row = Math.floor(py / 40);
  if (row < 0 || row >= level.map.length || col < 0 || col >= level.map[0].length) return '#';
  return level.map[row][col];
}
