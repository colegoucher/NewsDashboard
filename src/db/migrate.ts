import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "./index";

// Idempotent SQL migrations, run manually (drizzle-kit push crashes on an
// introspection bug against this database). Add statements; never edit old ones.
const MIGRATIONS = [
  sql`alter table items add column if not exists image_url text`,
  sql`alter table items add column if not exists cluster_key text`,
  sql`create table if not exists story_follows (
    id serial primary key,
    item_id integer not null references items(id),
    active boolean not null default true,
    created_at timestamptz not null default now()
  )`,
  sql`create table if not exists follow_updates (
    id serial primary key,
    follow_id integer not null references story_follows(id),
    item_id integer not null references items(id),
    note text,
    seen boolean not null default false,
    created_at timestamptz not null default now()
  )`,
];

async function main() {
  for (const m of MIGRATIONS) await db.execute(m);
  console.log(`${MIGRATIONS.length} migrations ensured`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
