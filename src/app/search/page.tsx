import Form from "next/form";
import { ItemCard } from "@/components/item-card";
import { Nav } from "@/components/nav";
import { searchItems } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const results = q ? await searchItems(q) : [];

  return (
    <>
      <Nav active="search" />
      <main className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6">
        <Form action="/search" className="mb-5 flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search everything you've ever collected…"
            autoFocus
            className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm shadow-sm outline-none focus:border-indigo-500 dark:border-stone-700 dark:bg-stone-900"
          />
          <button
            type="submit"
            className="rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-stone-900"
          >
            Search
          </button>
        </Form>

        {q && results.length === 0 && (
          <p className="py-16 text-center text-sm text-stone-500">
            Nothing found for &ldquo;{q}&rdquo;.
          </p>
        )}
        {!q && (
          <p className="py-16 text-center text-sm text-stone-500">
            Your whole archive is searchable — titles and summaries, including read and expired
            articles.
          </p>
        )}
        <div className="space-y-3">
          {results.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      </main>
    </>
  );
}
