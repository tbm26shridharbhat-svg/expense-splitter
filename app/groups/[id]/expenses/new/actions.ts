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
  splits: z.array(z.object({
    userId: z.string(),
    amount: z.number()
  })).min(1, "Pick at least one person to split with"),
});

export async function addExpenseAction(groupId: string, formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!Types.ObjectId.isValid(groupId)) throw new Error("Bad group id");

  const splitUserIds = formData.getAll("splitUserIds").map(String);
  const splits = splitUserIds.map(userId => ({
    userId,
    amount: Number(formData.get(`splitAmount_${userId}`) ?? 0)
  }));

  const parsed = Schema.safeParse({
    description: String(formData.get("description") ?? "").trim(),
    amount: Number(formData.get("amount") ?? 0),
    paidByUserId: String(formData.get("paidByUserId") ?? ""),
    splits,
  });

  if (!parsed.success) {
    console.error("[addExpense] validation:", parsed.error.issues);
    throw new Error(parsed.error.issues[0].message);
  }

  // Validate sum of splits equals total amount (within rounding)
  const totalSplit = parsed.data.splits.reduce((sum, s) => sum + s.amount, 0);
  if (Math.abs(totalSplit - parsed.data.amount) > 0.01) {
    throw new Error(`Splits don't add up to the total. Total: ${parsed.data.amount}, Splits: ${totalSplit.toFixed(2)}`);
  }

  await connectDB();

  const isMember = await Membership.exists({
    groupId,
    userId: session.userId,
    leftAt: null,
  });
  if (!isMember) throw new Error("Not a member of this group");

  const payerOk = await Membership.exists({
    groupId,
    userId: parsed.data.paidByUserId,
    leftAt: null,
  });
  if (!payerOk) throw new Error("Payer is not a group member");

  const group = await Group.findById(groupId).lean();
  if (!group) throw new Error("Group not found");

  const clientEventId = formData.get("clientEventId");
  const payload = {
    expenseId: new Types.ObjectId().toString(),
    description: parsed.data.description,
    currency: group.baseCurrency,
    fxRateToBase: 1.0,
    paidByUserId: parsed.data.paidByUserId,
    splits: parsed.data.splits,
    totalAmount: parsed.data.amount,
    expenseTimestamp: new Date().toISOString(),
  };

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
      revalidatePath(`/groups/${groupId}`);
      redirect(`/groups/${groupId}`);
    }
    throw err;
  }

  await applyExpenseAdded(groupId, payload);

  revalidatePath(`/groups/${groupId}`);
  redirect(`/groups/${groupId}`);
}
