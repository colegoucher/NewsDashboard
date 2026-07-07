import { and, desc, eq, gt, inArray, notExists, sql } from "drizzle-orm";
import { db } from "@/db";
import { items, sources, userActions } from "@/db/schema";
import { FEED_WINDOW_DAYS } from "./config";
import { computeAffinities, scoreItem, scoreItemForDiscover } from "./scoring";

export interface FeedItem {
  id: number;
  title: string;
  url: string;
  summary: string | null;
  category: string | null;
  tags: string[] | null;
  publishedAt: Date;
  sourceName: string;
  sourceId: number;
  contentStatus: string;
  imageUrl: string | null;
  saved: boolean;
}

const baseColumns = {
  id: items.id,
  title: items.title,
  url: items.url,
  summary: items.summary,
  category: items.category,
  tags: items.tags,
  publishedAt: items.publishedAt,
  sourceId: items.sourceId,
  sourceName: sources.name,
  contentStatus: items.contentStatus,
  imageUrl: items.imageUrl,
};

function windowStart(): Date {
  return new Date(Date.now() - FEED_WINDOW_DAYS * 24 * 3600 * 1000);
}

/** Items neither read nor dismissed, relevance-scored. */
export async function getFeed(category?: string): Promise<FeedItem[]> {
  const hidden = db
    .select({ one: sql`1` })
    .from(userActions)
    .where(
      and(
        eq(userActions.itemId, items.id),
        inArray(userActions.actionType, ["read", "dismiss"])
      )
    );

  const rows = await db
    .select(baseColumns)
    .from(items)
    .innerJoin(sources, eq(items.sourceId, sources.id))
    .where(
      and(
        gt(items.publishedAt, windowStart()),
        notExists(hidden),
        category ? eq(items.category, category) : undefined
      )
    )
    .orderBy(desc(items.publishedAt))
    .limit(300);

  const aff = await computeAffinities();
  const savedIds = await getSavedIds(rows.map((r) => r.id));
  return rows
    .map((r) => ({ item: { ...r, saved: savedIds.has(r.id) }, score: scoreItem(r, aff) }))
    .sort((a, b) => b.score - a.score)
    .map((s) => s.item);
}

export async function getDiscoverCandidates(): Promise<FeedItem[]> {
  const hidden = db
    .select({ one: sql`1` })
    .from(userActions)
    .where(
      and(
        eq(userActions.itemId, items.id),
        inArray(userActions.actionType, ["read", "dismiss", "upvote", "downvote"])
      )
    );

  const rows = await db
    .select(baseColumns)
    .from(items)
    .innerJoin(sources, eq(items.sourceId, sources.id))
    .where(and(gt(items.publishedAt, windowStart()), notExists(hidden)))
    .orderBy(desc(items.publishedAt))
    .limit(300);

  const aff = await computeAffinities();
  const savedIds = await getSavedIds(rows.map((r) => r.id));
  return rows
    .map((r) => ({
      item: { ...r, saved: savedIds.has(r.id) },
      score: scoreItemForDiscover(r, aff),
    }))
    .sort((a, b) => b.score - a.score)
    .map((s) => s.item)
    .slice(0, 40);
}

export async function getSaved(): Promise<FeedItem[]> {
  const rows = await db
    .selectDistinctOn([items.id], baseColumns)
    .from(items)
    .innerJoin(sources, eq(items.sourceId, sources.id))
    .innerJoin(
      userActions,
      and(eq(userActions.itemId, items.id), eq(userActions.actionType, "save"))
    )
    .orderBy(items.id, desc(items.publishedAt));

  return rows
    .map((r) => ({ ...r, saved: true }))
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}

async function getSavedIds(ids: number[]): Promise<Set<number>> {
  if (ids.length === 0) return new Set();
  const rows = await db
    .select({ itemId: userActions.itemId })
    .from(userActions)
    .where(and(eq(userActions.actionType, "save"), inArray(userActions.itemId, ids)));
  return new Set(rows.map((r) => r.itemId));
}

export async function getItem(id: number) {
  const [row] = await db
    .select({ ...baseColumns, rawContent: items.rawContent })
    .from(items)
    .innerJoin(sources, eq(items.sourceId, sources.id))
    .where(eq(items.id, id))
    .limit(1);
  return row ?? null;
}

/** Distinct categories present in the current window (drives the feed tabs). */
export async function getActiveCategories(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ category: items.category })
    .from(items)
    .where(and(gt(items.publishedAt, windowStart()), sql`${items.category} is not null`));
  return rows.map((r) => r.category!).sort();
}

export async function getLastRun() {
  return db.query.fetchRuns.findFirst({
    orderBy: (t, { desc: d }) => [d(t.startedAt)],
  });
}
