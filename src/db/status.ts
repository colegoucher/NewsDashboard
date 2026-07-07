import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "./index";

// Quick health check: recent runs + item/summary counts.
//   npx tsx src/db/status.ts
async function main() {
  const runs = await db.query.fetchRuns.findMany({
    orderBy: (t, { desc }) => [desc(t.id)],
    limit: 3,
  });
  for (const r of runs) {
    console.log(
      `run ${r.id} [${r.trigger}] ${r.status} — fetched ${r.itemsFetched}, summarized ${r.itemsSummarized}` +
        (r.error ? ` — errors: ${r.error.slice(0, 200)}` : "")
    );
  }
  const [counts] = await db.execute<{ total: string; summarized: string }>(
    sql`select count(*) as total, count(summary) as summarized from items`
  );
  console.log(`items: ${counts.total} total, ${counts.summarized} summarized`);

  const allSources = await db.query.sources.findMany();
  console.log(
    "sources:",
    allSources.map((s) => `${s.name}${s.active ? "" : " (off)"}`).join(", ")
  );
  const cats = await db.query.settings.findFirst({
    where: (t, { eq }) => eq(t.key, "categories"),
  });
  console.log("categories setting:", cats?.value ?? "(defaults)");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
