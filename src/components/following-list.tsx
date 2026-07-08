"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

interface Follow {
  followId: number;
  itemId: number;
  title: string;
}

export function FollowingList({ follows }: { follows: Follow[] }) {
  const router = useRouter();
  if (follows.length === 0) return null;

  async function unfollow(followId: number) {
    await fetch("/api/follow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unfollow", followId }),
    });
    router.refresh();
  }

  return (
    <section className="mb-8">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-stone-500">
        🔮 Stories you&apos;re following
      </h2>
      <p className="mb-3 text-xs text-stone-500">
        The morning pipeline watches for developments and flags them on your Feed.
      </p>
      <div className="space-y-2">
        {follows.map((f) => (
          <div
            key={f.followId}
            className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-3.5 py-2.5 dark:border-stone-800 dark:bg-stone-900"
          >
            <Link
              href={`/item/${f.itemId}`}
              className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
            >
              {f.title}
            </Link>
            <button
              onClick={() => unfollow(f.followId)}
              className="shrink-0 rounded-full border border-stone-300 px-2.5 py-1 text-xs hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
            >
              stop watching
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
