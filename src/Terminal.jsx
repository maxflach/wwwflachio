import { useEffect, useRef, useState } from "react";

// ===== Virtual filesystem =====
const ABOUT = [
  "max flach",
  "founder / cto / entrepreneur — stockholm, sweden",
  "shipping code professionally since 1996.",
  "three decades, six companies, and counting.",
  "",
  "[ now ]",
  "  servo.music         founder + cto    (2024 — )",
  "  musicdatalabs       founder          (2024 — )",
  "  max flach holding   founder          (2018 — )",
  "",
  "[ then ]",
  "  utopia music        cto / chief architect / cto   (2018 — 2024)",
  "  hubory              founder + cto    (2015 — 2021)   fiber",
  "  the digital family  founder          (2015 — 2021)   incubator",
  "  ispy group          founder + cto    (2002 — 2018)   digital agency",
  "  qulit               founder + cto    (1998 — 2003)",
  "",
  "[ contact ]",
  "  email     max@flach.io",
  "  linkedin  linkedin.com/in/max-flach-67527618",
  "",
  "type 'help' for the rest.",
].join("\n");

const CONTACT = [
  "email     max@flach.io",
  "linkedin  linkedin.com/in/max-flach-67527618",
  "location  stockholm, sweden",
].join("\n");

const VENTURES = [
  "[ now ]",
  "  servo.music         — founder + cto   (2024 — )",
  "  musicdatalabs       — founder         (2024 — )",
  "  max flach holding   — founder         (2018 — )",
  "",
  "[ then ]",
  "  utopia music        — cto / chief architect / cto",
  "                        (sep 2018 — apr 2024, ~5 yrs 8 mos)",
  "  hubory              — founder + cto   (sep 2015 — nov 2021)",
  "                        fiber connectivity solutions",
  "  the digital family  — founder         (jun 2015 — nov 2021)",
  "                        full-service digital incubator",
  "  ispy group          — founder + cto   (jan 2002 — sep 2018)",
  "                        stockholm digital agency, ~16 yrs 9 mos",
  "  qulit               — founder + cto   (dec 1998 — may 2003)",
  "                        stockholm, ~4 yrs 6 mos",
  "",
  "tip: cd projects/ then ls",
].join("\n");

const FS = {
  "/": { dir: true, entries: ["about.txt", "contact.txt", "ventures.txt", "projects/", "secrets.txt"] },
  "/about.txt":     { content: ABOUT },
  "/contact.txt":   { content: CONTACT },
  "/ventures.txt":  { content: VENTURES },
  "/secrets.txt":   { content: "permission denied. nice try." },

  "/projects": {
    dir: true,
    entries: [
      "servo.music.txt",
      "musicdatalabs.txt",
      "max-flach-holding.txt",
      "utopia-music.txt",
      "hubory.txt",
      "the-digital-family.txt",
      "ispy-group.txt",
      "qulit.txt",
    ],
  },
  "/projects/servo.music.txt":      { content: "Servo.music — Founder + CTO\n2024 — present\nStockholm, Sweden" },
  "/projects/musicdatalabs.txt":    { content: "MusicDataLabs — Founder\n2024 — present\nStockholm, Sweden" },
  "/projects/max-flach-holding.txt":{ content: "Max Flach Holding — Founder\n2018 — present" },
  "/projects/utopia-music.txt":     { content: "Utopia Music\nCTO / Chief Architect / CTO\nSep 2018 — Apr 2024 (~5 yrs 8 mos)" },
  "/projects/hubory.txt":           { content: "Hubory — Founder + CTO\nSep 2015 — Nov 2021\nFiber connectivity solutions" },
  "/projects/the-digital-family.txt": { content: "The Digital Family — Founder\nJun 2015 — Nov 2021\nFull-service digital incubator" },
  "/projects/ispy-group.txt":       { content: "ISPY Group — Founder + CTO\nJan 2002 — Sep 2018 (~16 yrs 9 mos)\nStockholm digital agency: dev, design, strategy, hosting" },
  "/projects/qulit.txt":            { content: "Qulit — Founder + CTO\nDec 1998 — May 2003 (~4 yrs 6 mos)\nStockholm" },
};

function resolve(cwd, arg) {
  if (!arg) return cwd;
  // ~ shorthand for home (root in this VFS)
  if (arg === "~" || arg === "~/") return "/";
  if (arg.startsWith("~/")) arg = arg.slice(1);

  const base = arg.startsWith("/") ? "/" : cwd;
  const combined = (base === "/" ? "" : base) + "/" + arg;
  const parts = [];
  for (const p of combined.split("/")) {
    if (!p || p === ".") continue;
    if (p === "..") parts.pop();
    else parts.push(p);
  }
  return "/" + parts.join("/");
}

function lookup(path) {
  // Accept trailing slashes
  const stripped = path.endsWith("/") && path.length > 1 ? path.slice(0, -1) : path;
  return FS[stripped] || FS[path];
}

function shortCwd(cwd) {
  if (cwd === "/") return "~";
  return "~" + cwd;
}

const HELP = [
  "available commands:",
  "  help              show this message",
  "  whoami            who you are",
  "  about             a few words",
  "  ventures          companies built / building",
  "  contact           how to reach me",
  "  ls [path]         list files",
  "  cd [path]         change directory ('cd' or 'cd ~' to go home)",
  "  pwd               print working directory",
  "  cat <file>        print a file",
  "  date              current time",
  "  echo <text>       echo",
  "  sudo <anything>   nope",
  "  clear             clear the screen",
  "  exit              close terminal (or press Esc)",
].join("\n");

function run(cmd, cwd) {
  const trimmed = cmd.trim();
  if (!trimmed) return { kind: "out", text: "" };
  const [name, ...rest] = trimmed.split(/\s+/);
  const arg = rest.join(" ");

  switch (name) {
    case "help":     return { kind: "out", text: HELP };
    case "whoami":   return { kind: "out", text: "guest" };
    case "about":    return { kind: "out", text: ABOUT };
    case "ventures": return { kind: "out", text: VENTURES };
    case "contact":  return { kind: "out", text: CONTACT };

    case "pwd":      return { kind: "out", text: cwd };

    case "ls": {
      const target = arg ? resolve(cwd, arg) : cwd;
      const node = lookup(target);
      if (!node) return { kind: "out", text: `ls: ${arg || target}: no such file or directory` };
      if (!node.dir) return { kind: "out", text: target.replace(/^\//, "") };
      return { kind: "out", text: node.entries.join("  ") };
    }

    case "cd": {
      const target = !arg || arg === "~" ? "/" : resolve(cwd, arg);
      const node = lookup(target);
      if (!node) return { kind: "out", text: `cd: ${arg}: no such file or directory` };
      if (!node.dir) return { kind: "out", text: `cd: ${arg}: not a directory` };
      return { kind: "cd", cwd: target };
    }

    case "cat": {
      if (!arg) return { kind: "out", text: "cat: missing file" };
      const target = resolve(cwd, arg);
      const node = lookup(target);
      if (!node) return { kind: "out", text: `cat: ${arg}: no such file` };
      if (node.dir) return { kind: "out", text: `cat: ${arg}: is a directory` };
      return { kind: "out", text: node.content };
    }

    case "date":  return { kind: "out", text: new Date().toString() };
    case "echo":  return { kind: "out", text: arg };
    case "sudo":  return { kind: "out", text: `${name}: ${arg || "<nothing>"}: permission denied. you are not in the sudoers file. this incident will be reported.` };
    case "rm":    return { kind: "out", text: "rm: nice try." };
    case "exit":  return { kind: "exit" };
    case "clear": return { kind: "clear" };

    default:      return { kind: "out", text: `${name}: command not found. type 'help'.` };
  }
}

// ===== Component =====
export default function Terminal({ onClose }) {
  const [history, setHistory] = useState([
    { kind: "out", text: "flach.io shell — type 'help'. Esc to close." },
  ]);
  const [input, setInput] = useState("");
  const [past, setPast] = useState([]);
  const [pastIdx, setPastIdx] = useState(-1);
  const [cwd, setCwd] = useState("/");
  const inputRef = useRef(null);
  const scrollRef = useRef(null);

  const prompt = `guest@flach.io:${shortCwd(cwd)}$ `;

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history]);

  function submit(e) {
    e.preventDefault();
    const result = run(input, cwd);
    if (result.kind === "exit") { onClose(); return; }
    if (result.kind === "clear") {
      setHistory([]);
    } else if (result.kind === "cd") {
      setCwd(result.cwd);
      setHistory((h) => [...h, { kind: "in", text: input, prompt }]);
    } else {
      setHistory((h) => [
        ...h,
        { kind: "in", text: input, prompt },
        ...(result.text ? [{ kind: "out", text: result.text }] : []),
      ]);
    }
    if (input.trim()) setPast((p) => [input, ...p]);
    setPastIdx(-1);
    setInput("");
  }

  function onKeyDown(e) {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(pastIdx + 1, past.length - 1);
      if (next >= 0 && past[next] !== undefined) { setPastIdx(next); setInput(past[next]); }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = pastIdx - 1;
      if (next < 0) { setPastIdx(-1); setInput(""); }
      else { setPastIdx(next); setInput(past[next]); }
    }
  }

  return (
    <div
      className="absolute inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl h-[60vh] bg-slate-950/95 border border-slate-700 rounded-md shadow-2xl flex flex-col font-mono text-sm text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="w-3 h-3 rounded-full bg-green-500" />
          <span className="ml-2 text-slate-500 text-xs">guest@flach.io — sh</span>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-auto p-3 whitespace-pre-wrap leading-snug terminal-scroll">
          {history.map((h, i) =>
            h.kind === "in" ? (
              <div key={i}>
                <span className="text-emerald-400">{h.prompt}</span>
                <span>{h.text}</span>
              </div>
            ) : (
              <div key={i} className="text-slate-300">{h.text}</div>
            )
          )}
          <form onSubmit={submit} className="flex">
            <span className="text-emerald-400 whitespace-pre">{prompt}</span>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              className="flex-1 bg-transparent outline-none text-slate-100 caret-emerald-400"
              autoComplete="off"
              spellCheck={false}
            />
          </form>
        </div>
      </div>
    </div>
  );
}
