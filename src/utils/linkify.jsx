// Wrap email/URL substrings in clickable <a> tags. Non-matching text stays plain.
//
// Used in the floppy-pickup reveal modal so things like 'max@flach.io' or
// '/in/max-flach-67527618' become real, clickable links.

export function linkifyLine(line) {
  const pattern = /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})|((?:https?:\/\/|www\.)[^\s]+)|(linkedin\.com\/[^\s]+)|(github\.com\/[^\s]+)|(\/in\/[A-Za-z0-9._-]+)/gi;
  const matches = [...line.matchAll(pattern)];
  if (!matches.length) return [line];

  const out = [];
  let lastIdx = 0;
  let key = 0;
  for (const m of matches) {
    const start = m.index;
    if (start > lastIdx) out.push(line.slice(lastIdx, start));
    const matched = m[0];
    let href = matched;
    if (m[1]) href = `mailto:${matched}`;
    else if (matched.startsWith("www.")) href = `https://${matched}`;
    else if (matched.startsWith("/in/")) href = `https://linkedin.com${matched}`;
    else if (matched.startsWith("linkedin.com")) href = `https://${matched}`;
    else if (matched.startsWith("github.com")) href = `https://${matched}`;
    out.push(
      <a
        key={`l${key++}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#FFD030] underline hover:text-white"
      >
        {matched}
      </a>
    );
    lastIdx = start + matched.length;
  }
  if (lastIdx < line.length) out.push(line.slice(lastIdx));
  return out;
}
