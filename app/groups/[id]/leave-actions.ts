"use server";

import { requireSession } from "@/lib/auth/require-auth";
import { connectDB, Membership, Event } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function leaveGroupAction(groupId: string): Promise<void> {
  const session = await requireSession();
  await connectDB();

  await Membership.findOneAndUpdate(
    { groupId, userId: session.userId },
    { leftAt: new Date() }
  );

  await Event.create({
    groupId,
    type: "member_removed",
    actorUserId: session.userId,
    payload: { userId: session.userId },
  });

  revalidatePath("/groups");
  redirect("/groups");
}
