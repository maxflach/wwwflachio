// Pure VFS + command runner for the in-monitor shell.
// Imported by Home.jsx (canvas-rendered terminal mode).

const ABOUT = [
  "max flach",
  "founder / cto / entrepreneur — stockholm, sweden",
  "",
  "first line of code at 8.   sold first software at 14.",
  "first company at 18.       still shipping in year 30.",
  "",
  "[ now ]",
  "  musicdatalabs       founder + cto    (2024 — )   musicdatalabs.com",
  "    servo.music       product                      servo.music",
  "  max flach holding   founder          (2018 — )   angel investments",
  "",
  "[ then ]",
  "  utopia music        cto / chief architect / cto   (2018 — 2024)",
  "  hubory              founder          (2015 — 2021)   fiber + tv activation",
  "  the digital family  founder          (2015 — 2021)   agency + incubator",
  "  ispy                founder + cto    (2003 — 2018)   digital agency, acq. utopia 2018",
  "  qulit               founder + cto    (1999 — 2003)   dot-com consultancy",
  "",
  "[ contact ]",
  "  email     max@flach.io",
  "  linkedin  linkedin.com/in/max-flach-67527618",
  "",
  "tip: cd projects/ and cat any of the files for the long version.",
].join("\n");

const CONTACT = [
  "email     max@flach.io",
  "linkedin  linkedin.com/in/max-flach-67527618",
  "location  stockholm, sweden",
].join("\n");

const VENTURES = [
  "[ now ]",
  "  musicdatalabs       — founder + cto   (2024 — )   musicdatalabs.com",
  "    servo.music                                     servo.music  (product)",
  "  max flach holding   — founder         (2018 — )   angel investments",
  "",
  "[ then ]",
  "  utopia music        — cto / chief architect / cto",
  "                        sep 2018 — apr 2024  (~5 yrs 8 mos)",
  "                        drove the technical evolution from day one;",
  "                        the platform's foundation was built by my",
  "                        ispy team before utopia acquired the agency.",
  "  hubory              — founder",
  "                        sep 2015 — nov 2021",
  "                        instant fiber + tv activation across all isps",
  "                        on the swedish open fiber network.",
  "  the digital family  — founder",
  "                        jun 2015 — nov 2021",
  "                        full-service digital agency that doubled as",
  "                        an incubator for multiple startups.",
  "  ispy                — founder + cto",
  "                        may 2003 — sep 2018  (~15 yrs 5 mos)",
  "                        pioneering stockholm digital agency.",
  "                        clients: telenor, bonnier, intel,",
  "                        bredbandsbolaget, magine tv, …",
  "                        4 consecutive gasell awards.",
  "                        built global streaming platforms.",
  "                        acquired by utopia music ag in 2018.",
  "  qulit               — founder + cto",
  "                        jan 1999 — may 2003",
  "                        consultancy bridging traditional business",
  "                        and the new digital world through the dot-com",
  "                        boom, mobile computing, and early e-commerce.",
  "                        notable client: bonnier.",
  "",
  "tip: cd projects/ and cat any of the files for the per-venture detail.",
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
  "/projects/musicdatalabs.txt": {
    content: [
      "MusicDataLabs — Founder + CTO",
      "2024 — present  •  Stockholm, Sweden",
      "musicdatalabs.com",
      "",
      "Currently active company. Builds and operates Servo.music.",
      "",
      "Music-data infrastructure for the next era of the industry.",
      "",
      "→ cat servo.music.txt",
    ].join("\n"),
  },

  "/projects/servo.music.txt": {
    content: [
      "Servo.music",
      "A MusicDataLabs product  •  2024 — present",
      "servo.music",
      "",
      "Built and operated by MusicDataLabs.",
    ].join("\n"),
  },

  "/projects/max-flach-holding.txt": {
    content: [
      "Max Flach Holding",
      "Founder  •  2018 — present  •  Stockholm, Sweden",
      "",
      "Personal holding company. Vehicle for small angel cheques into",
      "early-stage tech founders I believe in. Quiet capital.",
    ].join("\n"),
  },

  "/projects/utopia-music.txt": {
    content: [
      "Utopia Music",
      "CTO  →  Chief Architect  →  CTO",
      "Sep 2018 — Apr 2024  (~5 yrs 8 mos)  •  Stockholm",
      "",
      "Drove the technical evolution of Utopia from almost day one of the",
      "company's existence — across two stints as Chief Technology Officer",
      "and one as Chief Architect.",
      "",
      "Even before Utopia acquired ISPY in 2018, my agency team had been",
      "the base building the foundational platform that became Utopia's",
      "backbone. The acquisition gave Utopia native tech capabilities and",
      "a developer team with a decade and a half of shared context.",
    ].join("\n"),
  },

  "/projects/hubory.txt": {
    content: [
      "Hubory — Founder",
      "Sep 2015 — Nov 2021  (~6 yrs 3 mos)  •  Stockholm, Sweden",
      "",
      "Pioneering Swedish company that revolutionised fiber + TV activation.",
      "Built instant activation across all Internet Service Providers",
      "connected to the Open Fiber network — turning a multi-week onboarding",
      "into a same-day flow.",
      "",
      "Materially improved the connectivity landscape in Sweden by",
      "streamlining a process every household has to go through.",
    ].join("\n"),
  },

  "/projects/the-digital-family.txt": {
    content: [
      "The Digital Family — Founder",
      "Jun 2015 — Nov 2021  (~6 yrs 6 mos)  •  Stockholm, Sweden",
      "",
      "Full-service digital agency: development, design, funding, online",
      "strategy. Doubled as an incubator that fostered the creation of",
      "multiple startups.",
      "",
      "Equal parts service provider and entrepreneurial partner — clients",
      "got robust digital solutions and, when needed, a runway to launch",
      "their own ideas under the same roof.",
    ].join("\n"),
  },

  "/projects/ispy.txt": {
    content: [
      "ISPY — Founder + CTO",
      "May 2003 — Sep 2018  (~15 yrs 5 mos)  •  Stockholm, Sweden",
      "",
      "Pioneering full-service digital agency. Web development, digital",
      "marketing strategy, and bespoke tech for global brands.",
      "",
      "[ Notable clients ]",
      "  Telenor   Bonnier   Intel",
      "  Bredbandsbolaget   Magine TV   …",
      "",
      "[ Track record ]",
      "  Four consecutive yearly Gasell awards.",
      "  Built global streaming platforms in the digital entertainment",
      "    industry — the team still recognised for that work.",
      "  Acquired by Utopia Music AG in 2018; the developer team that",
      "    had followed the agency since 2003 came along and built",
      "    Utopia's platform.",
    ].join("\n"),
  },

  "/projects/qulit.txt": {
    content: [
      "Qulit — Founder + CTO",
      "Jan 1999 — May 2003  (~4 yrs 4 mos)  •  Stockholm, Sweden",
      "",
      "Consultancy bridging traditional business and the new digital world.",
      "Built through the internet boom, mobile computing, and early",
      "e-commerce — the dot-com era and its aftermath.",
      "",
      "Notable client: Bonnier.",
      "",
      "Started at age 18. First company. The one that taught the rest.",
    ].join("\n"),
  },
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
