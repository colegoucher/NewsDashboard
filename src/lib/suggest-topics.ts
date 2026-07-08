import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getCategories } from "./categories";
import { getSetting } from "./settings";

// Topic suggestions from behavior: tags that keep showing up in what the user
// actually reads/likes, but aren't yet a category or topic stream. No AI call.

export interface TopicSuggestion {
  tag: string;
  count: number;
}

export async function getTopicSuggestions(limit = 3): Promise<TopicSuggestion[]> {
  const [tagRows, categories, existingSources, ignoredRaw] = await Promise.all([
    db.execute<{ tag: string; count: string }>(sql`
      select t.tag, count(distinct i.id) as count
      from user_actions a
      join items i on i.id = a.item_id,
      lateral jsonb_array_elements_text(i.tags) as t(tag)
      where a.action_type in ('read', 'upvote', 'save')
        and a.created_at > now() - interval '30 days'
      group by t.tag
      having count(distinct i.id) >= 5
      order by count desc limit 25
    `),
    getCategories(),
    db.query.sources.findMany({ columns: { name: true, config: true } }),
    getSetting("ignored_topic_suggestions"),
  ]);

  const taken = new Set<string>([
    ...categories.map((c) => c.toLowerCase()),
    ...existingSources.map((s) => s.name.toLowerCase().replace(/^topic: /, "")),
    ...existingSources.map((s) => (s.config.query ?? "").toLowerCase()),
    ...(ignoredRaw ? (JSON.parse(ignoredRaw) as string[]) : []).map((t) => t.toLowerCase()),
  ]);

  return tagRows
    .filter((r) => {
      const tag = r.tag.toLowerCase();
      // skip if it's already covered by (or a word inside) a category/topic
      return ![...taken].some((t) => t.includes(tag) || tag.includes(t));
    })
    .slice(0, limit)
    .map((r) => ({ tag: r.tag, count: Number(r.count) }));
}
