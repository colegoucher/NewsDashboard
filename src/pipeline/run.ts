import "dotenv/config";
import { and, eq, isNull, lt, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { fetchRuns, items, sources, userActions } from "@/db/schema";
import {
  FETCH_LIMIT_PER_SOURCE,
  RAW_CONTENT_RETENTION_DAYS,
  SUMMARIZE_BATCH_LIMIT,
  SUMMARIZE_PER_CALL,
} from "@/lib/config";
import { canonicalizeUrl } from "@/lib/canonical-url";
import { extractArticle } from "@/lib/extract";
import { BudgetExceededError, summarizeBatch } from "@/lib/gemini";
import { getSetting } from "@/lib/settings";
import { SOURCE_FETCHERS } from "@/sources";

// The full pipeline: fetch -> extract -> summarize -> retention.
// Runs under GitHub Actions (schedule or manual dispatch) where wall-clock
// time doesn't matter — Gemini rate-limit sleeps are fine here.

async function main() {
  const trigger = process.argv.includes("--manual") ? "manual" : "schedule";

  if (trigger === "schedule") {
    const enabled = await getSetting("auto_fetch_enabled");
    if (enabled === "false") {
      console.log("auto_fetch_enabled=false — skipping scheduled run");
      process.exit(0);
    }
  }

  const [run] = await db.insert(fetchRuns).values({ trigger }).returning({ id: fetchRuns.id });
  const errors: string[] = [];
  let fetched = 0;
  let summarized = 0;

  try {
    // ---- phase 1: fetch (fast, no AI) — items land raw so a later failure loses nothing ----
    const activeSources = await db.query.sources.findMany({ where: eq(sources.active, true) });
    for (const source of activeSources) {
      const fetcher = SOURCE_FETCHERS[source.type];
      if (!fetcher) {
        errors.push(`${source.name}: no fetcher for type "${source.type}"`);
        continue;
      }
      try {
        const fetchedItems = await fetcher(source, FETCH_LIMIT_PER_SOURCE);
        for (const fi of fetchedItems) {
          const canonicalUrl = canonicalizeUrl(fi.url);
          // Canonical-URL dedup across sources (same article via two feeds).
          const dupe = await db.query.items.findFirst({
            where: eq(items.canonicalUrl, canonicalUrl),
            columns: { id: true },
          });
          if (dupe) continue;

          const inserted = await db
            .insert(items)
            .values({
              sourceId: source.id,
              title: fi.title,
              url: fi.url,
              canonicalUrl,
              externalId: fi.externalId,
              publishedAt: fi.publishedAt,
              rawContent: fi.rawContent,
              contentStatus: fi.contentComplete && fi.rawContent ? "full" : "pending",
            })
            .onConflictDoNothing({ target: [items.sourceId, items.externalId] })
            .returning({ id: items.id });
          fetched += inserted.length;
        }
        console.log(`fetched ${source.name}`);
      } catch (e) {
        errors.push(`${source.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    console.log(`phase 1 done: ${fetched} new items`);

    // ---- phase 2: extract full text where the source only gave an excerpt or nothing ----
    const pending = await db.query.items.findMany({
      where: eq(items.contentStatus, "pending"),
      orderBy: (t, { desc }) => [desc(t.publishedAt)],
      limit: SUMMARIZE_BATCH_LIMIT * 2,
    });
    for (const item of pending) {
      const isRedditPermalink = item.url.includes("reddit.com/r/");
      const result = isRedditPermalink
        ? { text: null, status: "failed" as const } // comment threads don't extract usefully
        : await extractArticle(item.url);

      if (result.status === "full") {
        await db
          .update(items)
          .set({ rawContent: result.text, contentStatus: "full" })
          .where(eq(items.id, item.id));
      } else {
        // Fall back to whatever the source gave us (RSS excerpt / nothing).
        await db
          .update(items)
          .set({ contentStatus: item.rawContent ? "excerpt" : "failed" })
          .where(eq(items.id, item.id));
      }
    }
    console.log(`phase 2 done: ${pending.length} items extracted/classified`);

    // ---- phase 3: summarize + categorize (rate-limited, budget-capped) ----
    const toSummarize = await db
      .select({
        id: items.id,
        title: items.title,
        rawContent: items.rawContent,
        contentStatus: items.contentStatus,
        sourceName: sources.name,
      })
      .from(items)
      .innerJoin(sources, eq(items.sourceId, sources.id))
      .where(isNull(items.summary))
      .orderBy(sql`${items.publishedAt} desc`)
      .limit(SUMMARIZE_BATCH_LIMIT);

    for (let i = 0; i < toSummarize.length; i += SUMMARIZE_PER_CALL) {
      const chunk = toSummarize.slice(i, i + SUMMARIZE_PER_CALL);
      try {
        const results = await summarizeBatch(
          chunk.map((item) => ({
            id: item.id,
            title: item.title,
            sourceName: item.sourceName,
            content: item.rawContent ?? item.title,
            isExcerptOnly: item.contentStatus !== "full",
          }))
        );
        for (const [id, r] of results) {
          await db
            .update(items)
            .set({ summary: r.summary, category: r.category, tags: r.tags })
            .where(eq(items.id, id));
          summarized++;
        }
      } catch (e) {
        if (e instanceof BudgetExceededError) {
          errors.push(`${e.message} — remaining items left for next run`);
          break;
        }
        errors.push(
          `summarize batch [${chunk.map((c) => c.id).join(",")}]: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
    console.log(`phase 3 done: ${summarized} items summarized`);

    // ---- phase 4: retention — prune old raw text, keep saved items ----
    const cutoff = new Date(Date.now() - RAW_CONTENT_RETENTION_DAYS * 24 * 3600 * 1000);
    const savedIds = db
      .select({ id: userActions.itemId })
      .from(userActions)
      .where(eq(userActions.actionType, "save"));
    const pruned = await db
      .update(items)
      .set({ rawContent: null })
      .where(
        and(
          lt(items.fetchedAt, cutoff),
          sql`${items.rawContent} is not null`,
          notInArray(items.id, savedIds)
        )
      )
      .returning({ id: items.id });
    console.log(`phase 4 done: pruned raw content from ${pruned.length} items`);

    const status = errors.length === 0 ? "success" : "partial";
    await db
      .update(fetchRuns)
      .set({
        finishedAt: new Date(),
        status,
        itemsFetched: fetched,
        itemsSummarized: summarized,
        error: errors.length ? errors.join("; ").slice(0, 4000) : null,
      })
      .where(eq(fetchRuns.id, run.id));
    console.log(`run ${run.id} finished: ${status}`, errors.length ? errors : "");
    process.exit(0);
  } catch (e) {
    await db
      .update(fetchRuns)
      .set({
        finishedAt: new Date(),
        status: "failed",
        itemsFetched: fetched,
        itemsSummarized: summarized,
        error: (e instanceof Error ? e.message : String(e)).slice(0, 4000),
      })
      .where(eq(fetchRuns.id, run.id));
    console.error(e);
    process.exit(1);
  }
}

main();
