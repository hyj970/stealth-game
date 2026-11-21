// Everything the player sees: the gallery floor, walls and cabinets, the guards
// and their vision cones, the thief's lantern glow, the HUD, and the title, win
// and caught screens. All drawing is canvas 2D, in the 1280x720 logical field.

import { FIELD, PALETTE, TILE, VISION } from './config.js';
import { GUARD_CHASE, GUARD_INVESTIGATE, GUARD_SEARCH, GUARD_SUSPICIOUS } from './guards.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_WIN = 'win';
export const SCREEN_LOSE = 'lose';
export const SCREEN_PAUSE = 'pause';

/** Build a renderer for a canvas; `random` seeds the floor speckle. */
export function makeRenderer(canvas, random) {
  const ctx = canvas.getContext('2d');
  const floor = document.createElement('canvas');
  floor.width = FIELD.width;
  floor.height = FIELD.height;
  paintFloor(floor.getContext('2d'), random);

  /** The checkerboard floor with a little wear, painted once per level. */
  function paintFloor(g) {
    g.fillStyle = PALETTE.floorA;
    g.fillRect(0, 0, FIELD.width, FIELD.height);
    for (let row = 0; row < FIELD.height / TILE; row += 1) {
      for (let col = 0; col < FIELD.width / TILE; col += 1) {
        if ((row + col) % 2 === 0) {
          g.fillStyle = PALETTE.floorB;
          g.fillRect(col * TILE, row * TILE, TILE, TILE);
        }
        g.strokeStyle = PALETTE.floorLine;
        g.lineWidth = 1;
        g.strokeRect(col * TILE + 0.5, row * TILE + 0.5, TILE, TILE);
      }
    }
    // Wear and dust: a few hundred faint speckles, seeded so they never move.
    for (let i = 0; i < 500; i += 1) {
      const x = random() * FIELD.width;
      const y = random() * FIELD.height;
      g.fillStyle = random() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.08)';
      g.fillRect(x, y, 2 + random() * 3, 2 + random() * 3);
    }
  }

  function coneColor(guard) {
    if (guard.state === GUARD_CHASE) return PALETTE.coneAlert;
    if (guard.state === GUARD_SUSPICIOUS || guard.state === GUARD_INVESTIGATE || guard.state === GUARD_SEARCH) {
      return PALETTE.coneSuspicious;
    }
    return PALETTE.coneCalm;
  }

  function drawCone(x, y, angle, range, halfAngle, color) {
    const gradient = ctx.createRadialGradient(x, y, 10, x, y, range);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, range, angle - halfAngle, angle + halfAngle);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = color.replace(/[\d.]+\)$/, '0.55)');
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle - halfAngle) * range, y + Math.sin(angle - halfAngle) * range);
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle + halfAngle) * range, y + Math.sin(angle + halfAngle) * range);
    ctx.stroke();
  }

  function drawGuard(guard) {
    drawCone(guard.x, guard.y, guard.angle, VISION.range, VISION.halfAngle, coneColor(guard));
    // Body: a patrolling watchman in a dark red coat and cap.
    ctx.fillStyle = PALETTE.guardDark;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.guard;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 13, 0, Math.PI * 2);
    ctx.fill();
    // Cap brim points where the guard is looking.
    ctx.fillStyle = PALETTE.guardDark;
    ctx.beginPath();
    ctx.arc(
      guard.x + Math.cos(guard.angle) * 9, guard.y + Math.sin(guard.angle) * 9,
      6, 0, Math.PI * 2,
    );
    ctx.fill();
    ctx.fillStyle = '#f5d7a1';
    ctx.beginPath();
    ctx.arc(guard.x + Math.cos(guard.angle) * 5, guard.y + Math.sin(guard.angle) * 5, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // A rising detection ring while the guard is on to you.
    if (guard.detection > 2) {
      ctx.strokeStyle = guard.detection >= VISION.suspiciousAt ? PALETTE.danger : PALETTE.guardCalm;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, 21, -Math.PI / 2, -Math.PI / 2 + (guard.detection / 100) * Math.PI * 2);
      ctx.stroke();
    }
    // "?" while suspicious, "!" while chasing.
    if (guard.state === GUARD_SUSPICIOUS || guard.state === GUARD_INVESTIGATE || guard.state === GUARD_SEARCH) {
      drawMark(guard.x, guard.y - 32, '?', PALETTE.guardCalm);
    } else if (guard.state === GUARD_CHASE) {
      drawMark(guard.x, guard.y - 32, '!', PALETTE.danger);
    }
  }

  function drawMark(x, y, text, color) {
    ctx.font = 'bold 26px ' + 'system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function drawCamera(camera) {
    drawCone(camera.x, camera.y, camera.angle, 215, 0.42, PALETTE.coneCamera);
    ctx.fillStyle = '#1c2b44';
    ctx.beginPath();
    ctx.arc(camera.x, camera.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7fb4ff';
    ctx.beginPath();
    ctx.arc(camera.x + Math.cos(camera.angle) * 6, camera.y + Math.sin(camera.angle) * 6, 4, 0, Math.PI * 2);
    ctx.fill();
    if (camera.alarm > 2) {
      ctx.strokeStyle = PALETTE.danger;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(camera.x, camera.y, 16, -Math.PI / 2, -Math.PI / 2 + (camera.alarm / 100) * Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawPlayer(player) {
    // The thief's lantern throws a soft pool of light around them.
    const glow = ctx.createRadialGradient(player.x, player.y, 4, player.x, player.y, 90);
    glow.addColorStop(0, 'rgba(255, 214, 130, 0.20)');
    glow.addColorStop(1, 'rgba(255, 214, 130, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 90, 0, Math.PI * 2);
    ctx.fill();
    // Hooded cloak, leaning the way they move.
    ctx.fillStyle = PALETTE.playerDark;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.moveTo(player.x + Math.cos(player.facing) * 16, player.y + Math.sin(player.facing) * 16);
    ctx.lineTo(
      player.x + Math.cos(player.facing + 2.4) * 12, player.y + Math.sin(player.facing + 2.4) * 12,
    );
    ctx.lineTo(
      player.x + Math.cos(player.facing - 2.4) * 12, player.y + Math.sin(player.facing - 2.4) * 12,
    );
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0d0f16';
    ctx.beginPath();
    ctx.arc(player.x + Math.cos(player.facing) * 4, player.y + Math.sin(player.facing) * 4, 5, 0, Math.PI * 2);
    ctx.fill();
    if (player.sneaking) {
      ctx.strokeStyle = 'rgba(55, 214, 182, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 20, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawGem(x, y, radius, color, pulse) {
    const glow = ctx.createRadialGradient(x, y, 2, x, y, radius * 3);
    glow.addColorStop(0, color);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.globalAlpha = 0.35 + pulse * 0.15;
    ctx.beginPath();
    ctx.arc(x, y, radius * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - radius);
    ctx.lineTo(x + radius * 0.7, y);
    ctx.lineTo(x, y + radius);
    ctx.lineTo(x - radius * 0.7, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.moveTo(x, y - radius * 0.55);
    ctx.lineTo(x + radius * 0.3, y - radius * 0.1);
    ctx.lineTo(x, y + radius * 0.2);
    ctx.lineTo(x - radius * 0.3, y - radius * 0.1);
    ctx.closePath();
    ctx.fill();
  }

  function drawHud(world, ui) {
    const level = world.level;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(0, 0, FIELD.width, 52);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 52.5);
    ctx.lineTo(FIELD.width, 52.5);
    ctx.stroke();

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText(level.name, 16, 18);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '14px system-ui, sans-serif';
    const objective = world.player.hasMoonstone
      ? 'Moonstone taken — reach the green exit'
      : 'Steal the Moonstone, then reach the exit';
    ctx.fillText(objective, 16, 39);

    // Alarm badge and the loudest detection meter.
    const alarm = world.alarmLevel();
    const badgeColor = alarm === 'alert' ? PALETTE.danger : alarm === 'suspicious' ? PALETTE.gold : PALETTE.muted;
    const badgeText = alarm === 'alert' ? 'ALERT' : alarm === 'suspicious' ? 'SUSPICIOUS' : 'UNSEEN';
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillStyle = badgeColor;
    ctx.fillText(badgeText, 640, 18);
    const detection = Math.round(world.loudestDetection());
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(560, 30, 160, 8);
    ctx.fillStyle = detection >= 35 ? PALETTE.danger : PALETTE.gold;
    ctx.fillRect(560, 30, (160 * detection) / 100, 8);

    // Right side: coins, score, time.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.text;
    ctx.font = '15px system-ui, sans-serif';
    const minutes = Math.floor(world.elapsed / 60);
    const seconds = Math.floor(world.elapsed % 60).toString().padStart(2, '0');
    ctx.fillText(`Coins ${world.player.coins}   Score ${world.player.score}   ${minutes}:${seconds}`, 1264, 18);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '13px system-ui, sans-serif';
    const loot = `Relics ${world.relicsTaken()}/${world.relics.length}   ${world.player.hasMoonstone ? '◆ Moonstone' : '◇ Moonstone'}`;
    ctx.fillText(loot, 1264, 39);

    // Bottom hint line.
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(238,241,245,0.75)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(
      'WASD / arrows move · Shift run (loud) · C sneak · Click throw a coin · P pause · M mute',
      16, FIELD.height - 14,
    );
    if (world.player.inShadow) {
      ctx.textAlign = 'right';
      ctx.fillStyle = PALETTE.player;
      ctx.fillText('Hidden in shadow — guards spot you slower', FIELD.width - 16, FIELD.height - 14);
    }

    // A banner for big moments (Moonstone taken, alarm raised).
    if (ui.banner && ui.bannerUntil > ui.now) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(13,15,22,0.75)';
      const w = ctx.measureText(ui.banner).width + 36;
      ctx.fillRect((FIELD.width - w) / 2, 66, w, 40);
      ctx.fillStyle = PALETTE.gold;
      ctx.fillText(ui.banner, FIELD.width / 2, 87);
    }
  }

  function drawTitle(world, ui) {
    ctx.fillStyle = 'rgba(10, 11, 18, 0.88)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 64px Georgia, serif';
    ctx.fillText('SHADOW LANTERN', FIELD.width / 2, 190);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('A quiet heist in two galleries', FIELD.width / 2, 235);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('Slip past the patrols. Stay out of the cones. Lift the Moonstone.', FIELD.width / 2, 268);
    ctx.fillText('Reach the green exit unseen — and mind the cameras in the Vault Wing.', FIELD.width / 2, 294);

    ctx.fillStyle = PALETTE.text;
    ctx.font = '16px system-ui, sans-serif';
    const lines = [
      'WASD / arrows — move        Shift — run (fast, loud)',
      'C — sneak (slow, quiet)     Click — throw a noise coin to lure a guard',
      'Hide in the dark patches. A "?" means a guard is getting curious; a "!" means run.',
    ];
    lines.forEach((line, i) => ctx.fillText(line, FIELD.width / 2, 360 + i * 28));
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(world.levelIndex === 0 ? 'Level 1 — The Quiet Gallery' : 'Level 2 — The Vault Wing', FIELD.width / 2, 470);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('Press Enter or click to begin', FIELD.width / 2, 510);
    if (ui.best) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '15px system-ui, sans-serif';
      ctx.fillText(`Best rating so far: ${ui.best}`, FIELD.width / 2, 545);
    }
  }

  function drawEnd(world, ui, won) {
    ctx.fillStyle = 'rgba(10, 11, 18, 0.82)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    if (won) {
      ctx.fillStyle = PALETTE.exit;
      ctx.font = 'bold 56px Georgia, serif';
      ctx.fillText('CLEAN GETAWAY', FIELD.width / 2, 200);
      const rating = world.rating();
      ctx.fillStyle = PALETTE.gold;
      ctx.font = 'bold 30px system-ui, sans-serif';
      ctx.fillText(`Rating: ${rating}`, FIELD.width / 2, 255);
      ctx.fillStyle = PALETTE.text;
      ctx.font = '18px system-ui, sans-serif';
      const minutes = Math.floor(world.elapsed / 60);
      const seconds = Math.floor(world.elapsed % 60).toString().padStart(2, '0');
      ctx.fillText(`Time ${minutes}:${seconds}   Score ${world.player.score}   Relics ${world.relicsTaken()}/${world.relics.length}`, FIELD.width / 2, 300);
      ctx.fillText(
        rating === 'Ghost'
          ? 'Not a single guard ever grew suspicious. A perfect shadow.'
          : rating === 'Shadow'
            ? 'Spotted, but never chased. The gallery never knew you were there.'
            : 'You were seen — but you still slipped away with the stone.',
        FIELD.width / 2, 335,
      );
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '17px system-ui, sans-serif';
      ctx.fillText(
        world.levelIndex + 1 < 2 ? 'Press R for the next gallery — the Vault Wing' : 'Press R to play again, or Enter to replay this gallery',
        FIELD.width / 2, 400,
      );
    } else {
      ctx.fillStyle = PALETTE.danger;
      ctx.font = 'bold 56px Georgia, serif';
      ctx.fillText('CAUGHT!', FIELD.width / 2, 200);
      ctx.fillStyle = PALETTE.text;
      ctx.font = '18px system-ui, sans-serif';
      ctx.fillText('A guard grabbed you under the lamplight. The Moonstone stays put.', FIELD.width / 2, 255);
      ctx.fillText(`You lasted ${Math.floor(world.elapsed)} seconds.`, FIELD.width / 2, 290);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '17px system-ui, sans-serif';
      ctx.fillText('Press R to try again — learn the patrol, then move between the cones.', FIELD.width / 2, 350);
    }
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText('R — restart    Enter — replay this level', FIELD.width / 2, 450);
  }

  function drawPause() {
    ctx.fillStyle = 'rgba(10, 11, 18, 0.7)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 40px Georgia, serif';
    ctx.fillText('Paused', FIELD.width / 2, 330);
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText('Press P or Escape to keep sneaking', FIELD.width / 2, 375);
  }

  return {
    /** Draw one frame. `screen` is one of the SCREEN_* constants. */
    draw(world, screen, ui) {
      ctx.clearRect(0, 0, FIELD.width, FIELD.height);
      ctx.drawImage(floor, 0, 0);

      // Warm pools of light over the prizes and the exit.
      const pulse = 0.5 + 0.5 * Math.sin(ui.now * 2);
      for (const spot of [world.moonstone, world.exit]) {
        const glow = ctx.createRadialGradient(spot.x, spot.y, 4, spot.x, spot.y, 130);
        glow.addColorStop(0, 'rgba(255, 210, 120, 0.14)');
        glow.addColorStop(1, 'rgba(255, 210, 120, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(spot.x, spot.y, 130, 0, Math.PI * 2);
        ctx.fill();
      }

      // Shadow patches: darker floor where the guards spot you slower.
      for (const s of world.parsed.shadows) {
        ctx.fillStyle = 'rgba(8, 10, 24, 0.55)';
        ctx.fillRect(s.x, s.y, s.w, s.h);
        ctx.strokeStyle = 'rgba(120, 150, 220, 0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(s.x + 0.5, s.y + 0.5, s.w, s.h);
      }

      // Walls and cabinets, drawn over the cones so sight stops at them.
      for (const b of world.parsed.blockers) {
        if (b.kind === 'wall') {
          ctx.fillStyle = PALETTE.wallSide;
          ctx.fillRect(b.x, b.y, b.w, b.h);
          ctx.fillStyle = PALETTE.wall;
          ctx.fillRect(b.x, b.y, b.w, b.h - 4);
          ctx.fillStyle = PALETTE.wallTop;
          ctx.fillRect(b.x, b.y, b.w, 4);
        } else {
          ctx.fillStyle = PALETTE.cabinet;
          ctx.fillRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6);
          ctx.fillStyle = PALETTE.cabinetTop;
          ctx.fillRect(b.x + 3, b.y + 3, b.w - 6, 8);
          ctx.strokeStyle = PALETTE.cabinetTrim;
          ctx.lineWidth = 2;
          ctx.strokeRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
          ctx.fillStyle = 'rgba(255, 215, 106, 0.5)';
          ctx.fillRect(b.x + b.w / 2 - 1, b.y + 8, 2, b.h - 16);
        }
      }

      // The exit: a green doorway that opens once the Moonstone is taken.
      const exit = world.exit;
      ctx.fillStyle = world.player.hasMoonstone ? PALETTE.exitGlow : 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.arc(exit.x, exit.y, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = world.player.hasMoonstone ? PALETTE.exit : PALETTE.muted;
      ctx.lineWidth = 3;
      ctx.strokeRect(exit.x - 16, exit.y - 16, 32, 32);
      ctx.fillStyle = world.player.hasMoonstone ? PALETTE.exit : PALETTE.muted;
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('EXIT', exit.x, exit.y);

      // Loot.
      if (!world.moonstone.taken) drawGem(world.moonstone.x, world.moonstone.y, 11, PALETTE.moonstone, pulse);
      for (const relic of world.relics) {
        if (!relic.taken) drawGem(relic.x, relic.y, 7, PALETTE.relic, pulse);
      }
      for (const coin of world.coins) {
        if (coin.taken) continue;
        ctx.fillStyle = PALETTE.coin;
        ctx.beginPath();
        ctx.arc(coin.x, coin.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#8a6d1f';
        ctx.font = 'bold 8px system-ui, sans-serif';
        ctx.fillText('¢', coin.x, coin.y + 0.5);
      }

      // Noise ripples and the coin in flight.
      for (const noise of world.noiseEvents) {
        ctx.strokeStyle = `rgba(242, 201, 76, ${0.7 * (1 - noise.age / 0.8)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(noise.x, noise.y, 10 + noise.age * 120, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (world.coinFlight) {
        ctx.fillStyle = PALETTE.coin;
        ctx.beginPath();
        ctx.arc(world.coinFlight.x, world.coinFlight.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Guards and cameras (their cones are drawn with them), then the thief.
      for (const camera of world.cameras) drawCamera(camera);
      for (const guard of world.guards) drawGuard(guard);
      drawPlayer(world.player);

      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSE) drawHud(world, ui);
      if (screen === SCREEN_TITLE) drawTitle(world, ui);
      if (screen === SCREEN_WIN) drawEnd(world, ui, true);
      if (screen === SCREEN_LOSE) drawEnd(world, ui, false);
      if (screen === SCREEN_PAUSE) drawPause();
    },
  };
}
