// Real DOOM via js-dos v8. Loads the shareware bundle, mounts the emulator
// into an off-screen host div, exposes its canvas so the main draw loop can
// blit it into the 480×270 game canvas → Pixi CRT filter → Three CRT screen.
//
// Bundle: shareware DOOM (DOOM1.WAD + DOOM.EXE + dosbox.conf) hosted by
// js-dos.com. CORS-open, freely redistributable. Can be overridden at build
// time via VITE_DOOM_BUNDLE_URL — drop a self-hosted .jsdos in /public and
// point this at /your-file.jsdos.

import { VIEW_W, VIEW_H } from "../game/world";

const JSDOS_JS  = "https://v8.js-dos.com/latest/js-dos.js";
const JSDOS_CSS = "https://v8.js-dos.com/latest/js-dos.css";
// Fallback DOOM bundle path. Each disk now passes its own bundleUrl into
// startDoom(), so this only kicks in if a caller forgets one.
const DEFAULT_BUNDLE = "/doom.jsdos";

// ===== js-dos script loader =====
// Loaded once per page. Idempotent — subsequent calls reuse the promise.
let loaderPromise = null;
function loadJsDos() {
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no window"));
    if (window.Dos) return resolve(window.Dos);

    if (!document.querySelector('link[data-jsdos]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = JSDOS_CSS;
      link.setAttribute("data-jsdos", "1");
      document.head.appendChild(link);
    }

    const script = document.createElement("script");
    script.src = JSDOS_JS;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      if (window.Dos) resolve(window.Dos);
      else reject(new Error("window.Dos missing after js-dos.js loaded"));
    };
    script.onerror = () => reject(new Error("failed to load js-dos.js"));
    document.head.appendChild(script);
  });
  return loaderPromise;
}

// ===== DOOM controller =====
// `startDoom(host, bundleUrl?)` boots the emulator into the given host div
// with the given .jsdos bundle URL. Originally DOOM-only — now generalized
// to load any game's bundle.
export async function startDoom(host, bundleUrl = DEFAULT_BUNDLE) {
  const Dos = await loadJsDos();

  // The js-dos v8 player decides whether to render with WebGL or 2D based on
  // browser support. Either way, the rendered <canvas> is created inside the
  // host element and we sample it via drawImage from the main loop.
  let player;
  try {
    player = Dos(host, {
      url: bundleUrl,
      background: "#000000",
      noCloud: true,
      noNetworking: true,
      mouseCapture: false,
      autoStart: true,
      kiosk: true,
    });
  } catch (err) {
    console.error("[doom] Dos() threw", err);
    throw err;
  }

  // Make the host keyboard-focusable so js-dos receives input.
  host.tabIndex = -1;
  // Defer to next tick — the canvas/inner div doesn't exist yet.
  setTimeout(() => {
    try {
      const inner = host.querySelector("canvas") || host;
      inner.focus({ preventScroll: true });
    } catch { /* ignore */ }
  }, 50);

  return {
    host,
    getCanvas() {
      return host.querySelector("canvas");
    },
    // Re-dispatch a real keyboard event so js-dos receives input regardless
    // of which element has focus. Targets the canvas (or host) — events with
    // bubbles:true propagate from there up through document, so a single
    // dispatch covers every reasonable listener target without duplicating.
    forwardKey(e) {
      const target = host.querySelector("canvas") || host;
      if (!target) return;
      try {
        target.dispatchEvent(new KeyboardEvent(e.type, {
          key: e.key,
          code: e.code,
          keyCode: e.keyCode,
          which: e.which,
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          metaKey: e.metaKey,
          repeat: e.repeat,
          bubbles: true,
          cancelable: true,
        }));
      } catch { /* ignore */ }
    },
    destroy() {
      // js-dos v8's player object may be a thenable (resolves to a
      // CommandInterface) or already have direct stop/exit methods —
      // try every shape we know of.
      try { player?.stop?.(); } catch { /* ignore */ }
      try { player?.exit?.(); } catch { /* ignore */ }
      try {
        player?.then?.((ci) => {
          try { ci?.exit?.(); } catch { /* already exited */ }
        });
      } catch { /* not a thenable */ }
      while (host.firstChild) host.removeChild(host.firstChild);
    },
  };
}

// ===== Loading / error screen =====
// Drawn into the 480×270 game canvas while js-dos boots, or if it fails.
// `gameLabel` is the human-readable name ("DOOM", "KEEN 1", "PRINCE OF
// PERSIA") and `gameFile` is the DOS executable filename shown in the
// fake-floppy-read line ("DOOM.EXE", "KEEN1.EXE", etc.).
export function drawDoomLoading(ctx, t, errorMsg, gameLabel = "DOOM", gameFile = "DOOM.EXE") {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  // Big red title with a black drop-shadow
  ctx.fillStyle = "#8a0808";
  ctx.font = "32px 'Press Start 2P', monospace";
  ctx.fillText(gameLabel, VIEW_W / 2 + 2, 60);
  ctx.fillStyle = "#FF2020";
  ctx.fillText(gameLabel, VIEW_W / 2, 58);

  if (errorMsg) {
    ctx.fillStyle = "#888";
    ctx.font = "6px 'Press Start 2P', monospace";
    ctx.fillText("FAILED TO LOAD:", VIEW_W / 2, 110);
    ctx.fillStyle = "#FF8040";
    ctx.fillText(errorMsg.slice(0, 44), VIEW_W / 2, 122);
    ctx.fillStyle = "#666";
    ctx.fillText("PRESS ESC TO EJECT", VIEW_W / 2, VIEW_H - 28);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    return;
  }

  ctx.fillStyle = "#888";
  ctx.font = "6px 'Press Start 2P', monospace";

  {
    const dots = ".".repeat(Math.floor(t / 18) % 4);
    ctx.fillStyle = "#9CC8FC";
    ctx.fillText("READING A:\\" + gameFile + dots, VIEW_W / 2, 150);

    // Spinning floppy
    ctx.save();
    ctx.translate(VIEW_W / 2, 190);
    ctx.rotate(Math.sin(t * 0.04) * 0.4);
    ctx.fillStyle = "#222";
    ctx.fillRect(-14, -14, 28, 28);
    ctx.fillStyle = "#666";
    ctx.fillRect(-5, -16, 10, 7);
    ctx.fillStyle = "#111";
    ctx.fillRect(-3, -15, 6, 4);
    ctx.fillStyle = "#f4eed8";
    ctx.fillRect(-8, -4, 16, 12);
    ctx.fillStyle = "#000";
    ctx.font = "italic 900 9px 'Brush Script MT', cursive";
    ctx.fillText(gameLabel.slice(0, 5), 0, 4);
    ctx.restore();

    // Progress bar
    const barW = 240, barH = 6;
    const bx = (VIEW_W - barW) / 2;
    const by = 224;
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, barW, barH);
    const pct = 0.05 + 0.95 * (1 - 1 / (1 + t / 60)); // asymptotic crawl
    ctx.fillStyle = "#FF2020";
    ctx.fillRect(bx + 2, by + 2, (barW - 4) * pct, barH - 4);

    ctx.fillStyle = "#666";
    ctx.fillText("PRESS ESC TO EJECT", VIEW_W / 2, VIEW_H - 28);
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

// Drawn into the game canvas every frame in doom mode: copies the js-dos
// canvas onto our 480×270 surface, letterboxing to preserve the 4:3 aspect.
export function blitDoomCanvas(ctx, srcCanvas) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (!srcCanvas || !srcCanvas.width || !srcCanvas.height) return;

  const srcA = srcCanvas.width / srcCanvas.height;
  const dstA = VIEW_W / VIEW_H;
  let dw, dh;
  if (srcA > dstA) { dw = VIEW_W; dh = VIEW_W / srcA; }
  else             { dh = VIEW_H; dw = VIEW_H * srcA; }
  const dx = (VIEW_W - dw) / 2;
  const dy = (VIEW_H - dh) / 2;
  try {
    ctx.drawImage(srcCanvas, dx, dy, dw, dh);
  } catch {
    // Tainted / not-yet-ready canvas — skip this frame.
  }
}
