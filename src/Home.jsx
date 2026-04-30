import { useEffect, useRef, useState } from "react";
import { Application, Sprite, Texture } from "pixi.js";
import { CRTFilter, RGBSplitFilter } from "pixi-filters";
import * as THREE from "three";
import { buildComputerScene, setKeyState } from "./computerModel";
import { run as runTerminal, makePrompt, complete as completeTerminal } from "./terminalCore";

// Pixi internal render-target dimensions. Higher than the game canvas so the CRT
// filter scanlines/noise stay crisp when sampled as a texture in 3D.
const PIXI_W = 960;
const PIXI_H = 540;

// ===== Boot sequence + boot menu =====
const BOOT_LINES = [
  "FlachOS BIOS v1.96   (c) 1996-2026 max flach holding",
  "",
  "Initializing memory ........................ 640K OK",
  "Detecting CPU .............................. i486 DX2 @ 66MHz",
  "Probing IDE bus:",
  "  primary master:    FLACH-DISK-3000   30y full",
  "  secondary master:  CD-ROM",
  "  secondary slave:   FLOPPY  (3.5\", 1.44 MB)",
  "",
  "Mounting /  ................................ [ OK ]",
  "Bringing up network:",
  "  eth0: 10base-T link detected",
  "  smtpd ........ :25/tcp",
  "  imapd ........ :143/tcp",
  "",
  "Starting init ............................. [ OK ]",
  "Starting flachd ........................... [ OK ]",
  "Spawning getty on tty1 .................... [ OK ]",
  "",
  ">> press any key to continue",
];
const BOOT_LINE_MS = 110;
const BOOT_HOLD_MS = 900;

const MENU_ITEMS = [
  { id: "game", label: "STORY" },
  { id: "terminal", label: "TERMINAL" },
  { id: "reboot", label: "REBOOT" },
];

// Render resolution. The canvas is upscaled with image-rendering: pixelated.
const VIEW_W = 480;
const VIEW_H = 270;

// World is wider than view — camera scrolls horizontally.
const WORLD_W = 960;

const GRAVITY = 0.5;
const MOVE_SPEED = 2.0;
const JUMP_V = -8.4;
const COYOTE_FRAMES = 6;   // grace window after walking off a ledge
const JUMP_BUFFER_FRAMES = 6; // jump pressed shortly before landing still counts

// Each sector's silkscreen label sits above the ground at its midpoint.
const SECTORS = [
  { label: "MEMORY", x: 120, y: 240 },
  { label: "CPU", x: 480, y: 240 },
  { label: "I/O", x: 800, y: 240 },
];

// Solid platforms — physics treats every entry as a rectangle the player collides with.
const SOLIDS = [
  { x: 0, y: 254, w: WORLD_W, h: 16, type: "pcb-ground" },

  // MEMORY sector — climb left to right
  { x: 60, y: 218, w: 80, h: 14, type: "ram" },
  { x: 168, y: 184, w: 56, h: 12, type: "dip-short" },
  { x: 256, y: 144, w: 72, h: 14, type: "ram" },

  // CPU sector — heatsink + socket on ground level, DIP up high as a step
  { x: 372, y: 208, w: 96, h: 16, type: "heatsink" },
  { x: 488, y: 214, w: 80, h: 14, type: "cpu-socket" },
  { x: 568, y: 168, w: 80, h: 12, type: "dip-long" },

  // I/O sector — caps low, DIP mid, small DIP higher
  { x: 656, y: 206, w: 60, h: 14, type: "caps" },
  { x: 740, y: 174, w: 72, h: 12, type: "dip-long" },
  { x: 848, y: 200, w: 50, h: 12, type: "dip-short" },

  // CRT — also collidable
  { x: 920, y: 222, w: 32, h: 32, type: "crt" },
];

// Floppy "?" disks — bumped from below to reveal a fact.
const FLOPPIES_DATA = [
  { x: 92, y: 184, label: "EMAIL", reveal: "max@flach.io" },
  { x: 274, y: 100, label: "LINKEDIN", reveal: "/in/max-flach-67527618" },
  {
    x: 588, y: 124, label: "NOW",
    reveal: [
      "FOUNDER + CTO",
      "SERVO.MUSIC",
      "MUSICDATALABS",
      "STOCKHOLM, SE",
    ].join("\n"),
  },
  {
    x: 680, y: 144, label: "THEN",
    reveal: [
      "2018-24  CTO @ UTOPIA MUSIC",
      "2018+    MAX FLACH HOLDING",
      "2015-21  HUBORY (FIBER)",
      "2015-21  THE DIGITAL FAMILY",
      "2002-18  ISPY GROUP",
      "1998-03  QULIT",
    ].join("\n"),
  },
  {
    x: 768, y: 130, label: "STACK",
    reveal: [
      "[ LANGUAGES ]",
      "  c  c++  js  ts  python  go  rust php",
      "  perl  lua  bash  zsh  awk  sed  sql",
      "",
      "[ FRONTEND ]",
      "  react  vue  svelte  solid  vanilla  vite ",
      "  webpack  esbuild  tailwind  three.js  pixi.js",
      "",
      "[ BACKEND ]",
      "  node  express deno  bun  fastapi",
      "  php  gin  grpc  graphql  rest",
      "  websockets",
      "",
      "[ DATA ]",
      "  postgres  mysql  parquett  sqlite  redis  memcached",
      "  mongodb  cassandra  elasticsearch  duckdb  mqtt",
      "  bigquery  snowflake  rabbitmq  nats",
      "",
      "[ INFRA ]",
      "  docker  k8s  helm  terraform  aws  gcp",
      "  cloudflare  fastly  vercel  fly.io",
      "  linux  nginx  caddy  haproxy  traefik",
      "",
      "[ OBSERVABILITY ]",
      "  prometheus  grafana  datadog  sentry  honeycomb",
      "",
      "[ CI / CD ]",
      "  github actions  gitlab ci  circleci  jenkins",
      "  buildkite  argo  flux",
      "",
      "[ AI / ML ]",
      "  pytorch  tensorflow  huggingface  langchain",
      "  openai  anthropic  claude  gemini  ollama",
      "",
      "[ TOOLS ]",
      "  git  tmux  vim  claude code",
      "  figma  notion  linear  slack",
      "",
      "tools are easy. taste takes 30 years.",
    ].join("\n"),
  },
];

// Background props — purely decorative, no collision.
const PROPS = [
  // Resistors (horizontal yellow capsules with color bands)
  { type: "resistor", x: 16, y: 246, bands: ["#A02020", "#202020", "#A02020"] },
  { type: "resistor", x: 144, y: 246, bands: ["#FFD030", "#202020", "#FFD030"] },
  { type: "resistor", x: 332, y: 246, bands: ["#A02020", "#A02020", "#202020"] },
  { type: "resistor", x: 638, y: 246, bands: ["#3060FF", "#FFD030", "#202020"] },
  { type: "resistor", x: 836, y: 246, bands: ["#FFD030", "#A02020", "#3060FF"] },
  // Small capacitors scattered along the ground
  { type: "smallcap", x: 36, y: 240 },
  { type: "smallcap", x: 220, y: 240 },
  { type: "smallcap", x: 350, y: 240 },
  { type: "smallcap", x: 552, y: 240 },
  { type: "smallcap", x: 740, y: 240 },
  { type: "smallcap", x: 882, y: 240 },
  // Oscillator (silver can)
  { type: "oscillator", x: 230, y: 232 },
  { type: "oscillator", x: 720, y: 232 },
  // Coin-cell battery
  { type: "battery", x: 410, y: 234 },
  // Small flat chips (decorative, on the PCB)
  { type: "flatchip", x: 120, y: 234 },
  { type: "flatchip", x: 470, y: 234 },
  { type: "flatchip", x: 656, y: 234 },
];

// Blinking LEDs around the board.
const LEDS = [
  { x: 30, y: 30, c: "#FF3030", phase: 0 },
  { x: 100, y: 60, c: "#30FF60", phase: 0.3 },
  { x: 250, y: 28, c: "#FFD030", phase: 0.6 },
  { x: 380, y: 48, c: "#3060FF", phase: 0.9 },
  { x: 520, y: 28, c: "#FF3030", phase: 0.2 },
  { x: 700, y: 48, c: "#30FF60", phase: 0.5 },
  { x: 800, y: 28, c: "#FFD030", phase: 0.8 },
  { x: 900, y: 56, c: "#3060FF", phase: 0.1 },
];

// Polyline traces. Each is a list of points; we draw segments between them and
// animate a small data packet along the path.
const TRACE_PATHS = [
  [{ x: 0, y: 90 }, { x: 200, y: 90 }, { x: 200, y: 130 }, { x: 480, y: 130 }, { x: 480, y: 80 }, { x: WORLD_W, y: 80 }],
  [{ x: 50, y: 240 }, { x: 50, y: 100 }, { x: 130, y: 100 }],
  [{ x: 320, y: 240 }, { x: 320, y: 60 }, { x: 470, y: 60 }],
  [{ x: 680, y: 240 }, { x: 680, y: 50 }, { x: 920, y: 50 }],
  [{ x: 220, y: 240 }, { x: 220, y: 200 }, { x: 360, y: 200 }],
];

const TRACE_COLOR = "#A8842A";
const TRACE_PAD = "#C8A038";

// Precompute polyline segment lengths.
const TRACE_META = TRACE_PATHS.map((path) => {
  const segs = [];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const len = Math.abs(b.x - a.x) + Math.abs(b.y - a.y); // axis-aligned
    segs.push({ a, b, len, start: total });
    total += len;
  }
  return { segs, total };
});

function pointAlong(meta, dist) {
  const d = ((dist % meta.total) + meta.total) % meta.total;
  for (const s of meta.segs) {
    if (d <= s.start + s.len) {
      const t = (d - s.start) / s.len;
      return {
        x: s.a.x + (s.b.x - s.a.x) * t,
        y: s.a.y + (s.b.y - s.a.y) * t,
      };
    }
  }
  return meta.segs[0].a;
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export default function Home() {
  // Off-DOM canvas the game draws into. Pixi reads it as a texture.
  const canvasRef = useRef(null);
  if (canvasRef.current === null) {
    const c = document.createElement("canvas");
    c.width = VIEW_W;
    c.height = VIEW_H;
    canvasRef.current = c;
  }
  const threeHostRef = useRef(null);
  const pixiCanvasRef = useRef(null);
  const sceneRef = useRef(null);
  const filtersRef = useRef({ crt: null, rgb: null });

  const stateRef = useRef({
    player: { x: 24, y: 220, w: 12, h: 16, vx: 0, vy: 0, onGround: false, facing: 1, anim: 0, coyote: 0, jumpBuf: 0 },
    keys: {},
    floppies: FLOPPIES_DATA.map((f) => ({ ...f, w: 16, h: 16, hit: false, bump: 0 })),
    crtNear: false,
    cameraX: 0,
    t: 0,
    mode: "boot",                                        // "boot" | "menu" | "game" | "terminal"
    boot: { elapsed: 0, lineIndex: 0, postPause: 0 },
    menu: { selected: 0 },
    terminal: {
      cwd: "/",
      input: "",
      past: [],
      pastIdx: -1,
      history: [{ kind: "out", text: "FlachOS shell — type 'help'. Esc returns to menu." }],
    },
    reveal: null,                                        // { label, text } or null
  });

  const [mode, setMode] = useState("boot");
  const [foundCount, setFoundCount] = useState(0);
  const [reveal, setReveal] = useState(null);
  const foundCountRef = useRef(0);
  useEffect(() => { foundCountRef.current = foundCount; }, [foundCount]);

  // The DOM overlay that takes over the screen on disk pickup is positioned to
  // exactly cover the 3D monitor's screen plane; this ref points at the DOM div.
  const screenOverlayRef = useRef(null);

  function fireReveal(data) {
    stateRef.current.reveal = data;
    setReveal(data);
  }
  function clearReveal() {
    stateRef.current.reveal = null;
    setReveal(null);
  }

  function switchMode(next) {
    stateRef.current.mode = next;
    if (next === "boot") {
      stateRef.current.boot = { elapsed: 0, lineIndex: 0, postPause: 0 };
    }
    setMode(next);
  }

  // Input
  useEffect(() => {
    const s = stateRef.current;
    function down(e) {
      const k = e.key;

      // ----- Boot screen: any key skips ahead to the menu -----
      if (s.mode === "boot") {
        e.preventDefault();
        if (s.boot.lineIndex < BOOT_LINES.length) {
          s.boot.lineIndex = BOOT_LINES.length;
          s.boot.elapsed = BOOT_LINES.length * BOOT_LINE_MS;
        } else {
          switchMode("menu");
        }
        return;
      }

      // ----- Boot menu: ArrowUp/Down navigate, Enter selects -----
      if (s.mode === "menu") {
        if (k === "ArrowUp") {
          e.preventDefault();
          s.menu.selected = (s.menu.selected - 1 + MENU_ITEMS.length) % MENU_ITEMS.length;
        } else if (k === "ArrowDown") {
          e.preventDefault();
          s.menu.selected = (s.menu.selected + 1) % MENU_ITEMS.length;
        } else if (k === "Enter") {
          e.preventDefault();
          const item = MENU_ITEMS[s.menu.selected];
          if (item.id === "game") switchMode("game");
          else if (item.id === "terminal") switchMode("terminal");
          else if (item.id === "reboot") switchMode("boot");
        }
        return;
      }

      // ----- Terminal: capture all typing -----
      if (s.mode === "terminal") {
        const term = s.terminal;
        if (k === "Escape") {
          e.preventDefault();
          switchMode("menu");
          return;
        }
        if (k === "Enter") {
          e.preventDefault();
          const result = runTerminal(term.input, term.cwd);
          if (result.kind === "exit") {
            switchMode("menu");
            return;
          }
          if (result.kind === "clear") {
            term.history = [];
          } else if (result.kind === "cd") {
            term.history.push({ kind: "in", text: term.input, prompt: makePrompt(term.cwd) });
            term.cwd = result.cwd;
          } else {
            term.history.push({ kind: "in", text: term.input, prompt: makePrompt(term.cwd) });
            if (result.text) term.history.push({ kind: "out", text: result.text });
          }
          if (term.input.trim()) term.past.unshift(term.input);
          term.pastIdx = -1;
          term.input = "";
          return;
        }
        if (k === "Backspace") {
          e.preventDefault();
          term.input = term.input.slice(0, -1);
          return;
        }
        if (k === "Tab") {
          e.preventDefault();
          const r = completeTerminal(term.input, term.cwd);
          if (r.kind === "complete") {
            term.input = r.input;
          } else if (r.kind === "options") {
            // Echo the candidates above the prompt without consuming input
            term.history.push({
              kind: "in",
              text: term.input,
              prompt: makePrompt(term.cwd),
            });
            term.history.push({ kind: "out", text: r.matches.join("  ") });
          }
          return;
        }
        if (k === "ArrowUp") {
          e.preventDefault();
          const n = Math.min(term.pastIdx + 1, term.past.length - 1);
          if (n >= 0 && term.past[n] !== undefined) {
            term.pastIdx = n;
            term.input = term.past[n];
          }
          return;
        }
        if (k === "ArrowDown") {
          e.preventDefault();
          const n = term.pastIdx - 1;
          if (n < 0) { term.pastIdx = -1; term.input = ""; }
          else { term.pastIdx = n; term.input = term.past[n]; }
          return;
        }
        if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          term.input += k;
          return;
        }
        return;
      }

      // ----- Game mode -----
      if (s.reveal) {
        // Reveal modal is up — Esc closes it; everything else is blocked
        if (k === "Escape") {
          e.preventDefault();
          clearReveal();
        }
        return;
      }
      if (k === "Escape") {
        e.preventDefault();
        switchMode("menu");
        return;
      }
      if (k === "ArrowLeft" || k === "a" || k === "A") s.keys.left = true;
      else if (k === "ArrowRight" || k === "d" || k === "D") s.keys.right = true;
      else if (k === "w" || k === "W" || k === " ") {
        e.preventDefault();
        if (!s.keys.jump) s.player.jumpBuf = JUMP_BUFFER_FRAMES;
        s.keys.jump = true;
      } else if (k === "ArrowDown" || k === "s" || k === "S") {
        if (s.crtNear) {
          e.preventDefault();
          switchMode("terminal");
        }
      }
    }
    function up(e) {
      const k = e.key;
      if (k === "ArrowLeft" || k === "a" || k === "A") s.keys.left = false;
      else if (k === "ArrowRight" || k === "d" || k === "D") s.keys.right = false;
      else if (k === "w" || k === "W" || k === " ") s.keys.jump = false;
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Game loop — always running; update() branches on stateRef.current.mode
  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    let raf;
    let last = performance.now();
    function loop(now) {
      const dt = Math.min(2, (now - last) / 16.67);
      last = now;
      update(dt);
      draw(ctx);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  function update(dt) {
    const s = stateRef.current;
    s.t += dt;

    // Boot animation only advances during boot mode.
    // NOTE: dt is in frame-units (1 = one 60fps frame, ~16.67ms), not seconds.
    if (s.mode === "boot") {
      const dtMs = dt * 16.67;
      s.boot.elapsed += dtMs;
      s.boot.lineIndex = Math.min(
        BOOT_LINES.length,
        Math.floor(s.boot.elapsed / BOOT_LINE_MS)
      );
      if (s.boot.lineIndex >= BOOT_LINES.length) {
        s.boot.postPause += dtMs;
        if (s.boot.postPause > BOOT_HOLD_MS) switchMode("menu");
      }
      return;
    }

    // Menu mode: nothing to advance — just sit and wait for input.
    if (s.mode === "menu") return;

    // ----- Game mode (existing physics) -----
    const p = s.player;

    if (s.keys.left) { p.vx = -MOVE_SPEED; p.facing = -1; }
    else if (s.keys.right) { p.vx = MOVE_SPEED; p.facing = 1; }
    else p.vx *= 0.6;

    // Coyote time + jump buffer for forgiving platforming
    if (p.onGround) p.coyote = COYOTE_FRAMES;
    else p.coyote = Math.max(0, p.coyote - dt);
    if (p.jumpBuf > 0) p.jumpBuf = Math.max(0, p.jumpBuf - dt);
    if (p.jumpBuf > 0 && p.coyote > 0) {
      p.vy = JUMP_V;
      p.onGround = false;
      p.coyote = 0;
      p.jumpBuf = 0;
    }
    // Variable jump height — releasing jump cuts upward velocity
    if (!s.keys.jump && p.vy < 0) p.vy *= 0.65;

    p.vy += GRAVITY * dt;
    if (p.vy > 9) p.vy = 9;

    if (Math.abs(p.vx) > 0.1 && p.onGround) p.anim += 0.2 * dt;

    // X
    p.x += p.vx * dt;
    for (const sol of SOLIDS) {
      if (rectsOverlap(p, sol)) {
        if (p.vx > 0) p.x = sol.x - p.w;
        else if (p.vx < 0) p.x = sol.x + sol.w;
        p.vx = 0;
      }
    }
    if (p.x < 0) p.x = 0;
    if (p.x + p.w > WORLD_W) p.x = WORLD_W - p.w;

    // Y
    p.y += p.vy * dt;
    p.onGround = false;
    for (const sol of SOLIDS) {
      if (rectsOverlap(p, sol)) {
        if (p.vy > 0) {
          p.y = sol.y - p.h;
          p.vy = 0;
          p.onGround = true;
        } else if (p.vy < 0) {
          p.y = sol.y + sol.h;
          p.vy = 0;
        }
      }
    }
    if (p.y > VIEW_H + 50) {
      p.x = 24; p.y = 200; p.vx = 0; p.vy = 0;
    }

    // Floppy bumps
    for (const f of s.floppies) {
      if (f.bump > 0) f.bump = Math.max(0, f.bump - 0.6 * dt);
      if (!f.hit && rectsOverlap(p, { x: f.x, y: f.y, w: f.w, h: f.h })) {
        if (p.vy <= 0 && p.y + 2 > f.y) {
          f.hit = true;
          f.bump = 6;
          p.vy = Math.max(p.vy, 0.5);
          fireReveal({ label: f.label, text: f.reveal });
          setFoundCount((c) => c + 1);
        }
      }
    }

    // CRT proximity (canvas-rendered hint reads s.crtNear directly)
    const crt = SOLIDS.find((sol) => sol.type === "crt");
    s.crtNear = rectsOverlap(p, { x: crt.x - 6, y: crt.y - 6, w: crt.w + 12, h: crt.h + 12 });

    // Camera follows player
    const target = p.x + p.w / 2 - VIEW_W / 2;
    s.cameraX += (target - s.cameraX) * Math.min(1, 0.18 * dt);
    s.cameraX = Math.max(0, Math.min(WORLD_W - VIEW_W, s.cameraX));
  }

  // Render pipeline:
  //   2D game canvas (off-DOM)                 ← drawn by the game loop
  //     → Pixi WebGL canvas (off-DOM)          ← CRT + RGB-split filters applied
  //       → Three.js (CanvasTexture on the screen mesh inside the 3D 486 model)
  //         → renders to the visible canvas mounted in `threeHostRef`
  useEffect(() => {
    let cancelled = false;
    let app = null;
    let texture = null;
    let renderer = null;
    let raf = 0;
    let onResize = null;
    let onMouseMove = null;
    let mouseX = 0, mouseY = 0;

    (async () => {
      // ----- Pixi (off-DOM, fixed resolution) -----
      app = new Application();
      try {
        await app.init({
          width: PIXI_W,
          height: PIXI_H,
          backgroundAlpha: 0,
          antialias: false,
          autoDensity: false,
          resolution: 1,
          preserveDrawingBuffer: true, // so Three can sample the canvas
        });
      } catch (err) {
        console.error("pixi init failed", err);
        return;
      }
      if (cancelled || !threeHostRef.current) {
        try { app.destroy(true, { children: true, texture: true, textureSource: true }); } catch { }
        return;
      }
      pixiCanvasRef.current = app.canvas; // do NOT append to DOM

      texture = Texture.from(canvasRef.current);
      const sprite = new Sprite(texture);
      sprite.width = PIXI_W;
      sprite.height = PIXI_H;
      app.stage.addChild(sprite);

      const crt = new CRTFilter({
        curvature: 2,
        lineWidth: 1.0,
        lineContrast: 0.28,
        verticalLine: false,
        noise: 0.18,
        noiseSize: 1.2,
        vignetting: 0.32,
        vignettingAlpha: 0.7,
        vignettingBlur: 0.3,
        seed: 0,
        time: 0,
      });
      const rgb = new RGBSplitFilter({ red: [2, 0], green: [0, 0], blue: [-2, 0] });
      sprite.filters = [crt, rgb];
      filtersRef.current.crt = crt;
      filtersRef.current.rgb = rgb;

      app.ticker.add((ticker) => {
        const dt = ticker.deltaTime;
        texture.source.update();
        crt.time += dt * 0.05;
        crt.seed = Math.random();
      });

      // ----- Three.js scene -----
      const host = threeHostRef.current;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0a0805);

      const camera = new THREE.PerspectiveCamera(
        36,
        host.clientWidth / Math.max(1, host.clientHeight),
        0.1,
        100
      );
      // Pulled back + raised so the keyboard lands in the lower third of the frame.
      const camBase = new THREE.Vector3(0, 5.4, 9.4);
      const camTarget = new THREE.Vector3(0, 0.6, 1.1);
      camera.position.copy(camBase);
      camera.lookAt(camTarget);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(host.clientWidth, host.clientHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      host.appendChild(renderer.domElement);

      const built = buildComputerScene(pixiCanvasRef.current);
      scene.add(built.object3D);
      sceneRef.current = built;

      onMouseMove = (e) => {
        mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        mouseY = (e.clientY / window.innerHeight) * 2 - 1;
      };
      window.addEventListener("pointermove", onMouseMove);

      onResize = () => {
        if (!host) return;
        const w = host.clientWidth, h = Math.max(1, host.clientHeight);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener("resize", onResize);

      // Reused scratch vectors for the per-frame screen projection
      const projCorners = [
        new THREE.Vector3(), new THREE.Vector3(),
        new THREE.Vector3(), new THREE.Vector3(),
      ];

      let last = performance.now();
      const loop = (now) => {
        const dt = (now - last) / 1000;
        last = now;

        // Mouse parallax — small camera drift around the base position
        camera.position.x = camBase.x + mouseX * 0.45;
        camera.position.y = camBase.y + (-mouseY) * 0.25;
        camera.lookAt(camTarget);

        if (sceneRef.current) sceneRef.current.update(dt);
        renderer.render(scene, camera);

        // Project the 4 corners of the 3D screen plane to screen-space and
        // position the DOM overlay (used for the disk-reveal modal) over it.
        if (sceneRef.current?.screenMesh && screenOverlayRef.current) {
          const sm = sceneRef.current.screenMesh;
          const halfW = sceneRef.current.screenW / 2;
          const halfH = sceneRef.current.screenH / 2;
          projCorners[0].set(-halfW, -halfH, 0);
          projCorners[1].set(halfW, -halfH, 0);
          projCorners[2].set(halfW, halfH, 0);
          projCorners[3].set(-halfW, halfH, 0);
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const c of projCorners) {
            c.applyMatrix4(sm.matrixWorld).project(camera);
            const sx = (c.x * 0.5 + 0.5) * host.clientWidth;
            const sy = (-c.y * 0.5 + 0.5) * host.clientHeight;
            if (sx < minX) minX = sx;
            if (sy < minY) minY = sy;
            if (sx > maxX) maxX = sx;
            if (sy > maxY) maxY = sy;
          }
          const el = screenOverlayRef.current;
          el.style.left = `${minX}px`;
          el.style.top = `${minY}px`;
          el.style.width = `${maxX - minX}px`;
          el.style.height = `${maxY - minY}px`;
        }

        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (onResize) window.removeEventListener("resize", onResize);
      if (onMouseMove) window.removeEventListener("pointermove", onMouseMove);
      filtersRef.current.crt = null;
      filtersRef.current.rgb = null;
      const built = sceneRef.current;
      sceneRef.current = null;
      if (built) {
        built.object3D.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            const ms = Array.isArray(obj.material) ? obj.material : [obj.material];
            for (const m of ms) {
              if (m.map) m.map.dispose?.();
              m.dispose?.();
            }
          }
        });
        if (built.screenTexture) built.screenTexture.dispose();
      }
      if (renderer) {
        renderer.dispose();
        if (renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      }
      if (app) {
        try { app.destroy(true, { children: true, texture: true, textureSource: true }); } catch { }
      }
      pixiCanvasRef.current = null;
    };
  }, []);

  // Animate the matching 3D keycap on real keyboard activity.
  useEffect(() => {
    function down(e) {
      const built = sceneRef.current;
      if (built) setKeyState(built.keyMap, e.code, true);
    }
    function up(e) {
      const built = sceneRef.current;
      if (built) setKeyState(built.keyMap, e.code, false);
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Glitch flash: when a floppy is picked up, briefly amp the RGB split.
  useEffect(() => {
    if (foundCount === 0) return;
    const rgb = filtersRef.current.rgb;
    if (!rgb) return;
    rgb.red.x = 9;
    rgb.blue.x = -9;
    rgb.green.y = 2;
    const id = setTimeout(() => {
      if (!filtersRef.current.rgb) return;
      filtersRef.current.rgb.red.x = 2;
      filtersRef.current.rgb.blue.x = -2;
      filtersRef.current.rgb.green.y = 0;
    }, 280);
    return () => clearTimeout(id);
  }, [foundCount]);

  function draw(ctx) {
    const s = stateRef.current;

    if (s.mode === "boot") { drawBoot(ctx, s); return; }
    if (s.mode === "menu") { drawMenu(ctx, s); return; }
    if (s.mode === "terminal") { drawTerminal(ctx, s); return; }

    const cam = Math.round(s.cameraX);

    // Sky / motherboard backdrop
    ctx.fillStyle = "#003322";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.save();
    ctx.translate(-cam, 0);

    // Faint grid dots across the world
    ctx.fillStyle = "#0A4D2E";
    const startX = Math.floor(cam / 16) * 16;
    for (let y = 8; y < VIEW_H; y += 16) {
      for (let x = startX; x < cam + VIEW_W + 16; x += 16) {
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // Traces
    drawTraces(ctx, s.t);

    // Sector silkscreen labels (faint)
    ctx.fillStyle = "#0A6633";
    ctx.font = "8px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const sec of SECTORS) {
      ctx.fillText(sec.label, sec.x, sec.y);
    }
    // Version stamp
    ctx.textAlign = "left";
    ctx.fillStyle = "#0A6633";
    ctx.fillText("FLACH-IO REV 1.0", 6, 264);
    ctx.textAlign = "right";
    ctx.fillText("(C) 2026", WORLD_W - 6, 264);
    ctx.textAlign = "left";

    // Background LEDs
    for (const led of LEDS) {
      const on = ((s.t * 0.04) + led.phase) % 1 > 0.4;
      ctx.fillStyle = "#181818";
      ctx.fillRect(led.x - 1, led.y - 1, 6, 6);
      if (on) {
        ctx.fillStyle = led.c;
        ctx.fillRect(led.x, led.y, 4, 4);
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(led.x, led.y, 1, 1);
      } else {
        ctx.fillStyle = "#222";
        ctx.fillRect(led.x, led.y, 4, 4);
      }
    }

    // Decorative props
    for (const prop of PROPS) drawProp(ctx, prop);

    // Solids
    for (const sol of SOLIDS) drawSolid(ctx, sol, s.t);

    // Floppies
    for (const f of s.floppies) drawFloppy(ctx, f);

    // Player
    drawPlayer(ctx, s.player);

    ctx.restore();

    // Game-mode overlays (HUD, hints, reveal card, all-disks badge) — all in
    // canvas so they render on the in-monitor screen.
    drawGameOverlay(ctx, s, foundCountRef.current);
  }

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-[#0a0805]"
      style={{ fontFamily: "'Press Start 2P', monospace" }}
    >
      {/* Three.js canvas mounts here — renders the 3D 486 with the live screen */}
      <div ref={threeHostRef} className="absolute inset-0" />

      {/* DOM overlay positioned to exactly cover the 3D monitor's screen plane.
          Hidden visually unless `reveal` is set. Always present in the DOM so
          the render loop can keep its position in sync with the camera. */}
      <div
        ref={screenOverlayRef}
        className="absolute pointer-events-none"
        style={{ left: 0, top: 0, width: 0, height: 0, zIndex: 50 }}
      >
        {reveal && (
          <div
            className="w-full h-full bg-[#020210] text-[#C0E0FF] flex flex-col pointer-events-auto"
            style={{
              fontFamily: "'Press Start 2P', monospace",
              boxShadow: "inset 0 0 60px rgba(0,0,0,0.7)",
            }}
          >
            {/* Title bar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#9CC8FC]/40">
              <span className="text-[10px] text-[#FFD030] tracking-widest">
                ▸ {reveal.label}
              </span>
              <button
                onClick={clearReveal}
                className="text-[10px] text-[#FFD030] hover:text-white px-2 py-1 leading-none"
                style={{ fontFamily: "'Press Start 2P', monospace" }}
                aria-label="Close"
              >
                [ X ]
              </button>
            </div>

            {/* Body — linkified content, fills full width of the screen */}
            <div
              className="flex-1 overflow-auto px-3 py-2 leading-snug terminal-scroll"
              style={{ fontSize: "clamp(7px, 0.95vw, 12px)" }}
            >
              {reveal.text.split("\n").map((line, i) => (
                <div
                  key={i}
                  className="whitespace-pre-wrap break-words"
                  style={{ fontFamily: "'Press Start 2P', monospace" }}
                >
                  {linkifyLine(line)}
                </div>
              ))}
            </div>

            {/* Footer hint */}
            <div className="px-3 py-2 text-[8px] text-[#666] tracking-widest border-t border-[#9CC8FC]/20 text-center">
              ESC OR [ X ] TO CLOSE
            </div>
          </div>
        )}
      </div>

    </div>
  );
}


// ===== TRACES =====
function drawTraces(ctx, t) {
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
    // glow trail
    ctx.fillStyle = "#FFD0307F";
    ctx.fillRect(Math.round(p.x) - 2, Math.round(p.y) - 2, 4, 4);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2);
  }
}

// ===== SOLIDS =====
function drawSolid(ctx, s, t) {
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
  // Base
  ctx.fillStyle = "#606060";
  ctx.fillRect(s.x, s.y + s.h - 4, s.w, 4);
  // Vertical fins
  const finW = 3;
  const gap = 2;
  const stride = finW + gap;
  for (let x = s.x; x < s.x + s.w; x += stride) {
    ctx.fillStyle = "#A0A0A0";
    ctx.fillRect(x, s.y, finW, s.h - 4);
    ctx.fillStyle = "#404040";
    ctx.fillRect(x + finW, s.y, gap, s.h - 4);
  }
  // Top highlight
  ctx.fillStyle = "#D0D0D0";
  ctx.fillRect(s.x, s.y, s.w, 1);
}

function drawCpuSocket(ctx, s) {
  // Outer black housing
  ctx.fillStyle = "#101010";
  ctx.fillRect(s.x, s.y, s.w, s.h);
  // Inner socket grid (dark green)
  ctx.fillStyle = "#0A4D2E";
  ctx.fillRect(s.x + 2, s.y + 2, s.w - 4, s.h - 4);
  // Pin grid (gold dots)
  for (let y = s.y + 4; y < s.y + s.h - 2; y += 3) {
    for (let x = s.x + 4; x < s.x + s.w - 2; x += 3) {
      ctx.fillStyle = "#C8A038";
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // Pin-1 corner mark
  ctx.fillStyle = "#FFD030";
  ctx.fillRect(s.x + 1, s.y + 1, 2, 2);
  // Top edge highlight
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
  // Bottom shadow
  ctx.fillStyle = "#806440";
  ctx.fillRect(s.x + 2, s.y + s.h - 6, s.w - 4, 2);
  // Top highlight
  ctx.fillStyle = "#E0C898";
  pxRoundedRect(ctx, s.x, s.y, s.w, 1, 2);

  // Screen — even rounder
  const sx = s.x + 4;
  const sy = s.y + 4;
  const sw = s.w - 8;
  const sh = s.h - 14;
  ctx.fillStyle = "#000000";
  pxRoundedRect(ctx, sx, sy, sw, sh, 2);

  // Scan lines (clip-ish: stay 1px in from rounded edges)
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
// ===== BOOT + MENU =====
function drawBoot(ctx, s) {
  // BIOS-blue text on black, classic mid-90s POST screen
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.font = "8px 'Press Start 2P', monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#9CC8FC";

  const startX = 8;
  const startY = 8;
  const lineH = 12;
  const shown = s.boot.lineIndex;

  for (let i = 0; i < shown; i++) {
    ctx.fillText(BOOT_LINES[i], startX, startY + i * lineH);
  }

  // Blinking cursor at the end of the most-recent line (or below the last one)
  const cursorOn = ((s.t * 1000 + s.boot.elapsed) % 600) < 300;
  if (cursorOn) {
    const lastIdx = Math.max(0, shown - 1);
    const lastText = BOOT_LINES[Math.min(shown, BOOT_LINES.length - 1)] || "";
    const cursorX = startX + (shown < BOOT_LINES.length ? ctx.measureText(lastText).width : 0);
    const cursorY = startY + (shown < BOOT_LINES.length ? lastIdx : BOOT_LINES.length - 1) * lineH;
    ctx.fillRect(
      shown < BOOT_LINES.length ? cursorX : startX + ctx.measureText(BOOT_LINES[BOOT_LINES.length - 1]).width + 2,
      cursorY,
      6,
      8
    );
  }
}

function drawMenu(ctx, s) {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  // Title
  ctx.font = "16px 'Press Start 2P', monospace";
  ctx.fillStyle = "#FFD030";
  ctx.fillText("FlachOS", VIEW_W / 2, 30);
  ctx.font = "8px 'Press Start 2P', monospace";
  ctx.fillStyle = "#9CC8FC";
  ctx.fillText("BOOT MENU", VIEW_W / 2, 56);

  // Decorative box
  ctx.strokeStyle = "#9CC8FC";
  ctx.lineWidth = 1;
  const boxX = 80, boxY = 84, boxW = VIEW_W - 160, boxH = 130;
  ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW, boxH);

  // Items
  ctx.textAlign = "left";
  ctx.font = "8px 'Press Start 2P', monospace";
  const itemX = boxX + 22;
  const itemY = boxY + 22;
  const lineH = 18;
  MENU_ITEMS.forEach((item, i) => {
    const y = itemY + i * lineH;
    const selected = s.menu.selected === i;
    if (selected) {
      const blink = ((s.t * 1000) % 600) < 300;
      ctx.fillStyle = "#FFD030";
      if (blink) ctx.fillText(">", itemX - 14, y);
      ctx.fillText(item.label, itemX, y);
    } else {
      ctx.fillStyle = "#9CC8FC";
      ctx.fillText(item.label, itemX, y);
    }
  });

  // Hint
  ctx.fillStyle = "#666666";
  ctx.textAlign = "center";
  ctx.fillText("UP / DOWN  -  ENTER", VIEW_W / 2, boxY + boxH + 14);

  // Footer brand
  ctx.fillStyle = "#444444";
  ctx.fillText("FLACH-IO  REV  1.0", VIEW_W / 2, VIEW_H - 16);
}

// Game-mode overlays drawn on the same 2D canvas as the game world.
function drawGameOverlay(ctx, s, foundCount) {
  ctx.font = "8px 'Press Start 2P', monospace";
  ctx.textBaseline = "top";

  // ----- DISKS x/N (top-left) -----
  const disksText = `DISKS ${foundCount}/${s.floppies.length}`;
  ctx.textAlign = "left";
  textWithShadow(ctx, disksText, 6, 6, "#F5F5DC");

  // ----- Controls (top-right) -----
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

  // ----- ↓ TO BOOT (when near CRT) -----
  if (s.crtNear) {
    ctx.textAlign = "center";
    const blink = ((s.t * 1000) % 700) < 350;
    if (blink) textWithShadow(ctx, "DOWN  TO  BOOT", VIEW_W / 2, VIEW_H - 30, "#FFD030");
  }

  // ----- ALL DISKS RECOVERED (full set) -----
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

// Wrap email/URL substrings in clickable <a>. Non-matching text stays plain.
function linkifyLine(line) {
  const pattern = /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})|((?:https?:\/\/|www\.)[^\s]+)|(linkedin\.com\/[^\s]+)|(github\.com\/[^\s]+)|(\/in\/[A-Za-z0-9._-]+)/gi;
  const matches = [...line.matchAll(pattern)];
  if (!matches.length) return [line];

  const out = [];
  let lastIdx = 0, key = 0;
  for (const m of matches) {
    const start = m.index;
    if (start > lastIdx) out.push(line.slice(lastIdx, start));
    const matched = m[0];
    let href = matched;
    if (m[1]) href = `mailto:${matched}`;
    else if (matched.startsWith("www.")) href = `https://${matched}`;
    else if (matched.startsWith("/in/")) href = `https://linkedin.com${matched}`;
    else if (matched.startsWith("linkedin.com")) href = `https://${matched}`;
    else if (matched.startsWith("github.com")) href = `https://${matched}`;
    out.push(
      <a
        key={`l${key++}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#FFD030] underline hover:text-white"
      >
        {matched}
      </a>
    );
    lastIdx = start + matched.length;
  }
  if (lastIdx < line.length) out.push(line.slice(lastIdx));
  return out;
}

function drawTerminal(ctx, s) {
  const { terminal, t } = s;
  // Background
  ctx.fillStyle = "#020210";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.font = "8px 'Press Start 2P', monospace";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  const margin = 6;
  const lineH = 11;
  const charW = ctx.measureText("M").width || 7;
  const maxCols = Math.floor((VIEW_W - margin * 2) / charW);
  const promptLineY = VIEW_H - margin - lineH;
  const visibleHistoryLines = Math.floor((promptLineY - margin) / lineH);

  // Flatten history into wrapped lines
  const lines = [];
  for (const h of terminal.history) {
    if (h.kind === "in") {
      const text = (h.prompt || "") + h.text;
      const wrapped = wrapForTerminal(text, maxCols);
      for (const w of wrapped) lines.push({ kind: "in", text: w });
    } else {
      for (const raw of h.text.split("\n")) {
        const wrapped = wrapForTerminal(raw, maxCols);
        if (wrapped.length === 0) lines.push({ kind: "out", text: "" });
        else for (const w of wrapped) lines.push({ kind: "out", text: w });
      }
    }
  }

  const start = Math.max(0, lines.length - visibleHistoryLines);
  let y = margin;
  for (let i = start; i < lines.length; i++) {
    const ln = lines[i];
    ctx.fillStyle = ln.kind === "in" ? "#9CC8FC" : "#C0E0FF";
    ctx.fillText(ln.text, margin, y);
    y += lineH;
  }

  // Prompt + input on the bottom row
  const prompt = makePrompt(terminal.cwd);
  ctx.fillStyle = "#30FF60";
  ctx.fillText(prompt, margin, promptLineY);
  ctx.fillStyle = "#FCFCFC";
  const promptWidth = ctx.measureText(prompt).width;
  // Truncate input from the left if it would overflow
  const availChars = Math.max(8, maxCols - prompt.length - 1);
  let displayInput = terminal.input;
  if (displayInput.length > availChars) {
    displayInput = "…" + displayInput.slice(-(availChars - 1));
  }
  ctx.fillText(displayInput, margin + promptWidth, promptLineY);

  // Blinking caret
  const blink = ((t * 16.67) % 600) < 300;
  if (blink) {
    const caretX = margin + promptWidth + ctx.measureText(displayInput).width + 1;
    ctx.fillStyle = "#FCFCFC";
    ctx.fillRect(caretX, promptLineY, 5, 8);
  }
}

function wrapForTerminal(text, maxCols) {
  if (!text) return [""];
  const out = [];
  for (let i = 0; i < text.length; i += maxCols) {
    out.push(text.slice(i, i + maxCols));
  }
  return out;
}

function drawProp(ctx, p) {
  switch (p.type) {
    case "resistor": {
      // Lead wires
      ctx.fillStyle = "#B0B0B0";
      ctx.fillRect(p.x - 3, p.y + 3, 3, 1);
      ctx.fillRect(p.x + 14, p.y + 3, 3, 1);
      // Body (capsule)
      ctx.fillStyle = "#D8B070";
      ctx.fillRect(p.x, p.y + 1, 14, 5);
      ctx.fillStyle = "#A88040";
      ctx.fillRect(p.x, p.y + 5, 14, 1);
      // Color bands
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
      // Silver can
      ctx.fillStyle = "#909090";
      ctx.fillRect(p.x, p.y, 14, 8);
      ctx.fillStyle = "#C0C0C0";
      ctx.fillRect(p.x, p.y, 14, 1);
      ctx.fillRect(p.x, p.y, 1, 8);
      ctx.fillStyle = "#606060";
      ctx.fillRect(p.x, p.y + 7, 14, 1);
      ctx.fillRect(p.x + 13, p.y, 1, 8);
      // Imprint
      ctx.fillStyle = "#404040";
      ctx.fillRect(p.x + 3, p.y + 3, 8, 1);
      ctx.fillRect(p.x + 3, p.y + 5, 8, 1);
      break;
    }
    case "battery": {
      // Coin cell from the side
      ctx.fillStyle = "#A0A0A0";
      ctx.fillRect(p.x, p.y, 18, 6);
      ctx.fillStyle = "#D0D0D0";
      ctx.fillRect(p.x, p.y, 18, 1);
      ctx.fillStyle = "#606060";
      ctx.fillRect(p.x, p.y + 5, 18, 1);
      // "+" mark
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
      // Tiny pins
      ctx.fillStyle = "#B0B0B0";
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(p.x + 1 + i * 3, p.y + 6, 2, 1);
      }
      break;
    }
  }
}

// ===== FLOPPY =====
function drawFloppy(ctx, f) {
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
  hoodie: "#2A6B7B",   // teal
  hoodieS: "#1A4651",   // hoodie shadow
  string: "#D8E8E8",   // hoodie drawstrings
  pants: "#1A1A2A",
  shoe: "#0E0E14",
  sole: "#F0F0F0",
  black: "#181818",
  white: "#FCFCFC",
};

function drawPlayer(ctx, p) {
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  const f = p.facing;
  const stepFrame = Math.floor(p.anim) % 2;

  // ---- Hair (top + sides, no cap) ----
  ctx.fillStyle = C.hair;
  ctx.fillRect(x + 3, y, 6, 1);
  ctx.fillRect(x + 2, y + 1, 8, 2);
  // sides extending down to ear-level
  ctx.fillRect(x + 2, y + 3, 1, 2);
  ctx.fillRect(x + 9, y + 3, 1, 2);
  // Asymmetric fringe to hint facing direction
  if (f > 0) {
    ctx.fillRect(x + 7, y + 3, 2, 1);
  } else {
    ctx.fillRect(x + 3, y + 3, 2, 1);
  }

  // ---- Face ----
  ctx.fillStyle = C.skin;
  ctx.fillRect(x + 3, y + 3, 6, 4);
  // Reset hair-overlap pixels on the side opposite to fringe
  // (already drawn above, fine)

  // ---- Glasses ----
  ctx.fillStyle = C.black;
  // Frames: two square lenses + bridge
  ctx.fillRect(x + 3, y + 4, 2, 2); // left lens
  ctx.fillRect(x + 7, y + 4, 2, 2); // right lens
  ctx.fillRect(x + 5, y + 5, 2, 1); // bridge
  // Lens reflections
  ctx.fillStyle = C.white;
  ctx.fillRect(x + 3, y + 4, 1, 1);
  ctx.fillRect(x + 7, y + 4, 1, 1);

  // ---- Neck (skin) ----
  ctx.fillStyle = C.skin;
  ctx.fillRect(x + 5, y + 7, 2, 1);

  // ---- Hoodie (collar + body) ----
  ctx.fillStyle = C.hoodie;
  // Collar (slightly raised at the back)
  ctx.fillRect(x + 3, y + 7, 2, 1);
  ctx.fillRect(x + 7, y + 7, 2, 1);
  // Body
  ctx.fillRect(x + 1, y + 8, 10, 4);
  // Hoodie shadow band along the bottom edge
  ctx.fillStyle = C.hoodieS;
  ctx.fillRect(x + 1, y + 11, 10, 1);
  // Drawstrings (two short strings hanging from collar)
  ctx.fillStyle = C.string;
  ctx.fillRect(x + 5, y + 8, 1, 2);
  ctx.fillRect(x + 6, y + 8, 1, 2);

  // ---- Hands (skin), poking out of sleeves ----
  ctx.fillStyle = C.skin;
  ctx.fillRect(x, y + 10, 1, 2);
  ctx.fillRect(x + 11, y + 10, 1, 2);

  // ---- Pants (dark) ----
  ctx.fillStyle = C.pants;
  if (p.onGround && Math.abs(p.vx) > 0.1) {
    // Walking — alternate stride
    if (stepFrame === 0) {
      ctx.fillRect(x + 1, y + 12, 4, 3);
      ctx.fillRect(x + 7, y + 12, 4, 3);
    } else {
      ctx.fillRect(x + 2, y + 12, 4, 3);
      ctx.fillRect(x + 6, y + 12, 4, 3);
    }
  } else if (!p.onGround) {
    // Jumping — knees in
    ctx.fillRect(x + 2, y + 12, 4, 3);
    ctx.fillRect(x + 6, y + 12, 4, 3);
  } else {
    // Standing
    ctx.fillRect(x + 2, y + 12, 3, 3);
    ctx.fillRect(x + 7, y + 12, 3, 3);
  }

  // ---- Sneakers ----
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
    // Pointed feet on jump
    ctx.fillRect(x + 1, y + 15, 4, 1);
    ctx.fillRect(x + 7, y + 15, 4, 1);
  } else {
    ctx.fillRect(x + 1, y + 15, 4, 1);
    ctx.fillRect(x + 7, y + 15, 4, 1);
    // White sole stripe when standing (sneaker detail)
    ctx.fillStyle = C.sole;
    ctx.fillRect(x + 1, y + 14, 1, 1);
    ctx.fillRect(x + 10, y + 14, 1, 1);
  }
}

