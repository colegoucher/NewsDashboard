"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Wraps the AI-curated section of Discover. Picks are generated on demand
// (one Gemini call) and cached for the day server-side to protect the budget.
export function AiPicksSection({
  hasPicks,
  children,
}: {
  hasPicks: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/discover-picks", { method: "POST" });
    if (res.ok) {
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to generate picks");
    }
    setBusy(false);
  }

  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Maybe I&apos;d like
        </h2>
        <button
          onClick={generate}
          disabled={busy}
          className="rounded-full border border-neutral-300 px-2.5 py-1 text-xs hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          {busy ? "thinking…" : hasPicks ? "regenerate" : "✨ generate AI picks"}
        </button>
      </div>
      {error && <p className="mb-3 text-xs text-red-600">{error}</p>}
      {hasPicks ? (
        <div className="space-y-3">{children}</div>
      ) : (
        !busy && (
          <p className="text-xs text-neutral-500">
            AI reads your taste profile and picks a handful of items — cached for the day.
          </p>
        )
      )}
    </section>
  );
}
