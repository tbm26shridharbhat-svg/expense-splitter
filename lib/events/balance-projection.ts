/**
 * Balance projection updater.
 *
 * Given an event, applies the balance delta to BalanceView. Pure-ish: takes an
 * event payload, computes the (userId → delta) map, and applies it via $inc
 * upserts.
 */
import { connectDB, BalanceView, Event } from "@/lib/db";

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

  const deltas = new Map<string, number>();
  deltas.set(payload.paidByUserId, payload.totalAmount); 

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

/** Apply an expense_voided event. */
export async function applyExpenseVoided(groupId: string, payload: { expenseId: string }): Promise<void> {
  await connectDB();
  const originalEvent = await Event.findOne({
    groupId,
    type: "expense_added",
    "payload.expenseId": payload.expenseId,
  }).lean();

  if (!originalEvent) return;

  const originalPayload = originalEvent.payload as ExpenseAddedPayload;

  // Reverse delta
  const deltas = new Map<string, number>();
  deltas.set(originalPayload.paidByUserId, -originalPayload.totalAmount); 

  for (const split of originalPayload.splits) {
    const cur = deltas.get(split.userId) ?? 0;
    deltas.set(split.userId, cur + split.amount);
  }

  const updatedAt = new Date();
  await Promise.all(
    [...deltas.entries()].map(([userId, delta]) =>
      BalanceView.findOneAndUpdate(
        { groupId, userId, currency: originalPayload.currency },
        { $inc: { amount: delta }, $set: { updatedAt } },
        { upsert: true, new: true },
      ),
    ),
  );
}
