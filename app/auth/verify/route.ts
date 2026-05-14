/**
 * Magic-link verification endpoint.
 *
 *   GET /auth/verify?token=xxx
 *
 * - Valid token → create/find user → set session cookie → redirect to /groups
 * - Invalid token → redirect to /login?error=invalid
 */
import { NextRequest, NextResponse } from "next/server";
import { consumeMagicLink } from "@/lib/auth/magic-link";
import { setSessionCookie } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing-token", req.url));
  }

  const user = await consumeMagicLink(token);
  if (!user) {
    return NextResponse.redirect(new URL("/login?error=invalid-or-expired", req.url));
  }

  await setSessionCookie({ userId: user.id, email: user.email });
  return NextResponse.redirect(new URL("/groups", req.url));
}
