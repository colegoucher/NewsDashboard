import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { followUpdates, items, storyFollows } from "@/db/schema";

const bodySchema = z.object({
  action: z.enum(["follow", "unfollow", "mark_seen"]),
  itemId: z.number().int().optional(),
  followId: z.number().int().optional(),
  updateId: z.number().int().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { action, itemId, followId, updateId } = parsed.data;

  if (action === "follow") {
    if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });
    const item = await db.query.items.findFirst({ where: eq(items.id, itemId) });
    if (!item) return NextResponse.json({ error: "item not found" }, { status: 404 });
    const existing = await db.query.storyFollows.findFirst({
      where: eq(storyFollows.itemId, itemId),
    });
    if (existing) {
      await db.update(storyFollows).set({ active: true }).where(eq(storyFollows.id, existing.id));
    } else {
      await db.insert(storyFollows).values({ itemId });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "unfollow") {
    if (followId) {
      await db.update(storyFollows).set({ active: false }).where(eq(storyFollows.id, followId));
    } else if (itemId) {
      await db
        .update(storyFollows)
        .set({ active: false })
        .where(and(eq(storyFollows.itemId, itemId), eq(storyFollows.active, true)));
    }
    return NextResponse.json({ ok: true });
  }

  // mark_seen
  if (!updateId) return NextResponse.json({ error: "updateId required" }, { status: 400 });
  await db.update(followUpdates).set({ seen: true }).where(eq(followUpdates.id, updateId));
  return NextResponse.json({ ok: true });
}
