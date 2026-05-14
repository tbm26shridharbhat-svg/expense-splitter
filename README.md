# Pocket — a settlement engine that looks like Splitwise

> Case 2 of the Fresher Day-Project case study. Small group expense splitter
> with optimal-netting math, an event-sourced ledger, and one-tap settlements.

**Live demo:** _(replace with Vercel URL after deploy)_
**Repo:** _(replace with GitHub URL)_
**Demo video:** _(replace with Loom/YouTube link)_

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

## License

MIT.
