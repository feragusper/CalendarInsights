import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// `postgres()` connects lazily (only on the first query), so constructing the
// client at import time is safe even during `next build`, where DATABASE_URL
// may be absent. The placeholder is never connected to — real requests run on
// dynamic routes with the real env var set.
const connectionString =
  process.env.DATABASE_URL ?? "postgresql://placeholder@localhost:5432/build";

const globalForDb = globalThis as unknown as {
  client?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.client ?? postgres(connectionString, { prepare: false });
if (process.env.NODE_ENV !== "production") globalForDb.client = client;

export const db = drizzle(client, { schema });
export { schema };
