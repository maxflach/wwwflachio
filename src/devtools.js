// Easter egg for anyone who opens DevTools.
export function printDevtoolsBanner() {
  const banner = `
  ███████╗██╗      █████╗  ██████╗██╗  ██╗   ██╗ ██████╗
  ██╔════╝██║     ██╔══██╗██╔════╝██║  ██║   ██║██╔═══██╗
  █████╗  ██║     ███████║██║     ███████║   ██║██║   ██║
  ██╔══╝  ██║     ██╔══██║██║     ██╔══██║   ██║██║   ██║
  ██║     ███████╗██║  ██║╚██████╗██║  ██║██╗██║╚██████╔╝
  ╚═╝     ╚══════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝╚═╝ ╚═════╝
`;
  const big = "color:#94a3b8;font-family:ui-monospace,Menlo,monospace;font-size:11px;line-height:1.1;";
  const dim = "color:#64748b;font:13px ui-monospace,Menlo,monospace;";
  const accent = "color:#38bdf8;font:13px ui-monospace,Menlo,monospace;font-weight:600;";

  console.log(`%c${banner}`, big);
  console.log("%cyou found the back room.", dim);
  console.log("%cmax flach — serial tech founder, stockholm.", dim);
  console.log("%ctry: %cpress / for a shell, %cor walk to the CRT.", dim, accent, accent);
  console.log("%c→ %cmax@flach.io", dim, accent);
}
