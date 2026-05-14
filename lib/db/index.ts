/**
 * Mongoose connection helper.
 *
 * Pattern is the standard Next.js cached-global trick: reuse the same connection
 * across requests so we don't open a new socket per server-action invocation,
 * which would exhaust Atlas's connection limit immediately on hot routes.
 */
import mongoose from "mongoose";

type Cached = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __mongooseCache: Cached | undefined;
}

const cache: Cached = global.__mongooseCache ?? { conn: null, promise: null };
if (!global.__mongooseCache) global.__mongooseCache = cache;

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("MONGODB_URI is not set. Copy .env.example -> .env.local.");
    }
    cache.promise = mongoose.connect(uri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
    });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}

// Re-export the models so callers can `import { User, Event, ... } from "@/lib/db"`
export * from "./schema";
