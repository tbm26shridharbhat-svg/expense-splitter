/**
 * Magic-link flow.
 *
 *   1. User submits email → `requestMagicLink(email)` writes a token doc and emails the link.
 *   2. User clicks link → `/auth/verify?token=...` calls `consumeMagicLink(token)`,
 *      which validates the token, creates/finds the user, and returns the user.
 *
 * Tokens are 32-char hex (16 bytes of entropy = 128 bits), single-use, 15-min TTL.
 * Mongo's TTL index on `expiresAt` cleans up old tokens automatically.
 */
import { randomBytes } from "node:crypto";
import { connectDB, LoginToken, User } from "@/lib/db";
import { sendMagicLinkEmail } from "./email";

const TOKEN_TTL_MS = 15 * 60 * 1000;

function generateToken(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Step 1 — generate a token, store it, send the email.
 *
 * `next` is an optional path to redirect the user to after they verify. We
 * carry it through the magic-link URL so the invite-link round-trip works:
 * /join/X → /login?next=/join/X → email → /auth/verify?token=Y&next=/join/X
 * → set session → redirect to /join/X → group membership added.
 */
export async function requestMagicLink(email: string, next?: string): Promise<void> {
  await connectDB();
  const trimmed = email.trim().toLowerCase();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await LoginToken.create({ token, email: trimmed, expiresAt });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const safeNext = sanitizeNext(next);
  const link = safeNext
    ? `${baseUrl}/auth/verify?token=${token}&next=${encodeURIComponent(safeNext)}`
    : `${baseUrl}/auth/verify?token=${token}`;

  await sendMagicLinkEmail(trimmed, link);
}

/**
 * Only allow same-origin relative paths as `next` — prevents open-redirect attacks
 * where an attacker sends a login link with `?next=https://evil.com` to phish.
 */
export function sanitizeNext(next: string | undefined | null): string | null {
  if (!next) return null;
  if (!next.startsWith("/")) return null;       // must be a path
  if (next.startsWith("//")) return null;       // protocol-relative URLs are out
  if (next.startsWith("/auth/")) return null;   // don't bounce back into auth
  return next;
}

/**
 * Step 2 — consume the token. Atomic: the same operation that marks it consumed
 * also returns whether it was valid (using findOneAndUpdate with the un-consumed filter).
 * Returns the user (creating it if first sign-in) or null if token is missing/expired/used.
 */
export async function consumeMagicLink(
  token: string,
): Promise<{ id: string; email: string } | null> {
  await connectDB();

  const now = new Date();

  // Atomic single-use: only matches an unconsumed, unexpired token.
  const tokenDoc = await LoginToken.findOneAndUpdate(
    {
      token,
      expiresAt: { $gt: now },
      consumedAt: null,
    },
    { $set: { consumedAt: now } },
    { new: true, lean: true },
  );

  if (!tokenDoc) return null;

  // Find-or-create the user — `upsert + new` always returns a doc
  const userDoc = await User.findOneAndUpdate(
    { email: tokenDoc.email },
    { $setOnInsert: { email: tokenDoc.email } },
    { upsert: true, new: true, lean: true },
  );

  if (!userDoc) {
    // Unreachable with upsert: true, new: true — Mongoose's types are just imprecise here.
    throw new Error("upsert returned no document");
  }

  return { id: String(userDoc._id), email: userDoc.email };
}
