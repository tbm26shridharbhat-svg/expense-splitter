import { BalanceView } from "@/lib/db";

/**
 * Identify a user with a significant debt to nudge them to settle up.
 */
export async function getSettleUpNudge(groupId: string): Promise<{ userId: string; amount: number } | null> {
  const worstDebtor = await BalanceView.findOne({
    groupId,
    amount: { $lt: -100 }, // Only nudge if debt > 100
  })
    .sort({ amount: 1 })
    .lean();

  if (!worstDebtor) return null;

  return { userId: String(worstDebtor.userId), amount: Math.abs(worstDebtor.amount) };
}
