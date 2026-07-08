"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TopicSuggestion } from "@/lib/suggest-topics";

// "You keep reading about X — want it as a topic?" One click creates the
// category + a cross-site stream for it.
export function TopicSuggestions({ suggestions }: { suggestions: TopicSuggestion[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  if (suggestions.length === 0) return null;

  async function act(tag: string, action: "add" | "ignore") {
    setBusy(tag);
    const res = await fetch("/api/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: tag, action }),
    });
    if (res.ok) {
      if (action === "ignore") {
        router.refresh();
      } else {
        setNotes((n) => ({
          ...n,
          [tag]: "Added ✓ — its tab appears once articles arrive (next fetch).",
        }));
      }
    } else {
      const body = await res.json().catch(() => ({}));
      setNotes((n) => ({ ...n, [tag]: body.error ?? "Something went wrong." }));
    }
    setBusy(null);
  }

  return (
    <section className="mb-8">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-stone-500">
        Topics you gravitate toward
      </h2>
      <p className="mb-3 text-xs text-stone-500">
        Based on what you actually read this month — make any of these a full topic?
      </p>
      <div className="space-y-2">
        {suggestions.map((s) => (
          <div
            key={s.tag}
            className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold capitalize">{s.tag}</span>
              <span className="text-xs text-stone-500">in {s.count} articles you engaged with</span>
              <div className="ml-auto flex shrink-0 gap-1.5">
                <button
                  onClick={() => act(s.tag, "add")}
                  disabled={busy === s.tag}
                  className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busy === s.tag ? "…" : "+ Make it a topic"}
                </button>
                <button
                  onClick={() => act(s.tag, "ignore")}
                  disabled={busy === s.tag}
                  className="rounded-full border border-stone-300 px-3 py-1 text-xs hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
                >
                  No
                </button>
              </div>
            </div>
            {notes[s.tag] && (
              <p className="mt-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                {notes[s.tag]}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
