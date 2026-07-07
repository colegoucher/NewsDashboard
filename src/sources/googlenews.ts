import Parser from "rss-parser";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { items as itemsTable } from "@/db/schema";
import type { FetchedItem, SourceFetcher } from "./types";

// Topic source: Google News search RSS aggregates articles for any query
// across thousands of outlets — this is how a "topic" (e.g. Sports) pulls
// from sites we don't individually follow.
//
// Google wraps item links in JS-only redirect pages, so we trade the page's
// signature + timestamp to an internal endpoint for the real article URL
// (the "garturlreq" exchange). If Google changes the scheme, resolution
// fails soft: the google link is kept and extraction degrades to excerpt.

const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "NewsDashboard/1.0 (personal aggregator)" },
});

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
// Pre-baked consent cookie; without it the article page omits the signature attrs.
const SOCS_COOKIE = "SOCS=CAESHAgBEhJnd3NfMjAyMzA4MTAtMF9SQzIaAmVuIAEaBgiA_LyaBg";

async function resolveGoogleNewsUrl(link: string): Promise<string> {
  try {
    const id = link.match(/articles\/([^?/]+)/)?.[1];
    if (!id) return link;

    const pageRes = await fetch(
      `https://news.google.com/articles/${id}?hl=en-US&gl=US&ceid=US:en`,
      {
        headers: { "User-Agent": BROWSER_UA, Cookie: SOCS_COOKIE },
        signal: AbortSignal.timeout(15_000),
      }
    );
    if (!pageRes.ok) return link;
    const html = await pageRes.text();
    const sg = html.match(/data-n-a-sg="([^"]+)"/)?.[1];
    const ts = html.match(/data-n-a-ts="([^"]+)"/)?.[1];
    if (!sg || !ts) return link;

    const inner = JSON.stringify([
      "garturlreq",
      [
        ["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1],
        "X",
        "X",
        1,
        [1, 1, 1],
        1,
        1,
        null,
        0,
        0,
        null,
        0,
      ],
      id,
      Number(ts),
      sg,
    ]);
    const res = await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": BROWSER_UA,
      },
      body: new URLSearchParams({ "f.req": JSON.stringify([[["Fbv4je", inner, null, "generic"]]]) }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return link;
    const text = await res.text();
    const urls = text.match(/https?:\/\/[^"\\]+/g) ?? [];
    return urls.find((u) => !u.includes("google.com")) ?? link;
  } catch {
    return link;
  }
}

export const fetchGoogleNews: SourceFetcher = async (source, limit) => {
  const query = source.config.query;
  if (!query) throw new Error(`googlenews source "${source.name}" has no query`);

  const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const feed = await parser.parseURL(feedUrl);

  const results: FetchedItem[] = [];
  for (const entry of (feed.items ?? []).slice(0, limit)) {
    if (!entry.title || !entry.link) continue;
    const externalId = entry.guid ?? entry.link;

    // URL resolution costs two requests per article — skip items we already have.
    const known = await db.query.items.findFirst({
      where: and(eq(itemsTable.sourceId, source.id), eq(itemsTable.externalId, externalId)),
      columns: { id: true },
    });
    if (known) continue;

    const url = await resolveGoogleNewsUrl(entry.link);
    await new Promise((r) => setTimeout(r, 300)); // be polite to Google

    results.push({
      // Titles arrive as "Headline - Outlet Name"; keep the outlet, it's useful.
      title: entry.title,
      url,
      rawContent: null, // force the extraction phase to fetch the real article
      publishedAt: entry.isoDate ? new Date(entry.isoDate) : new Date(),
      externalId,
    });
  }
  return results;
};
