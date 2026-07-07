import "dotenv/config";
import { db } from "./index";
import { settings, sources } from "./schema";

// Starter sources. Edit this list (or the sources table directly) to add/remove —
// nothing else in the system needs to change.
const STARTER_SOURCES: { name: string; type: string; config: Record<string, string> }[] = [
  // RSS — programming / AI / tech
  { name: "Hacker News (frontpage)", type: "rss", config: { feedUrl: "https://hnrss.org/frontpage" } },
  { name: "Ars Technica", type: "rss", config: { feedUrl: "https://feeds.arstechnica.com/arstechnica/index" } },
  { name: "The Verge", type: "rss", config: { feedUrl: "https://www.theverge.com/rss/index.xml" } },
  { name: "TechCrunch", type: "rss", config: { feedUrl: "https://techcrunch.com/feed/" } },
  { name: "Simon Willison", type: "rss", config: { feedUrl: "https://simonwillison.net/atom/everything/" } },
  // RSS — world news (headline-level)
  { name: "BBC World", type: "rss", config: { feedUrl: "https://feeds.bbci.co.uk/news/world/rss.xml" } },
  // Reddit
  { name: "r/programming", type: "reddit", config: { subreddit: "programming" } },
  { name: "r/MachineLearning", type: "reddit", config: { subreddit: "MachineLearning" } },
  { name: "r/technology", type: "reddit", config: { subreddit: "technology" } },
];

async function main() {
  for (const s of STARTER_SOURCES) {
    const existing = await db.query.sources.findFirst({
      where: (t, { eq }) => eq(t.name, s.name),
    });
    if (!existing) {
      await db.insert(sources).values(s);
      console.log(`added source: ${s.name}`);
    }
  }

  await db
    .insert(settings)
    .values({ key: "auto_fetch_enabled", value: "true" })
    .onConflictDoNothing();

  console.log("seed complete");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
