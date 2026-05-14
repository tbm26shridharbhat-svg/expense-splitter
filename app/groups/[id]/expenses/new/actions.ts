"use server";

import { z } from "zod";
import { Types } from "mongoose";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/require-auth";
import { connectDB, Group, Membership, Event } from "@/lib/db";
import { applyExpenseAdded } from "@/lib/events/balance-projection";

const Schema = z.object({
  description: z.string().min(1, "What was it for?").max(200),
  amount: z.number().positive("Amount must be > 0"),
  paidByUserId: z.string().min(1),
  splitUserIds: z.array(z.string()).min(1, "Pick at least one person to split with"),
});

/**
 * Add an expense. Equal split among the chosen members.
 *
 * Two writes:
 *   1. Append the expense_added event (audit trail, source of truth)
 *   2. Update the balances projection
 *
 * Idempotency: callers can pass a clientEventId; the unique sparse index on
 * `events.clientEventId` makes the same submission a no-op on retry. We use
 * a UUID per form render below.
 */
export async function addExpenseAction(groupId: string, formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!Types.ObjectId.isValid(groupId)) throw new Error("Bad group id");

  const splitUserIds = formData.getAll("splitUserIds").map(String);
  const parsed = Schema.safeParse({
    description: String(formData.get("description") ?? "").trim(),
    amount: Number(formData.get("amount") ?? 0),
    paidByUserId: String(formData.get("paidByUserId") ?? ""),
    splitUserIds,
  });

  if (!parsed.success) {
    console.error("[addExpense] validation:", parsed.error.issues);
    throw new Error(parsed.error.issues[0].message);
  }

  await connectDB();

  // Caller must be a member of the group
  const isMember = await Membership.exists({
    groupId,
    userId: session.userId,
    leftAt: null,
  });
  if (!isMember) throw new Error("Not a member of this group");

  // The payer must be a current member too
  const payerOk = await Membership.exists({
    groupId,
    userId: parsed.data.paidByUserId,
    leftAt: null,
  });
  if (!payerOk) throw new Error("Payer is not a group member");

  const group = await Group.findById(groupId).lean();
  if (!group) throw new Error("Group not found");

  // Equal split — round each share to 2dp; any residual goes onto the first split
  const n = parsed.data.splitUserIds.length;
  const share = Math.round((parsed.data.amount / n) * 100) / 100;
  const splits = parsed.data.splitUserIds.map((userId) => ({ userId, amount: share }));
  const totalSoFar = share * n;
  const residual = Math.round((parsed.data.amount - totalSoFar) * 100) / 100;
  if (residual !== 0 && splits.length > 0) {
    splits[0].amount = Math.round((splits[0].amount + residual) * 100) / 100;
  }

  const clientEventId = formData.get("clientEventId");
  const payload = {
    expenseId: new Types.ObjectId().toString(),
    description: parsed.data.description,
    currency: group.baseCurrency,
    fxRateToBase: 1.0,
    paidByUserId: parsed.data.paidByUserId,
    splits,
    totalAmount: parsed.data.amount,
    expenseTimestamp: new Date().toISOString(),
  };

  // 1. Append event — idempotent via clientEventId unique index
  try {
    await Event.create({
      groupId,
      type: "expense_added",
      actorUserId: session.userId,
      payload,
      clientEventId: clientEventId ? String(clientEventId) : undefined,
    });
  } catch (err: unknown) {
    const e = err as { code?: number };
    if (e.code === 11000) {
      // Duplicate clientEventId — already processed. Silent no-op (the goal).
      revalidatePath(`/groups/${groupId}`);
      redirect(`/groups/${groupId}`);
    }
    throw err;
  }

  // 2. Update the balances projection
  await applyExpenseAdded(groupId, payload);

  revalidatePath(`/groups/${groupId}`);
  redirect(`/groups/${groupId}`);
}
