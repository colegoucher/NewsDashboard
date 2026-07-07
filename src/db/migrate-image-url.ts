import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "./index";

// One-off: drizzle-kit push crashed on introspection (upstream bug), so the
// image_url column is added directly. Idempotent.
async function main() {
  await db.execute(sql`alter table items add column if not exists image_url text`);
  console.log("image_url column ensured");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
