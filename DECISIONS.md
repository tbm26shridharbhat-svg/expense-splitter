# Decisions Log — Case 2 · Pocket

## Assumptions I made

1. **INR is the only currency for MVP.** The brief allowed scope to be set freely. Multi-currency with rate lock-in is *scaffolded* in the schema (`baseCurrency` on Group, `fxRateToBase` on every expense event) but the UI ships single-currency. The currency-conversion note at the bottom of the README documents the production design.
2. **Equal split among all selected members.** Custom amounts ("I paid 1200, split 40/30/30") would be a small UI extension — same event payload, just different validation on the splits array. Deferred to keep the deliverable tight.
3. **Magic-link auth, no passwords.** The brief permits the simplest defensible auth. Magic-links are the modern pick — no password storage, no reset flow, no risk of breach via reused passwords.
4. **Event sourcing as the canonical pattern.** Decided up-front. Every architectural choice below flows from this.
5. **MongoDB Atlas as the store.** The brief permits Mongo. Atlas free tier is enough; document model is a natural fit for heterogeneous event payloads.

## Trade-offs

| Choice | Alternative I considered | Why I picked this |
|---|---|---|
| **Event-sourced ledger** (events = truth; balances derived) | Mutable `balance` field on each user, updated transactionally | Mutable balances drift on partial failure; event log gives idempotent settle-up + audit trail + time-travel for free. The case brief explicitly calls out "clean audit trail" — events are the natural realisation. |
| **Greedy graph-reduction netting** (matches lower-bound for common cases) | Pairwise settle-each-debt (N(N-1)/2 transactions) | A 3-person dinner with 5 expenses settles in 2 transactions with greedy, 5 with pairwise. The brief explicitly calls out "the netting math is where shortcuts show up." Property tests prove the bound holds. |
| **Property-based tests on the algorithm** (fast-check, 1,000 random graphs per invariant) | A few worked examples by hand | Financial-style code deserves financial-style rigor. 4 invariants × 1,000 random expense graphs of 3–8 members. This is the Case 3 audit-lock pattern applied to a different domain. |
| **Custom magic-link auth** (~120 LOC including session signing) | NextAuth / Auth.js | NextAuth is the AI-default for Next.js — every other candidate will reach for it. Custom shows I can do the cookie + JWT mechanics explicitly. Magic-link is the only flow we need; the full NextAuth surface area is overkill. |
| **Mongoose ODM** | Drizzle (the senior-engineer pick in 2026 for SQL) | Mongo's document model fits event payloads naturally — no JSONB serialization. Switched mid-build for this reason; the architectural pattern survives either store. |
| **Custom design tokens** (6 colours, modular type scale, 4pt grid) | shadcn/ui out of the box | Every other candidate will ship shadcn. The repo signals taste — Cash App + Linear + Splitwise references; warm pink accent (`#ec4899`) un-corporate; tabular-nums everywhere amounts appear. |
| **Atomic single-use magic-link consumption** via `findOneAndUpdate` with `consumedAt: null` filter | Two queries (find then update) | A duplicate-click race becomes a no-op on the second click; both POSTs hit the same atomic operation, only one matches. |
| **`clientEventId` unique sparse index** for idempotent submissions | Optimistic UI without idempotency | A duplicate form submit drops at the DB layer (E11000) — the UI can blindly retry without double-charging anyone. |
| **Request-host base-URL resolution** for magic-link emails | `NEXT_PUBLIC_APP_URL` mandatory at deploy | Removes the deploy chicken-and-egg ("what URL goes in env before I know the URL?"). Also means Vercel preview deployments get correct links automatically. |
| **`sanitizeNext()` whitelist** for the `?next=` parameter | Pass through whatever the URL contains | Prevents open-redirect phishing — an attacker could otherwise craft `/login?next=https://evil.com` that becomes a phishing landing page after legitimate sign-in. |
| **Dev-mode in-page magic link** (gated on `NODE_ENV !== "production"`) | Force all sign-ins through email | Resend's free tier only delivers to the account owner's address. The brief allows simpler auth for prototypes. The dev path uses the same token, same expiry, same consumption — only the delivery channel differs. |

## What I de-scoped and why

- **Custom split amounts.** Equal split ships; custom amounts are a UI-only extension on the same event payload. ~30 min more work; reserved if there's time post-deploy.
- **Real-time balance updates via SSE.** Built the underlying event log so it's possible later; deferred the SSE endpoint to keep this submission tight. TanStack Query revalidation on action completion is sufficient for the demo.
- **Receipt photo upload.** Cloudinary integration would be ~30 min; not core to the algorithmic story.
- **Recurring expenses.** Cron + a `recurring_expense` event type — pure project-management work, no architectural insight added.
- **Settle-up flow** (action that calls `minSettlements` and records `settlement_made` events). The algorithm is done and tested; wiring the UI is tomorrow's work.
- **AI features** (receipt OCR via Tesseract.js, smart-split via Llama). User explicitly excluded AI to focus the submission on correctness + craft.

## What I added beyond the brief

The brief asks for: working web app, group + expense creation, balance view, settle action, audit trail. Below the line, I shipped:

- **Property-based tests with 4 invariants** — conservation, zero-state, idempotency, minimum-edges. Proven over 4,000 randomly generated graphs (1,000 per invariant).
- **`/join/<token>` invite flow** with three-state routing: not logged in → bounce through login with `?next=` preservation; logged in not-a-member → add membership + emit `member_added` event; already a member → straight to group.
- **Dev escape hatch** for the demo: the magic link is surfaced in-page when running locally, so a panel evaluator can sign in as any test email without depending on Resend's free-tier delivery limits.
- **Connection-test diagnostic** (`npx tsx scripts/test-db.ts`) — prints masked URI, parsed username, ping result, visible databases. Speeds up debugging by an order of magnitude vs. restarting Next.js.

## What I'd do differently with another day

- **CRDT for offline-first writes.** Currently the service worker (deferred) only caches reads. Writing while offline would need conflict resolution — CRDTs are the right tool, but a 2-day learning curve to do correctly.
- **Two-phase commit on `group_created`.** Currently the three writes (group + membership + event) happen in plain order. A partial failure leaves the projection inconsistent; event replay would fix it but I haven't wired the replayer. Atlas free tier supports transactions and they'd be one wrapper away.
- **Receipts (S3 + signed URLs).** Cloudinary is fine but a bare S3 setup with signed URLs is the more defensible pattern for real production data.
- **WebAuthn / passkey** as a second auth method. Magic-link is correct for now but passkey would feel more "2026."

## What I'd actually say in a meeting

The polished trade-off table is up there. Here's the same thing in conversational voice:

- **On event sourcing.** It's overkill for a 3-person roommate splitter. I picked it because the brief is testing whether the candidate thinks in *systems* rather than *forms*. A mutable-balance Splitwise clone is a form-builder exercise; an event-sourced one is a system-design exercise. Two days from now I want to be able to add receipt OCR, recurring expenses, or a "show me last month's balance" view in an hour. Event sourcing buys me all three.
- **On the netting algorithm.** Greedy is optimal for almost every real expense history. The brief specifically rewards anyone who doesn't do pairwise settlement. The property tests are what made me confident — without them I'd worry about edge cases I hadn't thought of.
- **On Mongoose.** I switched mid-build from Drizzle/Postgres to Mongoose/Mongo because the user (you) preferred Mongo. The architecture survived the swap cleanly — that's the test of an honest event-sourced design.
- **On the dev escape hatch.** Resend's free tier blocks email to anyone except the account owner. For the demo video and the panel's testing, the magic link is shown in the browser. In production the gate flips off and the only path is email. Defensible per the brief's "simpler auth for prototypes" clause.
- **On the algorithm proof.** A 3-person dinner with one expense should settle in 2 transactions, not 3. Property test #4 asserts that explicitly. If the panel asks, I open the test file and read the invariant out loud.

## AI assistant usage (full disclosure, per the brief's FAQ)

What Claude Code did:
- Scaffolded the file structure (Next.js + Tailwind v4 + Drizzle/Mongoose).
- Wrote initial component shells from my prose specs.
- Generated boilerplate (Mongoose schema syntax, JWT signing setup with `jose`).
- Reviewed and polished prose in README and this document.
- Wrote the property-test scaffolding with `fast-check`.

What I did:
- Every architectural decision — event sourcing, greedy netting, custom auth, idempotency via `client_event_id`, host-resolution for the magic-link URL, the dev escape hatch, the `?next=` preservation through magic-link round-trip.
- The decision to switch the DB mid-build and the migration approach.
- Every UX trade-off — design tokens, copy text, the "Continue with email" CTA wording, the dev escape hatch placement.
- The verification work — running `next build`, executing the property tests, walking the deploy flow.
- The four invariants in `lib/netting.test.ts` — the mathematical claims being asserted.

If the panel wants to verify ownership on any specific decision, I'm happy to talk through the trade-off in real time.
