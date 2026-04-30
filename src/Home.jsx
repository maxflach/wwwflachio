import { useEffect, useRef, useState } from "react";
import { Application, Sprite, Texture } from "pixi.js";
import { CRTFilter, RGBSplitFilter } from "pixi-filters";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

import { buildComputerScene, setKeyState } from "./computerModel";
import { run as runTerminal, makePrompt, complete as completeTerminal } from "./terminalCore";
import TouchControls from "./TouchControls";
import TerminalSoftKeyboardBridge from "./components/TerminalSoftKeyboardBridge";
import { linkifyLine } from "./utils/linkify";

import {
  VIEW_W, VIEW_H, WORLD_W,
  GRAVITY, MOVE_SPEED, JUMP_V, COYOTE_FRAMES, JUMP_BUFFER_FRAMES,
  SECTORS, SOLIDS, FLOPPIES_DATA, PROPS, LEDS,
  rectsOverlap,
} from "./game/world";
import {
  drawTraces, drawSolid, drawProp, drawFloppy, drawPlayer, drawGameOverlay,
} from "./game/draw";
import { BOOT_LINES, BOOT_LINE_MS, BOOT_HOLD_MS, drawBoot } from "./screens/boot";
import { MENU_ITEMS, drawMenu } from "./screens/menu";
import { drawTerminal } from "./screens/terminal";
import { drawScreensaver, updateScreensaver } from "./screens/screensaver";

// Switch to screensaver after this much idle time (no key activity)
const IDLE_TIMEOUT_MS = 30000;

const IS_TOUCH = typeof window !== "undefined" &&
  ("ontouchstart" in window || (navigator?.maxTouchPoints || 0) > 0);

// Pixi internal render-target dimensions. Higher than the game canvas so the CRT
// filter scanlines/noise stay crisp when sampled as a texture in 3D.
const PIXI_W = 960;
const PIXI_H = 540;

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
    mode: "boot",                              // "boot" | "menu" | "game" | "terminal" | "screensaver"
    savedMode: "menu",                         // mode to return to from screensaver
    lastActivity: performance.now(),
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
  // iOS soft keyboard only pops on focus() inside a real touch handler — we
  // show a "TAP TO TYPE" overlay until the bridge is actually focused.
  const [bridgeFocused, setBridgeFocused] = useState(false);
  useEffect(() => { if (mode !== "terminal") setBridgeFocused(false); }, [mode]);

  // Track the soft-keyboard height via visualViewport so we can shift the
  // 3D scene up (keyboard otherwise covers the lower half of the monitor).
  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      setKbHeight(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    };
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    onResize();
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
    };
  }, []);
  const sceneShift = mode === "terminal" && kbHeight > 0 ? kbHeight * 0.5 : 0;
  const foundCountRef = useRef(0);
  useEffect(() => { foundCountRef.current = foundCount; }, [foundCount]);

  // The DOM overlay that takes over the screen on disk pickup is positioned to
  // exactly cover the 3D monitor's screen plane; this ref points at the DOM div.
  const screenOverlayRef = useRef(null);
  const revealBodyRef = useRef(null);
  const terminalBridgeRef = useRef(null);

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

  // ---- Input ----
  useEffect(() => {
    const s = stateRef.current;

    function down(e) {
      // Native events fired on the soft-keyboard bridge are handled by the
      // bridge itself (which synthesizes window-level events as needed). Skip
      // here to avoid double-processing.
      if (IS_TOUCH && e.target === terminalBridgeRef.current) return;
      const k = e.key;
      s.lastActivity = performance.now();

      // ----- Screensaver: any key returns to the saved mode -----
      if (s.mode === "screensaver") {
        e.preventDefault();
        switchMode(s.savedMode || "menu");
        return;
      }

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
          else if (item.id === "lock") {
            // Jump straight to the screensaver; any key returns here.
            s.savedMode = "menu";
            switchMode("screensaver");
          }
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
            term.history.push({ kind: "in", text: term.input, prompt: makePrompt(term.cwd) });
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
        // Reveal modal is up: Esc closes; arrows scroll the body
        if (k === "Escape") {
          e.preventDefault();
          clearReveal();
          return;
        }
        if (k === "ArrowDown" || k === "ArrowUp" || k === "PageDown" || k === "PageUp") {
          e.preventDefault();
          const body = revealBodyRef.current;
          if (body) {
            const step = k === "PageDown" || k === "PageUp" ? body.clientHeight * 0.85 : 28;
            body.scrollBy({ top: (k === "ArrowUp" || k === "PageUp") ? -step : step, behavior: "smooth" });
          }
          return;
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

  // ---- Game loop (always running; update() branches on stateRef.current.mode) ----
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

    // NOTE: dt is in frame-units (1 = one 60fps frame, ~16.67ms), not seconds.
    if (s.mode === "boot") {
      const dtMs = dt * 16.67;
      s.boot.elapsed += dtMs;
      s.boot.lineIndex = Math.min(BOOT_LINES.length, Math.floor(s.boot.elapsed / BOOT_LINE_MS));
      if (s.boot.lineIndex >= BOOT_LINES.length) {
        s.boot.postPause += dtMs;
        if (s.boot.postPause > BOOT_HOLD_MS) switchMode("menu");
      }
      return;
    }
    if (s.mode === "menu") return;
    if (s.mode === "terminal") return;
    if (s.mode === "screensaver") { updateScreensaver(s, dt); return; }

    // ----- Game mode physics -----
    const p = s.player;

    if (s.keys.left)       { p.vx = -MOVE_SPEED; p.facing = -1; }
    else if (s.keys.right) { p.vx = MOVE_SPEED;  p.facing = 1;  }
    else                   { p.vx *= 0.6; }

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

    // X movement: solids + floppies are both solid blocks
    p.x += p.vx * dt;
    for (const sol of SOLIDS) {
      if (rectsOverlap(p, sol)) {
        if (p.vx > 0) p.x = sol.x - p.w;
        else if (p.vx < 0) p.x = sol.x + sol.w;
        p.vx = 0;
      }
    }
    for (const f of s.floppies) {
      if (rectsOverlap(p, f)) {
        if (p.vx > 0) p.x = f.x - p.w;
        else if (p.vx < 0) p.x = f.x + f.w;
        p.vx = 0;
      }
    }
    if (p.x < 0) p.x = 0;
    if (p.x + p.w > WORLD_W) p.x = WORLD_W - p.w;

    // Y movement: floppies block from below AND can be stood on
    p.y += p.vy * dt;
    p.onGround = false;
    for (const sol of SOLIDS) {
      if (rectsOverlap(p, sol)) {
        if (p.vy > 0)      { p.y = sol.y - p.h;  p.vy = 0; p.onGround = true; }
        else if (p.vy < 0) { p.y = sol.y + sol.h; p.vy = 0; }
      }
    }
    for (const f of s.floppies) {
      if (f.bump > 0) f.bump = Math.max(0, f.bump - 0.6 * dt);
      if (!rectsOverlap(p, f)) continue;
      if (p.vy > 0) {
        p.y = f.y - p.h;
        p.vy = 0;
        p.onGround = true;
      } else if (p.vy < 0) {
        p.y = f.y + f.h;
        p.vy = 0;
        if (!f.hit) {
          f.hit = true;
          f.bump = 6;
          fireReveal({ label: f.label, text: f.reveal });
          setFoundCount((c) => c + 1);
        }
      }
    }

    if (p.y > VIEW_H + 50) { p.x = 24; p.y = 200; p.vx = 0; p.vy = 0; }

    // CRT proximity (canvas-rendered hint reads s.crtNear directly)
    const crt = SOLIDS.find((sol) => sol.type === "crt");
    s.crtNear = rectsOverlap(p, { x: crt.x - 6, y: crt.y - 6, w: crt.w + 12, h: crt.h + 12 });

    // Camera follows player
    const target = p.x + p.w / 2 - VIEW_W / 2;
    s.cameraX += (target - s.cameraX) * Math.min(1, 0.18 * dt);
    s.cameraX = Math.max(0, Math.min(WORLD_W - VIEW_W, s.cameraX));
  }

  function draw(ctx) {
    const s = stateRef.current;

    if (s.mode === "boot")        { drawBoot(ctx, s); return; }
    if (s.mode === "menu")        { drawMenu(ctx, s); return; }
    if (s.mode === "terminal")    { drawTerminal(ctx, s); return; }
    if (s.mode === "screensaver") { drawScreensaver(ctx, s); return; }

    const cam = Math.round(s.cameraX);

    // Motherboard backdrop
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

    drawTraces(ctx, s.t);

    // Sector silkscreen labels
    ctx.fillStyle = "#0A6633";
    ctx.font = "8px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const sec of SECTORS) ctx.fillText(sec.label, sec.x, sec.y);
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

    for (const prop of PROPS) drawProp(ctx, prop);
    for (const sol of SOLIDS) drawSolid(ctx, sol, s.t);
    for (const f of s.floppies) drawFloppy(ctx, f);
    drawPlayer(ctx, s.player);

    ctx.restore();

    drawGameOverlay(ctx, s, foundCountRef.current);
  }

  // ---- Pixi + Three.js mount: full render pipeline ----
  //   2D game canvas (off-DOM)            ← drawn by the game loop
  //     → Pixi WebGL canvas (off-DOM)     ← CRT + RGB-split filters applied
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
      // Two camera presets — landscape shows the full hero shot; portrait
      // pulls in tight on the monitor since the keyboard barely fits in 9:16.
      const PRESETS = {
        landscape: { fov: 36, base: new THREE.Vector3(0, 5.4, 9.4), target: new THREE.Vector3(0, 0.6, 1.1) },
        portrait:  { fov: 44, base: new THREE.Vector3(0, 3.2, 8.0), target: new THREE.Vector3(0, 1.8, 0.0) },
      };
      const camBase = new THREE.Vector3();
      const camTarget = new THREE.Vector3();
      function applyPreset() {
        const aspect = host.clientWidth / Math.max(1, host.clientHeight);
        const p = aspect >= 1 ? PRESETS.landscape : PRESETS.portrait;
        camBase.copy(p.base);
        camTarget.copy(p.target);
        camera.fov = p.fov;
        camera.updateProjectionMatrix();
      }
      applyPreset();
      camera.position.copy(camBase);
      camera.lookAt(camTarget);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(host.clientWidth, host.clientHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      // Tone-mapping pulls bright highlights into a perceptual range so the
      // plastic doesn't blow out white.
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.78;
      host.appendChild(renderer.domElement);

      // Procedural environment map — without this the clearcoat layer on the
      // plastic materials has nothing to reflect, so the plastic looks flat.
      // Kept low so the case isn't internally illuminated.
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envScene = new RoomEnvironment();
      scene.environment = pmrem.fromScene(envScene, 0.04).texture;
      scene.environmentIntensity = 0.28;

      const built = buildComputerScene(pixiCanvasRef.current);
      scene.add(built.object3D);
      sceneRef.current = built;

      onMouseMove = (e) => {
        // Skip parallax on touch — touch-driven pointermove events would jerk
        // the camera every time a button is tapped.
        if (e.pointerType === "touch") return;
        mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        mouseY = (e.clientY / window.innerHeight) * 2 - 1;
      };
      window.addEventListener("pointermove", onMouseMove);

      onResize = () => {
        if (!host) return;
        const w = host.clientWidth, h = Math.max(1, host.clientHeight);
        camera.aspect = w / h;
        applyPreset();
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

  // ---- Idle watcher: after IDLE_TIMEOUT_MS of no input, kick over to
  //      the screensaver. Excludes boot mode (still scrolling). Any input
  //      in screensaver mode pops back to the saved mode (handled in input). ----
  useEffect(() => {
    const id = setInterval(() => {
      const s = stateRef.current;
      if (s.mode === "screensaver" || s.mode === "boot") return;
      if (performance.now() - s.lastActivity > IDLE_TIMEOUT_MS) {
        s.savedMode = s.mode;
        switchMode("screensaver");
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Mouse / pointer activity also resets idle (so just moving the mouse
  // counts as "alive" — important since the page has no scrollable content).
  useEffect(() => {
    const bump = () => { stateRef.current.lastActivity = performance.now(); };
    window.addEventListener("pointermove", bump);
    window.addEventListener("pointerdown", bump);
    return () => {
      window.removeEventListener("pointermove", bump);
      window.removeEventListener("pointerdown", bump);
    };
  }, []);

  // ---- Animate the matching 3D keycap on real keyboard activity. ----
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

  // ---- Glitch flash: when a floppy is picked up, briefly amp the RGB split. ----
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

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-[#0a0805]"
      style={{ fontFamily: "'Press Start 2P', monospace" }}
    >
      {/* Three.js canvas mounts here — renders the 3D 486 with the live screen.
          When the soft keyboard is up in terminal mode, shift the scene up so
          the monitor lands in the visible viewport above the keyboard. */}
      <div
        ref={threeHostRef}
        className="absolute inset-0 transition-transform duration-150 ease-out"
        style={{ transform: `translateY(-${sceneShift}px)` }}
      />

      {/* Mobile-only: on-screen control deck synthesizing keyboard events */}
      {IS_TOUCH && <TouchControls mode={mode} revealOpen={!!reveal} kbHeight={kbHeight} />}

      {/* Mobile-only: soft-keyboard bridge for the terminal */}
      {IS_TOUCH && mode === "terminal" && (
        <>
          <TerminalSoftKeyboardBridge
            inputRef={terminalBridgeRef}
            getCurrent={() => stateRef.current.terminal.input}
            onFocusChange={setBridgeFocused}
          />
          {!bridgeFocused && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                terminalBridgeRef.current?.focus();
              }}
              onTouchStart={(e) => {
                // iOS only pops the keyboard from a focus() inside a real
                // touch handler — call it synchronously here.
                e.preventDefault();
                terminalBridgeRef.current?.focus();
              }}
              className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 pointer-events-auto"
              style={{ touchAction: "manipulation" }}
            >
              <span
                className="text-[#FFD030] text-sm tracking-widest animate-pulse"
                style={{ fontFamily: "'Press Start 2P', monospace" }}
              >
                TAP TO TYPE
              </span>
            </button>
          )}
        </>
      )}

      {/* DOM overlay positioned to exactly cover the 3D monitor's screen plane.
          Hidden visually unless `reveal` is set. Always present in the DOM so
          the render loop can keep its position in sync with the camera. The
          same translateY as the threeHost keeps the modal aligned with the
          visually-shifted screen when the soft keyboard is up. */}
      <div
        ref={screenOverlayRef}
        className="absolute pointer-events-none transition-transform duration-150 ease-out"
        style={{ left: 0, top: 0, width: 0, height: 0, zIndex: 50, transform: `translateY(-${sceneShift}px)` }}
      >
        {reveal && (
          <div
            className="reveal-crt w-full h-full bg-[#020210] text-[#C0E0FF] flex flex-col pointer-events-auto"
            style={{
              fontFamily: "'Press Start 2P', monospace",
              boxShadow: "inset 0 0 60px rgba(0,0,0,0.7)",
            }}
          >
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

            <div
              ref={revealBodyRef}
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

            <div className="px-3 py-2 text-[8px] text-[#666] tracking-widest border-t border-[#9CC8FC]/20 text-center">
              UP / DOWN  SCROLL    ESC OR [ X ]  CLOSE
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
