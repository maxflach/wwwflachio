import { useEffect, useState } from "react";

const FRAMES = [
  "404",
  "4O4",
  "40A",
  "4Ø4",
  "4 4",
  "404",
];

export default function NotFound() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 180);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center font-mono px-6 text-center">
      <div className="text-[20vw] leading-none font-bold text-sky-400 select-none tracking-tighter">
        {FRAMES[frame]}
      </div>
      <p className="mt-6 text-slate-400 max-w-md">
        this page is more interesting than the homepage, but it still doesn&apos;t exist.
      </p>
      <a
        href="/"
        className="mt-8 px-4 py-2 border border-slate-700 rounded hover:bg-slate-800 transition"
      >
        ← back to nothing
      </a>
      <p className="mt-10 text-xs text-slate-600">
        path: <code>{typeof window !== "undefined" ? window.location.pathname : ""}</code>
      </p>
    </div>
  );
}
