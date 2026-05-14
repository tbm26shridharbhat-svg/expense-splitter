# Submission Notes — Case 2 · Pocket

Honest caveats for the panel. Things to know before opening the deployed link.

## What's most worth looking at first

1. **`lib/netting.ts` + `lib/netting.test.ts`** — the algorithmic core. Four invariants asserted across 1,000+ randomly generated balance maps. Run `npm test` to see them pass.
2. **`lib/db/schema.ts`** — the event-sourced data model. Read the inline comments to see why every table exists.
3. **The live deployment** — try the full flow end-to-end (Onboarding, Uneven Splitting, Analytics, Settlement, etc.).

## "State of the Art" Feature Summary

This application now includes premium functionality that sets it apart:

- **Intelligent Two-Path Auth**: Email-first identification (returning user vs. new) with a progressive, multi-step onboarding for new users.
- **Contextual Collaboration**: Every expense is a discussion thread (`ExpenseThread`).
- **Financial Intelligence**: Proactive nudge engine identifying "worst debtors" to settle up.
- **Savings Goals**: Interactive savings goals with visual progress bars.
- **Modern UI**: A borderless, airy, and card-based minimalist design language.
- **Robust Management**: Recurring expense scheduling and activity CSV export.
- **Optimized Performance**: Infinite-scrolling/load-more activity feed, intelligent balance breakdown visualization, and animated skeleton loaders for smooth perceived loading.

## Known limitations to flag

- **Real-time updates**: While the architecture is event-sourced and ready, real-time "live" dashboard updates (e.g., Pusher) were de-scoped in favor of stable server-action revalidations.

## Auth behaviour

The auth uses password-based authentication with `scrypt` hashing. Sessions are managed via signed JWT cookies (`jose`), giving full control over token lifetime and cookie attributes.

## MongoDB Atlas free-tier behaviour

The deployed app talks to a free-tier M0 Atlas cluster.
1. **Cold starts**: The first request after idle can have latency while the connection is established. Subsequent requests are sub-100ms.
2. **IP Access**: Network access is currently set to `0.0.0.0/0` (public) for the demo.

## What's most worth challenging in a Q&A

- **Why event sourcing for this?** True, it is heavier than a CRUD app. But it makes the "correctness" requirement of the brief effortless. Time-travel, audit trails, and idempotent settlements aren't features—they are the *consequence* of this architecture.
- **How is international currency handled?** We lock the FX rate at the *moment of expense creation* (`fxRateToBase`), treating the locked-in currency conversion as immutable history.

## Live URLs

- **Deployed app:** [https://expense-splitter-kxovvf8ja-tbm26shridharbhat-4278s-projects.vercel.app/](https://expense-splitter-kxovvf8ja-tbm26shridharbhat-4278s-projects.vercel.app/)
- **Repo:** <https://github.com/tbm26shridharbhat-svg/expense-splitter>

