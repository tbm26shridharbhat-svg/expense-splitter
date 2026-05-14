"use server";

import { z } from "zod";
import { Types } from "mongoose";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/require-auth";
import { connectDB, Event, Group, Membership } from "@/lib/db";
import { applySettlementMade } from "@/lib/events/balance-projection";

const Schema = z.object({
  fromUserId: z.string(),
  toUserId: z.string(),
  amount: z.number().positive(),
});

export async function settleUpAction(groupId: string, prevState: any, formData: FormData): Promise<{ error?: string }> {
  const session = await requireSession();
  
  const parsed = Schema.safeParse({
    fromUserId: formData.get("fromUserId"),
    toUserId: formData.get("toUserId"),
    amount: Number(formData.get("amount")),
  });

  if (!parsed.success) return { error: "Invalid settlement data" };

  await connectDB();
  
  const group = await Group.findById(groupId).lean();
  if (!group) return { error: "Group not found" };

  // Create event
  const payload = {
    ...parsed.data,
    currency: group.baseCurrency,
    timestamp: new Date().toISOString(),
  };

  await Event.create({
    groupId,
    type: "settlement_made",
    actorUserId: session.userId,
    payload,
  });

  // Apply projection
  await applySettlementMade(groupId, payload);

  revalidatePath(`/groups/${groupId}`);
  redirect(`/groups/${groupId}`);
}
