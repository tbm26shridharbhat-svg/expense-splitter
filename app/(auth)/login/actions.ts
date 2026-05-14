"use server";

import { z } from "zod";
import { requestMagicLink } from "@/lib/auth/magic-link";

const Schema = z.object({
  email: z.string().email("Enter a valid email."),
  next: z.string().optional(),
});

export async function requestMagicLinkAction(
  email: string,
  next?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = Schema.safeParse({ email, next });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  try {
    await requestMagicLink(parsed.data.email, parsed.data.next);
    return { ok: true };
  } catch (err) {
    console.error("[login] requestMagicLink failed:", err);
    return {
      ok: false,
      error: "We couldn't send the link. Try again in a minute.",
    };
  }
}
