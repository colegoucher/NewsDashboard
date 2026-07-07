"use client";

import { useState } from "react";

export function AddTopic() {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim() || busy) return;
    setBusy(true);
    setNote(null);
    const res = await fetch("/api/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setNote(
        `"${body.topic}" is saved ✓ — its tab appears once articles arrive (next fetch, usually tomorrow morning). Nothing else to do.`
      );
      setTopic("");
    } else {
      setNote(body.error ?? "Something went wrong.");
    }
    setBusy(false);
  }

  return (
    <section className="mb-8">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="rounded-full border border-dashed border-neutral-400 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:border-neutral-600 hover:text-neutral-900 dark:border-neutral-600 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          + Add a topic (e.g. Sports, Formula 1, Space)
        </button>
      ) : (
        <form onSubmit={submit} className="flex max-w-md items-center gap-2">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic — broad (Sports) or specific (Premier League)"
            autoFocus
            className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button
            type="submit"
            disabled={busy || !topic.trim()}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            {busy ? "…" : "Add"}
          </button>
        </form>
      )}
      {note && <p className="mt-2 text-xs font-medium text-indigo-700 dark:text-indigo-400">{note}</p>}
    </section>
  );
}
