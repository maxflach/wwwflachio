# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Personal landing page for flach.io. Single-page React + Vite + Tailwind app whose only content is an animated ASCII art block ("NOTHING / TO / SEE / HERE") rendered via `react-ascii-text` over a background image (`public/bg.png`). All visible UI lives in `src/App.jsx` — there is no router, state layer, or component tree to speak of.

## Commands

- `npm run dev` — Vite dev server (default http://localhost:5173)
- `npm run build` — production build to `dist/`
- `npm run preview` — serve the built `dist/`
- `npm run lint` — ESLint (flat config in `eslint.config.js`)
- `npm run deploy` — `vite build` then `firebase deploy` (Firebase Hosting, project `flachio` per `.firebaserc`)
- `npm run deploy:hosting` — same, but only the `hosting` target

## Deployment

Two deployment paths exist:

1. **Firebase Hosting** (current): `firebase.json` serves `dist/` with SPA rewrite (`**` → `/index.html`).
2. **Docker + Caddy** (legacy / alt): `Dockerfile` builds the app and copies `dist/` into a `caddy:2-alpine` image; `Caddyfile` is a stub. `.gitlab-ci.yml` is also present from a prior deployment setup. Treat these as historical unless a change explicitly targets them.

## Static assets

`public/` is served at the site root. Notable: `public/autodiscover/autodiscover.xml` and `public/index.html` exist for mail-client autoconfig (Outlook/Thunderbird discovery for the flach.io domain) — don't delete them when cleaning up assets.
