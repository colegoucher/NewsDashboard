import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { items } from "@/db/schema";
import { askAboutArticle, BudgetExceededError } from "@/lib/gemini";

const bodySchema = z.object({
  itemId: z.number().int(),
  question: z.string().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string() }))
    .max(20)
    .default([]),
});

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { itemId, question, history } = parsed.data;

  const item = await db.query.items.findFirst({ where: eq(items.id, itemId) });
  if (!item) return NextResponse.json({ error: "item not found" }, { status: 404 });

  // Raw text may have been pruned by retention — re-fetch on demand.
  // jsdom (inside extract) is imported lazily and failures degrade to the
  // summary: the common path must never depend on it initializing on Vercel.
  let content = item.rawContent;
  let contentStatus = item.contentStatus;
  if (!content) {
    try {
      const { extractArticle } = await import("@/lib/extract");
      const result = await extractArticle(item.url);
      if (result.text) {
        content = result.text;
        contentStatus = "full";
        await db
          .update(items)
          .set({ rawContent: result.text, contentStatus: "full" })
          .where(eq(items.id, itemId));
      }
    } catch (e) {
      console.error("ask-ai refetch failed:", e instanceof Error ? e.message : e);
    }
    if (!content) {
      content = item.summary ?? item.title;
      contentStatus = "failed";
    }
  }

  try {
    const answer = await askAboutArticle({
      title: item.title,
      content,
      contentStatus,
      question,
      history,
    });
    return NextResponse.json({ answer });
  } catch (e) {
    if (e instanceof BudgetExceededError) {
      return NextResponse.json(
        { error: "Daily AI budget used up — resets at midnight Pacific." },
        { status: 429 }
      );
    }
    // Never let the UI fall back to a bare "Something went wrong".
    const msg = e instanceof Error ? e.message : String(e);
    console.error("ask-ai failed:", msg);
    return NextResponse.json(
      { error: `AI call failed (${msg.slice(0, 120)}) — try again in a moment.` },
      { status: 502 }
    );
  }
}
