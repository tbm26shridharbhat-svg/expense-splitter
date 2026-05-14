# Architecture

System diagram and data-contract spec for Pocket.

## End-to-end flow

```mermaid
flowchart TB
    subgraph Client["🖥️ Browser"]
        Pages["Next.js App Router pages<br/>/login · /groups · /groups/[id] · /join/[token]"]
    end

    subgraph Edge["⚡ Server Actions + Route Handlers"]
        Auth["Auth flow<br/>requestMagicLink → consumeMagicLink → setSessionCookie"]
        Mutations["Group + expense mutations<br/>createGroup · addExpense · ensureInviteToken"]
        Verify["GET /auth/verify<br/>token consumption + session set"]
        Join["/join/[token]<br/>membership add"]
    end

    subgraph DB["💾 MongoDB Atlas"]
        Events[("📜 events<br/>append-only, source of truth")]
        BalancesView[("📊 balances_view<br/>projection — recomputable")]
        Users[("👤 users")]
        Groups[("👥 groups")]
        Memberships[("🔗 memberships")]
        LoginTokens[("🔑 login_tokens<br/>TTL index, auto-expire")]
    end

    subgraph Email["📧 Resend"]
        ResendAPI["Magic-link email<br/>(prod path)"]
        DevLink["In-page magic link<br/>(NODE_ENV !== production)"]
    end

    subgraph Algo["🧮 lib/netting.ts"]
        Net["minSettlements()<br/>greedy minimum-edges"]
        Tests["lib/netting.test.ts<br/>4 invariants × 1,000 random graphs"]
    end

    subgraph Proj["🔄 lib/events/balance-projection.ts"]
        ApplyExp["applyExpenseAdded()"]
        ApplySett["applySettlementMade()"]
    end

    Pages -->|"form action"| Mutations
    Pages -->|"useSearchParams ?next"| Auth
    Auth -->|"insert"| LoginTokens
    Auth -->|"upsert"| Users
    Auth -->|"sign session"| Pages
    Auth -.->|"send link"| ResendAPI
    Auth -.->|"dev surface"| DevLink

    Mutations -->|"append"| Events
    Mutations -->|"upsert"| Groups
    Mutations -->|"upsert"| Memberships
    Mutations -->|"$inc upsert"| BalancesView
    Mutations --> ApplyExp
    Mutations --> ApplySett

    Verify -->|"consume atomic"| LoginTokens
    Join -->|"check exists"| Memberships
    Join -->|"append member_added"| Events

    Net -.->|"used by future<br/>settle-up action"| Mutations
    Tests -->|"asserts"| Net

    classDef client fill:#fde68a,stroke:#a16207,color:#000
    classDef edge fill:#dbeafe,stroke:#1d4ed8,color:#000
    classDef db fill:#fef3c7,stroke:#92400e,color:#000
    classDef email fill:#e0e7ff,stroke:#4338ca,color:#000
    classDef algo fill:#d1fae5,stroke:#065f46,color:#000
    classDef proj fill:#fce7f3,stroke:#9d174d,color:#000

    class Pages client
    class Auth,Mutations,Verify,Join edge
    class Events,BalancesView,Users,Groups,Memberships,LoginTokens db
    class ResendAPI,DevLink email
    class Net,Tests algo
    class ApplyExp,ApplySett proj
```

## What each layer guarantees

**Client.** Server-rendered React 19 + App Router. Forms submit via Server Actions — no separate API layer. `useOptimistic` could be wired tomorrow for instant UI feedback.

**Edge (Server Actions + Route Handlers).** Auth-gated mutations call `requireSession()` first; throws redirect to `/login` if no cookie. All business logic lives here; the client just renders state.

**Database (MongoDB Atlas).** Six collections:

| Collection | Role | Indexes |
|---|---|---|
| `events` | Immutable, append-only source of truth | `(groupId, createdAt)`, unique sparse `clientEventId` |
| `balances_view` | Projection — recomputable from events | unique `(groupId, userId, currency)` |
| `users` | Auth-facing | unique `email` |
| `groups` | Group metadata | unique sparse `shareToken` |
| `memberships` | Many-to-many users ↔ groups | unique `(groupId, userId)` |
| `login_tokens` | Magic-link single-use | unique `token`, TTL `expiresAt` |

**Email (Resend).** Production path: real email delivery. Dev path: link surfaced in-browser. Production code is identical to dev; only the response shape differs gated on `NODE_ENV`.

**Algorithm.** Pure function. No DB dependency. Tested via property tests asserting four invariants.

**Projection.** Updates `balances_view` via `$inc` upserts. Idempotent at the DB level (re-applying the same delta is safe because `$inc` is commutative across the document).

## The data contract

`events.payload` is unstructured `Mixed` in Mongoose, but every type has an expected shape (validated by Zod at write-time in server actions). The shapes:

```typescript
// group_created
{
  name: string;
  baseCurrency: string;
  isTrip: boolean;
  creatorUserId: string;
}

// member_added
{
  userId: string;
  viaInvite?: boolean;
}

// expense_added
{
  expenseId: string;
  description: string;
  currency: string;
  fxRateToBase: number;       // 1.0 today; multi-currency scaffolding
  paidByUserId: string;
  splits: { userId: string; amount: number }[];
  totalAmount: number;
  expenseTimestamp: string;   // ISO date
  category?: string;          // for trip mode
}

// settlement_made
{
  settlementId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
}
```

## Idempotency model

Three places duplicates can happen, three defences:

| Risk | Source | Defence |
|---|---|---|
| User double-clicks "Save expense" | Browser | `clientEventId` unique sparse index — DB drops the duplicate write |
| User double-clicks magic link in email | Browser | `findOneAndUpdate({consumedAt: null})` — atomic single-use |
| User visits invite link twice | Browser | `Membership.exists()` check before `Membership.create()` |

All three are at the DB layer. No application-level locking.

## What the architecture doesn't currently do (yet)

- **No SSE for real-time balance updates.** When User A adds an expense, User B sees the new balance only on next page refresh. The architecture supports SSE — adding a `/api/sse/[groupId]` route handler subscribed to event-emitter notifications is the next step.
- **No background projection rebuild.** If the projection drifts (e.g. via a half-failed mutation), it's currently rebuilt only manually. A scheduled job that replays the event log into `balances_view` would close this loop.
- **No FX-rate fetching.** `fxRateToBase` is captured in the event payload but always `1.0` today. A production deploy would fetch from a free API and cache.
