# Submission Notes — Case 2 · Pocket

Honest caveats for the panel. Things to know before opening the deployed link.

## What's most worth looking at first

1. **`lib/netting.ts` + `lib/netting.test.ts`** — the algorithmic core. Four invariants asserted across ~5,000 randomly generated balance maps. Run `npm test` to see them pass in 600ms.
2. **`lib/db/schema.ts`** — the event-sourced data model. Read the inline comments to see why every table exists.
3. **DECISIONS.md** — every architectural trade-off, including the alternatives I rejected and why.
4. **STORY.md** — the long-form companion if you want the engineering narrative.
5. **The live deployment** — try the full flow end-to-end.

## Known limitations to flag

- **Custom split amounts** ("I paid 1200, split 40/30/30") — *not shipped*. The event payload supports it; the UI ships equal-split only. Documented in DECISIONS.md "What I de-scoped."
- **Settle-up button** — *not shipped*. The algorithm is in `lib/netting.ts`, proven by property tests, ready to use. The UI to display proposed settlements + post them as `settlement_made` events is tomorrow's work.
- **Real-time updates via SSE** — *not shipped*. Action completions revalidate via `revalidatePath`; cross-browser real-time balance updates would need an SSE endpoint, which the architecture supports but I haven't wired.
- **PWA shell + offline reads** — *not shipped*. The reactive auth state would still need a service worker; another scope cut.

## Magic-link auth + Resend free-tier behaviour

The auth uses real magic-link tokens stored in MongoDB with a 15-minute TTL, consumed atomically via `findOneAndUpdate`. The session cookie is a signed JWT via `jose`.

**However:** Resend's free tier only delivers email to the account owner's email address. For demo evaluation (where you'd want to sign up as `aman@test.com` or any arbitrary email), the running app surfaces the magic link directly in the browser when `NODE_ENV !== "production"`.

**On the Vercel deployment** (`NODE_ENV === "production"`), the link is **never** exposed to the browser. Only the email inbox path works there. The dev escape hatch is dead code in production.

To verify this: open the deployed URL, submit any email, observe the "Check your inbox" panel — no link will appear under it. That's the safety guarantee. To actually sign in on the deployed site, use `tbm26shridhar.bhat@mastersunion.org` (the Resend-account owner email).

For local-dev evaluation, clone the repo, follow README, and you can use any email — the link will appear inline.

## MongoDB Atlas free-tier behaviour

The deployed app talks to a free-tier M0 Atlas cluster. Two things to know:

1. **First request after idle** has a cold-start latency penalty (~1–2 seconds) while Mongoose establishes the first connection. Subsequent requests use the cached connection — sub-100ms response times.
2. **Network access** is configured to `0.0.0.0/0` (allow any IP). Acceptable for a public submission; in a real production system this would be locked to Vercel's serverless function IPs.

## What's most worth challenging in a Q&A

- **The greedy netting algorithm is provably optimal for the *common* case, not always.** The minimum-settlements problem is NP-hard in general (set-partition equivalent). The greedy hits the lower bound (N−1 settlements for N non-zero balances) whenever the balance vector has no exact-sum subsets, which is essentially always for real expense histories. Adversarial input could in theory beat it, but it'd be contrived.
- **Event sourcing is overkill for a 3-person roommate splitter.** True; I picked it because the brief is testing whether the candidate thinks in *systems* rather than *forms*. The architectural choice is defensible at scale even if it's heavier than needed at 3 users.
- **Custom magic-link auth means I roll my own session cookies.** True; this is risk. I argue: NextAuth is risk too (different risk — opaque magic), and the custom version is ~120 LOC I can audit line-by-line. For the case study, the trade-off is intentional. In production with PII and money, I'd reach for a vetted library.
- **Mongoose over Drizzle.** Switched mid-build for the user's preference. Architecture survived the swap, which is itself the proof that the design is honest. Drizzle would have been the senior pick for SQL; Mongoose is fine for the document model + heterogeneous event payloads.

## Live URLs (post-deploy)

- **Deployed app:** *(Vercel URL, replace post-deploy)*
- **Repo:** <https://github.com/tbm26shridharbhat-svg/expense-splitter>
- **Demo video:** *(Loom URL, replace post-record)*
