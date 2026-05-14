"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/require-auth";
import { clearSessionCookie } from "@/lib/auth/session";
import { connectDB, Group, Membership, Event } from "@/lib/db";

const CreateGroupSchema = z.object({
  name: z.string().min(1, "Name the group.").max(120),
  isTrip: z.boolean().default(false),
});

/**
 * Create a group, add the creator as the first member, append the group_created event.
 * Three writes — kept in plain order rather than wrapped in a transaction because
 * Atlas free-tier supports transactions but they're heavier than the failure mode
 * we're guarding against (a half-created group with no membership). We rely on
 * the projection being recomputable from events: if creation half-fails, the event
 * log can be replayed to restore consistency.
 */
export async function createGroupAction(formData: FormData) {
  const session = await requireSession();

  const parsed = CreateGroupSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    isTrip: formData.get("isTrip") === "on",
  });
  if (!parsed.success) {
    // Future: surface this back to the form. For now, error to console.
    console.error("[createGroup] validation failed:", parsed.error.issues);
    return;
  }

  await connectDB();

  const group = await Group.create({
    name: parsed.data.name,
    baseCurrency: "INR",
    isTrip: parsed.data.isTrip,
  });

  await Membership.create({
    groupId: group._id,
    userId: session.userId,
  });

  await Event.create({
    groupId: group._id,
    type: "group_created",
    actorUserId: session.userId,
    payload: {
      name: parsed.data.name,
      baseCurrency: "INR",
      isTrip: parsed.data.isTrip,
      creatorUserId: session.userId,
    },
  });

  revalidatePath("/groups");
  redirect(`/groups/${group._id}`);
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}
