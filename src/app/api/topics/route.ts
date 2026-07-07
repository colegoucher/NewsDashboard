import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { sources } from "@/db/schema";
import { addCategory } from "@/lib/categories";

const bodySchema = z.object({
  topic: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[\p{L}\p{N} &'-]+$/u, "letters, numbers and spaces only"),
});

// Creates a topic: a new category (the summarizer starts using it) plus a
// Google News source that pulls articles for it from any outlet on the web.
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid topic name" }, { status: 400 });
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
