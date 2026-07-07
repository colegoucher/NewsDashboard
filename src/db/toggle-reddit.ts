import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { sources } from "./schema";

// Flips all reddit sources on/off. Used while Reddit API approval is pending:
//   npx tsx src/db/toggle-reddit.ts        -> deactivate
//   npx tsx src/db/toggle-reddit.ts --on   -> activate
const active = process.argv.includes("--on");

async function main() {
  const updated = await db
    .update(sources)
    .set({ active })
    .where(eq(sources.type, "reddit"))
    .returning({ name: sources.name });
  console.log(`${active ? "activated" : "deactivated"}:`, updated.map((u) => u.name).join(", "));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
