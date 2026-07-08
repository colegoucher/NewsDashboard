import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { items } from "@/db/schema";
import { BudgetExceededError, devilsAdvocate } from "@/lib/gemini";

export const maxDuration = 60;

const bodySchema = z.object({ itemId: z.number().int() });

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const item = await db.query.items.findFirst({ where: eq(items.id, parsed.data.itemId) });
  if (!item) return NextResponse.json({ error: "item not found" }, { status: 404 });

  try {
    const argument = await devilsAdvocate({
      title: item.title,
      content: item.rawContent ?? item.summary ?? item.title,
    });
    return NextResponse.json({ argument });
  } catch (e) {
    if (e instanceof BudgetExceededError) {
      return NextResponse.json(
        { error: "Daily AI budget used up — resets at midnight Pacific." },
        { status: 429 }
      );
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error("devils-advocate failed:", msg);
    return NextResponse.json(
      { error: `AI call failed (${msg.slice(0, 120)}) — try again in a moment.` },
      { status: 502 }
    );
  }
}
