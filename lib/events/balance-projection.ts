/**
 * Balance projection updater.
 *
 * Given an event, applies the balance delta to BalanceView. Pure-ish: takes an
 * event payload, computes the (userId → delta) map, and applies it via $inc
 * upserts.
 *
 * The math, by event type:
 *
 *   expense_added:
 *     payer:      balance += totalAmount   (they paid out of pocket)
 *     each split: balance -= split.amount  (they owe their share)
 *
 *     Sums to zero by construction:
 *       sum(splits) == totalAmount  →  net delta across all users == 0
 *
 *   settlement_made:
 *     fromUser:   balance += amount   (they paid their debt; balance moves toward 0)
 *     toUser:     balance -= amount   (their credit reduced)
 *
 *   expense_voided / corrected: not implemented tonight; tomorrow's projection
 *   can either rewind the original event or apply an inverse delta event.
 */
import { connectDB, BalanceView } from "@/lib/db";

interface ExpenseAddedPayload {
  totalAmount: number;
  paidByUserId: string;
  currency: string;
  splits: { userId: string; amount: number }[];
}

interface SettlementMadePayload {
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
}

/** Apply an expense_added event to the balances projection. */
export async function applyExpenseAdded(
  groupId: string,
  payload: ExpenseAddedPayload,
): Promise<void> {
  await connectDB();

  // Accumulate deltas per user so a payer who is also a splittee gets one net update
  const deltas = new Map<string, number>();
  deltas.set(payload.paidByUserId, payload.totalAmount); // payer paid

  for (const split of payload.splits) {
    const cur = deltas.get(split.userId) ?? 0;
    deltas.set(split.userId, cur - split.amount);
  }

  const updatedAt = new Date();
  await Promise.all(
    [...deltas.entries()].map(([userId, delta]) =>
      BalanceView.findOneAndUpdate(
        { groupId, userId, currency: payload.currency },
        { $inc: { amount: delta }, $set: { updatedAt } },
        { upsert: true, new: true },
      ),
    ),
  );
}

/** Apply a settlement_made event to the balances projection. */
export async function applySettlementMade(
  groupId: string,
  payload: SettlementMadePayload,
): Promise<void> {
  await connectDB();
  const updatedAt = new Date();
  await Promise.all([
    BalanceView.findOneAndUpdate(
      { groupId, userId: payload.fromUserId, currency: payload.currency },
      { $inc: { amount: payload.amount }, $set: { updatedAt } },
      { upsert: true, new: true },
    ),
    BalanceView.findOneAndUpdate(
      { groupId, userId: payload.toUserId, currency: payload.currency },
      { $inc: { amount: -payload.amount }, $set: { updatedAt } },
      { upsert: true, new: true },
    ),
  ]);
}
