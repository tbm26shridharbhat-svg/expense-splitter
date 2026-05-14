"use server";

import { z } from "zod";
import { requestMagicLink } from "@/lib/auth/magic-link";

const Schema = z.object({
  email: z.string().email("Enter a valid email."),
  next: z.string().optional(),
});

/**
 * Returns `devMagicLink` only when NODE_ENV !== "production". This lets the
 * login page surface the link in-browser for local dev + the demo, where
 * Resend's free tier only delivers to the account owner's email. Production
 * never exposes the link — the only path is the email inbox.
 */
export async function requestMagicLinkAction(
  email: string,
  next?: string,
): Promise<
  | { ok: true; devMagicLink?: string }
  | { ok: false; error: string }
> {
  const parsed = Schema.safeParse({ email, next });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  try {
    const link = await requestMagicLink(parsed.data.email, parsed.data.next);
    if (process.env.NODE_ENV !== "production") {
      return { ok: true, devMagicLink: link };
    }
    return { ok: true };
  } catch (err) {
    console.error("[login] requestMagicLink failed:", err);
    return {
      ok: false,
      error: "We couldn't send the link. Try again in a minute.",
    };
  }
}
