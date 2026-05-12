import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// World-space box-projected UVs. Walks every vertex, picks the dominant
// face by normal, and re-projects UVs from world position so texel density
// stays consistent in world units regardless of the face's aspect ratio.
// (BoxGeometry/RoundedBoxGeometry default UVs go 0..1 per face, which makes
// rectangular faces stretch the texture along their long axis.)
function setBoxUVsByNormal(geometry, density = 4) {
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  const W = bb.max.x - bb.min.x;
  const H = bb.max.y - bb.min.y;
  const D = bb.max.z - bb.min.z;
  const cx = (bb.min.x + bb.max.x) / 2;
  const cy = (bb.min.y + bb.max.y) / 2;
  const cz = (bb.min.z + bb.max.z) / 2;

  const pos = geometry.attributes.position;
  const norm = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  if (!pos || !norm || !uv) return;

  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i) - cx;
    const py = pos.getY(i) - cy;
    const pz = pos.getZ(i) - cz;
    const ax = Math.abs(norm.getX(i));
    const ay = Math.abs(norm.getY(i));
    const az = Math.abs(norm.getZ(i));

    let u, v;
    if (ax >= ay && ax >= az) {
      // ±X face: project onto (Z, Y)
      u = (pz / D + 0.5) * D * density;
      v = (py / H + 0.5) * H * density;
    } else if (ay >= ax && ay >= az) {
      // ±Y face: project onto (X, Z)
      u = (px / W + 0.5) * W * density;
      v = (pz / D + 0.5) * D * density;
    } else {
      // ±Z face: project onto (X, Y)
      u = (px / W + 0.5) * W * density;
      v = (py / H + 0.5) * H * density;
    }
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
}

// Bevelled box helper — small radius, low segment count keeps the look
// chunky-but-soft. Now also re-projects UVs in world units so textures
// don't stretch on rectangular faces.
function rbox(w, h, d, radius = 0.04, segments = 3) {
  const geo = new RoundedBoxGeometry(w, h, d, segments, radius);
  setBoxUVsByNormal(geo, 4);
  return geo;
}

// Plain BoxGeometry with the same world-UV projection applied. Use this for
// small body pieces (front panel, drive bays, brand plate, eject buttons)
// that use a plastic material — keeps texel density consistent with rbox.
function bodyBox(w, h, d, density = 4) {
  const geo = new THREE.BoxGeometry(w, h, d);
  setBoxUVsByNormal(geo, density);
  return geo;
}

// ===== Procedural textures =====
// All generated on a 2D canvas so we don't ship asset files.

function hexToRgb(hex) {
  return [
    (hex >> 16) & 0xff,
    (hex >> 8) & 0xff,
    hex & 0xff,
  ];
}

// Take a canvas and return a same-sized canvas that has been Gaussian-blurred
// using ctx.filter. Used to soften per-pixel noise into smoother plastic-feel
// gradients rather than concrete-feel pebble grain.
function blurCanvas(src, blurPx) {
  const dst = document.createElement("canvas");
  dst.width = src.width;
  dst.height = src.height;
  const ctx = dst.getContext("2d");
  ctx.filter = `blur(${blurPx}px)`;
  ctx.drawImage(src, 0, 0);
  return dst;
}

// Aged-plastic texture: base color + per-pixel speckle + a few low-frequency blotches.
// `blurPx` smooths the per-pixel noise into wavy plastic-feel gradients.
function makePlasticTexture(baseHex, repeat = 2, blotches = 50, speckleAmp = 22, blurPx = 3) {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");

  const [br, bg, bb] = hexToRgb(baseHex);
  ctx.fillStyle = `rgb(${br},${bg},${bb})`;
  ctx.fillRect(0, 0, size, size);

  // Per-pixel speckle (will mostly get blurred into smooth gradients)
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * speckleAmp;
    d[i]     = Math.max(0, Math.min(255, d[i]     + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n * 0.95));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * 0.85));
  }
  ctx.putImageData(img, 0, 0);

  // Low-freq darker blotches: simulates uneven yellowing/grime
  for (let i = 0; i < blotches; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 40 + 15;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = Math.random() * 0.06 + 0.02;
    g.addColorStop(0, `rgba(40, 30, 10, ${a})`);
    g.addColorStop(1, "rgba(40, 30, 10, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const final = blurPx > 0 ? blurCanvas(c, blurPx) : c;
  const tex = new THREE.CanvasTexture(final);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 4;
  return tex;
}

// Coarse desk-wood texture: horizontal grain bands + vertical streaks.
function makeWoodTexture() {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");

  for (let y = 0; y < size; y++) {
    const wave = Math.sin(y * 0.06) * 0.4 + Math.sin(y * 0.21) * 0.2;
    const noise = (Math.random() - 0.5) * 0.15;
    const v = 60 + (wave + noise) * 22;
    const r = Math.max(20, Math.min(110, v + 18));
    const g = Math.max(15, Math.min(90, v));
    const b = Math.max(5, Math.min(60, v - 15));
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, y, size, 1);
  }
  for (let i = 0; i < 220; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const len = Math.random() * 50 + 8;
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.10})`;
    ctx.fillRect(x, y, 1, len);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.anisotropy = 4;
  return tex;
}

// Plastic bump map: pebble-grain noise + a few low-frequency surface blots.
// NOT a color texture — sampled as height data, so colorSpace = NoColorSpace.
function makePlasticBumpMap() {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");

  // Mid-grey base (height = 0.5 = no displacement)
  ctx.fillStyle = "rgb(128,128,128)";
  ctx.fillRect(0, 0, size, size);

  // Per-pixel pebble grain
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 60;
    const v = Math.max(0, Math.min(255, 128 + n));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);

  // Low-freq blots — slightly raised / sunken patches simulating uneven mold
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 30 + 12;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const v = Math.random() < 0.5 ? 100 : 156;
    g.addColorStop(0, `rgba(${v},${v},${v},0.3)`);
    g.addColorStop(1, `rgba(${v},${v},${v},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const final = blurCanvas(c, 1.5); // soften pebble grain into plastic micro-relief
  const tex = new THREE.CanvasTexture(final);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

// Roughness variation map: mostly mid value with subtle per-pixel and
// low-freq variation, so the plastic isn't uniformly shiny.
function makeRoughnessMap() {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");

  ctx.fillStyle = "rgb(160,160,160)";
  ctx.fillRect(0, 0, size, size);

  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 30;
    const v = Math.max(0, Math.min(255, 160 + n));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);

  // Slightly less-rough (shinier) patches scattered around
  for (let i = 0; i < 15; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 30 + 14;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(80,80,80,0.4)");
    g.addColorStop(1, "rgba(80,80,80,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const final = blurCanvas(c, 2); // smoother roughness variation
  const tex = new THREE.CanvasTexture(final);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

// Speaker grille texture — fine dot pattern
function makeGrilleTexture() {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#0a0a0a";
  for (let y = 4; y < size; y += 6) {
    for (let x = (y / 6) % 2 === 0 ? 4 : 7; x < size; x += 6) {
      ctx.beginPath();
      ctx.arc(x, y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 4);
  return tex;
}

// ===== Palette: yellowed-beige aged plastic =====
const PALETTE = {
  body:         0xE8D89A,
  bodyShadow:   0xC9B26F,
  bodyHighlight:0xF5E8B5,
  bodyDeep:     0xA88E50,
  dark:         0x1A1A1A,
  darkSoft:     0x2A2A2A,
  keyTop:       0xEFE0A8,
  ledRed:       0xFF3030,
  ledGreen:     0x30FF60,
  desk:         0x251A0E,
};

const U = 0.16;            // 1U keycap width
const GAP = 0.018;
const STRIDE = U + GAP;
const KEY_HEIGHT = 0.05;
const PRESS_DEPTH = 0.035;

// ===== Keyboard layout (104-key ANSI: function row + 5 main + numpad + nav cluster + arrows) =====
const MAIN_ROWS = [
  // F-row — Esc on its own, then four-blocks of F-keys
  [
    { code: "Escape" },
    { gap: 0.6 },
    { code: "F1" }, { code: "F2" }, { code: "F3" }, { code: "F4" },
    { gap: 0.4 },
    { code: "F5" }, { code: "F6" }, { code: "F7" }, { code: "F8" },
    { gap: 0.4 },
    { code: "F9" }, { code: "F10" }, { code: "F11" }, { code: "F12" },
  ],
  // Number row
  [
    { code: "Backquote" }, { code: "Digit1" }, { code: "Digit2" }, { code: "Digit3" },
    { code: "Digit4" }, { code: "Digit5" }, { code: "Digit6" }, { code: "Digit7" },
    { code: "Digit8" }, { code: "Digit9" }, { code: "Digit0" }, { code: "Minus" },
    { code: "Equal" }, { code: "Backspace", w: 2 },
  ],
  // Tab row
  [
    { code: "Tab", w: 1.5 }, { code: "KeyQ" }, { code: "KeyW" }, { code: "KeyE" },
    { code: "KeyR" }, { code: "KeyT" }, { code: "KeyY" }, { code: "KeyU" },
    { code: "KeyI" }, { code: "KeyO" }, { code: "KeyP" }, { code: "BracketLeft" },
    { code: "BracketRight" }, { code: "Backslash", w: 1.5 },
  ],
  // Caps row
  [
    { code: "CapsLock", w: 1.75 }, { code: "KeyA" }, { code: "KeyS" }, { code: "KeyD" },
    { code: "KeyF" }, { code: "KeyG" }, { code: "KeyH" }, { code: "KeyJ" },
    { code: "KeyK" }, { code: "KeyL" }, { code: "Semicolon" }, { code: "Quote" },
    { code: "Enter", w: 2.25 },
  ],
  // Shift row
  [
    { code: "ShiftLeft", w: 2.25 }, { code: "KeyZ" }, { code: "KeyX" }, { code: "KeyC" },
    { code: "KeyV" }, { code: "KeyB" }, { code: "KeyN" }, { code: "KeyM" },
    { code: "Comma" }, { code: "Period" }, { code: "Slash" }, { code: "ShiftRight", w: 2.75 },
  ],
  // Bottom row
  [
    { code: "ControlLeft", w: 1.25 }, { code: "MetaLeft", w: 1.25 }, { code: "AltLeft", w: 1.25 },
    { code: "Space", w: 6.25 },
    { code: "AltRight", w: 1.25 }, { code: "MetaRight", w: 1.25 }, { code: "ContextMenu", w: 1.25 }, { code: "ControlRight", w: 1.25 },
  ],
];

// Top-right cluster (PrtSc/ScrLk/Pause)
const TOP_RIGHT_KEYS = [
  ["PrintScreen", 0, 0], ["ScrollLock", 1, 0], ["Pause", 2, 0],
];

// 6-key nav cluster
const NAV_KEYS = [
  ["Insert", 0, 0], ["Home", 1, 0], ["PageUp", 2, 0],
  ["Delete", 0, 1], ["End", 1, 1], ["PageDown", 2, 1],
];

// Inverted-T arrows
const ARROW_KEYS = [
  ["ArrowUp", 1, 0],
  ["ArrowLeft", 0, 1], ["ArrowDown", 1, 1], ["ArrowRight", 2, 1],
];

// 17-key numpad. Format: [code, col, row, wU?, hU?]
const NUMPAD_KEYS = [
  ["NumLock", 0, 0], ["NumpadDivide", 1, 0], ["NumpadMultiply", 2, 0], ["NumpadSubtract", 3, 0],
  ["Numpad7", 0, 1], ["Numpad8", 1, 1], ["Numpad9", 2, 1], ["NumpadAdd", 3, 1, 1, 2],
  ["Numpad4", 0, 2], ["Numpad5", 1, 2], ["Numpad6", 2, 2],
  ["Numpad1", 0, 3], ["Numpad2", 1, 3], ["Numpad3", 2, 3], ["NumpadEnter", 3, 3, 1, 2],
  ["Numpad0", 0, 4, 2, 1], ["NumpadDecimal", 2, 4],
];

// ===== Lazily-created shared textures (one set, reused across all instances) =====
let TEXTURES = null;
function getTextures() {
  if (TEXTURES) return TEXTURES;
  TEXTURES = {
    // Plastic albedo should be nearly uniform — real plastic gets its look from
    // SPECULAR / clearcoat reflections off a roomEnvironment, not from baked-in
    // blots and noise in the diffuse map. Way fewer blotches, much lower
    // speckle, heavier blur — a near-flat color with subtle wavy variation.
    body:       makePlasticTexture(PALETTE.body, 1, 14, 8, 5),
    bodyShadow: makePlasticTexture(PALETTE.bodyShadow, 1, 14, 8, 5),
    bodyDeep:   makePlasticTexture(PALETTE.bodyDeep, 1, 14, 8, 5),
    keyTop:     makePlasticTexture(PALETTE.keyTop, 1, 8, 5, 4),
    speaker:    makePlasticTexture(PALETTE.darkSoft, 1, 18, 10, 4),
    wood:       makeWoodTexture(),
    grille:     makeGrilleTexture(),
    bump:       makePlasticBumpMap(),
    roughness:  makeRoughnessMap(),
  };
  // Bump every diffuse map's anisotropy up so oblique faces stay crisp.
  for (const k of ["body", "bodyShadow", "bodyDeep", "keyTop", "speaker", "wood"]) {
    TEXTURES[k].anisotropy = 8;
  }
  return TEXTURES;
}

// ===== Helpers =====
// Plastic body material. The clearcoat layer reflects scene.environment —
// kept SUBTLE so the case doesn't look internally lit. envMapIntensity 0.4
// scales reflection strength per material.
function makePlasticMaterial({ map, roughness = 0.6, clearcoat = 0.25, clearcoatRoughness = 0.45, bumpScale = 0.0015, envMapIntensity = 0.4 }) {
  const tex = getTextures();
  return new THREE.MeshPhysicalMaterial({
    map,
    bumpMap: tex.bump,
    bumpScale,
    roughnessMap: tex.roughness,
    roughness,
    clearcoat,
    clearcoatRoughness,
    metalness: 0.0,
    envMapIntensity,
  });
}

let sharedKeyMaterial = null;
function getKeyMaterial() {
  if (!sharedKeyMaterial) {
    sharedKeyMaterial = makePlasticMaterial({
      map: getTextures().keyTop,
      roughness: 0.65,
      clearcoat: 0.15,
      clearcoatRoughness: 0.55,
      bumpScale: 0.0012,
      envMapIntensity: 0.35,
    });
  }
  return sharedKeyMaterial;
}

// Display label for each key code. Empty string = no label (Space).
const KEY_LABELS = {
  Escape: "Esc",
  F1: "F1", F2: "F2", F3: "F3", F4: "F4",
  F5: "F5", F6: "F6", F7: "F7", F8: "F8",
  F9: "F9", F10: "F10", F11: "F11", F12: "F12",
  Backquote: "`", Digit1: "1", Digit2: "2", Digit3: "3", Digit4: "4",
  Digit5: "5", Digit6: "6", Digit7: "7", Digit8: "8", Digit9: "9", Digit0: "0",
  Minus: "-", Equal: "=", Backspace: "←",
  Tab: "Tab",
  KeyQ: "Q", KeyW: "W", KeyE: "E", KeyR: "R", KeyT: "T",
  KeyY: "Y", KeyU: "U", KeyI: "I", KeyO: "O", KeyP: "P",
  BracketLeft: "[", BracketRight: "]", Backslash: "\\",
  CapsLock: "Caps",
  KeyA: "A", KeyS: "S", KeyD: "D", KeyF: "F", KeyG: "G",
  KeyH: "H", KeyJ: "J", KeyK: "K", KeyL: "L",
  Semicolon: ";", Quote: "'", Enter: "↵",
  ShiftLeft: "Shift", ShiftRight: "Shift",
  KeyZ: "Z", KeyX: "X", KeyC: "C", KeyV: "V", KeyB: "B",
  KeyN: "N", KeyM: "M",
  Comma: ",", Period: ".", Slash: "/",
  ControlLeft: "Ctrl", ControlRight: "Ctrl",
  MetaLeft: "⌘", MetaRight: "⌘",
  AltLeft: "Alt", AltRight: "Alt",
  Space: "",
  ContextMenu: "≡",
  PrintScreen: "PrtSc", ScrollLock: "ScrLk", Pause: "Pause",
  Insert: "Ins", Home: "Home", PageUp: "PgUp",
  Delete: "Del", End: "End", PageDown: "PgDn",
  ArrowUp: "↑", ArrowLeft: "←", ArrowDown: "↓", ArrowRight: "→",
  NumLock: "Num", NumpadDivide: "/", NumpadMultiply: "*", NumpadSubtract: "-",
  Numpad7: "7", Numpad8: "8", Numpad9: "9", NumpadAdd: "+",
  Numpad4: "4", Numpad5: "5", Numpad6: "6",
  Numpad1: "1", Numpad2: "2", Numpad3: "3", NumpadEnter: "↵",
  Numpad0: "0", NumpadDecimal: ".",
};

const labelTextureCache = new Map();
function getLabelTexture(label) {
  if (!label) return null;
  if (labelTextureCache.has(label)) return labelTextureCache.get(label);

  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, size, size);

  // Slightly faded ink — matches the aged-keyboard feel
  ctx.fillStyle = "#3A2812";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Single-character labels get a big bold print; multi-letter shrinks to fit
  let fontSize;
  if (label.length === 1)      fontSize = 36;
  else if (label.length <= 3)  fontSize = 24;
  else if (label.length <= 5)  fontSize = 18;
  else                          fontSize = 14;
  ctx.font = `600 ${fontSize}px Helvetica, Arial, sans-serif`;
  ctx.fillText(label, size / 2, size / 2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  labelTextureCache.set(label, tex);
  return tex;
}

function makeKey(widthU = 1, heightU = 1, code) {
  const w = widthU * STRIDE - GAP;
  const d = heightU * STRIDE - GAP;
  const cap = new THREE.Mesh(rbox(w, KEY_HEIGHT, d, 0.012, 2), getKeyMaterial());
  // Stamp the keycap with its code so the click raycaster can synthesize the
  // matching KeyboardEvent without a side table.
  cap.userData.keyCode = code;

  // Attach a label as a child plane, so it follows the cap when pressed.
  const labelText = code ? KEY_LABELS[code] : null;
  if (labelText) {
    const labelTex = getLabelTexture(labelText);
    const plane = new THREE.PlaneGeometry(w * 0.78, d * 0.78);
    const mat = new THREE.MeshBasicMaterial({
      map: labelTex,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
    const labelMesh = new THREE.Mesh(plane, mat);
    labelMesh.rotation.x = -Math.PI / 2; // lie flat on the keycap top
    labelMesh.position.y = KEY_HEIGHT / 2 + 0.001; // hover just above
    cap.add(labelMesh);
  }

  return cap;
}

// Sculpted IBM-Model-M-style profile: each row gets a small pitch + Y offset
// so home row sits lowest and the function/space rows curve up toward the user.
const HOME_ROW = 3;
const ROW_TILT = 0.045;   // radians per row away from home (~2.6°)
const ROW_LIFT = 0.012;   // y units per row away from home

function buildMainBlock(keyMap) {
  const group = new THREE.Group();
  const numRows = MAIN_ROWS.length;

  MAIN_ROWS.forEach((row, rowIdx) => {
    const rowGroup = new THREE.Group();
    const rowZ = (rowIdx - (numRows - 1) / 2) * STRIDE;
    rowGroup.position.set(0, Math.abs(rowIdx - HOME_ROW) * ROW_LIFT, rowZ);
    rowGroup.rotation.x = (rowIdx - HOME_ROW) * ROW_TILT;

    let totalU = 0;
    for (const k of row) totalU += k.gap !== undefined ? k.gap : (k.w || 1);
    let xCur = -(totalU * STRIDE) / 2;

    for (const k of row) {
      if (k.gap !== undefined) {
        xCur += k.gap * STRIDE;
        continue;
      }
      const wU = k.w || 1;
      const mesh = makeKey(wU, 1, k.code);
      const x = xCur + (wU * STRIDE - GAP) / 2;
      const y = KEY_HEIGHT / 2;
      mesh.position.set(x, y, 0);
      mesh.userData.baseY = y; mesh.userData.targetY = y; mesh.userData.currentY = y;
      rowGroup.add(mesh);
      keyMap.set(k.code, mesh);
      xCur += wU * STRIDE;
    }

    group.add(rowGroup);
  });

  return group;
}

// IBM-Model-M-style striped-letters badge — but it says MAX
function makeMaxLogoTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext("2d");
  // Background matches the upper console plastic
  ctx.fillStyle = "#E8D89A";
  ctx.fillRect(0, 0, c.width, c.height);
  // Letters
  ctx.fillStyle = "#1A1A1A";
  ctx.font = "900 44px Helvetica, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("MAX", c.width / 2, c.height / 2 + 2);
  // Eight horizontal stripes punched through the letters (the IBM logo trick)
  ctx.fillStyle = "#E8D89A";
  for (let i = 0; i < 8; i++) {
    const y = 18 + i * 4;
    ctx.fillRect(50, y, 156, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

function buildCluster(keys, keyMap) {
  const group = new THREE.Group();
  for (const [code, col, row, wU = 1, hU = 1] of keys) {
    const mesh = makeKey(wU, hU, code);
    const w = wU * STRIDE - GAP;
    const d = hU * STRIDE - GAP;
    const x = col * STRIDE + w / 2;
    const y = KEY_HEIGHT / 2;
    const z = row * STRIDE + d / 2;
    mesh.position.set(x, y, z);
    mesh.userData.baseY = y; mesh.userData.targetY = y; mesh.userData.currentY = y;
    group.add(mesh);
    keyMap.set(code, mesh);
  }
  return group;
}

function buildCase(materials) {
  const { matBody, matBodyShadow, matDark, matBodyDeep } = materials;
  const group = new THREE.Group();
  const W = 4.5, H = 0.8, D = 3.0;

  // Main body — soft-cornered chassis
  const body = new THREE.Mesh(rbox(W, H, D, 0.06, 3), matBody);
  body.position.y = H / 2;
  group.add(body);

  // Recessed front face
  const front = new THREE.Mesh(bodyBox(W * 0.94, H * 0.88, 0.04), matBodyShadow);
  front.position.set(0, H / 2, D / 2 - 0.005);
  group.add(front);

  // 5.25" CD-ROM bay
  const cdBay = new THREE.Mesh(bodyBox(1.5, 0.2, 0.04), matBodyDeep);
  cdBay.position.set(0.6, H * 0.7, D / 2 + 0.001);
  group.add(cdBay);
  const cdSlot = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.025, 0.02), matDark);
  cdSlot.position.set(0.55, H * 0.71, D / 2 + 0.014);
  group.add(cdSlot);
  const cdEject = new THREE.Mesh(bodyBox(0.07, 0.04, 0.025), matBodyShadow);
  cdEject.position.set(1.25, H * 0.69, D / 2 + 0.016);
  group.add(cdEject);
  // CD activity LED
  const cdLed = new THREE.Mesh(
    new THREE.SphereGeometry(0.012, 12, 12),
    new THREE.MeshBasicMaterial({ color: PALETTE.ledGreen })
  );
  cdLed.position.set(-0.15, H * 0.69, D / 2 + 0.014);
  group.add(cdLed);

  // 3.5" Floppy bay
  const fdBay = new THREE.Mesh(bodyBox(1.0, 0.13, 0.04), matBodyDeep);
  fdBay.position.set(0.6, H * 0.4, D / 2 + 0.001);
  group.add(fdBay);
  const fdSlot = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.018, 0.02), matDark);
  fdSlot.position.set(0.55, H * 0.41, D / 2 + 0.014);
  group.add(fdSlot);
  const fdEject = new THREE.Mesh(bodyBox(0.05, 0.035, 0.025), matBodyShadow);
  fdEject.position.set(0.95, H * 0.4, D / 2 + 0.016);
  group.add(fdEject);
  // Record the slot's world position so the disk-insertion animation knows
  // where to fly to. The case group sits at the root, so this is world-space.
  const slotPos = new THREE.Vector3(0.55, H * 0.41, D / 2 + 0.014);

  // Power button (round)
  const pwrBtn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.04, 24),
    matBodyShadow
  );
  pwrBtn.rotation.x = Math.PI / 2;
  pwrBtn.position.set(-1.7, H * 0.5, D / 2 + 0.022);
  group.add(pwrBtn);
  // Reset button (small)
  const reset = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.025, 16),
    matBodyShadow
  );
  reset.rotation.x = Math.PI / 2;
  reset.position.set(-1.4, H * 0.5, D / 2 + 0.015);
  group.add(reset);

  // LEDs
  const pwrLed = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 16, 16),
    new THREE.MeshBasicMaterial({ color: PALETTE.ledGreen })
  );
  pwrLed.position.set(-1.7, H * 0.25, D / 2 + 0.014);
  group.add(pwrLed);
  const hddLed = new THREE.Mesh(
    new THREE.SphereGeometry(0.022, 16, 16),
    new THREE.MeshBasicMaterial({ color: PALETTE.ledRed })
  );
  hddLed.position.set(-1.45, H * 0.25, D / 2 + 0.014);
  group.add(hddLed);

  // Vent slits on the right side
  for (let i = 0; i < 8; i++) {
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.04, 0.55), matDark);
    slit.position.set(W / 2 + 0.001, H * 0.18 + i * 0.06, 0.5);
    group.add(slit);
  }

  return { group, height: H, width: W, depth: D, slotPos };
}

function buildMonitor(materials, pixiCanvas) {
  const { matBody, matBodyShadow, matDark } = materials;
  const group = new THREE.Group();
  const W = 3.2, H = 2.6, D = 2.6;

  // Bezel — soft-cornered CRT housing
  const bezel = new THREE.Mesh(rbox(W, H, D, 0.07, 3), matBody);
  bezel.position.y = H / 2;
  group.add(bezel);

  // Inner dark bezel surrounding the screen
  const innerW = 2.55, innerH = 1.95;
  const innerBezel = new THREE.Mesh(
    new THREE.BoxGeometry(innerW, innerH, 0.04),
    matDark
  );
  innerBezel.position.set(0, H * 0.55, D / 2 + 0.001);
  group.add(innerBezel);

  // The actual screen plane — sourced from the Pixi canvas
  const screenW = 2.32, screenH = 1.74;
  const screenTexture = new THREE.CanvasTexture(pixiCanvas);
  screenTexture.colorSpace = THREE.SRGBColorSpace;
  screenTexture.minFilter = THREE.LinearFilter;
  screenTexture.magFilter = THREE.LinearFilter;
  // Default flipY = true is correct for sampling an HTMLCanvasElement (canvas
  // pixels have top-left origin; Three flips so the texture reads right-side up).
  const screenMat = new THREE.MeshBasicMaterial({
    map: screenTexture,
    toneMapped: false,
  });
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(screenW, screenH),
    screenMat
  );
  screen.position.set(0, H * 0.55, D / 2 + 0.024);
  group.add(screen);

  // Brand plate below screen
  const brandPlate = new THREE.Mesh(
    bodyBox(W * 0.92, 0.32, 0.02),
    matBody
  );
  brandPlate.position.set(0, H * 0.13, D / 2 + 0.011);
  group.add(brandPlate);

  // Power LED + button on monitor face
  const monLed = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 16, 16),
    new THREE.MeshBasicMaterial({ color: PALETTE.ledGreen })
  );
  monLed.position.set(W / 2 - 0.2, H * 0.13, D / 2 + 0.024);
  group.add(monLed);
  const monPwr = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.03, 12),
    matBodyShadow
  );
  monPwr.rotation.x = Math.PI / 2;
  monPwr.position.set(W / 2 - 0.34, H * 0.13, D / 2 + 0.026);
  group.add(monPwr);

  return { group, screenTexture, screenMesh: screen, screenW, screenH, height: H, width: W, depth: D };
}

function buildSpeaker() {
  const sp = new THREE.Group();
  const w = 0.42, h = 1.05, d = 0.5;
  const matCabinet = new THREE.MeshStandardMaterial({
    map: getTextures().speaker,
    roughness: 0.75,
  });
  const matCone = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.3,
  });
  const cabinet = new THREE.Mesh(rbox(w, h, d, 0.025, 3), matCabinet);
  cabinet.position.y = h / 2;
  sp.add(cabinet);
  const cone = new THREE.Mesh(new THREE.CircleGeometry(0.15, 24), matCone);
  cone.position.set(0, h * 0.42, d / 2 + 0.002);
  sp.add(cone);
  const tweeter = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), matCone);
  tweeter.position.set(0, h * 0.78, d / 2 + 0.002);
  sp.add(tweeter);
  return sp;
}

// ===== Main entry =====
export function buildComputerScene(pixiCanvas) {
  const root = new THREE.Group();

  const tex = getTextures();
  const materials = {
    matBody:       makePlasticMaterial({ map: tex.body,       roughness: 0.55, clearcoat: 0.30, clearcoatRoughness: 0.40, envMapIntensity: 0.45 }),
    matBodyShadow: makePlasticMaterial({ map: tex.bodyShadow, roughness: 0.62, clearcoat: 0.18, clearcoatRoughness: 0.50, envMapIntensity: 0.35 }),
    matBodyDeep:   makePlasticMaterial({ map: tex.bodyDeep,   roughness: 0.68, clearcoat: 0.12, clearcoatRoughness: 0.60, envMapIntensity: 0.30 }),
    matDark:       new THREE.MeshStandardMaterial({ color: PALETTE.dark, roughness: 0.5 }),
  };

  // ----- Case -----
  const caseObj = buildCase(materials);
  root.add(caseObj.group);

  // ----- Monitor (sitting on case, slightly back, sunk a hair into the case top
  //              to avoid z-fighting between the monitor's bottom face and the case top) -----
  const monitorObj = buildMonitor(materials, pixiCanvas);
  monitorObj.group.position.set(0, caseObj.height - 0.04, -0.15);
  monitorObj.group.rotation.x = -0.04; // slight forward tilt
  root.add(monitorObj.group);

  // ----- Speakers flanking the monitor -----
  const leftSp = buildSpeaker();
  leftSp.position.set(-(monitorObj.width / 2 + 0.45), caseObj.height, -0.45);
  root.add(leftSp);
  const rightSp = buildSpeaker();
  rightSp.position.set(monitorObj.width / 2 + 0.45, caseObj.height, -0.45);
  root.add(rightSp);

  // ----- Filler pile of non-bootable disks (visual flavor) — back-right
  //       corner so it doesn't fight with the individual bootables. -----
  const floppyPile = buildFloppyPile();
  floppyPile.group.position.set(3.6, 0, -0.2);
  floppyPile.group.rotation.y = -0.18;
  root.add(floppyPile.group);

  // ----- Individual disks scattered on the desk (each clickable on its own). -----
  const deskDisks = buildDeskDisks();
  root.add(deskDisks.group);

  // ----- Jolt Cola can, left of the case behind the keyboard. Period-correct
  //       caffeine. Rotated so the label faces the camera, which sits up and
  //       to the right of the can. -----
  const jolt = buildJoltCan();
  jolt.position.set(-3.6, 0, 1.5);
  // CylinderGeometry UV u=0 sits on +Z, so the brand block centered at
  // u=0.25 naturally faces +X. Rotate the can so that label normal points
  // up-and-right toward the camera (which sits at +X, +Z relative to it).
  jolt.rotation.y = -1.15;
  root.add(jolt);

  // ----- Desk lamp — pivoting swing-arm casting a warm cone over the case
  //       and desk. The spot light inside the shade is the scene's main
  //       shadow caster. -----
  const lamp = buildDeskLamp();
  lamp.group.position.set(-4.4, 0, -1.5);
  // Aim the swing slightly toward the case center so the cone covers it.
  lamp.group.rotation.y = 0.45;
  root.add(lamp.group);

  const allDisks = [...floppyPile.disks, ...deskDisks.disks];

  // ----- Keyboard (104-key) -----
  const keyMap = new Map();
  const mainBlock = buildMainBlock(keyMap);

  // Find max main-block width for centering & for placing aux clusters
  let mainWidthU = 0;
  for (const row of MAIN_ROWS) {
    let w = 0;
    for (const k of row) w += k.gap !== undefined ? k.gap : (k.w || 1);
    if (w > mainWidthU) mainWidthU = w;
  }
  const mainWidth = mainWidthU * STRIDE;
  const numRows = MAIN_ROWS.length;

  // Aux clusters live to the right of the main block.
  const AUX_GAP = STRIDE * 0.6;
  const navStartX = mainWidth / 2 + AUX_GAP;

  // PrtSc/ScrLk/Pause — aligned with main row 0 (function row)
  const topRight = buildCluster(TOP_RIGHT_KEYS, keyMap);
  topRight.position.set(navStartX, 0, (0 - (numRows - 1) / 2) * STRIDE - STRIDE / 2);

  // 6-key nav cluster — aligned with main rows 1-2
  const nav = buildCluster(NAV_KEYS, keyMap);
  nav.position.set(navStartX, 0, (1 - (numRows - 1) / 2) * STRIDE - STRIDE / 2);

  // Arrow cluster (inverted-T) — aligned with main rows 4-5
  const arrows = buildCluster(ARROW_KEYS, keyMap);
  arrows.position.set(navStartX, 0, (4 - (numRows - 1) / 2) * STRIDE - STRIDE / 2);

  // Numpad — to the right of the nav/arrow column
  const numpadStartX = navStartX + 3 * STRIDE + AUX_GAP;
  const numpad = buildCluster(NUMPAD_KEYS, keyMap);
  numpad.position.set(numpadStartX, 0, (1 - (numRows - 1) / 2) * STRIDE - STRIDE / 2);

  // ----- IBM-Model-M-style two-tone housing -----
  // Bottom flange: wider, slightly darker, more substantial (the chunky base)
  // Top console: smaller, lighter beige, holds the keys + IBM badge + lock LEDs
  const leftMost = -mainWidth / 2;
  const rightMost = numpadStartX + 4 * STRIDE;
  const consoleW = rightMost - leftMost + STRIDE * 0.9;
  const consoleD = numRows * STRIDE + STRIDE * 0.5;
  const consoleH = 0.06;
  const flangeW = consoleW + 0.18;
  const flangeD = consoleD + 0.18;
  const flangeH = 0.07;
  const consoleCenterX = (leftMost + rightMost) / 2;
  const consoleCenterZ = 0;
  // Pad the console depth a bit at the back (where the IBM logo + LEDs go)
  const backStripD = STRIDE * 1.0;

  const flangeMat = makePlasticMaterial({
    map: tex.bodyDeep,
    roughness: 0.68,
    clearcoat: 0.12,
    clearcoatRoughness: 0.60,
    envMapIntensity: 0.30,
  });
  const consoleMat = makePlasticMaterial({
    map: tex.body,
    roughness: 0.55,
    clearcoat: 0.30,
    clearcoatRoughness: 0.40,
    envMapIntensity: 0.45,
  });

  const flange = new THREE.Mesh(
    rbox(flangeW, flangeH, flangeD, 0.045, 3),
    flangeMat
  );
  flange.position.set(consoleCenterX, flangeH / 2, consoleCenterZ);

  const consoleBox = new THREE.Mesh(
    rbox(consoleW, consoleH, consoleD + backStripD, 0.025, 3),
    consoleMat
  );
  consoleBox.position.set(
    consoleCenterX,
    flangeH + consoleH / 2,
    consoleCenterZ - backStripD / 2
  );

  const kb = new THREE.Group();
  kb.add(flange);
  kb.add(consoleBox);

  // Lift each key cluster up to sit on top of the upper console
  const surfaceY = flangeH + consoleH;
  [mainBlock, topRight, nav, arrows, numpad].forEach((g) => { g.position.y = surfaceY; });
  kb.add(mainBlock);
  kb.add(topRight);
  kb.add(nav);
  kb.add(arrows);
  kb.add(numpad);

  // ----- MAX badge (upper-left of the console — same spot a real Model M
  //       has the "IBM" plate, on the back strip behind the function row) -----
  const ibmZ = -(numRows / 2) * STRIDE - backStripD * 0.5;
  const maxPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.45, 0.11),
    new THREE.MeshBasicMaterial({ map: makeMaxLogoTexture(), toneMapped: false })
  );
  maxPlate.rotation.x = -Math.PI / 2;
  // Positioned above the F-row keys, near the left edge of the console.
  // Sits well above the surface (≈2cm) so depth ties don't flicker at
  // oblique camera angles — the rounded console corners still come close
  // at small offsets, polygonOffset alone isn't enough.
  maxPlate.position.set(-mainWidth / 2 + 0.32, surfaceY + 0.02, ibmZ);
  maxPlate.material.polygonOffset = true;
  maxPlate.material.polygonOffsetFactor = -4;
  maxPlate.material.polygonOffsetUnits = -4;
  maxPlate.renderOrder = 1; // draw after the console
  kb.add(maxPlate);

  // ----- Three lock-state LEDs above the numpad (Caps / Num / Scroll) -----
  const ledMatGreen = new THREE.MeshBasicMaterial({ color: PALETTE.ledGreen });
  const ledLabels = [
    { x: numpadStartX + 0 * STRIDE, label: "NUM" },
    { x: numpadStartX + 1.5 * STRIDE, label: "CAPS" },
    { x: numpadStartX + 3 * STRIDE, label: "SCRL" },
  ];
  for (const led of ledLabels) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 12), ledMatGreen);
    dot.position.set(led.x, surfaceY + 0.005, ibmZ);
    kb.add(dot);
  }

  // ----- Cable port (back of keyboard, under the back strip) -----
  const cablePort = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.06, 12),
    new THREE.MeshStandardMaterial({ color: PALETTE.dark, roughness: 0.6 })
  );
  cablePort.rotation.x = Math.PI / 2;
  cablePort.position.set(consoleCenterX, flangeH * 0.6, -flangeD / 2 - 0.001);
  kb.add(cablePort);

  // The housing extends from leftMost (typing area) to past the numpad on the right.
  // Shift the whole keyboard left so its housing visually centers under the monitor.
  kb.position.set(-consoleCenterX, 0, caseObj.depth / 2 + flangeD / 2 + 0.4);
  // Slight tilt back like a real keyboard
  kb.rotation.x = -0.03;
  root.add(kb);

  // ----- Lights -----
  // Direct lights — softened since scene.environment now contributes the
  // ambient + soft fill. A single warm key light keeps the shapes defined.
  const ambient = new THREE.AmbientLight(0xffffff, 0.18);
  root.add(ambient);
  const keyLight = new THREE.DirectionalLight(0xfff5e0, 0.7);
  keyLight.position.set(3.5, 6.5, 4);
  root.add(keyLight);
  const fill = new THREE.DirectionalLight(0xb0c8ff, 0.18);
  fill.position.set(-3, 2.5, 3);
  root.add(fill);
  const rim = new THREE.DirectionalLight(0xffe0b0, 0.15);
  rim.position.set(0, 1, -4);
  root.add(rim);

  // ----- Desk — finite block so the camera can see its edges fall away
  //       to the dark backdrop instead of running to infinity. -----
  const deskW = 16;
  const deskD = 9;
  const deskT = 0.35;
  const desk = new THREE.Mesh(
    new THREE.BoxGeometry(deskW, deskT, deskD),
    new THREE.MeshStandardMaterial({ map: tex.wood, roughness: 0.95 })
  );
  desk.position.set(0, -deskT / 2, 1.0);
  desk.receiveShadow = true;
  desk.castShadow = true;
  root.add(desk);

  // Floor far below the desk, in a darker shade — gives the scene a vertical
  // dimension and stops the off-desk space from reading as "void".
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x0e0805, roughness: 1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -3.5;
  floor.receiveShadow = true;
  root.add(floor);

  // ----- Shadow flags. Every mesh casts + receives by default; the desk is
  //       a receiver-only (set above) since geometrically it has nothing
  //       above it to cast onto something else; LEDs/emissive meshes don't
  //       need to cast since they're tiny and inside the case. -----
  root.traverse((obj) => {
    if (!obj.isMesh || obj === desk) return;
    // Skip MeshBasicMaterial — those are unlit (LEDs, labels, the CRT
    // screen mesh) and shouldn't cast or receive shadows.
    const mat = obj.material;
    const isBasic = Array.isArray(mat)
      ? mat.every((m) => m.isMeshBasicMaterial)
      : mat?.isMeshBasicMaterial;
    if (isBasic) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
  });

  // ----- Update fn (called every frame from Home.jsx) -----
  function update(dt) {
    const t = Math.min(1, dt * 22);
    keyMap.forEach((mesh) => {
      const u = mesh.userData;
      u.currentY += (u.targetY - u.currentY) * t;
      mesh.position.y = u.currentY;
    });
    monitorObj.screenTexture.needsUpdate = true;
  }

  return {
    object3D: root,
    screenTexture: monitorObj.screenTexture,
    screenMesh: monitorObj.screenMesh,
    screenW: monitorObj.screenW,
    screenH: monitorObj.screenH,
    keyMap,
    update,
    // Every clickable disk (pile + loose) + the slot's world position so
    // Home.jsx can raycast and animate insertion into the floppy drive.
    floppyDisks: allDisks,
    floppyPileGroup: floppyPile.group,
    slotPos: caseObj.slotPos.clone(),
  };
}

// ===== 3.5" floppy diskettes (clickable, sit on the desk) =====

function makeFloppyLabelTexture(text, handwritten = false) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 180;
  const ctx = c.getContext("2d");

  // Off-white label paper
  ctx.fillStyle = "#f4eed8";
  ctx.fillRect(0, 0, c.width, c.height);

  // Subtle border
  ctx.strokeStyle = "rgba(60,40,20,0.18)";
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, c.width - 4, c.height - 4);

  // Faint horizontal "lined paper" rules to suggest a real label
  ctx.fillStyle = "rgba(80,80,140,0.10)";
  for (let y = 36; y < c.height - 16; y += 28) {
    ctx.fillRect(10, y, c.width - 20, 1);
  }

  // Shrink font size until the text fits within maxWidth (no overflow off
  // the label edge for long names like "WORDPERFECT 5").
  const fitFont = (template, text, maxWidth, startSize, minSize) => {
    let size = startSize;
    while (size > minSize) {
      ctx.font = template.replace("{S}", size);
      if (ctx.measureText(text).width <= maxWidth) break;
      size -= 2;
    }
    return size;
  };

  if (handwritten) {
    // Sharpie scrawl: rotated, bold, slightly imperfect.
    ctx.save();
    ctx.translate(c.width / 2, c.height / 2 + 6);
    ctx.rotate(-0.07);
    ctx.fillStyle = "#0a0a0a";
    fitFont("italic 900 {S}px 'Brush Script MT', 'Marker Felt', 'Comic Sans MS', cursive",
            text, c.width - 60, 92, 28);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Render twice with tiny offset for that "thick marker" feel
    ctx.fillText(text, 0, 0);
    ctx.fillText(text, 1, 0);
    // Underline scrawl
    ctx.strokeStyle = "#0a0a0a";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-70, 42);
    ctx.bezierCurveTo(-30, 48, 30, 38, 78, 46);
    ctx.stroke();
    ctx.restore();
    // A couple of ink smudges
    ctx.fillStyle = "rgba(20,20,20,0.18)";
    ctx.beginPath();
    ctx.arc(40, 28, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(220, 150, 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#1a1a1a";
    fitFont("bold {S}px 'Courier New', monospace", text, c.width - 32, 30, 12);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, c.width / 2, c.height / 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Builds a single 3.5" floppy. `floppyId` is set ONLY on the Group's userData
// — the raycaster's pickDisk walks up until it finds it, so any child mesh
// hit (body, slider, label) resolves to the whole disk group. If `bundleUrl`
// is set, clicking the disk boots that game; otherwise the disk just bounces.
function makeFloppy({ label, handwritten = false, caseColor = 0x1a1a1a, id, bundleUrl, gameLabel, gameFile }) {
  const group = new THREE.Group();
  const W = 0.48, H = 0.022, D = 0.5;

  // Case body — rounded plastic
  const caseMat = new THREE.MeshStandardMaterial({
    color: caseColor,
    roughness: 0.42,
    metalness: 0.04,
  });
  const body = new THREE.Mesh(rbox(W, H, D, 0.012, 2), caseMat);
  body.position.y = H / 2;
  group.add(body);

  // Metal shutter — the spring-loaded slider that exposes the magnetic disk.
  // Sits on the back edge (label-up orientation = shutter goes in FIRST).
  const sliderMat = new THREE.MeshStandardMaterial({
    color: 0xb8b8b8,
    metalness: 0.85,
    roughness: 0.28,
  });
  const slider = new THREE.Mesh(
    new THREE.BoxGeometry(W * 0.42, H * 0.6, D * 0.22),
    sliderMat
  );
  slider.position.set(0, H * 0.85, -D * 0.36);
  group.add(slider);

  // Shutter window (the dark rectangular hole in the slider's center)
  const shutterWindow = new THREE.Mesh(
    new THREE.BoxGeometry(W * 0.18, H * 0.65, D * 0.10),
    new THREE.MeshStandardMaterial({ color: 0x080808 })
  );
  shutterWindow.position.set(0, H * 0.87, -D * 0.36);
  group.add(shutterWindow);

  // Embossed arrow on the top-right corner ("insert this way")
  const arrowMat = new THREE.MeshStandardMaterial({ color: 0x404040 });
  const arrow = new THREE.Mesh(
    new THREE.BoxGeometry(W * 0.04, H * 0.2, D * 0.06),
    arrowMat
  );
  arrow.position.set(W * 0.35, H + 0.001, -D * 0.15);
  group.add(arrow);

  // Label on top — covers most of the front face
  const labelTex = makeFloppyLabelTexture(label, handwritten);
  const labelPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 0.82, D * 0.55),
    new THREE.MeshBasicMaterial({
      map: labelTex,
      transparent: true,
      depthWrite: false,
    })
  );
  labelPlane.rotation.x = -Math.PI / 2;
  labelPlane.position.set(0, H + 0.001, D * 0.08);
  group.add(labelPlane);

  // Only the GROUP gets the floppyId so click-resolve always lands here.
  group.userData = {
    floppyId: id,
    label,
    bundleUrl,
    gameLabel,
    gameFile,
    W, H, D,
  };
  return group;
}

// Color palette of typical 90s floppies, shared by the pile + loose disk.
const FLOPPY_COLORS = {
  black: 0x1c1c1c,
  grey: 0x6c6c6c,
  red: 0x9a2828,
  blue: 0x254a8a,
  yellow: 0xc8a830,
  orange: 0xd66830,
  white: 0xeae5dc,
};

// ===== Jolt Cola can — period-correct caffeine on the desk =====

// Wrap-around label texture. Width = circumference (twice the text width so
// the brand reads from any angle), height = body height. Seam at u=0/u=1 is
// pure red so the wrap looks continuous.
function makeJoltLabel() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 384;
  const ctx = c.getContext("2d");

  // Red base — classic Jolt red
  ctx.fillStyle = "#c81818";
  ctx.fillRect(0, 0, c.width, c.height);

  // Subtle vertical highlight band to fake cylindrical light direction
  const grad = ctx.createLinearGradient(0, 0, c.width, 0);
  grad.addColorStop(0,    "rgba(0,0,0,0.18)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.10)");
  grad.addColorStop(0.5,  "rgba(0,0,0,0.18)");
  grad.addColorStop(0.75, "rgba(255,255,255,0.10)");
  grad.addColorStop(1,    "rgba(0,0,0,0.18)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c.width, c.height);

  // Top / bottom bands — silver-ish trim
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, c.width, 28);
  ctx.fillRect(0, c.height - 28, c.width, 28);
  ctx.fillStyle = "#d8d8d8";
  ctx.fillRect(0, 28, c.width, 6);
  ctx.fillRect(0, c.height - 34, c.width, 6);

  // Brand block repeated twice around the circumference
  const REPS = 2;
  for (let r = 0; r < REPS; r++) {
    const cx = (c.width / REPS) * (r + 0.5);
    const cy = c.height / 2;

    // Yellow lightning bolt behind the text
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = "#ffe020";
    ctx.beginPath();
    ctx.moveTo(-150, -110);
    ctx.lineTo(-40,  -110);
    ctx.lineTo(-90,  -10);
    ctx.lineTo(-20,  -10);
    ctx.lineTo(-110,  130);
    ctx.lineTo(-60,    20);
    ctx.lineTo(-130,   20);
    ctx.closePath();
    ctx.fill();
    // Bolt outline
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();

    // "JOLT!" — chunky black sans-serif, slightly tilted
    ctx.save();
    ctx.translate(cx + 40, cy);
    ctx.rotate(-0.05);
    ctx.fillStyle = "#0a0a0a";
    ctx.font = "900 150px 'Impact', 'Arial Black', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("JOLT!", 0, 0);
    ctx.restore();

    // Slogan curving below
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px 'Helvetica', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ALL THE SUGAR + TWICE THE CAFFEINE", cx, cy + 100);

    // "Cola" italic above
    ctx.fillStyle = "#ffffff";
    ctx.font = "italic bold 36px 'Georgia', serif";
    ctx.fillText("Cola", cx + 80, cy - 86);

    // Tiny nutrition mark
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "10px sans-serif";
    ctx.fillText("12 FL OZ (355 mL)", cx, cy + 150);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  return tex;
}

export function buildJoltCan() {
  const group = new THREE.Group();
  const H = 0.46;
  const R = 0.16;
  const SEG = 36;

  // Body — labelled cylinder
  const bodyMat = new THREE.MeshStandardMaterial({
    map: makeJoltLabel(),
    roughness: 0.42,
    metalness: 0.18,           // hint of the metal under the print
  });
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, H * 0.88, SEG, 1, true),
    bodyMat
  );
  body.position.y = H * 0.44;
  group.add(body);

  // Bottom rim — tapers slightly inward (standard can profile)
  const aluMat = new THREE.MeshStandardMaterial({
    color: 0xc8c8d0,
    metalness: 0.88,
    roughness: 0.26,
  });
  const aluMatDark = new THREE.MeshStandardMaterial({
    color: 0x8a8a92,
    metalness: 0.88,
    roughness: 0.34,
  });
  const bottom = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 0.94, R * 0.86, H * 0.05, SEG),
    aluMatDark
  );
  bottom.position.y = H * 0.025;
  group.add(bottom);

  // Top neck — slight inward taper
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 0.86, R, H * 0.08, SEG),
    aluMat
  );
  neck.position.y = H * 0.88 + H * 0.04;
  group.add(neck);

  // Lid surface (recessed slightly inside the neck)
  const lid = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 0.82, R * 0.82, H * 0.015, SEG),
    aluMatDark
  );
  lid.position.y = H * 0.88 + H * 0.08;
  group.add(lid);

  // Pull tab — small flat aluminum strip sitting on the lid
  const tab = new THREE.Mesh(
    new THREE.BoxGeometry(R * 0.95, H * 0.018, R * 0.28),
    aluMat
  );
  tab.position.set(R * 0.05, H * 0.88 + H * 0.094, 0);
  group.add(tab);

  // Hole under the tab (the rivet) — small dark disc
  const rivet = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 0.05, R * 0.05, H * 0.005, 12),
    new THREE.MeshStandardMaterial({ color: 0x202020, metalness: 0.6, roughness: 0.3 })
  );
  rivet.position.set(R * 0.05, H * 0.88 + H * 0.105, 0);
  group.add(rivet);

  // Pop-tab opening hint (oval indent — a darker patch on the lid)
  const opening = new THREE.Mesh(
    new THREE.BoxGeometry(R * 0.55, H * 0.003, R * 0.22),
    new THREE.MeshStandardMaterial({ color: 0x4a4a4a, metalness: 0.7, roughness: 0.35 })
  );
  opening.position.set(-R * 0.32, H * 0.88 + H * 0.084, 0);
  group.add(opening);

  return group;
}

// ===== Desk lamp + spot light =====
// Classic articulated swing-arm desk lamp. Heavy base, vertical pole, one
// forward-angled arm, conical shade with a warm bulb inside. The spot light
// is what casts real shadows over the scene.
export function buildDeskLamp() {
  const group = new THREE.Group();

  // Materials — dark anodized metal for the body, brass-y interior for the
  // shade so the bulb glow has somewhere to bounce.
  const matBody = new THREE.MeshStandardMaterial({
    color: 0x2a2828, roughness: 0.42, metalness: 0.55,
  });
  const matJoint = new THREE.MeshStandardMaterial({
    color: 0x1a1818, roughness: 0.5, metalness: 0.65,
  });
  const matShadeOuter = new THREE.MeshStandardMaterial({
    color: 0x6a2818, roughness: 0.38, metalness: 0.5,
    side: THREE.DoubleSide,
  });
  const matBulb = new THREE.MeshStandardMaterial({
    color: 0xfff0c0, emissive: 0xfff0c0, emissiveIntensity: 1.8,
    roughness: 0.4,
  });

  // Base — wide weighted disc + a small collar
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.48, 0.52, 0.09, 32),
    matBody
  );
  base.position.y = 0.045;
  group.add(base);
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.17, 0.07, 18),
    matJoint
  );
  collar.position.y = 0.13;
  group.add(collar);

  // Vertical pole — tall and noticeable
  const poleH = 2.3;
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, poleH, 14),
    matBody
  );
  pole.position.y = 0.13 + poleH / 2;
  group.add(pole);

  // Joint at top of pole
  const j1y = 0.13 + poleH;
  const joint1 = new THREE.Mesh(new THREE.SphereGeometry(0.10, 16, 12), matJoint);
  joint1.position.y = j1y;
  group.add(joint1);

  // Forward-and-down arm. We position the cylinder at the midpoint between
  // the joint and the arm's end point and rotate around X so the cylinder
  // axis (local +Y) points from the joint toward the end.
  const armDip = 0.65;
  const armReach = 2.1;
  const armLen = Math.hypot(armDip, armReach);
  const armAngle = Math.acos(-armDip / armLen);

  const arm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, armLen, 14),
    matBody
  );
  arm.position.set(0, j1y - armDip / 2, armReach / 2);
  arm.rotation.x = armAngle;
  group.add(arm);

  // Joint at end of arm
  const j2y = j1y - armDip;
  const j2z = armReach;
  const joint2 = new THREE.Mesh(new THREE.SphereGeometry(0.10, 16, 12), matJoint);
  joint2.position.set(0, j2y, j2z);
  group.add(joint2);

  // Shade group sits at the end joint and points the cone downward.
  const shadeGroup = new THREE.Group();
  shadeGroup.position.set(0, j2y, j2z);
  shadeGroup.rotation.x = 0.35;
  group.add(shadeGroup);

  // Conical shade — wider, taller for visual presence
  const shadeH = 0.46;
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.10, 0.32, shadeH, 28, 1, true),
    matShadeOuter
  );
  shade.position.y = -shadeH / 2;
  shadeGroup.add(shade);
  // Top cap so the shade isn't see-through from above
  const shadeCap = new THREE.Mesh(
    new THREE.CircleGeometry(0.10, 24),
    matShadeOuter
  );
  shadeCap.rotation.x = Math.PI / 2;
  shadeCap.position.y = 0;
  shadeGroup.add(shadeCap);

  // Bulb (visual element inside the shade — the actual lighting comes from
  // the SpotLight below)
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.10, 16, 12), matBulb);
  bulb.position.y = -shadeH * 0.55;
  shadeGroup.add(bulb);

  // SpotLight inside the shade, pointing down through the shade opening.
  // shadow.bias avoids the surface acne / shadow-stripe artifact common on
  // flat receivers (the desk plane).
  const light = new THREE.SpotLight(0xfff0c8, 12, 16, Math.PI / 3.2, 0.45, 1.6);
  light.position.y = -shadeH * 0.55;
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.camera.near = 0.4;
  light.shadow.camera.far = 16;
  light.shadow.bias = -0.0008;
  light.shadow.radius = 4;
  shadeGroup.add(light);

  // Target several units below the shade so the SpotLight's cone aims down.
  const target = new THREE.Object3D();
  target.position.set(0, -8, 0);
  shadeGroup.add(target);
  light.target = target;

  return { group, light };
}

// A stack of NON-bootable filler diskettes — just visual flavor in the
// corner of the desk. Bootables now live on their own (see DESK_DISKS below)
// so each can be clicked without un-stacking.
export function buildFloppyPile() {
  const group = new THREE.Group();
  const disks = [];

  const PILE = [
    { id: "disk-wordp",   label: "WORDPERFECT 5", color: FLOPPY_COLORS.red,    yaw: 0.07 },
    { id: "disk-norton",  label: "NORTON UTIL.",  color: FLOPPY_COLORS.blue,   yaw: -0.18 },
    { id: "disk-mixtape", label: "Mixtape '96",   color: FLOPPY_COLORS.orange, yaw: -0.05, handwritten: true },
  ];

  PILE.forEach((spec, i) => {
    const disk = makeFloppy({
      label: spec.label,
      handwritten: spec.handwritten || false,
      caseColor: spec.color,
      id: spec.id,
    });
    disk.position.y = i * 0.025;
    disk.rotation.y = spec.yaw;
    group.add(disk);
    disks.push({ id: spec.id, label: spec.label, mesh: disk });
  });

  return { group, disks };
}

// Individual disks placed at their own spots on the desk. Each is a separate
// click target so the player can pick any of the three bootable games (or
// poke the loose BACKUP). Returns a group plus a flat disks list.
export function buildDeskDisks() {
  const group = new THREE.Group();
  const disks = [];

  // World-space spots on the desk. y stays 0 (lying flat on the desk plane).
  // Yaw is a casual rotation so they don't look like a grid.
  const SPOTS = [
    {
      id: "disk-prince", label: "PRINCE", color: FLOPPY_COLORS.red,
      handwritten: true, x: -3.4, z: 0.6, yaw: -0.32,
      bundleUrl: "/prince-of-persia.jsdos", gameLabel: "PRINCE", gameFile: "PRINCE.EXE",
    },
    {
      id: "disk-keen", label: "KEEN 1", color: FLOPPY_COLORS.white,
      handwritten: true, x: -2.6, z: 1.9, yaw: 0.41,
      bundleUrl: "/keen-1.jsdos", gameLabel: "KEEN 1", gameFile: "KEEN1.EXE",
    },
    {
      id: "disk-doom", label: "DOOM", color: FLOPPY_COLORS.black,
      handwritten: true, x: 3.0, z: 1.9, yaw: -0.22,
      bundleUrl: "/doom.jsdos", gameLabel: "DOOM", gameFile: "DOOM.EXE",
    },
    {
      id: "disk-backup-loose", label: "BACKUP — DO NOT LOSE !!", color: FLOPPY_COLORS.yellow,
      handwritten: true, x: 2.0, z: 2.5, yaw: 0.95,
    },
  ];

  for (const spec of SPOTS) {
    const disk = makeFloppy({
      label: spec.label,
      handwritten: spec.handwritten || false,
      caseColor: spec.color,
      id: spec.id,
      bundleUrl: spec.bundleUrl,
      gameLabel: spec.gameLabel,
      gameFile: spec.gameFile,
    });
    disk.position.set(spec.x, 0, spec.z);
    disk.rotation.y = spec.yaw;
    group.add(disk);
    disks.push({ id: spec.id, label: spec.label, mesh: disk });
  }
  return { group, disks };
}

export function setKeyState(keyMap, code, down) {
  const mesh = keyMap.get(code);
  if (!mesh) return;
  mesh.userData.targetY = down
    ? mesh.userData.baseY - PRESS_DEPTH
    : mesh.userData.baseY;
}
