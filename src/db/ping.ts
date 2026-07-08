import "dotenv/config";
import postgres from "postgres";

// Quick DB latency probe: npx tsx src/db/ping.ts
async function main() {
  const t0 = Date.now();
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, connect_timeout: 10 });
  await sql`select 1`;
  console.log(`connect + select 1: ${Date.now() - t0}ms`);

  const t1 = Date.now();
  await sql`select count(*) from items where published_at > now() - interval '14 days'`;
  console.log(`items window count: ${Date.now() - t1}ms`);

  const t2 = Date.now();
  await sql`select i.source_id, i.category, a.action_type, count(*)
            from user_actions a join items i on i.id = a.item_id
            group by 1, 2, 3`;
  console.log(`affinity aggregate: ${Date.now() - t2}ms`);

  await sql.end();
  process.exit(0);
}

main().catch((e) => {
  console.error("DB FAIL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
