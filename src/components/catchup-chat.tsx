"use client";

import Link from "next/link";
import { useState } from "react";

interface Message {
  role: "user" | "assistant";
  text: string;
  items?: { id: number; title: string }[];
}

// Day-level chat: answers questions across all of today's summaries and
// links the articles it drew from.
export function CatchupChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || busy) return;
    setQuestion("");
    setBusy(true);
    const history = messages.map((m) => ({ role: m.role, text: m.text }));
    setMessages((m) => [...m, { role: "user", text: q }]);

    const res = await fetch("/api/catchup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q, history }),
    });
    const body = await res.json().catch(() => ({}));
    setMessages((m) => [
      ...m,
      res.ok
        ? { role: "assistant", text: body.answer, items: body.items }
        : { role: "assistant", text: body.error ?? "Something went wrong." },
    ]);
    setBusy(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-4 flex w-full items-center gap-2.5 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-fuchsia-50 px-4 py-3 text-left text-sm text-indigo-900 shadow-sm transition hover:shadow-md dark:border-indigo-900 dark:from-indigo-950/50 dark:to-fuchsia-950/40 dark:text-indigo-200"
      >
        <span className="text-lg">💬</span>
        <span className="font-medium">Catch me up — ask anything about today&apos;s news</span>
      </button>
    );
  }

  return (
    <section className="mb-4 rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm dark:border-indigo-900 dark:bg-stone-900">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span>💬</span> Catch me up
        </h2>
        <button
          onClick={() => setOpen(false)}
          className="rounded-full px-2 py-0.5 text-xs text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
        >
          close
        </button>
      </div>
      <div className="space-y-3">
        {messages.length === 0 && (
          <p className="text-xs text-stone-500">
            Try: &ldquo;what actually happened today?&rdquo; · &ldquo;anything big in AI?&rdquo; ·
            &ldquo;summarize the sports news&rdquo;
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i}>
            <div
              className={`rounded-xl px-3 py-2 text-sm leading-relaxed ${
                m.role === "user"
                  ? "ml-8 bg-indigo-600 text-white"
                  : "mr-4 bg-stone-100 dark:bg-stone-800"
              }`}
            >
              {m.text}
            </div>
            {m.items && m.items.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {m.items.map((it) => (
                  <Link
                    key={it.id}
                    href={`/item/${it.id}`}
                    className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300"
                  >
                    {it.title.slice(0, 48)}
                    {it.title.length > 48 ? "…" : ""}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="mr-4 rounded-xl bg-stone-100 px-3 py-2 text-sm dark:bg-stone-800">…</div>
        )}
      </div>
      <form onSubmit={ask} className="mt-3 flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What happened today?"
          autoFocus
          className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-stone-700 dark:bg-stone-950"
        />
        <button
          type="submit"
          disabled={busy || !question.trim()}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Ask
        </button>
      </form>
    </section>
  );
}
