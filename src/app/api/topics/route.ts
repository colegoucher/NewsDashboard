import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { sources } from "@/db/schema";
import { addCategory } from "@/lib/categories";
import { getSetting, setSetting } from "@/lib/settings";

const bodySchema = z.object({
  topic: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[\p{L}\p{N} &'-]+$/u, "letters, numbers and spaces only"),
  action: z.enum(["add", "ignore"]).default("add"),
});

// Creates a topic: a new category (the summarizer starts using it) plus a
// Google News source that pulls articles for it from any outlet on the web.
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid topic name" }, { status: 400 });
  }
  if (parsed.data.action === "ignore") {
    const raw = await getSetting("ignored_topic_suggestions");
    const ignored: string[] = raw ? JSON.parse(raw) : [];
    if (!ignored.includes(parsed.data.topic)) ignored.push(parsed.data.topic);
    await setSetting("ignored_topic_suggestions", JSON.stringify(ignored));
    return NextResponse.json({ ok: true });
  }

  // Title Case for the category/tab label.
  const topic = parsed.data.topic
    .split(/\s+/)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

  const sourceName = `Topic: ${topic}`;
  const existing = await db.query.sources.findFirst({ where: eq(sources.name, sourceName) });
  if (existing) {
    return NextResponse.json({ error: `"${topic}" already exists` }, { status: 409 });
  }

  await addCategory(topic);
  await db.insert(sources).values({
    name: sourceName,
    type: "googlenews",
    config: { query: topic },
  });
  return NextResponse.json({ ok: true, topic });
}
