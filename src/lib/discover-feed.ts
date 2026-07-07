// Given a bare domain, find its RSS/Atom feed: first via the <link
// rel="alternate"> tags on the homepage, then common feed paths.

const COMMON_PATHS = ["/feed", "/rss", "/rss.xml", "/atom.xml", "/feed.xml", "/index.xml"];

const FETCH_OPTS: RequestInit = {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  },
  redirect: "follow",
  signal: AbortSignal.timeout(10_000),
};

async function looksLikeFeed(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, FETCH_OPTS);
    if (!res.ok) return false;
    const head = (await res.text()).slice(0, 2000);
    return head.includes("<rss") || head.includes("<feed") || head.includes("<channel");
  } catch {
    return false;
  }
}

export async function discoverFeedUrl(domain: string): Promise<string | null> {
  const base = `https://${domain}`;

  // 1. Homepage <link rel="alternate" type="application/rss+xml" href="...">
  try {
    const res = await fetch(base, FETCH_OPTS);
    if (res.ok) {
      const html = await res.text();
      const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];
      for (const tag of linkTags) {
        if (!/application\/(rss|atom)\+xml/i.test(tag)) continue;
        const href = tag.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
        if (!href) continue;
        const feedUrl = new URL(href, base).toString();
        if (await looksLikeFeed(feedUrl)) return feedUrl;
      }
    }
  } catch {
    // fall through to common paths
  }

  // 2. Conventional paths
  for (const path of COMMON_PATHS) {
    const candidate = base + path;
    if (await looksLikeFeed(candidate)) return candidate;
  }
  return null;
}
