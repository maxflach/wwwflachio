# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Personal landing page for flach.io. Single-page React + Vite + Tailwind app. The visible page is a 3D vintage-PC scene rendered with Three.js: a beige 486 desktop sits on a wood desk, with a CRT monitor on top, two flanking speakers, and a 104-key IBM-Model-M-style keyboard. The CRT screen displays a small 8-bit platformer (drawn into a 2D canvas, then post-processed by Pixi.js for CRT/RGB-split effects, then sampled as a `CanvasTexture` on the screen plane). Real keyboard input animates the matching 3D keycap and drives the in-game player.

## Commands

- `npm run dev` — Vite dev server (default http://localhost:5173)
- `npm run build` — production build to `dist/`
- `npm run preview` — serve the built `dist/`
- `npm run lint` — ESLint (flat config in `eslint.config.js`)
- `npm run deploy` — `vite build` then `firebase deploy` (Firebase Hosting, project `flachio` per `.firebaserc`)
- `npm run deploy:hosting` — same, but only the `hosting` target

## Architecture

Render pipeline (top to bottom of the stack):

1. **Game canvas** (off-DOM 2D canvas, 480×270) — game logic + draw calls live in `src/Home.jsx` (`update`/`draw` plus the `drawSolid` / `drawFloppy` / `drawPlayer` helpers).
2. **Pixi.js layer** (off-DOM WebGL canvas, 960×540) — `Application` reads the game canvas as a `Texture`, runs `CRTFilter` + `RGBSplitFilter` on a `Sprite`. Inited with `preserveDrawingBuffer: true` so Three can sample it.
3. **Three.js layer** (visible WebGLRenderer canvas) — mounts inside the `threeHostRef` div. Builds the 3D scene via `buildComputerScene(pixiCanvas)` from `src/computerModel.js`. The CRT screen mesh uses a `CanvasTexture` sourced from the Pixi canvas; `texture.needsUpdate = true` every frame.

Other notable pieces in `src/`:

- `Terminal.jsx` — DOM-overlay fake shell with a small VFS (`cd`, `ls`, `cat`, `pwd`, `about`, `ventures`, ...).
- `NotFound.jsx` — animated `404` page; `App.jsx` routes by `window.location.pathname` (no router lib).
- `devtools.js` — DevTools console banner.
- `computerModel.js` — pure factory that builds the 486 scene graph + `e.code → keyMesh` keymap. All textures are procedural canvases (no asset files).

## Deployment

Firebase Hosting only. `firebase.json` serves `dist/` with SPA rewrite (`**` → `/index.html`). Project ID `flachio` per `.firebaserc`; account `max@flach.io`.

## Static assets

`public/` is served at the site root. Notable: `public/autodiscover/autodiscover.xml` and `public/index.html` exist for mail-client autoconfig (Outlook/Thunderbird discovery for the flach.io domain) — don't delete them when cleaning up assets.
