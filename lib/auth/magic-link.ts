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
import { headers } from "next/headers";
import { connectDB, LoginToken, User } from "@/lib/db";
import { sendMagicLinkEmail } from "./email";

const TOKEN_TTL_MS = 15 * 60 * 1000;

function generateToken(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Resolve the app's public base URL at runtime. Three sources in priority order:
 *
 *   1. NEXT_PUBLIC_APP_URL  — explicit override; useful if you've set a custom domain
 *   2. Request headers      — works on Vercel (X-Forwarded-Proto + Host) AND localhost;
 *                             auto-tracks preview deployment URLs too
 *   3. localhost fallback   — for headless scripts that don't have a request context
 *
 * Using request headers as the default removes the deploy chicken-and-egg: you can
 * ship to Vercel without first knowing the URL.
 */
async function resolveBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;

  try {
    const h = await headers();
    const proto = h.get("x-forwarded-proto") ?? "http";
    const host = h.get("host");
    if (host) return `${proto}://${host}`;
  } catch {
    // headers() throws outside a request context (e.g., build-time)
  }
  return "http://localhost:3000";
}

/**
 * Step 1 — generate a token, store it, send the email.
 *
 * Returns the magic-link URL so callers in non-production environments can
 * surface it in-page when email delivery is constrained (e.g. Resend free tier
 * only delivers to the account's own email). In production, the link returned
 * here MUST NOT be exposed to the browser; the action gates that.
 *
 * `next` is an optional path to redirect the user to after they verify. We
 * carry it through the magic-link URL so the invite-link round-trip works:
 * /join/X → /login?next=/join/X → email → /auth/verify?token=Y&next=/join/X
 * → set session → redirect to /join/X → group membership added.
 */
export async function requestMagicLink(email: string, next?: string): Promise<string> {
  await connectDB();
  const trimmed = email.trim().toLowerCase();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await LoginToken.create({ token, email: trimmed, expiresAt });

  const baseUrl = await resolveBaseUrl();
  const safeNext = sanitizeNext(next);
  const link = safeNext
    ? `${baseUrl}/auth/verify?token=${token}&next=${encodeURIComponent(safeNext)}`
    : `${baseUrl}/auth/verify?token=${token}`;

  await sendMagicLinkEmail(trimmed, link);
  return link;
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
