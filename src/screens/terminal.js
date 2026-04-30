// In-canvas terminal renderer (drawn into the same 2D canvas the boot/menu/game
// modes use, so it shares the Pixi CRT post-process).

import { VIEW_W, VIEW_H } from "../game/world";
import { makePrompt } from "../terminalCore";

export function drawTerminal(ctx, s) {
  const { terminal, t } = s;
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
