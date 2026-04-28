import { useEffect, useRef, useState } from "react";
import { Application, Sprite, Texture } from "pixi.js";
import { CRTFilter, RGBSplitFilter } from "pixi-filters";
import Terminal from "./Terminal";

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
  { label: "CPU",    x: 480, y: 240 },
  { label: "I/O",    x: 800, y: 240 },
];

// Solid platforms — physics treats every entry as a rectangle the player collides with.
const SOLIDS = [
  { x: 0,   y: 254, w: WORLD_W, h: 16, type: "pcb-ground" },

  // MEMORY sector — climb left to right
  { x: 60,  y: 218, w: 80,  h: 14, type: "ram" },
  { x: 168, y: 184, w: 56,  h: 12, type: "dip-short" },
  { x: 256, y: 144, w: 72,  h: 14, type: "ram" },

  // CPU sector — heatsink + socket on ground level, DIP up high as a step
  { x: 372, y: 208, w: 96,  h: 16, type: "heatsink" },
  { x: 488, y: 214, w: 80,  h: 14, type: "cpu-socket" },
  { x: 568, y: 168, w: 80,  h: 12, type: "dip-long" },

  // I/O sector — caps low, DIP mid, small DIP higher
  { x: 656, y: 206, w: 60,  h: 14, type: "caps" },
  { x: 740, y: 174, w: 72,  h: 12, type: "dip-long" },
  { x: 848, y: 200, w: 50,  h: 12, type: "dip-short" },

  // CRT — also collidable
  { x: 920, y: 222, w: 32,  h: 32, type: "crt" },
];

// Floppy "?" disks — bumped from below to reveal a fact.
const FLOPPIES_DATA = [
  { x: 92,  y: 184, label: "EMAIL",    reveal: "max@flach.io" },
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
      "C  JS  TS  PY  PHP  GO",
      "REACT  NODE  NEXT  VUE",
      "POSTGRES  MYSQL  REDIS",
      "DOCKER  K8S  LINUX",
      "AWS  GCP  CLOUDFLARE",
      "...AND WHATEVER SHIPS",
    ].join("\n"),
  },
];

// Background props — purely decorative, no collision.
const PROPS = [
  // Resistors (horizontal yellow capsules with color bands)
  { type: "resistor", x: 16,  y: 246, bands: ["#A02020", "#202020", "#A02020"] },
  { type: "resistor", x: 144, y: 246, bands: ["#FFD030", "#202020", "#FFD030"] },
  { type: "resistor", x: 332, y: 246, bands: ["#A02020", "#A02020", "#202020"] },
  { type: "resistor", x: 638, y: 246, bands: ["#3060FF", "#FFD030", "#202020"] },
  { type: "resistor", x: 836, y: 246, bands: ["#FFD030", "#A02020", "#3060FF"] },
  // Small capacitors scattered along the ground
  { type: "smallcap", x: 36,  y: 240 },
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
  { x: 30,  y: 30,  c: "#FF3030", phase: 0   },
  { x: 100, y: 60,  c: "#30FF60", phase: 0.3 },
  { x: 250, y: 28,  c: "#FFD030", phase: 0.6 },
  { x: 380, y: 48,  c: "#3060FF", phase: 0.9 },
  { x: 520, y: 28,  c: "#FF3030", phase: 0.2 },
  { x: 700, y: 48,  c: "#30FF60", phase: 0.5 },
  { x: 800, y: 28,  c: "#FFD030", phase: 0.8 },
  { x: 900, y: 56,  c: "#3060FF", phase: 0.1 },
];

// Polyline traces. Each is a list of points; we draw segments between them and
// animate a small data packet along the path.
const TRACE_PATHS = [
  [{ x: 0,   y: 90  }, { x: 200, y: 90  }, { x: 200, y: 130 }, { x: 480, y: 130 }, { x: 480, y: 80  }, { x: WORLD_W, y: 80 }],
  [{ x: 50,  y: 240 }, { x: 50,  y: 100 }, { x: 130, y: 100 }],
  [{ x: 320, y: 240 }, { x: 320, y: 60  }, { x: 470, y: 60  }],
  [{ x: 680, y: 240 }, { x: 680, y: 50  }, { x: 920, y: 50  }],
  [{ x: 220, y: 240 }, { x: 220, y: 200 }, { x: 360, y: 200 }],
];

const TRACE_COLOR = "#A8842A";
const TRACE_PAD   = "#C8A038";

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
  const pixiHostRef = useRef(null);
  const filtersRef = useRef({ crt: null, rgb: null });

  const stateRef = useRef({
    player: { x: 24, y: 220, w: 12, h: 16, vx: 0, vy: 0, onGround: false, facing: 1, anim: 0, coyote: 0, jumpBuf: 0 },
    keys: {},
    floppies: FLOPPIES_DATA.map((f) => ({ ...f, w: 16, h: 16, hit: false, bump: 0 })),
    crtNear: false,
    cameraX: 0,
    t: 0,
  });

  const [reveal, setReveal] = useState(null);
  const [foundCount, setFoundCount] = useState(0);
  const [crtNear, setCrtNear] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);

  // Input
  useEffect(() => {
    const s = stateRef.current;
    function down(e) {
      const k = e.key;
      if (terminalOpen) return;
      if (k === "ArrowLeft" || k === "a" || k === "A") s.keys.left = true;
      else if (k === "ArrowRight" || k === "d" || k === "D") s.keys.right = true;
      else if (k === "w" || k === "W" || k === " ") {
        e.preventDefault();
        if (!s.keys.jump) s.player.jumpBuf = JUMP_BUFFER_FRAMES;
        s.keys.jump = true;
      } else if (k === "ArrowDown" || k === "s" || k === "S") {
        if (s.crtNear) {
          e.preventDefault();
          setTerminalOpen(true);
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
  }, [terminalOpen]);

  // Game loop
  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    let raf;
    let last = performance.now();
    function loop(now) {
      const dt = Math.min(2, (now - last) / 16.67);
      last = now;
      if (!terminalOpen) update(dt);
      draw(ctx);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [terminalOpen]);

  function update(dt) {
    const s = stateRef.current;
    s.t += dt;
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
          setReveal({ label: f.label, text: f.reveal });
          setFoundCount((c) => c + 1);
        }
      }
    }

    // CRT proximity
    const crt = SOLIDS.find((s) => s.type === "crt");
    const near = rectsOverlap(p, { x: crt.x - 6, y: crt.y - 6, w: crt.w + 12, h: crt.h + 12 });
    if (near !== s.crtNear) {
      s.crtNear = near;
      setCrtNear(near);
    }

    // Camera follows player
    const target = p.x + p.w / 2 - VIEW_W / 2;
    s.cameraX += (target - s.cameraX) * Math.min(1, 0.18 * dt);
    s.cameraX = Math.max(0, Math.min(WORLD_W - VIEW_W, s.cameraX));
  }

  useEffect(() => {
    if (!reveal) return;
    const id = setTimeout(() => setReveal(null), 3500);
    return () => clearTimeout(id);
  }, [reveal]);

  // Pixi: mount a WebGL canvas that uses the off-DOM game canvas as a texture and
  // pipes it through CRT + RGB-split filters before display.
  useEffect(() => {
    let cancelled = false;
    let app = null;
    let texture = null;

    (async () => {
      app = new Application();
      try {
        await app.init({
          resizeTo: pixiHostRef.current,
          backgroundAlpha: 0,
          antialias: false,
          autoDensity: true,
          resolution: window.devicePixelRatio || 1,
        });
      } catch (err) {
        console.error("pixi init failed", err);
        return;
      }
      if (cancelled || !pixiHostRef.current) {
        try { app.destroy(true, { children: true, texture: true, textureSource: true }); } catch {}
        return;
      }

      pixiHostRef.current.appendChild(app.canvas);

      texture = Texture.from(canvasRef.current);
      const sprite = new Sprite(texture);
      sprite.width = app.screen.width;
      sprite.height = app.screen.height;
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
      const rgb = new RGBSplitFilter([2, 0], [0, 0], [-2, 0]);

      sprite.filters = [crt, rgb];
      filtersRef.current.crt = crt;
      filtersRef.current.rgb = rgb;

      app.ticker.add((ticker) => {
        const dt = ticker.deltaTime;
        // Push the latest 2D-canvas frame to the GPU
        texture.source.update();
        crt.time += dt * 0.05;
        crt.seed = Math.random();
      });

      const onResize = () => {
        sprite.width = app.screen.width;
        sprite.height = app.screen.height;
      };
      app.renderer.on("resize", onResize);
    })();

    return () => {
      cancelled = true;
      filtersRef.current.crt = null;
      filtersRef.current.rgb = null;
      if (app) {
        try { app.destroy(true, { children: true, texture: true, textureSource: true }); } catch {}
      }
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
    // Scanlines + vignette + noise are added by the Pixi CRT filter post-process.
  }

  return (
    <div className="crt-bezel">
      <div
        className="crt-screen-area"
        style={{ fontFamily: "'Press Start 2P', monospace" }}
      >
        {/* Big silkscreen sign — sits behind the canvas */}
        <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none select-none">
          <div
            className="text-center leading-tight"
            style={{
              color: "#0A4D2E",
              fontSize: "min(11vw, 11vh)",
              letterSpacing: "0.05em",
              opacity: 0.85,
            }}
          >
            NOTHING<br />TO SEE<br />HERE
          </div>
        </div>

        {/* Pixi WebGL canvas mounts here — applies CRT, scanlines, RGB split, noise */}
        <div ref={pixiHostRef} className="crt-host" />


        <Hud foundCount={foundCount} total={FLOPPIES_DATA.length} />

        {crtNear && !terminalOpen && (
          <div
            className="absolute z-20 left-1/2 -translate-x-1/2 text-[#FFD030] text-[10px] md:text-xs animate-bounce"
            style={{ bottom: "22%", textShadow: "2px 2px 0 #000" }}
          >
            ↓ TO BOOT
          </div>
        )}

        {reveal && (
          <div
            className="absolute z-30 top-[28%] left-1/2 -translate-x-1/2 bg-[#F5F5DC] text-[#181818] px-5 py-3 text-center"
            style={{
              border: "4px solid #181818",
              boxShadow: "6px 6px 0 #181818",
              fontFamily: "'Press Start 2P', monospace",
            }}
          >
            <div className="text-[8px] text-[#888] mb-2 tracking-wider">▸ {reveal.label}</div>
            <pre className="text-[9px] md:text-[11px] whitespace-pre leading-relaxed" style={{ fontFamily: "'Press Start 2P', monospace" }}>
              {reveal.text}
            </pre>
          </div>
        )}

        {foundCount === FLOPPIES_DATA.length && (
          <div
            className="absolute z-20 bottom-3 left-1/2 -translate-x-1/2 text-[#FFD030] text-[10px] md:text-xs"
            style={{ textShadow: "2px 2px 0 #000" }}
          >
            ★ ALL DISKS RECOVERED ★
          </div>
        )}

        {terminalOpen && <Terminal onClose={() => setTerminalOpen(false)} />}
      </div>

      {/* Bezel chrome */}
      <div className="crt-power" />
      <span className="crt-power-label">PWR</span>
      <div className="crt-brand">FLACH-IO</div>
    </div>
  );
}

function Hud({ foundCount, total }) {
  return (
    <>
      <div
        className="absolute top-3 left-3 z-20 text-[#F5F5DC] text-[9px] md:text-xs"
        style={{ textShadow: "2px 2px 0 #000" }}
      >
        DISKS {foundCount}/{total}
      </div>
      <div
        className="absolute top-3 right-3 z-20 text-[#F5F5DC] text-[9px] md:text-xs text-right leading-relaxed"
        style={{ textShadow: "2px 2px 0 #000" }}
      >
        <div>← → MOVE</div>
        <div>SPACE JUMP</div>
        <div>↓ AT CRT</div>
      </div>
    </>
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
    case "pcb-ground":     return drawPcbGround(ctx, s);
    case "ram":            return drawRam(ctx, s);
    case "dip-long":
    case "dip-short":      return drawDip(ctx, s);
    case "caps":           return drawCaps(ctx, s);
    case "heatsink":       return drawHeatsink(ctx, s);
    case "cpu-socket":     return drawCpuSocket(ctx, s);
    case "crt":            return drawCrt(ctx, s, t);
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
  hair:   "#3A2412",   // dark brown
  skin:   "#F4C8A8",
  hoodie: "#2A6B7B",   // teal
  hoodieS:"#1A4651",   // hoodie shadow
  string: "#D8E8E8",   // hoodie drawstrings
  pants:  "#1A1A2A",
  shoe:   "#0E0E14",
  sole:   "#F0F0F0",
  black:  "#181818",
  white:  "#FCFCFC",
};

function drawPlayer(ctx, p) {
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  const f = p.facing;
  const stepFrame = Math.floor(p.anim) % 2;

  // ---- Hair (top + sides, no cap) ----
  ctx.fillStyle = C.hair;
  ctx.fillRect(x + 3, y,     6, 1);
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
  ctx.fillRect(x,     y + 10, 1, 2);
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
      ctx.fillRect(x,     y + 15, 4, 1);
      ctx.fillRect(x + 7, y + 15, 5, 1);
    } else {
      ctx.fillRect(x,     y + 15, 5, 1);
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

