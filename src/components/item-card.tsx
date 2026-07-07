import Link from "next/link";
import type { FeedItem } from "@/lib/queries";
import { ActionButtons } from "./action-buttons";

export function ItemCard({
  item,
  reason,
  refreshOnAction = false,
}: {
  item: FeedItem;
  reason?: string;
  refreshOnAction?: boolean;
}) {
  const teaser = item.summary
    ? item.summary.slice(0, 220) + (item.summary.length > 220 ? "…" : "")
    : "(not yet summarized)";

  return (
    <article className="rounded-xl border border-neutral-200 bg-white p-4 transition-shadow hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-1.5 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
        <span>{item.sourceName}</span>
        <span>·</span>
        <time>{formatDate(item.publishedAt)}</time>
        {item.category && (
          <span className="ml-auto rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            {item.category}
          </span>
        )}
      </div>
      <Link href={`/item/${item.id}`} className="group block">
        <h2 className="text-base font-semibold leading-snug group-hover:underline">
          {item.title}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          {teaser}
        </p>
      </Link>
      {reason && (
        <p className="mt-2 text-xs italic text-indigo-600 dark:text-indigo-400">{reason}</p>
      )}
      <div className="mt-3">
        <ActionButtons itemId={item.id} saved={item.saved} refreshOnAction={refreshOnAction} />
      </div>
    </article>
  );
}

function formatDate(d: Date): string {
  const hours = Math.floor((Date.now() - d.getTime()) / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
