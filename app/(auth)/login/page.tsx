"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { requestMagicLinkAction } from "./actions";

// Wrap the form in Suspense — Next.js requires this for useSearchParams in client
// components so the build doesn't fail trying to prerender it statically.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

/**
 * Login — single email field. Server action handles the request.
 *
 * UX choice: on success, swap the form for a confirmation panel in-place.
 * Don't navigate. Don't reload. Don't show a popup. The user just sees their
 * own email confirmed back to them and instructions for what's next.
 *
 * `?next=<path>` in the URL is carried through to the magic-link itself,
 * so /join/<token> invitations bounce cleanly: invite → login → email → in.
 */
function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? undefined;
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "sending") return;
    setState("sending");
    setError(null);

    const result = await requestMagicLinkAction(email, next);
    if (result.ok) {
      setState("sent");
    } else {
      setState("error");
      setError(result.error);
    }
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-between px-6 pt-12 pb-12 sm:px-12">
      <Link href="/" className="text-sm flex items-center gap-2 self-start max-w-sm w-full">
        <span aria-hidden className="size-2 rounded-full bg-accent" />
        <span className="font-medium">Pocket</span>
      </Link>

      {state === "sent" ? (
        <SentPanel email={email} />
      ) : (
        <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
            <p className="text-ink/65 text-sm">
              We'll email you a magic link. Single tap, 15-minute window, no password.
            </p>
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wide text-ink/55">Email</span>
            <input
              type="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="h-12 px-4 rounded-xl bg-card border border-hairline
                         focus:border-accent focus:ring-2 focus:ring-accent/20
                         outline-none transition text-base"
            />
          </label>

          <button
            type="submit"
            disabled={state === "sending" || !email}
            className="h-14 rounded-2xl bg-accent text-white font-medium text-base
                       active:scale-[0.99] transition-transform shadow-sm
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state === "sending" ? "Sending…" : "Send the link"}
          </button>

          {error && (
            <p className="text-sm text-debt">{error}</p>
          )}
        </form>
      )}

      <div /> {/* spacer */}
    </main>
  );
}

function SentPanel({ email }: { email: string }) {
  return (
    <div className="w-full max-w-sm flex flex-col gap-6 text-center items-center">
      <div className="size-12 rounded-full bg-accent/10 flex items-center justify-center text-accent text-xl">
        ↗
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Check your inbox</h1>
        <p className="text-ink/65 text-sm">
          We sent a magic link to <strong className="text-ink">{email}</strong>. It's valid for 15 minutes.
        </p>
      </div>
      <p className="text-xs text-ink/45">
        Wrong email? <Link href="/login" className="underline">Try again.</Link>
      </p>
    </div>
  );
}
