import type { FetchedItem, SourceFetcher } from "./types";

// Reddit via OAuth (app-only client_credentials). The unauthenticated .json endpoints
// are blocked from datacenter IPs (GitHub Actions, Vercel), so OAuth is not optional.

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.token;

  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) throw new Error("REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET not set");

  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent(),
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`reddit token request failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

function userAgent(): string {
  return process.env.REDDIT_USER_AGENT ?? "web:news-dashboard:v1.0 (personal aggregator)";
}

interface RedditPost {
  id: string;
  title: string;
  permalink: string;
  url: string;
  selftext: string;
  is_self: boolean;
  created_utc: number;
  stickied: boolean;
}

export const fetchReddit: SourceFetcher = async (source, limit) => {
  const subreddit = source.config.subreddit;
  if (!subreddit) throw new Error(`reddit source "${source.name}" has no subreddit`);

  const token = await getToken();
  const res = await fetch(`https://oauth.reddit.com/r/${subreddit}/hot?limit=${limit}&raw_json=1`, {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": userAgent() },
  });
  if (!res.ok) throw new Error(`reddit fetch r/${subreddit} failed: ${res.status}`);
  const data = (await res.json()) as { data: { children: { data: RedditPost }[] } };

  return data.data.children
    .map((c) => c.data)
    .filter((p) => !p.stickied)
    .map((p): FetchedItem => {
      const isSelf = p.is_self;
      return {
        title: p.title,
        // For link posts the interesting content is the linked article; keep the
        // permalink discoverable by storing the external link as the item URL.
        url: isSelf ? `https://www.reddit.com${p.permalink}` : p.url,
        rawContent: isSelf && p.selftext ? p.selftext : null,
        contentComplete: isSelf,
        publishedAt: new Date(p.created_utc * 1000),
        externalId: p.id,
      };
    });
};
