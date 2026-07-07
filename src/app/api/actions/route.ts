import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { userActions } from "@/db/schema";

const bodySchema = z.object({
  itemId: z.number().int(),
  action: z.enum(["upvote", "downvote", "save", "unsave", "read", "dismiss"]),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { itemId, action } = parsed.data;

  if (action === "unsave") {
    await db
      .delete(userActions)
      .where(and(eq(userActions.itemId, itemId), eq(userActions.actionType, "save")));
    return NextResponse.json({ ok: true });
  }

  // Votes replace an opposite vote rather than stacking.
  if (action === "upvote" || action === "downvote") {
    const opposite = action === "upvote" ? "downvote" : "upvote";
    await db
      .delete(userActions)
      .where(and(eq(userActions.itemId, itemId), eq(userActions.actionType, opposite)));
    const existing = await db.query.userActions.findFirst({
      where: and(eq(userActions.itemId, itemId), eq(userActions.actionType, action)),
    });
    if (!existing) await db.insert(userActions).values({ itemId, actionType: action });
    return NextResponse.json({ ok: true });
  }

  const existing = await db.query.userActions.findFirst({
    where: and(eq(userActions.itemId, itemId), eq(userActions.actionType, action)),
  });
  if (!existing) await db.insert(userActions).values({ itemId, actionType: action });
  return NextResponse.json({ ok: true });
}
