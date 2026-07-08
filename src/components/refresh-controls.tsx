"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  lastRun: { startedAt: string; status: string; error: string | null } | null;
  autoFetchEnabled: boolean;
}

// The nav's utility menu: freshness status, manual refresh, auto-fetch
// toggle, and logout — behind one button so the bar stays clean on phones.
export function RefreshControls({ lastRun, autoFetchEnabled }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(autoFetchEnabled);
  const [note, setNote] = useState<string | null>(null);
  const [loadedAt] = useState(() => Date.now());

  const ageHours = lastRun
    ? (loadedAt - new Date(lastRun.startedAt).getTime()) / 3_600_000
    : Infinity;
  const dotColor =
    lastRun?.status === "failed"
      ? "bg-rose-500"
      : ageHours > 26
        ? "bg-amber-500"
        : "bg-emerald-500";

  async function refresh() {
    setBusy(true);
    setNote(null);
    const res = await fetch("/api/refresh", { method: "POST" });
    if (res.ok) {
      setNote("Refresh started — new articles land in ~5–10 minutes, then reload the page.");
    } else {
      const body = await res.json().catch(() => ({}));
      setNote(body.error ?? "Refresh failed.");
    }
    setBusy(false);
  }

  async function toggleAuto() {
    const next = !auto;
    setAuto(next);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "auto_fetch_enabled", value: String(next) }),
    });
    router.refresh();
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const statusLine = lastRun
    ? `${lastRun.status === "failed" ? "⚠ Last fetch failed · " : ""}Updated ${timeAgo(lastRun.startedAt)}`
    : "Never fetched yet";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        title="Status & settings"
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-stone-300 text-sm hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
      >
        ⚙️
        <span
          className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--background)] ${dotColor}`}
          title={statusLine}
        />
      </button>

      {open && (
        <>
          {/* click-outside backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-20 w-72 rounded-2xl border border-stone-200 bg-white p-2 shadow-lg dark:border-stone-700 dark:bg-stone-900">
            <div className="px-3 py-2">
              <p className="flex items-center gap-2 text-sm font-medium">
                <span className={`h-2 w-2 rounded-full ${dotColor}`} />
                {statusLine}
              </p>
              {lastRun?.error && (
                <p className="mt-1 text-xs leading-snug text-stone-500">
                  {lastRun.error.slice(0, 140)}
                </p>
              )}
              {note && (
                <p className="mt-1.5 text-xs font-medium leading-snug text-indigo-600 dark:text-indigo-400">
                  {note}
                </p>
              )}
            </div>

            <hr className="my-1 border-stone-200 dark:border-stone-700" />

            <button
              onClick={refresh}
              disabled={busy}
              className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-stone-100 disabled:opacity-50 dark:hover:bg-stone-800"
            >
              🔄 {busy ? "Starting…" : "Fetch new articles now"}
            </button>

            <button
              onClick={toggleAuto}
              className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              <span className="flex-1">⏰ Daily 7am auto-fetch</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  auto
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                    : "bg-stone-200 text-stone-600 dark:bg-stone-700 dark:text-stone-300"
                }`}
              >
                {auto ? "ON" : "OFF"}
              </span>
            </button>

            <hr className="my-1 border-stone-200 dark:border-stone-700" />

            <button
              onClick={logout}
              className="w-full rounded-xl px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
            >
              🚪 Log out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
