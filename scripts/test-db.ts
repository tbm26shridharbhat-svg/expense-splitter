/**
 * Quick MongoDB connection diagnostic.
 *
 * Usage:   npx tsx scripts/test-db.ts
 *
 * Reads MONGODB_URI from .env.local, attempts a connection, runs a ping
 * and lists databases. Prints the masked URI (no password) and a precise
 * error message if anything fails.
 */
import mongoose from "mongoose";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Tiny .env.local reader — no extra dep
function loadEnv() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) {
    console.error("✗ .env.local does not exist at", path);
    process.exit(1);
  }
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnv();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("✗ MONGODB_URI is not set in .env.local");
  process.exit(1);
}

// Mask the password in any logs
const masked = uri.replace(/(:)[^@]+(@)/, (_, p1, p2) => `${p1}<password>${p2}`);
console.log("Attempting:", masked);

// Parse and surface the username so we can confirm it matches Atlas
try {
  const url = new URL(uri);
  console.log("Username being sent:", url.username);
} catch {
  console.error("✗ URI is malformed (cannot parse with URL())");
  process.exit(1);
}

(async () => {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    console.log("✓ Connected to cluster");

    const adminDb = mongoose.connection.db?.admin();
    if (adminDb) {
      const ping = await adminDb.ping();
      console.log("✓ Ping:", ping);
      const dbs = await adminDb.listDatabases();
      console.log("✓ Visible databases:", dbs.databases.map((d) => d.name).join(", "));
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err: unknown) {
    const e = err as { name?: string; code?: number; codeName?: string; message?: string };
    console.error("\n✗ Connection failed:");
    console.error("  name:    ", e.name);
    console.error("  code:    ", e.code);
    console.error("  codeName:", e.codeName);
    console.error("  message: ", e.message);
    console.error();
    if (e.message?.includes("bad auth")) {
      console.error("→ Atlas rejected the username/password combo.");
      console.error("  Most common causes:");
      console.error("  • Database user wasn't saved (Atlas form needs explicit click)");
      console.error("  • Password was edited but Update User wasn't clicked");
      console.error("  • Password retyped by hand has hidden whitespace or wrong char");
      console.error("  Fix: Atlas → Database Access → Edit user → Edit Password → AUTOGENERATE → COPY");
      console.error("       Paste directly into .env.local (don't retype).");
    }
    process.exit(1);
  }
})();
