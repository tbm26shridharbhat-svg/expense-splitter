/**
 * Server-side guard: call from any route or server action that requires a
 * logged-in user. Throws a redirect to /login if the session cookie is
 * missing or invalid.
 */
import { redirect } from "next/navigation";
import { getSession, type Session } from "./session";

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
