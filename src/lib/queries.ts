import { and, desc, eq, gt, inArray, notExists, sql } from "drizzle-orm";
import { db } from "@/db";
import { followUpdates, items, sources, storyFollows, userActions } from "@/db/schema";
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
  clusterKey: string | null;
  saved: boolean;
  /** other outlets covering the same story (cluster collapse) */
  alsoCoveredBy?: { id: number; sourceName: string }[];
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
  clusterKey: items.clusterKey,
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
  const ranked = rows
    .map((r) => ({ item: { ...r, saved: savedIds.has(r.id) }, score: scoreItem(r, aff) }))
    .sort((a, b) => b.score - a.score)
    .map((s) => s.item);

  // Same-story collapse: the top-ranked item of a cluster represents it;
  // the rest fold into an "also covered by" list instead of separate cards.
  const seenClusters = new Map<string, FeedItem>();
  const collapsed: FeedItem[] = [];
  for (const item of ranked) {
    if (!item.clusterKey) {
      collapsed.push(item);
      continue;
    }
    const primary = seenClusters.get(item.clusterKey);
    if (!primary) {
      seenClusters.set(item.clusterKey, item);
      collapsed.push(item);
    } else {
      (primary.alsoCoveredBy ??= []).push({ id: item.id, sourceName: item.sourceName });
    }
  }
  return collapsed;
}

/** Full-text-ish search over everything ever stored (title + summary + tags). */
export async function searchItems(query: string): Promise<FeedItem[]> {
  const q = query.trim();
  if (!q) return [];
  const rows = await db
    .select(baseColumns)
    .from(items)
    .innerJoin(sources, eq(items.sourceId, sources.id))
    .where(
      sql`(
        to_tsvector('english', ${items.title} || ' ' || coalesce(${items.summary}, ''))
          @@ websearch_to_tsquery('english', ${q})
        or ${items.title} ilike ${"%" + q + "%"}
      )`
    )
    .orderBy(desc(items.publishedAt))
    .limit(50);
  const savedIds = await getSavedIds(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, saved: savedIds.has(r.id) }));
}

/** Articles for the catch-me-up chat: everything summarized in the last 36h. */
export async function getCatchupArticles() {
  return db
    .select({
      id: items.id,
      title: items.title,
      category: items.category,
      summary: items.summary,
      sourceName: sources.name,
    })
    .from(items)
    .innerJoin(sources, eq(items.sourceId, sources.id))
    .where(
      and(
        sql`${items.publishedAt} > now() - interval '36 hours'`,
        sql`${items.summary} is not null`
      )
    )
    .orderBy(desc(items.publishedAt))
    .limit(150);
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

// ---- "Whatever happened to...?" follows ----

export interface FollowUpdate {
  updateId: number;
  note: string | null;
  updateItemId: number;
  updateItemTitle: string;
  followedTitle: string;
}

/** Unseen developments on followed stories (shown as a banner on the Feed). */
export async function getUnseenFollowUpdates(): Promise<FollowUpdate[]> {
  const followedItem = db.$with("followed").as(
    db
      .select({ followId: storyFollows.id, title: items.title })
      .from(storyFollows)
      .innerJoin(items, eq(storyFollows.itemId, items.id))
  );
  return db
    .with(followedItem)
    .select({
      updateId: followUpdates.id,
      note: followUpdates.note,
      updateItemId: followUpdates.itemId,
      updateItemTitle: items.title,
      followedTitle: followedItem.title,
    })
    .from(followUpdates)
    .innerJoin(items, eq(followUpdates.itemId, items.id))
    .innerJoin(followedItem, eq(followUpdates.followId, followedItem.followId))
    .where(eq(followUpdates.seen, false))
    .orderBy(desc(followUpdates.createdAt));
}

/** Stories currently being watched (listed on the Saved page). */
export async function getFollowing() {
  return db
    .select({
      followId: storyFollows.id,
      itemId: items.id,
      title: items.title,
      createdAt: storyFollows.createdAt,
    })
    .from(storyFollows)
    .innerJoin(items, eq(storyFollows.itemId, items.id))
    .where(eq(storyFollows.active, true))
    .orderBy(desc(storyFollows.createdAt));
}

export async function isFollowing(itemId: number): Promise<boolean> {
  const row = await db.query.storyFollows.findFirst({
    where: and(eq(storyFollows.itemId, itemId), eq(storyFollows.active, true)),
  });
  return !!row;
}

export async function getLastRun() {
  return db.query.fetchRuns.findFirst({
    orderBy: (t, { desc: d }) => [d(t.startedAt)],
  });
}
