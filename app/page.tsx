import Link from "next/link";

/**
 * Marketing/landing page. Single screen, no scroll. Mobile-first.
 *
 * Design intent — Cash App meets Linear meets Splitwise:
 *   - Big tabular number is the protagonist (preview of the experience)
 *   - One CTA, accent pink, warm but un-corporate
 *   - No nav, no footer, no "trusted by" logos. Just the point.
 */
export default function Landing() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-between px-6 pt-20 pb-12 sm:px-12">
      <header className="w-full max-w-sm flex items-center gap-2 text-sm tracking-tight">
        <span aria-hidden className="size-2 rounded-full bg-accent" />
        <span className="font-medium">Pocket</span>
      </header>

      <section className="flex flex-col items-center text-center max-w-md gap-6">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-ink">
          Split with people.
          <br />
          Settle with one tap.
        </h1>

        <p className="text-lg text-ink/65 max-w-sm">
          Group expenses, optimal netting, the smallest number of settlements
          that zero you out.
        </p>

        <div className="amount text-4xl sm:text-5xl font-semibold mt-4 tracking-tight">
          <span className="text-success">+₹1,240</span>
          <span className="text-ink/30 mx-3">·</span>
          <span className="text-debt">−₹780</span>
        </div>
        <p className="text-xs text-ink/50 -mt-2">
          Who owes whom · in one glance
        </p>
      </section>

      <Link
        href="/login"
        className="w-full max-w-sm h-14 rounded-2xl bg-accent text-white font-medium text-base flex items-center justify-center
                   active:scale-[0.99] transition-transform shadow-sm hover:bg-accent/90"
      >
        Continue with email
      </Link>
    </main>
  );
}
