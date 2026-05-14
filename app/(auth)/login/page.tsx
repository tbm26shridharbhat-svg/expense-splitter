"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { authAction } from "./actions";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/groups";
  const [state, formAction, isPending] = useActionState(authAction, {});

  return (
    <main className="min-h-dvh flex flex-col items-center justify-between px-6 pt-12 pb-12 sm:px-12">
      <Link href="/" className="text-sm flex items-center gap-2 self-start max-w-sm w-full">
        <span aria-hidden className="size-2 rounded-full bg-accent" />
        <span className="font-medium">Pocket</span>
      </Link>

      <form action={formAction} className="w-full max-w-sm flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to Pocket</h1>
          <p className="text-ink/65 text-sm">
            Sign in or create an account to start splitting expenses.
          </p>
        </div>

        <input type="hidden" name="next" value={next} />

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wide text-ink/55 font-medium">Email</span>
            <input
              name="email"
              type="email"
              autoFocus
              required
              placeholder="you@example.com"
              autoComplete="email"
              className="h-12 px-4 rounded-xl bg-card border border-hairline
                         focus:border-accent focus:ring-2 focus:ring-accent/20
                         outline-none transition text-base"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wide text-ink/55 font-medium">Password</span>
            <input
              name="password"
              type="password"
              required
              placeholder="••••••••"
              autoComplete="current-password"
              className="h-12 px-4 rounded-xl bg-card border border-hairline
                         focus:border-accent focus:ring-2 focus:ring-accent/20
                         outline-none transition text-base"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="h-14 rounded-2xl bg-accent text-white font-medium text-base
                     active:scale-[0.99] transition-transform shadow-sm
                     disabled:opacity-50 disabled:cursor-not-allowed mt-2"
        >
          {isPending ? "Connecting…" : "Continue"}
        </button>

        {state?.error && (
          <p className="text-sm text-debt bg-debt/5 p-3 rounded-lg border border-debt/10 text-center">
            {state.error}
          </p>
        )}

        <p className="text-xs text-ink/45 text-center px-4">
          By continuing, you agree to our terms of service and privacy policy.
        </p>
      </form>

      <div /> {/* spacer */}
    </main>
  );
}
