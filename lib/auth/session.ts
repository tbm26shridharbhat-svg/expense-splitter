/**
 * Session cookie — signed-and-verified via jose (JWT, HS256).
 *
 * Why not NextAuth: we want explicit control over token lifetime, cookie
 * attributes, and the data carried in the session. A custom session is
 * ~50 lines and removes a dependency that's notorious for breaking on
 * every Next.js minor.
 */
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "dev-secret-do-not-use-in-prod",
);
const COOKIE_NAME = "pocket_session";
const TTL_DAYS = 30;

export interface Session {
  userId: string;
  email: string;
}

/** Sign a session payload into a JWT and set it as an HttpOnly cookie. */
export async function setSessionCookie(session: Session): Promise<void> {
  const token = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL_DAYS}d`)
    .sign(SECRET);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_DAYS * 24 * 60 * 60,
  });
}

/** Read & verify the session cookie. Returns null if missing or invalid. */
export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET);
    return { userId: payload.userId as string, email: payload.email as string };
  } catch {
    return null;
  }
}

/** Clear the session — for logout. */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
