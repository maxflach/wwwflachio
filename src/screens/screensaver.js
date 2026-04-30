// Classic C64-demo-style screensaver. No sound. Rotates through three scenes
// (~10s each): starfield + bouncing logo, full-screen plasma, rotating
// wireframe cube. A common rainbow sine-wave scroller plays along the bottom
// throughout. Renders into the same 2D canvas used by boot/menu/game/terminal
// so it rides through Pixi's CRT post-process and shows up on the in-monitor
// screen.

import { VIEW_W, VIEW_H } from "../game/world";

const C64_PALETTE = [
  "#FF2050", "#FF7F00", "#FFD030", "#80FF40",
  "#30FF80", "#30E0FF", "#3060FF", "#A040FF",
];

// Same palette in [r, g, b] arrays for plasma rendering
const C64_RGB = C64_PALETTE.map((hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
]);

const SCROLL_TEXT =
  "*** WELCOME TO FLACHOS *** GREETINGS FROM MAX FLACH *** " +
  "SERIAL TECH FOUNDER FROM STOCKHOLM, SE *** " +
  "SHIPPING CODE SINCE 1996 *** " +
  "FOUNDED QULIT, ISPY, HUBORY, THE DIGITAL FAMILY *** " +
  "EX-CTO @ UTOPIA MUSIC *** " +
  "NOW FOUNDING MUSICDATALABS + SERVO.MUSIC *** " +
  "SAY HI :: MAX AT FLACH DOT IO *** " +
  "PRESS ANY KEY TO RETURN ***   ";

// Scene rotation: each scene plays for SCENE_SECONDS, then advances.
const SCENE_SECONDS = 10;
const NUM_SCENES = 3;

// ----- Lazily-allocated buffers (reused frame to frame) -----
let plasmaBuf = null;
let plasmaImg = null;
const PLASMA_W = 120;
const PLASMA_H = 68;
function ensurePlasmaBuf() {
  if (plasmaBuf) return;
  plasmaBuf = document.createElement("canvas");
  plasmaBuf.width = PLASMA_W;
  plasmaBuf.height = PLASMA_H;
  const c = plasmaBuf.getContext("2d");
  plasmaImg = c.createImageData(PLASMA_W, PLASMA_H);
}

function ensureStars(s) {
  if (s.stars) return;
  s.stars = Array.from({ length: 96 }, () => ({
    x: (Math.random() - 0.5) * 2,
    y: (Math.random() - 0.5) * 2,
    z: Math.random() * 5 + 0.1,
  }));
}

export function updateScreensaver(s, dt) {
  ensureStars(s);
  for (const star of s.stars) {
    star.z -= 0.06 * dt;
    if (star.z < 0.1) {
      star.x = (Math.random() - 0.5) * 2;
      star.y = (Math.random() - 0.5) * 2;
      star.z = 5;
    }
  }
}

export function drawScreensaver(ctx, s) {
  const t = s.t;
  // dt is in frame units (~60fps), so seconds = t / 60
  const seconds = t / 60;
  const scene = Math.floor(seconds / SCENE_SECONDS) % NUM_SCENES;

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  if (scene === 0) drawStarfieldScene(ctx, s, t);
  else if (scene === 1) drawPlasmaScene(ctx, s, t);
  else drawWireframeScene(ctx, s, t);

  drawScroller(ctx, t);
  drawSceneIndicator(ctx, scene, t);
}

// ===== Scene 0: starfield + bouncing logo + colour bars =====
function drawStarfieldScene(ctx, s, t) {
  ensureStars(s);
  for (const star of s.stars) {
    const sx = (star.x / star.z) * 220 + VIEW_W / 2;
    const sy = (star.y / star.z) * 220 + VIEW_H / 2;
    if (sx < 0 || sx >= VIEW_W || sy < 0 || sy >= VIEW_H) continue;
    const brightness = Math.min(1, (5 - star.z) / 5);
    const v = Math.floor(brightness * 220 + 30);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    const size = brightness > 0.7 ? 2 : 1;
    ctx.fillRect(Math.round(sx), Math.round(sy), size, size);
  }

  // Bouncing colour-cycled logo
  ctx.font = "24px 'Press Start 2P', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lx = VIEW_W / 2 + Math.sin(t * 0.04) * 90;
  const ly = 70 + Math.cos(t * 0.05) * 18;
  const logo = "FLACHOS";
  const charW = 22;
  const startX = lx - (logo.length * charW) / 2 + charW / 2;
  for (let i = 0; i < logo.length; i++) {
    const idx = (Math.floor(t * 0.4) + i) % C64_PALETTE.length;
    ctx.fillStyle = C64_PALETTE[idx];
    ctx.fillText(logo[i], startX + i * charW, ly);
  }

  ctx.font = "8px 'Press Start 2P', monospace";
  ctx.fillStyle = "#9CC8FC";
  ctx.fillText("=== A DEMO BY FLACH ===", VIEW_W / 2, ly + 22);

  // Pulsing colour bars
  const barY = VIEW_H / 2 + 18;
  for (let i = 0; i < 8; i++) {
    const phase = i * 0.7 + t * 0.04;
    const w = (Math.sin(phase) * 0.5 + 0.5) * (VIEW_W * 0.6);
    ctx.fillStyle = C64_PALETTE[i];
    ctx.globalAlpha = 0.35;
    ctx.fillRect(VIEW_W / 2 - w / 2, barY + i * 2, w, 2);
  }
  ctx.globalAlpha = 1;
}

// ===== Scene 1: full-screen plasma + giant logo overlay =====
function drawPlasmaScene(ctx, s, t) {
  ensurePlasmaBuf();
  const data = plasmaImg.data;
  const tt = t * 0.04;
  for (let y = 0; y < PLASMA_H; y++) {
    for (let x = 0; x < PLASMA_W; x++) {
      const v =
        Math.sin(x * 0.13 + tt) +
        Math.sin(y * 0.11 + tt * 1.1) +
        Math.sin((x + y) * 0.08 + tt * 0.7) +
        Math.sin(Math.sqrt((x - 60) * (x - 60) + (y - 34) * (y - 34)) * 0.18 + tt * 0.9);
      // v is roughly -4..4 — map to a smooth palette index
      const norm = (v + 4) / 8; // 0..1
      const f = norm * (C64_RGB.length - 0.001);
      const i0 = Math.floor(f);
      const frac = f - i0;
      const a = C64_RGB[i0];
      const b = C64_RGB[(i0 + 1) % C64_RGB.length];
      const off = (y * PLASMA_W + x) * 4;
      data[off]     = a[0] * (1 - frac) + b[0] * frac;
      data[off + 1] = a[1] * (1 - frac) + b[1] * frac;
      data[off + 2] = a[2] * (1 - frac) + b[2] * frac;
      data[off + 3] = 255;
    }
  }
  plasmaBuf.getContext("2d").putImageData(plasmaImg, 0, 0);
  const wasSmoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(plasmaBuf, 0, 0, VIEW_W, VIEW_H);
  ctx.imageSmoothingEnabled = wasSmoothing;

  // Giant black-shadowed logo overlay
  ctx.font = "44px 'Press Start 2P', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const cx = VIEW_W / 2;
  const cy = VIEW_H / 2;
  ctx.fillStyle = "#000000";
  ctx.fillText("FLACHOS", cx + 3, cy + 3);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("FLACHOS", cx, cy);

  ctx.font = "10px 'Press Start 2P', monospace";
  ctx.fillStyle = "#000000";
  ctx.fillText("PLASMA SCENE", cx + 1, cy + 32);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("PLASMA SCENE", cx, cy + 31);
}

// ===== Scene 2: rotating wireframe cube + sub-cube =====
const CUBE_VERTS = [
  [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
  [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
];
const CUBE_EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

function drawWireframeScene(ctx, s, t) {
  drawWireframeCube(ctx, t, VIEW_W / 2, VIEW_H / 2 - 8, 56, t * 0.025, t * 0.018, 4);
  drawWireframeCube(ctx, t, VIEW_W / 2, VIEW_H / 2 - 8, 28, -t * 0.04, t * 0.03, 4);

  ctx.font = "12px 'Press Start 2P', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#FFD030";
  ctx.fillText("FLACHOS", VIEW_W / 2, 30);
  ctx.font = "7px 'Press Start 2P', monospace";
  ctx.fillStyle = "#9CC8FC";
  ctx.fillText("VECTOR ROUTINE BY FLACH", VIEW_W / 2, 46);
}

function drawWireframeCube(ctx, t, cx, cy, scale, rotY, rotX, persp) {
  const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
  const cosX = Math.cos(rotX), sinX = Math.sin(rotX);

  const projected = CUBE_VERTS.map(([x, y, z]) => {
    // Rotate around Y axis
    let nx = x * cosY - z * sinY;
    let nz = z * cosY + x * sinY;
    // Rotate around X axis
    let ny = y * cosX - nz * sinX;
    nz = nz * cosX + y * sinX;
    // Perspective project
    const f = persp / (persp + nz);
    return [cx + nx * scale * f, cy + ny * scale * f, nz];
  });

  ctx.lineWidth = 1;
  for (let i = 0; i < CUBE_EDGES.length; i++) {
    const [a, b] = CUBE_EDGES[i];
    const idx = (Math.floor(t * 0.3) + i) % C64_PALETTE.length;
    ctx.strokeStyle = C64_PALETTE[idx];
    ctx.beginPath();
    ctx.moveTo(projected[a][0], projected[a][1]);
    ctx.lineTo(projected[b][0], projected[b][1]);
    ctx.stroke();
  }
  // Vertex dots
  ctx.fillStyle = "#FFFFFF";
  for (const [x, y] of projected) ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
}

// ===== Common: sine-wave scroller along the bottom =====
function drawScroller(ctx, t) {
  ctx.font = "14px 'Press Start 2P', monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const scrollSpeed = 1.6;
  const ch = 12;
  const scrollOffset = (t * scrollSpeed) % (SCROLL_TEXT.length * ch);
  const baseY = VIEW_H - 26;
  for (let i = 0; i < SCROLL_TEXT.length; i++) {
    const x = i * ch - scrollOffset + VIEW_W;
    if (x < -ch || x > VIEW_W) continue;
    const wave = Math.sin(t * 0.08 + i * 0.32) * 8;
    const cIdx = (i + Math.floor(t * 0.18)) % C64_PALETTE.length;
    ctx.fillStyle = C64_PALETTE[cIdx];
    ctx.fillText(SCROLL_TEXT[i], x, baseY + wave);
  }

  if (((t * 1000) % 1000) < 500) {
    ctx.font = "6px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#666";
    ctx.fillText("PRESS ANY KEY", VIEW_W / 2, VIEW_H - 6);
  }
}

// Scene indicator dots — three small markers in the top-right
function drawSceneIndicator(ctx, scene, t) {
  for (let i = 0; i < NUM_SCENES; i++) {
    const cx = VIEW_W - 14 - i * 8;
    const active = i === scene;
    ctx.fillStyle = active ? "#FFD030" : "#333";
    ctx.fillRect(cx, 8, 4, 4);
  }
}
