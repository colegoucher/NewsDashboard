import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { userActions } from "@/db/schema";
import { ActionButtons } from "@/components/action-buttons";
import { AskAi } from "@/components/ask-ai";
import { DevilsAdvocate, FollowButton } from "@/components/item-tools";
import { categoryColor } from "@/lib/category-colors";
import { getItem, isFollowing } from "@/lib/queries";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // fail fast instead of zombie-hanging on a wedged connection

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idRaw } = await params;
  const id = Number(idRaw);
  if (!Number.isInteger(id)) notFound();

  const item = await getItem(id);
  if (!item) notFound();

  // Opening the summary is what "read" means (scrolling past a card is not).
  const alreadyRead = await db.query.userActions.findFirst({
    where: and(eq(userActions.itemId, id), eq(userActions.actionType, "read")),
  });
  if (!alreadyRead) {
    await db.insert(userActions).values({ itemId: id, actionType: "read" });
  }

  const [savedRow, following] = await Promise.all([
    db.query.userActions.findFirst({
      where: and(eq(userActions.itemId, id), eq(userActions.actionType, "save")),
    }),
    isFollowing(id),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1 rounded-full bg-stone-200/70 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-300/70 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
      >
        ← Feed
      </Link>

      <article className="mt-5">
        {item.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt=""
            className="mb-5 max-h-80 w-full rounded-2xl object-cover shadow-sm"
          />
        )}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-stone-500 dark:text-stone-400">
          <span className="font-medium">{item.sourceName}</span>
          <span aria-hidden>·</span>
          <time>
            {item.publishedAt.toLocaleDateString(undefined, { month: "long", day: "numeric" })}
          </time>
          {item.category && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${categoryColor(item.category)}`}
            >
              {item.category}
            </span>
          )}
        </div>
        <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
          {item.title}
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <ActionButtons itemId={item.id} saved={!!savedRow} showDismiss={false} />
          <FollowButton itemId={item.id} following={following} />
        </div>

        {item.contentStatus !== "full" && (
          <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
            Full article text wasn&apos;t available — this summary is based on{" "}
            {item.contentStatus === "excerpt" ? "an excerpt" : "the title only"}.
          </p>
        )}

        <div className="mt-6 space-y-4 text-[17px] leading-relaxed text-stone-800 dark:text-stone-200">
          {(item.summary ?? "Not summarized yet — it will be after the next pipeline run.")
            .split(/\n\n+/)
            .map((p, i) => (
              <p key={i}>{p}</p>
            ))}
        </div>

        {item.tags && item.tags.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-1.5">
            {item.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-stone-200/70 px-2.5 py-1 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-400"
              >
                #{t}
              </span>
            ))}
          </div>
        )}

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-7 inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]"
        >
          Read the original ↗
        </a>

        <DevilsAdvocate itemId={item.id} />
      </article>

      <hr className="my-8 border-stone-200 dark:border-stone-800" />
      <AskAi itemId={item.id} />
    </main>
  );
}
