/**
 * Magic-link flow.
 *
 *   1. User submits email → `requestMagicLink(email)` writes a token row and
 *      emails the link.
 *   2. User clicks link → `/auth/verify?token=...` calls `consumeMagicLink(token)`,
 *      which validates the token, creates/finds the user, and returns a Session.
 *
 * Tokens are 32 char hex (16 bytes of entropy = 128 bits), single-use, 15 min TTL.
 */
import { randomBytes } from "node:crypto";
import { eq, and, gt, isNull } from "drizzle-orm";
import { db, loginTokens, users } from "@/lib/db";
import { sendMagicLinkEmail } from "./email";

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

function generateToken(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Step 1 — generate a token, store it, send the email.
 *
 * No user record is created here. We create the user only when the token is
 * consumed (so half-finished sign-ups don't leave orphan rows).
 */
export async function requestMagicLink(email: string): Promise<void> {
  const trimmed = email.trim().toLowerCase();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await db.insert(loginTokens).values({
    token,
    email: trimmed,
    expiresAt,
  });

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const link = `${baseUrl}/auth/verify?token=${token}`;

  await sendMagicLinkEmail(trimmed, link);
}

/**
 * Step 2 — consume the token; idempotent on the consumedAt field.
 * Returns the user row (creating it if first sign-in) or null if the token
 * is missing, expired, or already used.
 */
export async function consumeMagicLink(
  token: string,
): Promise<{ id: string; email: string } | null> {
  const now = new Date();

  const found = await db
    .select()
    .from(loginTokens)
    .where(
      and(
        eq(loginTokens.token, token),
        gt(loginTokens.expiresAt, now),
        isNull(loginTokens.consumedAt),
      ),
    )
    .limit(1);

  if (found.length === 0) return null;

  const tokenRow = found[0];

  // Mark consumed (so it can't be reused even if leaked from email)
  await db
    .update(loginTokens)
    .set({ consumedAt: now })
    .where(eq(loginTokens.token, token));

  // Find or create user
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, tokenRow.email))
    .limit(1);

  if (existing.length > 0) {
    return { id: existing[0].id, email: existing[0].email };
  }

  const created = await db
    .insert(users)
    .values({ email: tokenRow.email })
    .returning({ id: users.id, email: users.email });

  return created[0];
}
