"use client";

import { useState } from "react";

export function FollowButton({
  itemId,
  following: initial,
}: {
  itemId: number;
  following: boolean;
}) {
  const [following, setFollowing] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const res = await fetch("/api/follow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: following ? "unfollow" : "follow", itemId }),
    });
    if (res.ok) setFollowing(!following);
    setBusy(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      title="Watch for future developments of this story"
      className={`rounded-full border px-2.5 py-1 text-xs transition disabled:opacity-50 ${
        following
          ? "border-amber-400 bg-amber-50 font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
          : "border-stone-300 hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
      }`}
    >
      🔮 {following ? "following" : "follow this story"}
    </button>
  );
}

export function DevilsAdvocate({ itemId }: { itemId: number }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [text, setText] = useState<string | null>(null);

  async function run() {
    setState("busy");
    const res = await fetch("/api/devils-advocate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
    const body = await res.json().catch(() => ({}));
    setText(res.ok ? body.argument : (body.error ?? "Something went wrong."));
    setState("done");
  }

  return (
    <section className="mt-8">
      {state !== "done" ? (
        <button
          onClick={run}
          disabled={state === "busy"}
          className="rounded-full border border-rose-300 bg-rose-50 px-3.5 py-1.5 text-xs font-medium text-rose-800 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/70"
        >
          {state === "busy" ? "thinking…" : "😈 Devil's advocate — steelman the other side"}
        </button>
      ) : (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 dark:border-rose-900 dark:bg-rose-950/30">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-rose-800 dark:text-rose-300">
            😈 The other side
          </h3>
          <div className="space-y-3 text-[15px] leading-relaxed text-stone-800 dark:text-stone-200">
            {(text ?? "").split(/\n\n+/).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
