import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { userActions } from "@/db/schema";
import { getSetting } from "./settings";

// Organic source discovery: aggregators (HN, Reddit) surface articles from
// sites we don't follow directly. When one of those sites keeps earning
// upvotes/saves, suggest promoting it to a full source.

const POSITIVE_WEIGHTS: Record<string, number> = { upvote: 3, save: 4 };
const SUGGEST_THRESHOLD = 6; // e.g. two upvotes, or an upvote + a save
const AGGREGATOR_DOMAINS = ["reddit.com", "ycombinator.com", "hnrss.org"];

export interface SourceSuggestion {
  domain: string;
  score: number;
  exampleTitles: string[];
}

function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Loose base-domain match so feeds.arstechnica.com covers arstechnica.com. */
function sameSite(a: string, b: string): boolean {
  const base = (d: string) => d.split(".").slice(-2).join(".");
  return base(a) === base(b);
}

export async function getSourceSuggestions(limit = 4): Promise<SourceSuggestion[]> {
  const [actions, existingSources, ignoredRaw] = await Promise.all([
    db
      .select()
      .from(userActions)
      .where(inArray(userActions.actionType, Object.keys(POSITIVE_WEIGHTS))),
    db.query.sources.findMany(),
    getSetting("ignored_source_domains"),
  ]);
  if (actions.length === 0) return [];

  const itemRows = await db.query.items.findMany({
    where: (t, { inArray: inArr }) =>
      inArr(
        t.id,
        actions.map((a) => a.itemId)
      ),
    columns: { id: true, url: true, title: true },
  });
  const itemById = new Map(itemRows.map((i) => [i.id, i]));

  const knownDomains = [
    ...AGGREGATOR_DOMAINS,
    ...existingSources
      .map((s) => (s.config.feedUrl ? domainOf(s.config.feedUrl) : null))
      .filter((d): d is string => !!d),
  ];
  const ignored: string[] = ignoredRaw ? JSON.parse(ignoredRaw) : [];

  const byDomain = new Map<string, { score: number; titles: string[] }>();
  for (const a of actions) {
    const item = itemById.get(a.itemId);
    if (!item) continue;
    const domain = domainOf(item.url);
    if (!domain) continue;
    if (ignored.includes(domain)) continue;
    if (knownDomains.some((k) => sameSite(k, domain))) continue;

    const entry = byDomain.get(domain) ?? { score: 0, titles: [] };
    entry.score += POSITIVE_WEIGHTS[a.actionType] ?? 0;
    if (item.title && !entry.titles.includes(item.title)) entry.titles.push(item.title);
    byDomain.set(domain, entry);
  }

  return [...byDomain.entries()]
    .filter(([, v]) => v.score >= SUGGEST_THRESHOLD && v.titles.length >= 2)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, limit)
    .map(([domain, v]) => ({ domain, score: v.score, exampleTitles: v.titles.slice(0, 3) }));
}
