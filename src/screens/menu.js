// FlachOS boot menu — STORY / TERMINAL / REBOOT — drawn on the 2D canvas with
// a faded 8-bit Flach coat of arms watermark behind it.

import { VIEW_W, VIEW_H } from "../game/world";

export const MENU_ITEMS = [
  { id: "game", label: "STORY" },
  { id: "terminal", label: "TERMINAL" },
  { id: "lock", label: "LOCK SCREEN" },
  { id: "reboot", label: "REBOOT" },
];

// Faded, chunky 8-bit version of the Flach family coat of arms. Quartered
// shield (gold/black bars), blue helm with red visor slits, gold/black
// checkered plume, gold mantling on the sides.
function drawShieldWatermark(ctx) {
  ctx.save();
  ctx.globalAlpha = 0.16;

  const GOLD = "#D9A41E";
  const GOLD_DK = "#9B7A1B";
  const BLACK = "#181818";
  const HELM_BLUE = "#2A6BC0";
  const HELM_BLUE_HI = "#5BAEF5";
  const VISOR_RED = "#A82828";

  const cx = VIEW_W / 2;

  // Plume — checkered black/gold
  const plumeX = cx - 6;
  const plumeW = 12;
  const plumeY = 22;
  const plumeRows = 9;
  ctx.fillStyle = GOLD;
  ctx.fillRect(plumeX + 4, plumeY - 4, 4, 4);
  for (let r = 0; r < plumeRows; r++) {
    const y = plumeY + r * 4;
    if (r % 2 === 0) {
      ctx.fillStyle = GOLD;  ctx.fillRect(plumeX, y, plumeW / 2, 4);
      ctx.fillStyle = BLACK; ctx.fillRect(plumeX + plumeW / 2, y, plumeW / 2, 4);
    } else {
      ctx.fillStyle = BLACK; ctx.fillRect(plumeX, y, plumeW / 2, 4);
      ctx.fillStyle = GOLD;  ctx.fillRect(plumeX + plumeW / 2, y, plumeW / 2, 4);
    }
  }

  // Helmet — trapezoid (narrow top, wide bottom)
  const helmTop = plumeY + plumeRows * 4 + 2;
  const helmH = 16;
  for (let i = 0; i < helmH; i++) {
    const w = 14 + Math.floor(i / 2);
    ctx.fillStyle = HELM_BLUE;
    ctx.fillRect(cx - Math.floor(w / 2), helmTop + i, w, 1);
  }
  ctx.fillStyle = HELM_BLUE_HI;
  ctx.fillRect(cx - 5, helmTop, 10, 1);
  ctx.fillStyle = VISOR_RED;
  for (let s = 0; s < 3; s++) {
    ctx.fillRect(cx - 6, helmTop + 4 + s * 3, 12, 2);
  }
  ctx.fillStyle = GOLD;
  ctx.fillRect(cx - 9, helmTop + helmH, 18, 2);

  // Shield — quartered, alternating gold/black bars reversed L/R
  const sw = 64, sh = 72;
  const sx = cx - sw / 2;
  const sy = helmTop + helmH + 4;

  ctx.fillStyle = BLACK;
  ctx.fillRect(sx - 2, sy - 2, sw + 4, sh + 4);

  ctx.save();
  ctx.beginPath();
  const shoulder = sy + sh - 16;
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx + sw, sy);
  ctx.lineTo(sx + sw, shoulder);
  ctx.lineTo(cx, sy + sh);
  ctx.lineTo(sx, shoulder);
  ctx.closePath();
  ctx.clip();

  const stripeH = 12;
  const halfW = sw / 2;
  for (let i = 0; i < 6; i++) {
    const y = sy + i * stripeH;
    const goldLeft = i % 2 === 0;
    ctx.fillStyle = goldLeft ? GOLD : BLACK;
    ctx.fillRect(sx, y, halfW, stripeH + 1);
    ctx.fillStyle = goldLeft ? BLACK : GOLD;
    ctx.fillRect(sx + halfW, y, halfW, stripeH + 1);
  }
  ctx.restore();

  // Mantling — chunky gold flourishes
  ctx.fillStyle = GOLD_DK;
  const bumpsLeft = [
    [-8, 6, 6, 4], [-10, 14, 8, 4], [-9, 22, 7, 4],
    [-11, 32, 9, 4], [-9, 42, 7, 4], [-7, 52, 6, 4],
  ];
  const bumpsRight = [
    [sw + 2, 6, 6, 4], [sw + 2, 14, 8, 4], [sw + 2, 22, 7, 4],
    [sw + 2, 32, 9, 4], [sw + 2, 42, 7, 4], [sw + 1, 52, 6, 4],
  ];
  for (const [dx, dy, w, h] of bumpsLeft)  ctx.fillRect(sx + dx, sy + dy, w, h);
  for (const [dx, dy, w, h] of bumpsRight) ctx.fillRect(sx + dx, sy + dy, w, h);

  ctx.restore();
}

export function drawMenu(ctx, s) {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  drawShieldWatermark(ctx);

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
