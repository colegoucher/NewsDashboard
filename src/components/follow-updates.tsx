"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FollowUpdate } from "@/lib/queries";

// Banner on the Feed: developments on stories the user follows (🔮).
export function FollowUpdates({ updates }: { updates: FollowUpdate[] }) {
  const router = useRouter();
  if (updates.length === 0) return null;

  async function dismiss(updateId: number) {
    await fetch("/api/follow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_seen", updateId }),
    });
    router.refresh();
  }

  return (
    <section className="mb-4 space-y-2">
      {updates.map((u) => (
        <div
          key={u.updateId}
          className="rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 p-3.5 shadow-sm dark:border-amber-800 dark:from-amber-950/50 dark:to-orange-950/40"
        >
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 text-lg">🔮</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                Update on a story you follow
              </p>
              <p className="mt-0.5 text-sm font-medium leading-snug">
                {u.note ?? "A development was published."}
              </p>
              <Link
                href={`/item/${u.updateItemId}`}
                className="mt-1 block text-sm text-amber-800 underline-offset-2 hover:underline dark:text-amber-300"
              >
                {u.updateItemTitle} →
              </Link>
              <p className="mt-1 text-xs text-stone-500">Following: {u.followedTitle}</p>
            </div>
            <button
              onClick={() => dismiss(u.updateId)}
              title="Dismiss"
              className="rounded-full px-2 py-1 text-xs text-stone-500 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
