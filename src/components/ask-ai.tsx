"use client";

import { useState } from "react";

interface Message {
  role: "user" | "assistant";
  text: string;
}

export function AskAi({ itemId }: { itemId: number }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || busy) return;
    setQuestion("");
    setBusy(true);
    const history = messages;
    setMessages((m) => [...m, { role: "user", text: q }]);

    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, question: q, history }),
    });
    const body = await res.json().catch(() => ({}));
    setMessages((m) => [
      ...m,
      {
        role: "assistant",
        text: res.ok ? body.answer : (body.error ?? "Something went wrong."),
      },
    ]);
    setBusy(false);
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Ask about this article
      </h2>
      <div className="space-y-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-lg px-3 py-2 text-sm leading-relaxed ${
              m.role === "user"
                ? "ml-8 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "mr-8 bg-neutral-100 dark:bg-neutral-800"
            }`}
          >
            {m.text}
          </div>
        ))}
        {busy && <div className="mr-8 rounded-lg bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-800">…</div>}
      </div>
      <form onSubmit={ask} className="mt-3 flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a follow-up question…"
          className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          type="submit"
          disabled={busy || !question.trim()}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          Ask
        </button>
      </form>
    </section>
  );
}
