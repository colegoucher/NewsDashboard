import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { userActions } from "@/db/schema";
import { ActionButtons } from "@/components/action-buttons";
import { AskAi } from "@/components/ask-ai";
import { getItem } from "@/lib/queries";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

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

  const savedRow = await db.query.userActions.findFirst({
    where: and(eq(userActions.itemId, id), eq(userActions.actionType, "save")),
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        ← Feed
      </Link>
      <article className="mt-4">
        <div className="mb-2 flex items-center gap-2 text-sm text-neutral-500">
          <span>{item.sourceName}</span>
          <span>·</span>
          <time>{item.publishedAt.toLocaleDateString(undefined, { month: "long", day: "numeric" })}</time>
          {item.category && (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-800">
              {item.category}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold leading-tight">{item.title}</h1>

        <div className="mt-3">
          <ActionButtons itemId={item.id} saved={!!savedRow} showDismiss={false} />
        </div>

        {item.contentStatus !== "full" && (
          <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            Full article text wasn&apos;t available — this summary is based on{" "}
            {item.contentStatus === "excerpt" ? "an excerpt" : "the title only"}.
          </p>
        )}

        <div className="prose-lg mt-5 space-y-4 leading-relaxed">
          {(item.summary ?? "Not summarized yet — it will be after the next pipeline run.")
            .split(/\n\n+/)
            .map((p, i) => (
              <p key={i}>{p}</p>
            ))}
        </div>

        {item.tags && item.tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {item.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          Read the original ↗
        </a>
      </article>

      <hr className="my-8 border-neutral-200 dark:border-neutral-800" />
      <AskAi itemId={item.id} />
    </main>
  );
}
