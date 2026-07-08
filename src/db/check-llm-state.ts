import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "./index";

async function main() {
  const rows = await db.execute<{ key: string; value: string }>(
    sql`select key, value from settings where key like 'llm_exhausted_%' or key like 'gemini_calls_%' order by key desc limit 6`
  );
  for (const r of rows) console.log(`${r.key} = ${r.value}`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
