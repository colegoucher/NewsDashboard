import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { sources } from "@/db/schema";
import { discoverFeedUrl } from "@/lib/discover-feed";
import { getSetting, setSetting } from "@/lib/settings";

export const maxDuration = 60;

const bodySchema = z.object({
  domain: z
    .string()
    .min(3)
    .max(253)
    .regex(/^[a-z0-9.-]+$/i),
  action: z.enum(["add", "ignore"]),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { domain, action } = parsed.data;

  if (action === "ignore") {
    const raw = await getSetting("ignored_source_domains");
    const ignored: string[] = raw ? JSON.parse(raw) : [];
    if (!ignored.includes(domain)) ignored.push(domain);
    await setSetting("ignored_source_domains", JSON.stringify(ignored));
    return NextResponse.json({ ok: true });
  }

  const feedUrl = await discoverFeedUrl(domain);
  if (!feedUrl) {
    return NextResponse.json(
      { error: `Couldn't find an RSS feed on ${domain} — the site may not publish one.` },
      { status: 404 }
    );
  }

  await db.insert(sources).values({
    name: domain,
    type: "rss",
    config: { feedUrl },
  });
  return NextResponse.json({ ok: true, feedUrl });
}
