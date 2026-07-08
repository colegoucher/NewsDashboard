import { sql } from "drizzle-orm";
import { db } from "@/db";

// Everything the "You" page shows: the ranker's beliefs made visible, plus
// wrapped-style fun stats. All computed from user_actions + items.

export interface TasteReport {
  sources: { name: string; score: number; interactions: number }[];
  categories: { name: string; score: number }[];
  topTags: { tag: string; count: number }[];
  stats: {
    read: number;
    saved: number;
    upvoted: number;
    downvoted: number;
    dismissed: number;
    totalItems: number;
    summarized: number;
    mostReadSource: string | null;
    mostDismissedCategory: string | null;
  };
}

const WEIGHTS = `case action_type when 'upvote' then 3 when 'save' then 4 when 'read' then 1
                 when 'downvote' then -3 when 'dismiss' then -1 else 0 end`;

export async function tasteReport(): Promise<TasteReport> {
  const [sourceRows, categoryRows, tagRows, actionCounts, itemCounts, mostRead, mostDismissed] =
    await Promise.all([
      db.execute<{ name: string; score: string; n: string }>(sql`
        select s.name,
               sum(exp(-extract(epoch from now() - a.created_at) / 86400.0 / 30.0) * ${sql.raw(WEIGHTS)}) as score,
               count(*) as n
        from user_actions a
        join items i on i.id = a.item_id
        join sources s on s.id = i.source_id
        group by s.name order by score desc
      `),
      db.execute<{ category: string; score: string }>(sql`
        select i.category,
               sum(exp(-extract(epoch from now() - a.created_at) / 86400.0 / 30.0) * ${sql.raw(WEIGHTS)}) as score
        from user_actions a
        join items i on i.id = a.item_id
        where i.category is not null
        group by i.category order by score desc
      `),
      db.execute<{ tag: string; count: string }>(sql`
        select t.tag, count(*) as count
        from user_actions a
        join items i on i.id = a.item_id,
        lateral jsonb_array_elements_text(i.tags) as t(tag)
        where a.action_type in ('read','upvote','save')
          and a.created_at > now() - interval '30 days'
        group by t.tag order by count desc limit 12
      `),
      db.execute<{ action_type: string; n: string }>(sql`
        select action_type, count(*) as n from user_actions group by action_type
      `),
      db.execute<{ total: string; summarized: string }>(sql`
        select count(*) as total, count(summary) as summarized from items
      `),
      db.execute<{ name: string }>(sql`
        select s.name from user_actions a
        join items i on i.id = a.item_id join sources s on s.id = i.source_id
        where a.action_type = 'read' group by s.name order by count(*) desc limit 1
      `),
      db.execute<{ category: string }>(sql`
        select i.category from user_actions a
        join items i on i.id = a.item_id
        where a.action_type = 'dismiss' and i.category is not null
        group by i.category order by count(*) desc limit 1
      `),
    ]);

  const squash = (x: number) => Math.tanh(x / 10);
  const count = (type: string) =>
    Number(actionCounts.find((r) => r.action_type === type)?.n ?? 0);

  return {
    sources: sourceRows.map((r) => ({
      name: r.name,
      score: squash(Number(r.score)),
      interactions: Number(r.n),
    })),
    categories: categoryRows.map((r) => ({ name: r.category, score: squash(Number(r.score)) })),
    topTags: tagRows.map((r) => ({ tag: r.tag, count: Number(r.count) })),
    stats: {
      read: count("read"),
      saved: count("save"),
      upvoted: count("upvote"),
      downvoted: count("downvote"),
      dismissed: count("dismiss"),
      totalItems: Number(itemCounts[0]?.total ?? 0),
      summarized: Number(itemCounts[0]?.summarized ?? 0),
      mostReadSource: mostRead[0]?.name ?? null,
      mostDismissedCategory: mostDismissed[0]?.category ?? null,
    },
  };
}
