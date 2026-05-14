/**
 * Neon Postgres client — Drizzle ORM on the HTTP driver.
 *
 * Why HTTP and not the WebSocket driver: Vercel serverless functions are short-
 * lived and don't benefit from a persistent socket pool. The HTTP driver fits
 * the request lifecycle, doesn't leak connections, and works in the Edge
 * runtime if we ever route something there.
 */
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

// Lazy: build steps don't need a DB; only request handlers do.
let cached: NeonHttpDatabase<typeof schema> | null = null;

function getDb(): NeonHttpDatabase<typeof schema> {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example -> .env.local.");
  }
  cached = drizzle(neon(url), { schema });
  return cached;
}

export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_target, prop) {
    return Reflect.get(getDb(), prop);
  },
});

export * from "./schema";
