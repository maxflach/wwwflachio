// Hidden <input> that pops the native soft keyboard on iOS/Android when the
// terminal mode opens. Char additions/removals are diffed and dispatched as
// synthesized window-level KeyboardEvents so the existing terminal handler in
// Home.jsx picks them up unchanged.

export default function TerminalSoftKeyboardBridge({ inputRef, getCurrent, onFocusChange }) {
  return (
    <input
      ref={(el) => {
        inputRef.current = el;
        if (el) {
          el.value = getCurrent() || "";
          el.dataset.last = el.value;
          // Try to focus immediately. On desktop + Android this typically
          // succeeds; on iOS the user-gesture chain has been broken by the
          // synthesized event that switched modes, so this silently fails —
          // the "TAP TO TYPE" overlay handles iOS by calling focus() inside
          // a real touch handler.
          el.focus();
        }
      }}
      type="text"
      autoCapitalize="none"
      autoCorrect="off"
      autoComplete="off"
      spellCheck={false}
      inputMode="text"
      onInput={(e) => {
        const el = e.currentTarget;
        const next = el.value;
        const prev = el.dataset.last || "";
        if (next.length > prev.length) {
          for (const ch of next.slice(prev.length)) {
            window.dispatchEvent(
              new KeyboardEvent("keydown", { key: ch, bubbles: true })
            );
          }
        } else if (next.length < prev.length) {
          const diff = prev.length - next.length;
          for (let i = 0; i < diff; i++) {
            window.dispatchEvent(
              new KeyboardEvent("keydown", { key: "Backspace", code: "Backspace", bubbles: true })
            );
          }
        }
        el.dataset.last = next;
      }}
      onKeyDown={(e) => {
        // Special keys typed on the bridge get forwarded to window directly so
        // the global terminal handler runs them. Plain letters are picked up
        // via onInput's diff; native keydowns on letters are filtered out by
        // the global `down` early-return in Home.jsx.
        const special = ["Enter", "Tab", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
        if (special.includes(e.key)) {
          e.preventDefault();
          window.dispatchEvent(
            new KeyboardEvent("keydown", { key: e.key, code: e.code, bubbles: true })
          );
          if (e.key === "Enter") {
            requestAnimationFrame(() => {
              const el = inputRef.current;
              if (el) { el.value = ""; el.dataset.last = ""; }
            });
          }
        }
      }}
      onFocus={() => onFocusChange?.(true)}
      onBlur={() => onFocusChange?.(false)}
      className="absolute opacity-0 pointer-events-auto"
      style={{
        left: 0,
        top: 0,
        width: 1,
        height: 1,
        // 16px+ prevents iOS from auto-zooming when focused
        fontSize: 16,
      }}
    />
  );
}
