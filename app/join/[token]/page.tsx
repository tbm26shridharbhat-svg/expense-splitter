/**
 * /join/[token] — the landing page for an invite link.
 *
 * Flow:
 *   - Not logged in → /login?next=/join/<token>  (after sign-in, comes back here)
 *   - Logged in + token valid + not already a member → add membership, append
 *     member_added event, redirect to /groups/[id]
 *   - Logged in + already a member → straight to /groups/[id]
 *   - Token unknown → friendly "this invite isn't valid" screen
 */
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { connectDB, Group, Membership, Event } from "@/lib/db";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function JoinPage({ params }: PageProps) {
  const { token } = await params;
  const session = await getSession();

  await connectDB();
  const group = await Group.findOne({ shareToken: token }).lean();

  if (!group) {
    return <InvalidInvite />;
  }

  const groupId = String(group._id);

  // Need to be signed in to actually join
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/join/${token}`)}`);
  }

  // Already a member? Just send them to the group.
  const existing = await Membership.findOne({
    groupId,
    userId: session.userId,
    leftAt: null,
  });
  if (existing) {
    redirect(`/groups/${groupId}`);
  }

  // Otherwise: add membership + append event (audit trail), then in.
  await Membership.create({ groupId, userId: session.userId });
  await Event.create({
    groupId,
    type: "member_added",
    actorUserId: session.userId, // self-joined; will be inviter once we track that
    payload: { userId: session.userId, viaInvite: true },
  });

  redirect(`/groups/${groupId}`);
}

function InvalidInvite() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <div className="size-12 rounded-full bg-debt/10 text-debt text-xl flex items-center justify-center mb-4">
        ✕
      </div>
      <h1 className="text-xl font-semibold mb-2">This invite isn&apos;t valid</h1>
      <p className="text-sm text-ink/65 max-w-sm">
        The link may have been revoked, or the group has been removed. Ask whoever
        sent it for a fresh one.
      </p>
    </main>
  );
}
