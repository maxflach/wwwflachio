// Pure VFS + command runner for the in-monitor shell.
// Imported by Home.jsx (canvas-rendered terminal mode).

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

export const FS = {
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

export function resolve(cwd, arg) {
  if (!arg) return cwd;
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

export function lookup(path) {
  const stripped = path.endsWith("/") && path.length > 1 ? path.slice(0, -1) : path;
  return FS[stripped] || FS[path];
}

export function shortCwd(cwd) {
  if (cwd === "/") return "~";
  return "~" + cwd;
}

export function makePrompt(cwd) {
  return `guest@flach.io:${shortCwd(cwd)}$ `;
}

const COMMANDS = [
  "help", "whoami", "about", "ventures", "contact",
  "ls", "cd", "pwd", "cat", "date", "echo", "clear", "exit",
];

// Find common prefix of an array of strings.
function commonPrefix(strs) {
  if (!strs.length) return "";
  let prefix = strs[0];
  for (let i = 1; i < strs.length; i++) {
    while (!strs[i].startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
      if (!prefix) return "";
    }
  }
  return prefix;
}

// Tab-completion. Given current input + cwd, returns either:
//   { kind: "complete", input }  — replace input with this (single match or common prefix)
//   { kind: "options", matches } — multiple candidates, render them above the prompt
//   { kind: "none" }             — nothing to do
export function complete(input, cwd) {
  const trimmed = input;
  const parts = trimmed.split(/\s+/);

  // Completing the command name (first token, no spaces yet)
  if (parts.length <= 1 && !trimmed.includes(" ")) {
    const prefix = trimmed;
    const matches = COMMANDS.filter((c) => c.startsWith(prefix));
    if (matches.length === 0) return { kind: "none" };
    if (matches.length === 1) return { kind: "complete", input: matches[0] + " " };
    const cp = commonPrefix(matches);
    if (cp.length > prefix.length) return { kind: "complete", input: cp };
    return { kind: "options", matches };
  }

  // Completing a path argument
  const cmd = parts[0];
  const argRaw = parts[parts.length - 1] || "";
  // Resolve directory portion + leaf portion of the partial path
  const lastSlash = argRaw.lastIndexOf("/");
  const dirPart = lastSlash >= 0 ? argRaw.slice(0, lastSlash + 1) : "";
  const leafPart = lastSlash >= 0 ? argRaw.slice(lastSlash + 1) : argRaw;
  const dirAbs = dirPart ? resolve(cwd, dirPart) : cwd;
  const dirNode = lookup(dirAbs);
  if (!dirNode || !dirNode.dir) return { kind: "none" };

  const candidates = dirNode.entries.filter((e) => e.startsWith(leafPart));
  if (candidates.length === 0) return { kind: "none" };

  // For `cd`, only directories make sense
  const filtered = cmd === "cd"
    ? candidates.filter((e) => e.endsWith("/"))
    : candidates;
  const set = filtered.length ? filtered : candidates;

  if (set.length === 1) {
    const completed = dirPart + set[0];
    const head = parts.slice(0, -1).join(" ");
    const next = head ? `${head} ${completed}` : completed;
    // If the completion lands on a directory, leave the trailing slash; otherwise add a space.
    return {
      kind: "complete",
      input: set[0].endsWith("/") ? next : next + " ",
    };
  }

  const cp = commonPrefix(set);
  if (cp.length > leafPart.length) {
    const completed = dirPart + cp;
    const head = parts.slice(0, -1).join(" ");
    const next = head ? `${head} ${completed}` : completed;
    return { kind: "complete", input: next };
  }

  return { kind: "options", matches: set };
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

export function run(cmd, cwd) {
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
