import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = ReturnType<typeof createDb>;

function createDb() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set");
  // Use the SESSION pooler (port 5432 on the same pooler host) instead of the
  // transaction pooler (6543). Transaction mode wedged intermittently when a
  // page fired many concurrent queries over few sockets (/taste 504s); session
  // mode handles pipelined queries correctly. Verified 7-way concurrent on one
  // connection in ~800ms. idle_timeout keeps session slots free between hits.
  const url = raw.replace(":6543/", ":5432/");
  const client = postgres(url, {
    prepare: false,
    max: 2,
    idle_timeout: 20, // seconds; releases the session slot quickly when idle
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
