import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { BudgetExceededError, catchUp } from "@/lib/gemini";
import { getCatchupArticles } from "@/lib/queries";

export const maxDuration = 60;

const bodySchema = z.object({
  question: z.string().min(1).max(1000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string() }))
    .max(12)
    .default([]),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const articles = await getCatchupArticles();
  if (articles.length === 0) {
    return NextResponse.json({
      answer: "No summarized articles in the last day and a half yet — try after the next fetch.",
      items: [],
    });
  }

  try {
    const result = await catchUp({
      question: parsed.data.question,
      history: parsed.data.history,
      articles: articles.map((a) => ({ ...a, summary: a.summary ?? "" })),
    });
    const byId = new Map(articles.map((a) => [a.id, a]));
    return NextResponse.json({
      answer: result.answer,
      items: result.itemIds.map((id) => ({ id, title: byId.get(id)?.title ?? "" })),
    });
  } catch (e) {
    if (e instanceof BudgetExceededError) {
      return NextResponse.json(
        { error: "Daily AI budget used up — resets at midnight Pacific." },
        { status: 429 }
      );
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error("catchup failed:", msg);
    return NextResponse.json(
      { error: `AI call failed (${msg.slice(0, 120)}) — try again in a moment.` },
      { status: 502 }
    );
  }
}
