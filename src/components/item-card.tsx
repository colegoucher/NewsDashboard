import Link from "next/link";
import { categoryColor } from "@/lib/category-colors";
import type { FeedItem } from "@/lib/queries";
import { ActionButtons } from "./action-buttons";

export function ItemCard({
  item,
  reason,
  hero = false,
  refreshOnAction = false,
}: {
  item: FeedItem;
  reason?: string;
  hero?: boolean;
  refreshOnAction?: boolean;
}) {
  const teaser = item.summary ?? "Not summarized yet — arrives with the next fetch.";

  if (hero && item.imageUrl) {
    return (
      <article className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:shadow-md dark:border-stone-800 dark:bg-stone-900">
        <Link href={`/item/${item.id}`} className="group block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            className="h-48 w-full object-cover transition duration-300 group-hover:scale-[1.02] sm:h-64"
          />
          <div className="p-4 sm:p-5">
            <Meta item={item} />
            <h2 className="mt-1.5 text-lg font-bold leading-snug group-hover:underline sm:text-xl">
              {item.title}
            </h2>
            <p className="clamp-3 mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
              {teaser}
            </p>
          </div>
        </Link>
        <div className="px-4 pb-4 sm:px-5">
          <ActionButtons itemId={item.id} saved={item.saved} refreshOnAction={refreshOnAction} />
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-3.5 shadow-sm transition hover:shadow-md sm:p-4 dark:border-stone-800 dark:bg-stone-900">
      <Link href={`/item/${item.id}`} className="group flex gap-3.5">
        <div className="min-w-0 flex-1">
          <Meta item={item} />
          <h2 className="clamp-2 mt-1 text-[15px] font-semibold leading-snug group-hover:underline sm:text-base">
            {item.title}
          </h2>
          <p className="clamp-2 mt-1.5 text-[13px] leading-relaxed text-stone-600 sm:text-sm dark:text-stone-400">
            {teaser}
          </p>
        </div>
        {item.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            className="h-20 w-24 shrink-0 rounded-xl object-cover sm:h-24 sm:w-32"
          />
        )}
      </Link>
      {reason && (
        <p className="mt-2 text-xs italic text-indigo-600 dark:text-indigo-400">{reason}</p>
      )}
      <div className="mt-2.5">
        <ActionButtons itemId={item.id} saved={item.saved} refreshOnAction={refreshOnAction} />
      </div>
    </article>
  );
}

function Meta({ item }: { item: FeedItem }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
      <span className="font-medium">{item.sourceName}</span>
      <span aria-hidden>·</span>
      <time>{formatDate(item.publishedAt)}</time>
      {item.category && (
        <span
          className={`rounded-full px-2 py-0.5 font-medium ${categoryColor(item.category)}`}
        >
          {item.category}
        </span>
      )}
    </div>
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
