import Link from "next/link";
import { ItemCard } from "@/components/item-card";
import { Nav } from "@/components/nav";
import { getActiveCategories, getFeed } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const [feed, categories] = await Promise.all([getFeed(category), getActiveCategories()]);

  return (
    <>
      <Nav active="feed" />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-4 flex flex-wrap gap-1.5">
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
          <p className="py-16 text-center text-sm text-neutral-500">
            Nothing here — hit refresh, or everything&apos;s been read. 🎉
          </p>
        ) : (
          <div className="space-y-3">
            {feed.map((item) => (
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
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        active
          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
      }`}
    >
      {label}
    </Link>
  );
}
