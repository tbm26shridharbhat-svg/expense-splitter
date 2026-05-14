/**
 * Magic-link verification endpoint.
 *
 *   GET /auth/verify?token=xxx[&next=/some/path]
 *
 * - Valid token + safe `next` → set session → redirect to `next`
 * - Valid token + no next      → set session → redirect to /groups
 * - Invalid/expired/used token → redirect to /login?error=invalid-or-expired
 *
 * `next` is sanitised against open-redirect attacks: relative paths only,
 * never `/auth/*` (would loop), never protocol-relative.
 */
import { NextRequest, NextResponse } from "next/server";
import { consumeMagicLink, sanitizeNext } from "@/lib/auth/magic-link";
import { setSessionCookie } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const nextParam = req.nextUrl.searchParams.get("next");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing-token", req.url));
  }

  const user = await consumeMagicLink(token);
  if (!user) {
    const back = sanitizeNext(nextParam)
      ? `/login?error=invalid-or-expired&next=${encodeURIComponent(sanitizeNext(nextParam)!)}`
      : "/login?error=invalid-or-expired";
    return NextResponse.redirect(new URL(back, req.url));
  }

  await setSessionCookie({ userId: user.id, email: user.email });

  const dest = sanitizeNext(nextParam) ?? "/groups";
  return NextResponse.redirect(new URL(dest, req.url));
}
