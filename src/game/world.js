// Game world: constants, level data (solids/floppies/props/leds/traces), and a
// couple of pure geometry helpers. No drawing, no rendering, no React.

// Render resolution. The 2D canvas is upscaled with image-rendering: pixelated.
export const VIEW_W = 480;
export const VIEW_H = 270;

// World is wider than view — camera scrolls horizontally.
export const WORLD_W = 960;

export const GRAVITY = 0.5;
export const MOVE_SPEED = 2.0;
export const JUMP_V = -8.4;
export const COYOTE_FRAMES = 6;       // grace window after walking off a ledge
export const JUMP_BUFFER_FRAMES = 6;  // jump pressed shortly before landing still counts

// Each sector's silkscreen label sits above the ground at its midpoint.
export const SECTORS = [
  { label: "MEMORY", x: 120, y: 240 },
  { label: "CPU", x: 480, y: 240 },
  { label: "I/O", x: 800, y: 240 },
];

// Solid platforms — physics treats every entry as a rectangle the player collides with.
export const SOLIDS = [
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
export const FLOPPIES_DATA = [
  { x: 92, y: 184, label: "EMAIL", reveal: "max@flach.io" },
  { x: 274, y: 100, label: "LINKEDIN", reveal: "/in/max-flach-67527618" },
  {
    x: 588, y: 124, label: "NOW",
    reveal: [
      "FOUNDER + CTO",
      "MUSICDATALABS  -  musicdatalabs.com",
      "  SERVO.MUSIC  -  servo.music",
      "STOCKHOLM, SE",
    ].join("\n"),
  },
  {
    x: 680, y: 144, label: "THEN",
    reveal: [
      "2018-24  CTO + CHIEF ARCHITECT @ UTOPIA MUSIC",
      "2018+    MAX FLACH HOLDING (ANGEL)",
      "2015-21  HUBORY (FIBER + TV ACTIVATION)",
      "2015-21  THE DIGITAL FAMILY (AGENCY + INCUBATOR)",
      "2003-18  ISPY (DIGITAL AGENCY, ACQ. UTOPIA 2018)",
      "1999-03  QULIT (DOT-COM CONSULTANCY)",
      "",
      "1989  first line of code, age 8",
      "1995  sold first software, age 14",
      "1999  first company, age 18",
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
export const PROPS = [
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
export const LEDS = [
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
export const TRACE_PATHS = [
  [{ x: 0, y: 90 }, { x: 200, y: 90 }, { x: 200, y: 130 }, { x: 480, y: 130 }, { x: 480, y: 80 }, { x: WORLD_W, y: 80 }],
  [{ x: 50, y: 240 }, { x: 50, y: 100 }, { x: 130, y: 100 }],
  [{ x: 320, y: 240 }, { x: 320, y: 60 }, { x: 470, y: 60 }],
  [{ x: 680, y: 240 }, { x: 680, y: 50 }, { x: 920, y: 50 }],
  [{ x: 220, y: 240 }, { x: 220, y: 200 }, { x: 360, y: 200 }],
];

export const TRACE_COLOR = "#A8842A";
export const TRACE_PAD = "#C8A038";

// Precompute polyline segment lengths.
export const TRACE_META = TRACE_PATHS.map((path) => {
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

export function pointAlong(meta, dist) {
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

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
