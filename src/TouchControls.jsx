// On-screen touch overlay. Buttons synthesize keydown/keyup KeyboardEvents on
// `window` so the existing input handler in Home.jsx picks them up unchanged.

function dispatchKey(type, key, code) {
  const e = new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true });
  window.dispatchEvent(e);
}

// Tap = quick keydown then keyup
function tap(key, code) {
  dispatchKey("keydown", key, code);
  setTimeout(() => dispatchKey("keyup", key, code), 50);
}

// Hold = keydown on press, keyup on release. Shared classes for the chunky buttons.
const BTN = "select-none active:scale-95 transition-transform";
const BTN_BOX = "flex items-center justify-center bg-black/60 border-2 border-[#FFD030] text-[#FFD030] font-mono shadow-[0_0_12px_rgba(0,0,0,0.6)]";

function HoldBtn({ k, code, children, className = "" }) {
  const start = (e) => { e.preventDefault(); dispatchKey("keydown", k, code); };
  const end   = (e) => { e.preventDefault(); dispatchKey("keyup", k, code); };
  return (
    <button
      onTouchStart={start}
      onTouchEnd={end}
      onTouchCancel={end}
      onMouseDown={start}
      onMouseUp={end}
      onMouseLeave={end}
      className={`${BTN} ${BTN_BOX} ${className}`}
      style={{ touchAction: "none" }}
    >
      {children}
    </button>
  );
}

function TapBtn({ k, code, children, className = "" }) {
  const fire = (e) => { e.preventDefault(); tap(k, code); };
  return (
    <button
      onTouchStart={fire}
      onClick={fire}
      className={`${BTN} ${BTN_BOX} ${className}`}
      style={{ touchAction: "none" }}
    >
      {children}
    </button>
  );
}

export default function TouchControls({ mode, revealOpen }) {
  if (mode === "boot") {
    return (
      <div className="absolute inset-0 z-40 pointer-events-auto" onTouchStart={(e) => { e.preventDefault(); tap("Enter", "Enter"); }}>
        {/* Tapping anywhere skips the boot scroll */}
      </div>
    );
  }

  if (mode === "menu") {
    return (
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-40">
        <TapBtn k="ArrowUp"   code="ArrowUp"   className="w-14 h-14 text-2xl">▲</TapBtn>
        <TapBtn k="ArrowDown" code="ArrowDown" className="w-14 h-14 text-2xl">▼</TapBtn>
        <TapBtn k="Enter"     code="Enter"     className="w-24 h-14 text-base px-3">ENTER</TapBtn>
      </div>
    );
  }

  if (mode === "game") {
    // While the reveal modal is open, hide the D-pad/JUMP/DOWN; the modal has
    // its own close button and Esc handling.
    if (revealOpen) {
      return (
        <div className="absolute top-3 right-3 z-40">
          <TapBtn k="Escape" code="Escape" className="w-16 h-9 text-[10px] px-2">CLOSE</TapBtn>
        </div>
      );
    }
    return (
      <>
        {/* D-pad bottom-left */}
        <div className="absolute bottom-6 left-6 flex gap-2 z-40">
          <HoldBtn k="ArrowLeft"  code="ArrowLeft"  className="w-16 h-16 text-3xl">◀</HoldBtn>
          <HoldBtn k="ArrowRight" code="ArrowRight" className="w-16 h-16 text-3xl">▶</HoldBtn>
        </div>

        {/* Action buttons bottom-right */}
        <div className="absolute bottom-6 right-6 flex flex-col gap-2 items-end z-40">
          <HoldBtn k=" " code="Space" className="w-20 h-16 text-base px-2">JUMP</HoldBtn>
          <TapBtn  k="ArrowDown" code="ArrowDown" className="w-16 h-12 text-xl">↓</TapBtn>
        </div>

        {/* Menu top-right */}
        <div className="absolute top-3 right-3 z-40">
          <TapBtn k="Escape" code="Escape" className="w-16 h-9 text-[10px] px-2">MENU</TapBtn>
        </div>
      </>
    );
  }

  if (mode === "terminal") {
    return (
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-40">
        <TapBtn k="Escape" code="Escape" className="w-16 h-10 text-xs px-2">ESC</TapBtn>
        <TapBtn k="Tab"    code="Tab"    className="w-16 h-10 text-xs px-2">TAB</TapBtn>
        <TapBtn k="ArrowUp"   code="ArrowUp"   className="w-12 h-10 text-base">▲</TapBtn>
        <TapBtn k="ArrowDown" code="ArrowDown" className="w-12 h-10 text-base">▼</TapBtn>
        <TapBtn k="Enter"  code="Enter"  className="w-20 h-10 text-xs px-2">ENTER</TapBtn>
      </div>
    );
  }

  return null;
}
