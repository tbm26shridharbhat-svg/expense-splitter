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

/** Step 1 — generate a token, store it, send the email. */
export async function requestMagicLink(email: string): Promise<void> {
  await connectDB();
  const trimmed = email.trim().toLowerCase();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await LoginToken.create({ token, email: trimmed, expiresAt });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const link = `${baseUrl}/auth/verify?token=${token}`;

  await sendMagicLinkEmail(trimmed, link);
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
