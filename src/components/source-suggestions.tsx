"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SourceSuggestion } from "@/lib/suggest-sources";

export function SourceSuggestions({ suggestions }: { suggestions: SourceSuggestion[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  if (suggestions.length === 0) return null;

  async function act(domain: string, action: "add" | "ignore") {
    setBusy(domain);
    const res = await fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, action }),
    });
    if (res.ok) {
      setNotes((n) => ({
        ...n,
        [domain]: action === "add" ? "Added! New items arrive with the next fetch." : "",
      }));
      if (action === "ignore") router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setNotes((n) => ({ ...n, [domain]: body.error ?? "Something went wrong." }));
    }
    setBusy(null);
  }

  return (
    <section className="mb-8">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Sites you keep liking
      </h2>
      <p className="mb-3 text-xs text-neutral-500">
        These sites showed up via your aggregators and earned your votes — follow them directly?
      </p>
      <div className="space-y-2">
        {suggestions.map((s) => (
          <div
            key={s.domain}
            className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-900 dark:bg-indigo-950/30"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{s.domain}</span>
              <div className="ml-auto flex gap-1.5">
                <button
                  onClick={() => act(s.domain, "add")}
                  disabled={busy === s.domain}
                  className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {busy === s.domain ? "finding feed…" : "+ Follow"}
                </button>
                <button
                  onClick={() => act(s.domain, "ignore")}
                  disabled={busy === s.domain}
                  className="rounded-full border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  No thanks
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              You liked: {s.exampleTitles.map((t) => `“${t.slice(0, 60)}${t.length > 60 ? "…" : ""}”`).join(", ")}
            </p>
            {notes[s.domain] && (
              <p className="mt-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-400">
                {notes[s.domain]}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
