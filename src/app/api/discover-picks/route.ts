import { NextResponse } from "next/server";
import { BudgetExceededError, pickDiscoverItems } from "@/lib/gemini";
import { getDiscoverCandidates } from "@/lib/queries";
import { tasteSummaryText } from "@/lib/scoring";
import { setSetting } from "@/lib/settings";

export const maxDuration = 60;

// Generates the AI-curated Discover picks (one Gemini call) and caches them
// for the day in settings, keyed by date.
export async function POST() {
  const candidates = await getDiscoverCandidates();
  if (candidates.length === 0) {
    return NextResponse.json({ error: "no candidates to pick from" }, { status: 400 });
  }

  try {
    const picks = await pickDiscoverItems({
      tasteSummary: await tasteSummaryText(),
      candidates: candidates.map((c) => ({
        id: c.id,
        title: c.title,
        category: c.category,
        sourceName: c.sourceName,
      })),
    });
    await setSetting(
      `discover_picks_${new Date().toISOString().slice(0, 10)}`,
      JSON.stringify({ generatedAt: new Date().toISOString(), picks })
    );
    return NextResponse.json({ ok: true, count: picks.length });
  } catch (e) {
    if (e instanceof BudgetExceededError) {
      return NextResponse.json(
        { error: "Daily AI budget used up — resets at midnight Pacific." },
        { status: 429 }
      );
    }
    throw e;
  }
}
