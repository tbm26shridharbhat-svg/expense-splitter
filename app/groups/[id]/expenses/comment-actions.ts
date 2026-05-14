"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/require-auth";
import { connectDB, Event, Membership } from "@/lib/db";

const Schema = z.object({
  groupId: z.string(),
  expenseId: z.string(),
  text: z.string().min(1).max(500),
});

export async function addCommentAction(
  prevState: any,
  formData: FormData,
): Promise<{ error?: string }> {
  const session = await requireSession();
  
  const parsed = Schema.safeParse({
    groupId: formData.get("groupId"),
    expenseId: formData.get("expenseId"),
    text: formData.get("text"),
  });

  if (!parsed.success) {
    return { error: "Invalid comment." };
  }

  await connectDB();

  const isMember = await Membership.exists({
    groupId: parsed.data.groupId,
    userId: session.userId,
    leftAt: null,
  });
  if (!isMember) return { error: "Not a member" };

  await Event.create({
    groupId: parsed.data.groupId,
    type: "expense_commented",
    actorUserId: session.userId,
    payload: {
      expenseId: parsed.data.expenseId,
      text: parsed.data.text,
      createdAt: new Date().toISOString(),
    },
  });

  revalidatePath(`/groups/${parsed.data.groupId}`);
  return {};
}
