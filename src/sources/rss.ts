import Parser from "rss-parser";
import type { FetchedItem, SourceFetcher } from "./types";

const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "NewsDashboard/1.0 (personal aggregator)" },
});

export const fetchRss: SourceFetcher = async (source, limit) => {
  const feedUrl = source.config.feedUrl;
  if (!feedUrl) throw new Error(`rss source "${source.name}" has no feedUrl`);

  const feed = await parser.parseURL(feedUrl);
  const items: FetchedItem[] = [];

  for (const entry of (feed.items ?? []).slice(0, limit)) {
    const url = entry.link;
    if (!url || !entry.title) continue;

    // Feeds vary: content:encoded is usually full text, content/summary usually an excerpt.
    const encoded = (entry as Record<string, unknown>)["content:encoded"];
    const body =
      (typeof encoded === "string" && encoded) || entry.content || entry.contentSnippet || null;

    const enclosure = entry.enclosure?.url;
    items.push({
      title: entry.title,
      url,
      rawContent: body ? stripHtml(body) : null,
      publishedAt: entry.isoDate ? new Date(entry.isoDate) : new Date(),
      externalId: entry.guid ?? url,
      imageUrl:
        enclosure && (entry.enclosure?.type ?? "").startsWith("image") ? enclosure : null,
    });
  }
  return items;
};

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
