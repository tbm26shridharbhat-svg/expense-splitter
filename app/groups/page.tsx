/**
 * /groups — list every group the signed-in user belongs to, plus a "Create"
 * action. This is the landing page after magic-link verification.
 *
 * Empty state matters: this is the first thing a new user sees after sign-in.
 */
import Link from "next/link";
import { requireSession } from "@/lib/auth/require-auth";
import { connectDB, Group, Membership } from "@/lib/db";
import { logoutAction, createGroupAction } from "./actions";
import { formatAmount } from "@/lib/utils";

export default async function GroupsPage() {
  const session = await requireSession();
  await connectDB();

  // Groups the user is currently a member of (not left)
  const memberships = await Membership.find({
    userId: session.userId,
    leftAt: null,
  }).lean();

  const groupIds = memberships.map((m) => m.groupId);
  const groups = groupIds.length
    ? await Group.find({ _id: { $in: groupIds } }).sort({ updatedAt: -1 }).lean()
    : [];

  // Member count per group, for the list display
  const memberCounts = await Membership.aggregate<{ _id: unknown; count: number }>([
    { $match: { groupId: { $in: groupIds }, leftAt: null } },
    { $group: { _id: "$groupId", count: { $sum: 1 } } },
  ]);
  const countByGroupId = new Map(memberCounts.map((c) => [String(c._id), c.count]));

  return (
    <main className="min-h-dvh flex flex-col px-5 pt-6 pb-12 sm:px-12">
      <header className="flex items-center justify-between max-w-md w-full mx-auto mb-12">
        <Link href="/groups" className="flex items-center gap-2 text-sm">
          <span aria-hidden className="size-2 rounded-full bg-accent" />
          <span className="font-medium">Pocket</span>
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="text-xs text-ink/55 hover:text-ink transition"
            aria-label={`Sign out ${session.email}`}
          >
            {session.email} · sign out
          </button>
        </form>
      </header>

      <section className="max-w-md w-full mx-auto flex flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">Your groups</h1>

        {groups.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="flex flex-col gap-3">
            {groups.map((g) => (
              <li key={String(g._id)}>
                <Link
                  href={`/groups/${g._id}`}
                  className="block bg-card border border-hairline rounded-2xl p-5 hover:border-accent/40 transition"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium truncate">{g.name}</span>
                      <span className="text-xs text-ink/55">
                        {countByGroupId.get(String(g._id)) ?? 1}{" "}
                        {(countByGroupId.get(String(g._id)) ?? 1) === 1 ? "member" : "members"}
                        {g.isTrip ? " · trip" : ""}
                      </span>
                    </div>
                    <span className="amount tabular text-lg font-medium text-ink/40" aria-hidden>
                      →
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <CreateGroupForm />
      </section>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="bg-card border border-hairline border-dashed rounded-2xl p-8 text-center flex flex-col items-center gap-2">
      <div className="size-10 rounded-full bg-accent/10 flex items-center justify-center text-accent text-lg">
        ✦
      </div>
      <p className="text-sm text-ink/70 max-w-xs">
        No groups yet. Create one — maybe the trip you've been splitting on a notes app.
      </p>
    </div>
  );
}

function CreateGroupForm() {
  return (
    <form
      action={createGroupAction}
      className="flex flex-col gap-3 mt-2"
    >
      <label className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wide text-ink/55">New group</span>
        <input
          name="name"
          type="text"
          placeholder="Goa trip · roommates · whatever"
          required
          maxLength={120}
          className="h-12 px-4 rounded-xl bg-card border border-hairline
                     focus:border-accent focus:ring-2 focus:ring-accent/20
                     outline-none transition text-base"
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-ink/70 select-none">
        <input
          type="checkbox"
          name="isTrip"
          className="size-4 accent-accent rounded"
        />
        Mark as a trip (gets a category breakdown later)
      </label>
      <button
        type="submit"
        className="h-12 rounded-xl bg-accent text-white font-medium
                   active:scale-[0.99] transition-transform shadow-sm hover:bg-accent/90"
      >
        Create group
      </button>
    </form>
  );
}
