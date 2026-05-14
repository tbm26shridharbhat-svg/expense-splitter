"use server";

import { requireSession } from "@/lib/auth/require-auth";
import { connectDB, Event } from "@/lib/db";
import { applyExpenseVoided } from "@/lib/events/balance-projection";
import { revalidatePath } from "next/cache";

export async function voidExpenseAction(groupId: string, expenseId: string): Promise<void> {
  const session = await requireSession();
  await connectDB();

  await Event.create({
    groupId,
    type: "expense_voided",
    actorUserId: session.userId,
    payload: { expenseId },
  });

  await applyExpenseVoided(groupId, { expenseId });

  revalidatePath(`/groups/${groupId}`);
}
