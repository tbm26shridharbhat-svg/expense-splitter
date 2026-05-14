# Notes — rough thinking while building Pocket

*Working file kept open in a side panel while building. Read it as a notebook,
not as polished prose. Part of the submission because the iteration story
is the engineering story.*

---

## Things that went wrong on the first pass

- **Two MongoDB auth failures before I read the screenshot carefully.** The connection string used the user `pocket-app` but Atlas only had `shridharbhat820` — I'd been editing the wrong field in Atlas's UI. The screenshot of "Database Users" finally pinned it. Saved me from a third password reset.

- **Mongoose URI password URL-encoding.** The first password contained `@` which is special in connection strings (separates user:pass from host). Encoded as `%40` it parsed correctly, but Atlas was rejecting on a different reason (the user didn't exist). Lesson: `bad auth` from Atlas can mean either wrong credential *or* user doesn't exist — log the actual username being sent before you panic.

- **`useSearchParams` and Next.js static-prerender.** Adding `?next=` reading to the login page broke `npm run build` with a Suspense-boundary error. Next 16 requires `useSearchParams` to be inside a `<Suspense>` boundary if the parent page would otherwise be statically prerendered. The fix is two lines: wrap the form in `<Suspense fallback={null}>`. I lost ~5 min to that.

- **The `?next=` parameter wasn't carried through the magic-link round-trip.** Built the `/join/<token>` invite flow assuming `/login?next=/join/X` would survive: send email → click email → land at /join/X. It didn't. The magic-link email URL was `/auth/verify?token=Y` (no `next`), so verify always redirected to `/groups`. Three coordinated changes fixed it: `requestMagicLink(email, next?)`, `<email URL>&next=<path>`, `/auth/verify` reads `next` and uses it. Three files; the test would have caught this if I'd written it.

- **Form action returning data.** Tried to return `{ ok, error }` from an `addExpenseAction` bound to `<form action={...}>`. Next 16 / React 19 requires form actions to be `void | Promise<void>`. Switched to throwing on error, redirecting on success. Slightly worse UX (no inline form errors) but it's tonight's compromise; `useActionState` is the fix tomorrow.

## Things I almost didn't do that turned out to matter

- **The dev escape hatch for magic links.** Without it, Resend's free tier (which only delivers to the account-owner's email) would have made the demo video impossible — the panel can't test sign-up with `aman@test.com` if Resend silently drops it. Gated on `NODE_ENV !== "production"`, the link is surfaced in-page. Took 15 minutes. Saved the demo.

- **`sanitizeNext()`.** Open-redirect vulnerability waiting to happen if the `?next=` parameter is passed through verbatim. An attacker crafts `/login?next=https://evil.com`, victim signs in legitimately, lands on phishing. Five lines: only relative paths, never protocol-relative, never `/auth/*`. Five lines of security-by-default.

- **`clientEventId` unique index.** Easy to forget. A double-click on "Save expense" would otherwise create two events. The unique sparse index makes duplicates a silent no-op at the DB layer — no application-level locking, no React state needed to protect against it.

- **Request-host detection for magic-link URLs.** First version had `NEXT_PUBLIC_APP_URL` hard-required for production. That creates a deploy chicken-and-egg: you don't know the Vercel URL until you deploy, but the env var has to be set before deploy. Switched to reading `X-Forwarded-Proto + Host` from request headers, with the env var as an override. Means the deploy is one-shot and preview URLs also work.

## Things I'm still uncertain about

- **Whether to add transactions on `group_created`.** Currently writes Group, Membership, Event in plain order. A partial failure between writes is recoverable via event replay (which I haven't built), but in the meantime a half-failed creation leaves the projection inconsistent. Atlas free tier supports transactions and they'd be one wrapper away. Punted because the failure mode is small for a fresher demo; I'd add this in production.

- **Whether the greedy netting is *always* optimal.** Property test #4 asserts `|settlements| ≤ count(non-zero balances) − 1`. This is necessary but not always *tight*. The minimum-settlements problem is NP-hard in the worst case (set-partition equivalent). My greedy is optimal whenever the balance vector has no exact-sum subsets, which is essentially always for real expense histories with non-trivial amounts. But I haven't formally proven this for synthetic adversarial inputs. Worth flagging in the demo Q&A.

- **Mongoose vs the native MongoDB driver.** Mongoose's typings are inconsistent (`findOneAndUpdate + upsert + new` says it can return null, but it always returns a doc). The native driver is more honest but more verbose. Mongoose was the right pick for build speed; in a longer project I'd reconsider.

- **The settle-up button hasn't been wired yet.** The algorithm is done and proven correct. The UI to display the suggested settlements and post them to the server is tomorrow's work. Without it, you can record balances but not settle them — which is half the point of the app.

## Decisions I'd make differently next time

- **Lock the auth round-trip flow before writing the UI.** I built `/login` and `/auth/verify` and `/join/[token]` separately, then discovered they didn't compose because the `?next=` parameter was lost between them. A flow diagram on paper for 10 minutes would have caught this.

- **Write the connection-test diagnostic *first*.** I wrote `scripts/test-db.ts` only after the third MongoDB auth failure. Should have written it before the first one — it gives clean diagnostic output in 2 seconds vs. restarting Next.js and watching server logs.

- **Pick the ODM and stick with it.** I started on Drizzle/Postgres, switched mid-build to Mongoose/Mongo. The architecture survived but the switch cost ~30 min that wasn't budgeted. Pick at minute zero.

## Small craft things I'm proud of

- **Property tests pass in 600ms on my laptop.** Four invariants, ~1,000 random graphs each. That's not slow enough to skip in CI.

- **The dev escape hatch UI.** The "DEV" badge + "Sign in directly" link looks deliberate, not patched on. Disappears entirely in production.

- **The invite-section component.** Generates token + displays URL + copy-to-clipboard, all in one mental unit. The optimistic "Copied ✓" feedback is the kind of micro-interaction that distinguishes a prototype from a product.

- **Mobile-first design from minute one.** The big-number tabular-num amount input is keyboard-friendly on mobile (`inputMode="decimal"`) and visually clean on desktop. Same component, no conditional logic.

## What I'd watch for if I were on the panel

- Can the candidate defend the event-sourcing choice in plain language?
- Can they walk through one property-test invariant from memory?
- Can they explain why the magic-link round-trip needed three coordinated changes, not one?
- Do they understand the difference between greedy-optimal and globally-optimal for the netting problem?

If I were sitting on the panel, those are the four questions I'd ask. I have answers for all four.
