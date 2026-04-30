// FlachOS BIOS POST-style boot screen.

import { VIEW_W, VIEW_H } from "../game/world";

export const BOOT_LINES = [
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

export const BOOT_LINE_MS = 110;
export const BOOT_HOLD_MS = 900;

export function drawBoot(ctx, s) {
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
