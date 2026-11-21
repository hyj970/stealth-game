// Shadow Lantern's hand-in program (Node 22, standard library only). The game is
// this directory's game/ folder: plain static files a desktop browser loads offline
// (game/index.html and its ES modules, no library and no network request). This
// program copies game/ and screenshots/ from beside this file to /output and
// writes /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library. Run it locally as:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output; inside it, the
// program writes to /output itself. Two runs over the same repository write the
// same bytes: the copy is a plain file copy and the dossier is built from the
// files as they stand, so nothing in here depends on the clock or the machine.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  if (existsSync(from)) cpSync(from, to, { recursive: true });
}

mkdirSync(outDir, { recursive: true });
copyTree(join(repoRoot, 'game'), join(outDir, 'game'));
copyTree(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'));

// The scorer's own caps: only text_max_bytes shapes the bytes; the others refuse
// an entry the scorer would refuse (more than 4 screenshots or one over 256 KiB;
// more than 993 files in game/ or 48 MiB of game files in all, or a path under
// game/ over 1000 bytes; game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
