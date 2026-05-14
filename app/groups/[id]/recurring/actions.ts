"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/require-auth";
import { connectDB, RecurringExpense, Membership } from "@/lib/db";
import { Types } from "mongoose";

const Schema = z.object({
  description: z.string().min(1),
  amount: z.number().positive(),
  paidByUserId: z.string(),
});

export async function addRecurringExpenseAction(groupId: string, prevState: any, formData: FormData): Promise<{ error?: string }> {
  const session = await requireSession();
  const parsed = Schema.safeParse({
    description: formData.get("description"),
    amount: Number(formData.get("amount")),
    paidByUserId: formData.get("paidByUserId"),
  });

  if (!parsed.success) return { error: "Invalid data" };

  await connectDB();
  
  // Basic membership check
  const isMember = await Membership.exists({ groupId, userId: session.userId });
  if (!isMember) return { error: "Not a member" };

  await RecurringExpense.create({
    groupId,
    ...parsed.data,
    nextRunDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
  });

  revalidatePath(`/groups/${groupId}`);
  return {};
}
