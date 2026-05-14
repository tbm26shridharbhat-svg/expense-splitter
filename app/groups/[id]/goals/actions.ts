"use server";

import { z } from "zod";
import { Types } from "mongoose";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/require-auth";
import { connectDB, Goal, Event } from "@/lib/db";

const Schema = z.object({
  description: z.string().min(1),
  targetAmount: z.number().positive(),
});

export async function addGoalAction(groupId: string, prevState: any, formData: FormData): Promise<{ error?: string }> {
  const session = await requireSession();
  const parsed = Schema.safeParse({
    description: formData.get("description"),
    targetAmount: Number(formData.get("targetAmount")),
  });

  if (!parsed.success) return { error: "Invalid data" };

  await connectDB();
  await Goal.create({
    groupId,
    ...parsed.data,
  });

  await Event.create({
    groupId,
    type: "goal_added",
    actorUserId: session.userId,
    payload: { description: parsed.data.description, targetAmount: parsed.data.targetAmount },
  });

  revalidatePath(`/groups/${groupId}`);
  return {};
}
