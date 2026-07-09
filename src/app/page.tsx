import Link from "next/link";
import { CatchupChat } from "@/components/catchup-chat";
import { FollowUpdates } from "@/components/follow-updates";
import { ItemCard } from "@/components/item-card";
import { Nav } from "@/components/nav";
import { getActiveCategories, getFeed, getUnseenFollowUpdates } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // fail fast instead of zombie-hanging on a wedged connection

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const [feed, categories, updates] = await Promise.all([
    getFeed(category),
    getActiveCategories(),
    getUnseenFollowUpdates(),
  ]);

  const [top, ...rest] = feed;

  return (
    <>
      <Nav active="feed" />
      <main className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6">
        <FollowUpdates updates={updates} />
        <CatchupChat />
        <div className="scrollbar-none -mx-3 mb-4 flex gap-1.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <CategoryTab href="/" label="All" active={!category} />
          {categories.map((c) => (
            <CategoryTab
              key={c}
              href={`/?category=${encodeURIComponent(c)}`}
              label={c}
              active={category === c}
            />
          ))}
        </div>
        {feed.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mb-3 text-4xl">🎉</div>
            <p className="text-sm text-stone-500">
              All caught up — hit refresh, or come back after the morning fetch.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {top && <ItemCard item={top} hero refreshOnAction />}
            {rest.map((item) => (
              <ItemCard key={item.id} item={item} refreshOnAction />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function CategoryTab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition sm:py-1 ${
        active
          ? "bg-stone-900 text-white shadow-sm dark:bg-white dark:text-stone-900"
          : "bg-stone-200/70 text-stone-700 hover:bg-stone-300/70 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
      }`}
    >
      {label}
    </Link>
  );
}
