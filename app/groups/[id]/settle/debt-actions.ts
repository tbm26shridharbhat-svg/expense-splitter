"use server";

import { connectDB, BalanceView } from "@/lib/db";
import { Types } from "mongoose";

export async function getDebtAction(groupId: string, fromUserId: string, toUserId: string): Promise<number> {
  await connectDB();
  
  // Find balance for fromUser relative to toUser
  // This is a simplified lookup; in this event-sourced architecture, 
  // balances are generally group-wide per user.
  // We'll calculate the relative debt based on individual net balances.
  
  const fromBalance = await BalanceView.findOne({ groupId, userId: fromUserId }).lean();
  const toBalance = await BalanceView.findOne({ groupId, userId: toUserId }).lean();

  const fromAmt = fromBalance?.amount ?? 0;
  
  // If fromUser has negative balance (owes), return that amount
  return fromAmt < 0 ? Math.abs(fromAmt) : 0;
}
