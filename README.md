# Pocket: The Future of Group Settlement

Pocket is not just another expense splitter. It’s an **event-sourced financial ledger** designed to kill roommate arguments before they start. While other apps bloat themselves with unnecessary features, Pocket focuses on one thing: **frictionless settlement.**

At any moment, you and your roommates know exactly who owes whom, and you can settle the entire web of debt with one tap.

**Live demo:** [https://expense-splitter-puce-pi.vercel.app/](https://expense-splitter-puce-pi.vercel.app/)
**Demo video:** [https://www.loom.com/share/bcecfa206b2d4619a124691a08d58d47](https://www.loom.com/share/bcecfa206b2d4619a124691a08d58d47)

---

## The "Wow" Factor

We’ve pushed Pocket beyond the basics to create a truly premium experience:

*   **Intelligent Auth**: A frictionless email-first entry that instantly detects returning users, coupled with a progressive, multi-step onboarding for new members.
*   **Contextual Collaboration**: Don't just track numbers—discuss them. Every expense has a dedicated thread to clarify details, saving you from switching to messaging apps.
*   **Proactive Financial Health**: The app acts as your financial assistant, nudging users to settle debts before they become a source of friction.
*   **Visual & Airy UI**: A clean, card-based interface built on a modern, minimalist design language. It uses subtle elevation, refined typography, and smooth micro-animations to make managing money feel effortless.
*   **Smart Automation**: Set collective savings goals for group trips, manage recurring expenses like rent automatically, and keep your data portable with one-tap CSV exports.

---

## The Engine Room (Technical Philosophy)

Pocket is built on an **immutable event-sourced ledger**. This is the secret to its correctness:

1.  **The Source of Truth**: Every action—adding an expense, settling a debt, voiding an error—is an event in an append-only log.
2.  **Derived Balances**: Balances aren't stored; they are *computed* from the history of events. This makes the ledger bulletproof.
3.  **Idempotent Settlement**: No more "did my payment go through?" issues. Every settlement action is unique and idempotent at the database level.
4.  **Greedy Netting**: The heart of the app is a battle-tested netting algorithm, verified by over 1,000 property-based tests to ensure the minimum number of transactions is always achieved.

---

## Handling International Currency

If Pocket were to scale globally, we wouldn't rely on live FX rates for historical settlements. Reliability requires avoiding "floating truth."

**The Golden Rule: Lock the Rate at Birth**
*   **Snapshotting**: When an expense is added in a foreign currency, the system fetches the current spot rate and locks it into the `expense_added` event. This `fxRateToBase` is immutable.
*   **Consistent Settlement**: If two friends split a $50 dinner on Mar 10 (when $1 = ₹83) and settle up on Mar 24 ($1 = ₹85), the second friend still owes exactly what was spent in the base currency at the time of purchase. They do not get a "discount" because the market moved.

**Enhancements for Production-Grade Trust:**

*   **Transparency First**: At the point of entry, the user sees both the foreign amount and the calculated base-currency amount. We don't just perform the math; we *show* them the math before they hit "Save."
*   **Manual Override for Real-World Variance**: We recognize that standard API rates often differ from a user’s specific bank conversion rate. Pocket allows a "Manual FX Rate Override" during expense creation. The system flags this as a `user_adjusted_rate` in the event payload, ensuring that the ledger remains auditable.
*   **Dynamic Base Currency Transitions**: What if a group decides to switch their base currency from INR to EUR halfway through a trip? Our event-sourced architecture handles this seamlessly by introducing a `base_currency_changed` event. All *subsequent* projections use the new base currency, while historical events remain perfectly accurate in their original, immutable format.

**The Tech-Side Reconciliation:**
Because we store the base-currency amount as the source of truth in our projection, the netting algorithm doesn't need to know about the complexity of the original currencies. It operates entirely on the normalized base-currency balance.

---

## Quick Start

```bash
# 1. Clone & Install
git clone <repo-url>
npm install

# 2. Configure
cp .env.example .env.local
# Set MONGODB_URI, SESSION_SECRET, etc.

# 3. Launch
npm run dev
```

---

## License

MIT. Crafted with precision for the modern roommate experience.
