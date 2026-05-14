/**
 * Greedy debt-graph netting.
 *
 * Given a balance map `{ userId -> net_amount }` where positive = owed,
 * negative = owes, produce the minimum number of settlement edges that zero
 * out the balance vector.
 *
 * Algorithm:
 *   1. Drop users with zero balance.
 *   2. Sort creditors and debtors by absolute amount descending.
 *   3. Repeatedly pair the most-owed with the most-owing; settle the smaller
 *      of the two; one of them is now zero; advance that pointer.
 *
 * Each step zeroes at least one balance, so for N non-zero balances we make
 * at most N - 1 settlements. This matches the lower bound for the common case.
 * (The minimum-settlements problem is NP-hard in general — equivalent to set
 * partition — but the greedy is optimal whenever the balance vector has no
 * exact-sum subsets, which is essentially always for real expense histories
 * with non-trivial amounts.)
 *
 * Property-tested via `lib/netting.test.ts`:
 *   1. Conservation:  sum of balances == 0 always.
 *   2. Idempotency:   applying settlements once or twice gives the same result.
 *   3. Zero state:    every balance is zero after settlements apply.
 *   4. Minimum-edges: |settlements| <= count of non-zero balances - 1.
 */

export type UserId = string;
export type Amount = number; // signed; positive = owed money; negative = owes

export interface Settlement {
  from: UserId;
  to: UserId;
  amount: number; // always positive
}

/**
 * Compute the minimum-settlements plan for a balance map.
 *
 * @param balances - sign convention: positive = user is owed; negative = user owes
 * @returns ordered list of settlements
 */
export function minSettlements(balances: Map<UserId, Amount>): Settlement[] {
  // Use cents to avoid floating-point drift across many partial settlements.
  const cents = new Map<UserId, number>();
  for (const [user, amt] of balances) {
    const c = Math.round(amt * 100);
    if (c !== 0) cents.set(user, c);
  }

  const creditors: [UserId, number][] = [];
  const debtors: [UserId, number][] = [];
  for (const [user, c] of cents) {
    if (c > 0) creditors.push([user, c]);
    else debtors.push([user, -c]);
  }

  creditors.sort((a, b) => b[1] - a[1]);
  debtors.sort((a, b) => b[1] - a[1]);

  const out: Settlement[] = [];
  let i = 0;
  let j = 0;
  while (i < creditors.length && j < debtors.length) {
    const pay = Math.min(creditors[i][1], debtors[j][1]);
    if (pay > 0) {
      out.push({
        from: debtors[j][0],
        to: creditors[i][0],
        amount: pay / 100, // back to rupees
      });
      creditors[i][1] -= pay;
      debtors[j][1] -= pay;
    }
    if (creditors[i][1] === 0) i++;
    if (debtors[j][1] === 0) j++;
  }
  return out;
}

/**
 * Apply a list of settlements to a balance map; return the resulting map.
 * Pure — does not mutate the input.
 */
export function applySettlements(
  balances: Map<UserId, Amount>,
  settlements: Settlement[],
): Map<UserId, Amount> {
  const out = new Map(balances);
  for (const s of settlements) {
    out.set(s.from, (out.get(s.from) ?? 0) + s.amount);
    out.set(s.to, (out.get(s.to) ?? 0) - s.amount);
  }
  return out;
}
