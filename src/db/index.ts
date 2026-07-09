import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = ReturnType<typeof createDb>;

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  // prepare: false is required for Supabase's transaction-mode pooler (port 6543),
  // which is what serverless deployments should connect through.
  // Aggressive idle/connect timeouts: a reused lambda holding a connection the
  // pooler already closed would otherwise hang page renders until the 504.
  // max: 1 — Supabase's recommendation for transaction pooler + serverless.
  // Every extra pooled socket is another chance to get wedged on a
  // half-closed connection; one connection serializes queries (fine at our
  // volume) and fails fast + reconnects when the socket dies.
  const client = postgres(url, {
    prepare: false,
    max: 1,
    idle_timeout: 20, // seconds; drop idle sockets before the pooler does
    connect_timeout: 10,
    max_lifetime: 60 * 30,
  });
  return drizzle(client, { schema });
}

// Lazy: the connection is only created on first query, so importing this module
// (e.g. during `next build` page-data collection) doesn't require DATABASE_URL.
let instance: Db | undefined;

export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    instance ??= createDb();
    const value = Reflect.get(instance, prop, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export { schema };
