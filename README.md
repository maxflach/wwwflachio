# flach.io

The personal site of [Max Flach](https://linkedin.com/in/max-flach-67527618) —
a serial tech founder in Stockholm who's been shipping code since 1996.

Live at **[flach.io](https://flach.io)**.

---

## What it is

A 3D vintage 486 desktop, hand-modeled in three.js, sitting on a wood desk.
The CRT monitor on top runs a tiny 8-bit platformer where you wander around the
inside of a circuit board collecting floppy disks for breadcrumbs of the bio.
The 104-key IBM-Model-M-style keyboard responds to your real keyboard — every
keypress depresses the matching 3D keycap.

Mostly an excuse to play with the rendering stack.

## Render pipeline

Three layers, each feeding the next:

```
2D canvas (off-DOM)              ← game logic + sprites drawn here
       ↓ sampled as Texture
Pixi.js WebGL canvas (off-DOM)   ← CRT filter, RGB-split, scanlines, noise
       ↓ sampled as CanvasTexture
Three.js scene (visible)         ← the 3D 486; the CRT screen mesh shows the above
```

The game canvas never makes it to the DOM — it's purely a drawing surface that
Pixi reads as a texture, applies post-processing, and outputs into its own
WebGL canvas, which Three then samples as a `CanvasTexture` and maps onto the
3D monitor's screen plane.

## Easter eggs

- **Walk to the CRT** in the platformer and press `↓` — opens an in-page shell
  with `cd` / `ls` / `cat` / `pwd` over a small VFS (`cat ventures.txt`,
  `cd projects/`)
- **Press `/`** anywhere — same shell, faster
- **View source** — there's a note for you in the HTML comment
- **Open DevTools** — there's a console banner with a few hints
- **`/humans.txt`** — the classic
- **`/.well-known/autoconfig/mail/config-v1.1.xml`** — Thunderbird/Outlook
  auto-discovery for the flach.io mail domain
- **404** — the missing-page page is more interesting than the homepage

## Stack

- **React 18** + **Vite** + **Tailwind**
- **three.js** for the 3D scene (case + monitor + keyboard + speakers, all
  hand-built from `RoundedBoxGeometry` primitives, no GLTF assets; procedural
  canvas textures for the plastic and wood)
- **pixi.js** + **pixi-filters** for the CRT post-processing
- **Firebase Hosting** for deploy

## Local dev

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production build to dist/
npm run lint
```

## Deploy

```bash
npm run deploy       # vite build + firebase deploy --only hosting
```

Targets the `flachio` Firebase Hosting project.

## License

The code in this repo is published as-is. Bio content and brand assets
(logos, "Servo.music", "MusicDataLabs", etc.) are not.
