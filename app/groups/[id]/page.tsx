/**
 * /groups/[id] — group detail.
 *
 * Tonight's scope: prove the routing + permission check work end-to-end.
 *   - Show group name, member count, balance placeholder
 *   - 404 if group doesn't exist or user isn't a member
 *
 * Tomorrow's scope (Phase 6): expense list, add-expense flow, settle-up button,
 * real balance computation via the projection.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { Types } from "mongoose";
import { requireSession } from "@/lib/auth/require-auth";
import { connectDB, Group, Membership, User } from "@/lib/db";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function GroupDetailPage({ params }: PageProps) {
  const session = await requireSession();
  const { id } = await params;

  // Validate ObjectId shape before hitting Mongo (avoids a CastError 500)
  if (!Types.ObjectId.isValid(id)) notFound();

  await connectDB();

  // Must be a current member to view
  const ownMembership = await Membership.findOne({
    groupId: id,
    userId: session.userId,
    leftAt: null,
  }).lean();
  if (!ownMembership) notFound();

  const group = await Group.findById(id).lean();
  if (!group) notFound();

  const memberships = await Membership.find({ groupId: id, leftAt: null }).lean();
  const memberUserIds = memberships.map((m) => m.userId);
  const members = await User.find({ _id: { $in: memberUserIds } })
    .select({ email: 1, name: 1 })
    .lean();

  return (
    <main className="min-h-dvh flex flex-col px-5 pt-6 pb-12 sm:px-12">
      <header className="flex items-center justify-between max-w-md w-full mx-auto mb-8">
        <Link href="/groups" className="flex items-center gap-2 text-sm text-ink/65 hover:text-ink">
          ← All groups
        </Link>
        <span className="text-xs text-ink/45">{session.email}</span>
      </header>

      <section className="max-w-md w-full mx-auto flex flex-col gap-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">{group.name}</h1>
          <p className="text-sm text-ink/55">
            {members.length} {members.length === 1 ? "member" : "members"}
            {group.isTrip ? " · trip" : ""} · base currency {group.baseCurrency}
          </p>
        </div>

        <section className="bg-card border border-hairline rounded-2xl p-6 flex flex-col gap-3">
          <h2 className="text-xs uppercase tracking-wide text-ink/55">Your balance</h2>
          <div className="amount text-3xl font-semibold tabular text-ink/30">
            ₹0
          </div>
          <p className="text-xs text-ink/45">
            No expenses yet — add one to start the ledger.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xs uppercase tracking-wide text-ink/55">Members</h2>
          <ul className="flex flex-col gap-1.5">
            {members.map((m) => (
              <li
                key={String(m._id)}
                className="text-sm py-1.5 px-3 rounded-lg bg-card border border-hairline"
              >
                {m.name ?? m.email}
                {String(m._id) === session.userId && (
                  <span className="text-xs text-ink/45 ml-2">· you</span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-card border border-dashed border-hairline rounded-2xl p-6 text-center">
          <p className="text-sm text-ink/55">
            Expense entry and settle-up land here next.
          </p>
        </section>
      </section>
    </main>
  );
}
