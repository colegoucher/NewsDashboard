import { ItemCard } from "@/components/item-card";
import { Nav } from "@/components/nav";
import { AiPicksSection } from "@/components/ai-picks";
import { SourceSuggestions } from "@/components/source-suggestions";
import { getDiscoverCandidates } from "@/lib/queries";
import { getSetting } from "@/lib/settings";
import { getSourceSuggestions } from "@/lib/suggest-sources";

export const dynamic = "force-dynamic";

export interface CachedPicks {
  generatedAt: string;
  picks: { itemId: number; reason: string }[];
}

export default async function DiscoverPage() {
  const [candidates, sourceSuggestions] = await Promise.all([
    getDiscoverCandidates(),
    getSourceSuggestions(),
  ]);

  const cachedRaw = await getSetting(`discover_picks_${new Date().toISOString().slice(0, 10)}`);
  const cached: CachedPicks | null = cachedRaw ? JSON.parse(cachedRaw) : null;
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const aiPicks = (cached?.picks ?? [])
    .filter((p) => byId.has(p.itemId))
    .map((p) => ({ item: byId.get(p.itemId)!, reason: p.reason }));
  const aiPickIds = new Set(aiPicks.map((p) => p.item.id));

  return (
    <>
      <Nav active="discover" />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <SourceSuggestions suggestions={sourceSuggestions} />
        <AiPicksSection hasPicks={aiPicks.length > 0}>
          {aiPicks.map(({ item, reason }) => (
            <ItemCard key={item.id} item={item} reason={reason} refreshOnAction />
          ))}
        </AiPicksSection>

        <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Outside your usual lane
        </h2>
        <p className="mb-4 text-xs text-neutral-500">
          Exploration-weighted picks — vote on these to train your profile.
        </p>
        <div className="space-y-3">
          {candidates
            .filter((c) => !aiPickIds.has(c.id))
            .slice(0, 20)
            .map((item) => (
              <ItemCard key={item.id} item={item} refreshOnAction />
            ))}
        </div>
      </main>
    </>
  );
}
