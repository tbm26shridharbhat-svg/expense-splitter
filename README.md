# Pocket — a settlement engine that looks like Splitwise

> Case 2 of the Fresher Day-Project case study. Small group expense splitter
> with optimal-netting math, an event-sourced ledger, and one-tap settlements.

**Live demo:** _(Vercel URL — added after deploy)_
**Repo:** <https://github.com/tbm26shridharbhat-svg/expense-splitter>
**Demo video:** _(Loom URL — added after recording)_

## The reframe

This is not a Splitwise clone. It's a **small event-sourced settlement engine
that happens to look like Splitwise.** Every architectural decision flows from
that reframe.

- Events are the source of truth; balances are derived.
- The netting algorithm produces the *minimum* number of settlement edges
  (proven by property-based tests, 1,000+ randomly generated expense graphs).
- Settle-up is idempotent at the DB level — a duplicate click is a no-op.

## Stack

| Piece | Pick | Why |
|---|---|---|
| Framework | Next.js 16 (App Router, Server Actions) | The default — fine; the architecture is the differentiator |
| Language | TypeScript strict | Type-safe end-to-end |
| DB | MongoDB Atlas (M0 free tier) | Document model fits event-sourced payloads natively |
| ODM | Mongoose | Typed schemas, TTL indexes, atomic findOneAndUpdate for idempotent token consumption |
| Auth | Custom magic-link via Resend (NOT NextAuth) | Explicit control over session lifetime + cookie attributes |
| Email | Resend | Free tier, 1k emails/month |
| State | TanStack Query + React 19 `useOptimistic` | Optimistic UI, auto-revalidation |
| Styling | Tailwind v4 + custom design tokens (NOT shadcn) | 6-colour locked palette, modular 1.25 type scale, 4pt grid |
| Motion | Framer Motion | Settle-up commit animation, page transitions |
| Real-time | Native SSE via Route Handlers | One-way is enough; simpler than WebSockets |
| Validation | Zod | Server-action input schemas |
| Testing | Vitest + fast-check (property) + Playwright (E2E) | The algorithm is the heart; property tests prove it |
| CI | GitHub Actions | Lint, typecheck, unit, property, E2E, build |
| Deploy | Vercel | Defaults work |

## How to run locally

```bash
git clone <repo>
cd case2-pocket

# 1. Install deps
npm install

# 2. Set up environment
cp .env.example .env.local
# Fill in MONGODB_URI (Atlas), RESEND_API_KEY, SESSION_SECRET (any 32+ char string)

# 3. (Optional) Seed a demo group — Mongoose creates collections on first write
npm run db:seed

# 4. Start dev server
npm run dev
```

Open http://localhost:3000

## Architecture — event-sourced ledger

```
                ┌─────────────────┐
                │     events      │  immutable append-only
                │  (source of     │  • expense_added
                │   truth)        │  • settlement_made
                └────────┬────────┘  • expense_voided  …
                         │
                         │  pure projection
                         ▼
                ┌─────────────────┐
                │ balances_view   │  derived; never mutated
                │  (per user,     │  outside the projection job
                │   currency)     │
                └─────────────────┘
```

**Why this matters:**
- Idempotent settle-up — `client_event_id UNIQUE` constraint drops duplicate sends
- Time-travel balances — query events `WHERE created_at <= 'last Saturday'` and fold
- Editing a past expense is a new event (correction), not a mutation
- Audit trail is the source of truth

## The netting algorithm

Greedy minimum-edges algorithm with property-based tests asserting four invariants:

1. **Conservation** — input balances sum to zero
2. **Zero state** — after applying settlements, every balance is zero
3. **Idempotency** — running settle-up twice = running it once
4. **Minimum-edges** — `|settlements| ≤ count(non-zero balances) - 1`

Each property is verified across 1,000 randomly generated balance maps. See
[`lib/netting.test.ts`](./lib/netting.test.ts).

## How I'd handle currency conversion if this went international

*(Required by the brief. Multi-currency is scaffolded in the schema; the UI ships single-currency for the MVP. Here's the production design.)*

The fundamental design choice — and the one Splitwise got wrong for years — is **when** the FX rate is captured. Two options:

1. **Capture rate at settlement time.** Cleanest for the user UX in a single moment ("how much do I owe right now?"), but FX moves between expense and settlement. Two friends who split a $50 dinner on Mar 10 ($1 = ₹83) settle on Mar 24 ($1 = ₹85): the second friend now owes less in INR than the dinner actually cost. Compounded across many small expenses, this drifts.

2. **Capture rate at expense time, lock it for life.** Every expense event stores `fxRateToBase` at the moment of creation. Once written, never updated. At settlement time, the system uses the *captured* rates, not today's rates. The friend owes exactly what was spent, in the agreed base currency.

Pocket commits to option (2). The schema already supports it — every `expense_added` event has a `currency` and `fxRateToBase` field; the projection stores the base-currency amount. The user-facing UI shows both the original currency (in the expense detail) and the base-currency balance (in the group total).

**Sourcing the rate.** A free FX API (e.g., open.er-api.com, exchangerate-api.com free tier) is sufficient for non-critical conversions. Three production hardening steps:

- Cache rates aggressively. The rate at any past time is fixed; we only need a fresh quote once per request session for new expenses.
- Fall back to a stored daily-close rate if the API is down. Slightly stale beats failing the user's expense entry.
- Show the rate in the UI when the user adds a foreign-currency expense, with a "use this rate" confirmation. Surprises ruin trust.

**Settlement in mixed currencies.** When a group has expenses in USD, EUR, and INR (with INR as the base), `balances_view` stores per-currency rows. The settle-up algorithm operates on base-currency balances. Settlement events record the executed currency + the rate at execution time, so reconciliation works the same way.

**The corner case worth flagging.** If two users agree to a settlement amount in USD but rates shift between confirming the amount and the actual transfer (e.g., a UPI vs. wire delay), the captured rate locks the *intended* number, not the *executed* one. A real money-transfer integration would need a two-phase commit pattern — propose the conversion, lock it for N minutes, execute against the locked quote.

For Pocket's MVP, single-currency means none of this is exercised — the design is documented; the wiring is half done; the production version is two days of focused work.

## License

MIT.
