"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  lastRun: { startedAt: string; status: string; error: string | null } | null;
  autoFetchEnabled: boolean;
}

export function RefreshControls({ lastRun, autoFetchEnabled }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(autoFetchEnabled);
  const [note, setNote] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    setNote(null);
    const res = await fetch("/api/refresh", { method: "POST" });
    if (res.ok) {
      setNote("Refresh started — new items appear in a few minutes.");
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

  const lastLabel = lastRun
    ? `${lastRun.status === "failed" ? "⚠ last run failed · " : lastRun.status === "partial" ? "△ " : ""}updated ${timeAgo(lastRun.startedAt)}`
    : "never fetched";

  return (
    <div className="flex min-w-0 items-center gap-2 text-xs text-stone-500 sm:gap-3 dark:text-stone-400">
      {/* Feedback notes show everywhere; the passive status line is desktop-only */}
      {note ? (
        <span className="min-w-0 truncate font-medium text-indigo-600 dark:text-indigo-400">
          {note}
        </span>
      ) : (
        <>
          <span className="hidden truncate md:inline" title={lastRun?.error ?? undefined}>
            {lastLabel}
          </span>
          {lastRun?.status === "failed" && (
            <span className="md:hidden" title={lastRun.error ?? "last run failed"}>
              ⚠
            </span>
          )}
        </>
      )}
      <button
        onClick={toggleAuto}
        title="Daily 8am auto-fetch"
        className={`shrink-0 rounded-full border px-2 py-1 ${
          auto
            ? "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
            : "border-stone-300 dark:border-stone-700"
        }`}
      >
        auto {auto ? "on" : "off"}
      </button>
      <button
        onClick={refresh}
        disabled={busy}
        className="shrink-0 rounded-full border border-stone-300 px-2 py-1 hover:bg-stone-100 disabled:opacity-50 dark:border-stone-700 dark:hover:bg-stone-800"
      >
        {busy ? "…" : "refresh"}
      </button>
    </div>
  );
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
