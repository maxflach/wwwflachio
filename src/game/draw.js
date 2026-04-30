// All canvas drawing for the game world: traces, every solid type, decorative
// props, the floppy disks, the player sprite, and the in-game HUD overlay.

import {
  VIEW_W, VIEW_H,
  TRACE_COLOR, TRACE_PAD, TRACE_PATHS, TRACE_META,
  pointAlong,
} from "./world";

// ===== TRACES =====
export function drawTraces(ctx, t) {
  // Wires
  ctx.fillStyle = TRACE_COLOR;
  for (const path of TRACE_PATHS) {
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1];
      if (a.x === b.x) {
        ctx.fillRect(a.x - 1, Math.min(a.y, b.y), 2, Math.abs(b.y - a.y));
      } else {
        ctx.fillRect(Math.min(a.x, b.x), a.y - 1, Math.abs(b.x - a.x), 2);
      }
    }
  }
  // Junction pads
  ctx.fillStyle = TRACE_PAD;
  for (const path of TRACE_PATHS) {
    for (const pt of path) {
      ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
    }
  }
  // Animated data packets
  for (let i = 0; i < TRACE_PATHS.length; i++) {
    const meta = TRACE_META[i];
    const speed = 30 + i * 7;
    const dist = (t * speed * 0.2) % meta.total;
    const p = pointAlong(meta, dist);
    ctx.fillStyle = "#FFD0307F";
    ctx.fillRect(Math.round(p.x) - 2, Math.round(p.y) - 2, 4, 4);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2);
  }
}

// ===== SOLIDS =====
export function drawSolid(ctx, s, t) {
  switch (s.type) {
    case "pcb-ground": return drawPcbGround(ctx, s);
    case "ram": return drawRam(ctx, s);
    case "dip-long":
    case "dip-short": return drawDip(ctx, s);
    case "caps": return drawCaps(ctx, s);
    case "heatsink": return drawHeatsink(ctx, s);
    case "cpu-socket": return drawCpuSocket(ctx, s);
    case "crt": return drawCrt(ctx, s, t);
    default:
      ctx.fillStyle = "#888";
      ctx.fillRect(s.x, s.y, s.w, s.h);
  }
}

function drawPcbGround(ctx, s) {
  ctx.fillStyle = "#0A6633";
  ctx.fillRect(s.x, s.y, s.w, 2);
  ctx.fillStyle = "#003322";
  ctx.fillRect(s.x, s.y + 2, s.w, s.h - 2);
  // Through-hole pads with via dots
  for (let x = s.x + 8; x < s.x + s.w; x += 24) {
    ctx.fillStyle = "#C8A038";
    ctx.fillRect(x, s.y + 6, 4, 4);
    ctx.fillStyle = "#181818";
    ctx.fillRect(x + 1, s.y + 7, 2, 2);
  }
  // Bottom trace stripe
  ctx.fillStyle = "#A8842A";
  ctx.fillRect(s.x, s.y + 12, s.w, 1);
}

function drawRam(ctx, s) {
  ctx.fillStyle = "#226633";
  ctx.fillRect(s.x, s.y, s.w, s.h);
  ctx.fillStyle = "#3A8C4A";
  ctx.fillRect(s.x, s.y, s.w, 1);
  // Tiny chips
  const chipCount = Math.floor(s.w / 16);
  for (let i = 0; i < chipCount; i++) {
    const cx = s.x + 4 + i * 16;
    ctx.fillStyle = "#181818";
    ctx.fillRect(cx, s.y + 2, 10, 5);
    ctx.fillStyle = "#444";
    ctx.fillRect(cx + 1, s.y + 3, 1, 1);
  }
  // Gold contacts
  for (let x = s.x + 1; x < s.x + s.w - 1; x += 3) {
    ctx.fillStyle = "#C8A038";
    ctx.fillRect(x, s.y + s.h - 3, 2, 3);
  }
}

function drawDip(ctx, s) {
  ctx.fillStyle = "#B0B0B0";
  const pins = Math.floor(s.w / 6);
  for (let i = 0; i < pins; i++) {
    ctx.fillRect(s.x + 2 + i * 6, s.y + s.h - 2, 2, 2);
  }
  ctx.fillStyle = "#181818";
  ctx.fillRect(s.x, s.y, s.w, s.h - 2);
  ctx.fillStyle = "#2A2A2A";
  ctx.fillRect(s.x, s.y, s.w, 1);
  ctx.fillStyle = "#888";
  ctx.fillRect(s.x + 2, s.y + 2, 1, 1);
  for (let x = s.x + 6; x < s.x + s.w - 4; x += 4) {
    ctx.fillRect(x, s.y + 4, 2, 1);
  }
}

function drawCaps(ctx, s) {
  ctx.fillStyle = "#0A4D2E";
  ctx.fillRect(s.x, s.y + s.h - 3, s.w, 3);
  const count = 3;
  const capW = 10;
  const gap = (s.w - count * capW) / (count + 1);
  for (let i = 0; i < count; i++) {
    const cx = s.x + gap + i * (capW + gap);
    const cy = s.y - 2;
    ctx.fillStyle = "#1A50C0";
    ctx.fillRect(cx, cy, capW, s.h);
    ctx.fillStyle = "#3A78D8";
    ctx.fillRect(cx + 1, cy, capW - 2, 1);
    ctx.fillStyle = "#FFD030";
    ctx.fillRect(cx, cy + 2, 2, s.h - 4);
    ctx.fillStyle = "#F5F5DC";
    ctx.fillRect(cx + capW - 3, cy + 4, 1, 1);
  }
}

function drawHeatsink(ctx, s) {
  ctx.fillStyle = "#606060";
  ctx.fillRect(s.x, s.y + s.h - 4, s.w, 4);
  const finW = 3, gap = 2, stride = finW + gap;
  for (let x = s.x; x < s.x + s.w; x += stride) {
    ctx.fillStyle = "#A0A0A0";
    ctx.fillRect(x, s.y, finW, s.h - 4);
    ctx.fillStyle = "#404040";
    ctx.fillRect(x + finW, s.y, gap, s.h - 4);
  }
  ctx.fillStyle = "#D0D0D0";
  ctx.fillRect(s.x, s.y, s.w, 1);
}

function drawCpuSocket(ctx, s) {
  ctx.fillStyle = "#101010";
  ctx.fillRect(s.x, s.y, s.w, s.h);
  ctx.fillStyle = "#0A4D2E";
  ctx.fillRect(s.x + 2, s.y + 2, s.w - 4, s.h - 4);
  for (let y = s.y + 4; y < s.y + s.h - 2; y += 3) {
    for (let x = s.x + 4; x < s.x + s.w - 2; x += 3) {
      ctx.fillStyle = "#C8A038";
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.fillStyle = "#FFD030";
  ctx.fillRect(s.x + 1, s.y + 1, 2, 2);
  ctx.fillStyle = "#303030";
  ctx.fillRect(s.x, s.y, s.w, 1);
}

// Pixel-art rounded rectangle: draws a "+" of two crossing rects so corner pixels are removed.
function pxRoundedRect(ctx, x, y, w, h, r = 1) {
  ctx.fillRect(x + r, y, w - 2 * r, h);
  ctx.fillRect(x, y + r, w, h - 2 * r);
}

function drawCrt(ctx, s, t) {
  // Stand
  ctx.fillStyle = "#A0A0A0";
  ctx.fillRect(s.x + 8, s.y + s.h - 4, s.w - 16, 4);
  ctx.fillStyle = "#606060";
  ctx.fillRect(s.x + 4, s.y + s.h - 2, s.w - 8, 2);

  // Bezel — rounded
  ctx.fillStyle = "#C8A872";
  pxRoundedRect(ctx, s.x, s.y, s.w, s.h - 4, 2);
  ctx.fillStyle = "#806440";
  ctx.fillRect(s.x + 2, s.y + s.h - 6, s.w - 4, 2);
  ctx.fillStyle = "#E0C898";
  pxRoundedRect(ctx, s.x, s.y, s.w, 1, 2);

  // Screen
  const sx = s.x + 4, sy = s.y + 4, sw = s.w - 8, sh = s.h - 14;
  ctx.fillStyle = "#000000";
  pxRoundedRect(ctx, sx, sy, sw, sh, 2);
  ctx.fillStyle = "#0A1F0A";
  for (let y = sy + 1; y < sy + sh - 1; y += 2) {
    ctx.fillRect(sx + 1, y, sw - 2, 1);
  }

  // Prompt + blinking cursor
  ctx.fillStyle = "#30FF60";
  ctx.fillRect(s.x + 7, s.y + 8, 2, 2);
  ctx.fillRect(s.x + 8, s.y + 9, 1, 1);
  if (((t * 0.04) % 1) > 0.5) {
    ctx.fillRect(s.x + 11, s.y + 8, 2, 4);
  }

  // Power LED on the bezel
  ctx.fillStyle = "#FF3030";
  ctx.fillRect(s.x + s.w - 5, s.y + s.h - 7, 2, 2);
}

// ===== PROPS =====
export function drawProp(ctx, p) {
  switch (p.type) {
    case "resistor": {
      ctx.fillStyle = "#B0B0B0";
      ctx.fillRect(p.x - 3, p.y + 3, 3, 1);
      ctx.fillRect(p.x + 14, p.y + 3, 3, 1);
      ctx.fillStyle = "#D8B070";
      ctx.fillRect(p.x, p.y + 1, 14, 5);
      ctx.fillStyle = "#A88040";
      ctx.fillRect(p.x, p.y + 5, 14, 1);
      const bands = p.bands;
      for (let i = 0; i < bands.length; i++) {
        ctx.fillStyle = bands[i];
        ctx.fillRect(p.x + 3 + i * 3, p.y + 1, 1, 5);
      }
      break;
    }
    case "smallcap": {
      ctx.fillStyle = "#181818";
      ctx.fillRect(p.x, p.y + 7, 6, 1);
      ctx.fillStyle = "#1A50C0";
      ctx.fillRect(p.x, p.y, 6, 7);
      ctx.fillStyle = "#3A78D8";
      ctx.fillRect(p.x + 1, p.y, 4, 1);
      ctx.fillStyle = "#FFD030";
      ctx.fillRect(p.x, p.y + 1, 1, 5);
      break;
    }
    case "oscillator": {
      ctx.fillStyle = "#909090";
      ctx.fillRect(p.x, p.y, 14, 8);
      ctx.fillStyle = "#C0C0C0";
      ctx.fillRect(p.x, p.y, 14, 1);
      ctx.fillRect(p.x, p.y, 1, 8);
      ctx.fillStyle = "#606060";
      ctx.fillRect(p.x, p.y + 7, 14, 1);
      ctx.fillRect(p.x + 13, p.y, 1, 8);
      ctx.fillStyle = "#404040";
      ctx.fillRect(p.x + 3, p.y + 3, 8, 1);
      ctx.fillRect(p.x + 3, p.y + 5, 8, 1);
      break;
    }
    case "battery": {
      ctx.fillStyle = "#A0A0A0";
      ctx.fillRect(p.x, p.y, 18, 6);
      ctx.fillStyle = "#D0D0D0";
      ctx.fillRect(p.x, p.y, 18, 1);
      ctx.fillStyle = "#606060";
      ctx.fillRect(p.x, p.y + 5, 18, 1);
      ctx.fillStyle = "#181818";
      ctx.fillRect(p.x + 8, p.y + 2, 3, 1);
      ctx.fillRect(p.x + 9, p.y + 1, 1, 3);
      break;
    }
    case "flatchip": {
      ctx.fillStyle = "#181818";
      ctx.fillRect(p.x, p.y, 14, 6);
      ctx.fillStyle = "#888";
      ctx.fillRect(p.x + 1, p.y + 1, 1, 1);
      ctx.fillRect(p.x + 4, p.y + 3, 6, 1);
      ctx.fillStyle = "#B0B0B0";
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(p.x + 1 + i * 3, p.y + 6, 2, 1);
      }
      break;
    }
  }
}

// ===== FLOPPY =====
export function drawFloppy(ctx, f) {
  const x = f.x;
  const y = f.y - f.bump;
  if (f.hit) {
    ctx.fillStyle = "#0A4D2E";
    ctx.fillRect(x, y, f.w, f.h);
    ctx.fillStyle = "#226633";
    ctx.fillRect(x + 1, y + 1, f.w - 2, f.h - 2);
    return;
  }
  ctx.fillStyle = "#1A50C0";
  ctx.fillRect(x, y, f.w, f.h);
  ctx.fillStyle = "#0A2870";
  ctx.fillRect(x, y, f.w, 1);
  ctx.fillRect(x, y + f.h - 1, f.w, 1);
  ctx.fillRect(x, y, 1, f.h);
  ctx.fillRect(x + f.w - 1, y, 1, f.h);
  ctx.fillStyle = "#B0B0B0";
  ctx.fillRect(x + 3, y + 1, 10, 5);
  ctx.fillStyle = "#181818";
  ctx.fillRect(x + 6, y + 2, 4, 3);
  ctx.fillStyle = "#181818";
  ctx.fillRect(x + 3, y + 1, 1, 5);
  ctx.fillStyle = "#F5F5DC";
  ctx.fillRect(x + 2, y + 8, 12, 6);
  ctx.fillStyle = "#181818";
  ctx.fillRect(x + 6, y + 9, 4, 1);
  ctx.fillRect(x + 5, y + 10, 1, 1);
  ctx.fillRect(x + 9, y + 10, 1, 1);
  ctx.fillRect(x + 8, y + 11, 1, 1);
  ctx.fillRect(x + 7, y + 12, 1, 1);
  ctx.fillRect(x + 7, y + 13, 1, 1);
}

// ===== PLAYER (developer-ish sprite, 12w x 16h) =====
const C = {
  hair: "#3A2412",   // dark brown
  skin: "#F4C8A8",
  hoodie: "#2A6B7B", // teal
  hoodieS: "#1A4651",
  string: "#D8E8E8",
  pants: "#1A1A2A",
  shoe: "#0E0E14",
  sole: "#F0F0F0",
  black: "#181818",
  white: "#FCFCFC",
};

export function drawPlayer(ctx, p) {
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  const f = p.facing;
  const stepFrame = Math.floor(p.anim) % 2;

  // Hair
  ctx.fillStyle = C.hair;
  ctx.fillRect(x + 3, y, 6, 1);
  ctx.fillRect(x + 2, y + 1, 8, 2);
  ctx.fillRect(x + 2, y + 3, 1, 2);
  ctx.fillRect(x + 9, y + 3, 1, 2);
  if (f > 0) ctx.fillRect(x + 7, y + 3, 2, 1);
  else       ctx.fillRect(x + 3, y + 3, 2, 1);

  // Face
  ctx.fillStyle = C.skin;
  ctx.fillRect(x + 3, y + 3, 6, 4);

  // Glasses
  ctx.fillStyle = C.black;
  ctx.fillRect(x + 3, y + 4, 2, 2);
  ctx.fillRect(x + 7, y + 4, 2, 2);
  ctx.fillRect(x + 5, y + 5, 2, 1);
  ctx.fillStyle = C.white;
  ctx.fillRect(x + 3, y + 4, 1, 1);
  ctx.fillRect(x + 7, y + 4, 1, 1);

  // Neck
  ctx.fillStyle = C.skin;
  ctx.fillRect(x + 5, y + 7, 2, 1);

  // Hoodie
  ctx.fillStyle = C.hoodie;
  ctx.fillRect(x + 3, y + 7, 2, 1);
  ctx.fillRect(x + 7, y + 7, 2, 1);
  ctx.fillRect(x + 1, y + 8, 10, 4);
  ctx.fillStyle = C.hoodieS;
  ctx.fillRect(x + 1, y + 11, 10, 1);
  ctx.fillStyle = C.string;
  ctx.fillRect(x + 5, y + 8, 1, 2);
  ctx.fillRect(x + 6, y + 8, 1, 2);

  // Hands
  ctx.fillStyle = C.skin;
  ctx.fillRect(x, y + 10, 1, 2);
  ctx.fillRect(x + 11, y + 10, 1, 2);

  // Pants
  ctx.fillStyle = C.pants;
  if (p.onGround && Math.abs(p.vx) > 0.1) {
    if (stepFrame === 0) {
      ctx.fillRect(x + 1, y + 12, 4, 3);
      ctx.fillRect(x + 7, y + 12, 4, 3);
    } else {
      ctx.fillRect(x + 2, y + 12, 4, 3);
      ctx.fillRect(x + 6, y + 12, 4, 3);
    }
  } else if (!p.onGround) {
    ctx.fillRect(x + 2, y + 12, 4, 3);
    ctx.fillRect(x + 6, y + 12, 4, 3);
  } else {
    ctx.fillRect(x + 2, y + 12, 3, 3);
    ctx.fillRect(x + 7, y + 12, 3, 3);
  }

  // Sneakers
  ctx.fillStyle = C.shoe;
  if (p.onGround && Math.abs(p.vx) > 0.1) {
    if (stepFrame === 0) {
      ctx.fillRect(x, y + 15, 4, 1);
      ctx.fillRect(x + 7, y + 15, 5, 1);
    } else {
      ctx.fillRect(x, y + 15, 5, 1);
      ctx.fillRect(x + 8, y + 15, 4, 1);
    }
  } else if (!p.onGround) {
    ctx.fillRect(x + 1, y + 15, 4, 1);
    ctx.fillRect(x + 7, y + 15, 4, 1);
  } else {
    ctx.fillRect(x + 1, y + 15, 4, 1);
    ctx.fillRect(x + 7, y + 15, 4, 1);
    ctx.fillStyle = C.sole;
    ctx.fillRect(x + 1, y + 14, 1, 1);
    ctx.fillRect(x + 10, y + 14, 1, 1);
  }
}

// ===== HUD overlay (drawn on the same canvas during game mode) =====
export function drawGameOverlay(ctx, s, foundCount) {
  ctx.font = "8px 'Press Start 2P', monospace";
  ctx.textBaseline = "top";

  const disksText = `DISKS ${foundCount}/${s.floppies.length}`;
  ctx.textAlign = "left";
  textWithShadow(ctx, disksText, 6, 6, "#F5F5DC");

  ctx.textAlign = "right";
  const controls = [
    "LEFT/RIGHT  MOVE",
    "SPACE       JUMP",
    "DOWN AT CRT",
    "ESC         MENU",
  ];
  controls.forEach((line, i) => {
    textWithShadow(ctx, line, VIEW_W - 6, 6 + i * 10, "#F5F5DC");
  });

  if (s.crtNear) {
    ctx.textAlign = "center";
    const blink = ((s.t * 1000) % 700) < 350;
    if (blink) textWithShadow(ctx, "DOWN  TO  BOOT", VIEW_W / 2, VIEW_H - 30, "#FFD030");
  }

  if (foundCount === s.floppies.length) {
    ctx.textAlign = "center";
    textWithShadow(ctx, "* ALL DISKS RECOVERED *", VIEW_W / 2, VIEW_H - 14, "#FFD030");
  }
}

function textWithShadow(ctx, text, x, y, fill) {
  ctx.fillStyle = "#000";
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}
