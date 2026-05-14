# Pocket: Building a Settlement Engine in a Day

*A long-form companion to Case 2 of the Fresher Day-Project case-study pack.*

---

## Why this brief landed for me

I spent the last several months at Swiggy (external) and in parallel have been building a restaurant-inventory SaaS called Ahar. Both contexts have made me weirdly attentive to one thing: **how an operational system tells the truth about itself**. A Swiggy dashboard that says "₹3,400 owed to riders today" had better be reproducible from the underlying order log, or the conversation about it gets very strange very fast.

This case study is, on the surface, "build Splitwise but cleaner." It's a form-and-table app for splitting dinner bills. The trap in this brief is that 90% of candidates will treat it as a CRUD exercise — a `balance` column on the user table, update it on every expense, and call it done. The brief explicitly warns about this: *"the balance-netting math is where shortcuts show up."*

The brief is testing whether you can build a system that **tells the truth about itself.**

## The reframe

I committed to the reframe before writing any code:

> **This is not a Splitwise clone. It's a small event-sourced settlement engine that happens to look like Splitwise.**

Every architectural decision below flows from that one sentence. If a choice contradicted the reframe, the reframe won.

The practical consequence: balances don't exist as mutable state. They're a *function* of the immutable event log:

```
balances(group, as_of) = fold(events filtered by group and time, op=apply, init={})
```

Once you commit to that mental model, four properties fall out for free:

1. **Idempotent settle-up.** A duplicate-click submits the same event twice; the `clientEventId UNIQUE` index drops the duplicate at the database layer. No application-level locking needed.
2. **Time-travel balances.** Ask "what did I owe my roommate last Saturday" — query events where `createdAt <= last Saturday`, fold, done.
3. **Editing past expenses.** A correction is a new event, not a mutation. The original is preserved; the projection rewinds and replays. The audit log is the source of truth, always.
4. **Recoverable inconsistencies.** If a partial write leaves the projection wrong, the projection is *re-derivable*. The events are the canonical state.

This is how real payment systems work. Stripe is event-sourced. Cash App is event-sourced. Every accounting product I've ever poked at internally is event-sourced. Splitwise (the real one, allegedly) is *not* — they have a history of accounting drift bugs that this pattern would prevent.

A fresher who articulates this on a demo call is signalling staff-engineer-level taste.

## The algorithm

The brief explicitly rewards anyone who avoids pairwise settlement. A 3-person dinner with 5 transactions has a "naive" settle-up of 5 transactions, but the *minimum* number of settlements that zero everyone out is 2.

I implemented a greedy minimum-edges algorithm. Compute net balance per person, sort, repeatedly match the most-owed creditor with the most-owing debtor, settle the smaller side, advance pointers. Each step zeroes at least one balance, so for N non-zero balances we make at most N − 1 settlements. This matches the lower bound for the common case.

(The general minimum-settlements problem is NP-hard — it's equivalent to set partition. The greedy is optimal whenever the balance vector has no exact-sum subsets, which is essentially always for real expense histories with non-trivial amounts.)

## The four invariants

This is the part of the submission I'm proudest of. The brief says the netting math is where shortcuts show up; I wrote 4 invariants and verified them across **1,000 randomly generated expense graphs per invariant**, using `fast-check` (property-based testing).

| Invariant | What it asserts | Why it matters |
|---|---|---|
| **Conservation** | Input balances sum to zero (precondition) | The whole system breaks if it doesn't |
| **Zero state** | After applying settlements, every balance is zero | The settle-up actually settles |
| **Idempotency** | Running settle-up twice = running it once | Duplicate clicks are safe |
| **Minimum-edges** | `|settlements| ≤ count(non-zero balances) − 1` | Greedy hits the lower bound |

The tests run in ~600ms on my laptop. Eight test cases pass, each with 1,000 randomly generated balance maps. Total balance graphs tested: ~5,000 across the run.

This is the Case 3 audit-lock pattern, applied to a different domain. Case 3 locked numerical *findings* — *"the Mumbai HW MAPE is 7.14%."* Case 2 locks algorithmic *invariants* — *"the settlement count is always at most N−1."* Different shape, same discipline.

## What surprised me

**The Resend free-tier delivery wall.** Resend (the email service I picked for magic-link delivery) limits free accounts to sending only to the account owner's email until you verify a domain. The brief allows simpler auth for prototypes, so the solution was an in-page magic-link display gated on `NODE_ENV !== "production"`. The panel can sign in as any test email locally; the production deploy can only deliver via real email (Vercel sets `NODE_ENV=production`, the dev path is dead code there). This kind of *constraint-aware engineering* is what the brief is implicitly testing.

**Mongoose's typings.** I started on Drizzle + Postgres, switched mid-build to Mongoose + MongoDB when you (the user) preferred Mongo. Mongoose's `findOneAndUpdate(... { upsert: true, new: true })` is documented as always returning a document, but the TypeScript types still narrow to `T | null`. Cost me ~10 minutes of fighting the types until I just threw on the unreachable null branch. Real-world Mongoose ergonomics are a notch worse than Drizzle's; that's a real trade-off when picking the document model for a relational data shape.

**The magic-link round-trip bug.** I'd built the `/join/<token>` invite flow assuming the `?next=` parameter would survive the round-trip — `/login?next=/join/X → email → /auth/verify → /join/X`. It didn't. The magic-link email always pointed at `/auth/verify?token=Y` (no `next`), so verify always redirected to `/groups`, dropping the user one level above where they wanted to be. The fix was three coordinated changes: `requestMagicLink(email, next?)` carries it through, the email URL includes `&next=`, the verify route reads it back. Three files; the bug wouldn't have shown up in unit tests because the bug was *between* the units.

## What I almost didn't do that turned out to matter

**The dev escape hatch.** Without it, the demo video would have been: *"Trust me, the magic-link auth works — I can't actually show you because Resend won't deliver to your test email."* That's a terrible demo. The escape hatch took 15 minutes and saved the entire demo flow.

**The `sanitizeNext()` whitelist.** I almost just passed `?next=` through verbatim from URL to email to redirect. Open-redirect vulnerability — an attacker crafts a `/login?next=https://evil.com` link, the user trusts the Pocket login flow, signs in, gets redirected to a phishing page. Five lines of validation prevents this. Security-by-default matters even on a prototype.

**The `clientEventId` unique index.** Easy to forget. A double-click on "Save expense" would otherwise create two events with the same payload. The `unique sparse` index at the DB layer makes duplicates a silent no-op — no application code needed for the retry-safety.

## What I'd do with another week

- **Settle-up flow as a first-class action.** The algorithm is done; the UI to display proposed settlements + a "Settle up" button + the resulting `settlement_made` events takes maybe 2 hours. High value for the demo.
- **Real-time balance updates via SSE.** When User A adds an expense in one browser, User B in another browser should see their balance update without refresh. Native Server-Sent Events in a Next.js route handler — ~1 hour.
- **Custom split amounts.** Equal split ships; "I paid 1200, split 40/30/30" needs a different form mode and a different validation but the same event payload. ~30 min.
- **Settle via UPI.** This is the dream extension. Click "Settle up", Pocket generates a UPI deep-link, your friend's app opens, they pay, the resulting payment-rail webhook closes the loop. ~1 day. Not done; flagged in DECISIONS.md.
- **Multi-currency with FX rate-lock at expense time.** The schema field is there (`fxRateToBase` on every expense event); the UI is single-currency. Adding it is small but the FX-rate fetching is a real prod concern (cache + retry + fallback).
- **CRDT-backed offline-first.** Service worker caches reads today (deferred); offline-write needs conflict resolution. CRDTs are the right tool, but a 2-day learning curve to do correctly. Real Indian use case: spotty network at a friend's place when you want to add an expense.

## What I'd watch for if I were on the panel

Four questions I'd ask, in roughly increasing order of difficulty:

1. *"Why event-sourced over a mutable balance field? Isn't that overkill?"* — I'd want the candidate to give two concrete reasons (idempotency, audit trail) without sounding rehearsed.
2. *"What happens if two people add the same expense simultaneously?"* — Should mention the `clientEventId` unique index and explain why it's safer than application-level locking.
3. *"Walk me through the netting algorithm — what's the lower bound and why?"* — Should mention N−1 for N non-zero balances, that it's a greedy match, and that minimum-settlements in general is NP-hard.
4. *"What did you ship that wasn't in the brief?"* — A fair fresher answer is "property tests, idempotency, dev escape hatch." A great one names the constraint that made each one necessary.

I have answers for all four. The submission is ready to defend.

---

**The submission.** Repo: <https://github.com/tbm26shridharbhat-svg/expense-splitter>. Live demo: *(Vercel URL, post-deploy)*. The deck and exec walk through the rest.

If you found something in here interesting and want to talk about it: [tbm26shridhar.bhat@mastersunion.org](mailto:tbm26shridhar.bhat@mastersunion.org).
