import { sql } from "drizzle-orm";
import { db } from "@/db";

// Query-time scoring: no cached taste_profile table. At single-user volume,
// computing affinities from user_actions on every feed load is fast, and
// there's nothing to keep in sync. Add a cache only if this is measurably slow.

const ACTION_WEIGHTS: Record<string, number> = {
  upvote: 3,
  save: 4,
  read: 1,
  downvote: -3,
  dismiss: -1,
};

export interface Affinities {
  bySource: Map<number, number>; // sourceId -> [-1, 1]
  byCategory: Map<string, number>; // category -> [-1, 1]
  interactionsBySource: Map<number, number>;
}

export async function computeAffinities(): Promise<Affinities> {
  // Time-decayed engagement per source and per category (30-day half-life-ish decay).
  const rows = await db.execute<{
    source_id: number;
    category: string | null;
    action_type: string;
    weight: string;
    n: string;
  }>(sql`
    select i.source_id,
           i.category,
           a.action_type,
           sum(exp(-extract(epoch from now() - a.created_at) / 86400.0 / 30.0)) as weight,
           count(*) as n
    from user_actions a
    join items i on i.id = a.item_id
    group by i.source_id, i.category, a.action_type
  `);

  const bySourceRaw = new Map<number, number>();
  const byCategoryRaw = new Map<string, number>();
  const interactionsBySource = new Map<number, number>();

  for (const r of rows) {
    const w = (ACTION_WEIGHTS[r.action_type] ?? 0) * Number(r.weight);
    bySourceRaw.set(r.source_id, (bySourceRaw.get(r.source_id) ?? 0) + w);
    interactionsBySource.set(
      r.source_id,
      (interactionsBySource.get(r.source_id) ?? 0) + Number(r.n)
    );
    if (r.category) byCategoryRaw.set(r.category, (byCategoryRaw.get(r.category) ?? 0) + w);
  }

  const squash = (x: number) => Math.tanh(x / 10); // -> [-1, 1]
  return {
    bySource: new Map([...bySourceRaw].map(([k, v]) => [k, squash(v)])),
    byCategory: new Map([...byCategoryRaw].map(([k, v]) => [k, squash(v)])),
    interactionsBySource,
  };
}

export interface ScorableItem {
  id: number;
  sourceId: number;
  category: string | null;
  publishedAt: Date;
}

const W_SOURCE = 1.0;
const W_CATEGORY = 0.7;
const EXPLORATION_BONUS = 0.15; // keeps never-interacted sources from being buried forever
const RECENCY_HALF_LIFE_HOURS = 24;

export function scoreItem(item: ScorableItem, aff: Affinities): number {
  const ageHours = (Date.now() - item.publishedAt.getTime()) / 3_600_000;
  const recency = Math.exp((-Math.LN2 * ageHours) / RECENCY_HALF_LIFE_HOURS);

  const srcAff = aff.bySource.get(item.sourceId) ?? 0;
  const catAff = (item.category && aff.byCategory.get(item.category)) || 0;
  const explored = (aff.interactionsBySource.get(item.sourceId) ?? 0) >= 5;
  const exploration = explored ? 0 : EXPLORATION_BONUS;

  return recency * (1 + W_SOURCE * srcAff + W_CATEGORY * catAff) + exploration;
}

/** Exploration-weighted variant used by Discover: taste matters less, novelty more. */
export function scoreItemForDiscover(item: ScorableItem, aff: Affinities): number {
  const ageHours = (Date.now() - item.publishedAt.getTime()) / 3_600_000;
  const recency = Math.exp((-Math.LN2 * ageHours) / (RECENCY_HALF_LIFE_HOURS * 3));
  const srcAff = aff.bySource.get(item.sourceId) ?? 0;
  const explored = (aff.interactionsBySource.get(item.sourceId) ?? 0) >= 5;
  return recency * (1 + 0.3 * srcAff) + (explored ? 0 : 0.4);
}

/** Short prose taste summary for the Discover Gemini prompt. */
export async function tasteSummaryText(): Promise<string> {
  const rows = await db.execute<{ kind: string; name: string; score: string }>(sql`
    with weighted as (
      select i.source_id, i.category, a.action_type,
             exp(-extract(epoch from now() - a.created_at) / 86400.0 / 30.0) as decay
      from user_actions a join items i on i.id = a.item_id
    )
    select 'source' as kind, s.name as name,
           sum(decay * case action_type when 'upvote' then 3 when 'save' then 4 when 'read' then 1
                                        when 'downvote' then -3 when 'dismiss' then -1 else 0 end) as score
    from weighted w join sources s on s.id = w.source_id
    group by s.name
    union all
    select 'category', w.category,
           sum(decay * case action_type when 'upvote' then 3 when 'save' then 4 when 'read' then 1
                                        when 'downvote' then -3 when 'dismiss' then -1 else 0 end)
    from weighted w where w.category is not null
    group by w.category
  `);

  const fmt = (kind: string) =>
    rows
      .filter((r) => r.kind === kind && Math.abs(Number(r.score)) > 0.5)
      .sort((a, b) => Number(b.score) - Number(a.score))
      .map((r) => `${r.name} (${Number(r.score) > 0 ? "likes" : "avoids"})`)
      .join(", ");

  const sourcesLine = fmt("source");
  const categoriesLine = fmt("category");
  if (!sourcesLine && !categoriesLine) {
    return "No history yet — the reader is brand new. Pick a diverse, interesting spread.";
  }
  return [
    sourcesLine ? `Sources: ${sourcesLine}.` : "",
    categoriesLine ? `Categories: ${categoriesLine}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
