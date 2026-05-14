"use server";

import { randomBytes } from "node:crypto";
import { Types } from "mongoose";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/require-auth";
import { connectDB, Group, Membership } from "@/lib/db";

/**
 * Generate a join token for this group if one doesn't exist.
 * Idempotent — calling twice on a group that already has a token is a no-op.
 *
 * Only current members can generate the link (silently no-ops otherwise).
 */
export async function ensureInviteTokenAction(groupId: string): Promise<void> {
  const session = await requireSession();
  if (!Types.ObjectId.isValid(groupId)) return;

  await connectDB();

  // Caller must be a member
  const isMember = await Membership.exists({
    groupId,
    userId: session.userId,
    leftAt: null,
  });
  if (!isMember) return;

  const group = await Group.findById(groupId).lean();
  if (!group) return;
  if (group.shareToken) {
    revalidatePath(`/groups/${groupId}`);
    return;
  }

  const token = randomBytes(12).toString("base64url"); // ~16 chars, URL-safe
  await Group.updateOne({ _id: groupId }, { $set: { shareToken: token } });
  revalidatePath(`/groups/${groupId}`);
}
