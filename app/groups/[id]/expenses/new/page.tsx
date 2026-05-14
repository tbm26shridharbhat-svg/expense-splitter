/**
 * /groups/[id]/expenses/new — add an expense.
 *
 * Equal split (Tier 1). Custom amounts can be a tomorrow refinement.
 *
 * UX: amounts use input mode="decimal" so mobile gets the number pad.
 * The "Paid by" defaults to the current user (most common case).
 * "Split with" defaults to everyone (the other common case).
 */
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Types } from "mongoose";
import { randomUUID } from "node:crypto";
import { requireSession } from "@/lib/auth/require-auth";
import { connectDB, Group, Membership, User } from "@/lib/db";
import { addExpenseAction } from "./actions";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function NewExpensePage({ params }: PageProps) {
  const session = await requireSession();
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) notFound();

  await connectDB();
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

  // Disallow expenses in a solo group — needs at least one other person to be meaningful
  if (members.length < 2) {
    redirect(`/groups/${id}?reason=invite-first`);
  }

  // Stable UUID for this form render — submission's idempotency key
  const clientEventId = randomUUID();

  // Bind the groupId to the server action
  const submit = addExpenseAction.bind(null, id);

  return (
    <main className="min-h-dvh flex flex-col px-5 pt-6 pb-12 sm:px-12">
      <header className="flex items-center justify-between max-w-md w-full mx-auto mb-6">
        <Link
          href={`/groups/${id}`}
          className="flex items-center gap-2 text-sm text-ink/65 hover:text-ink"
        >
          ← {group.name}
        </Link>
      </header>

      <form action={submit} className="max-w-md w-full mx-auto flex flex-col gap-6">
        <input type="hidden" name="clientEventId" value={clientEventId} />

        <h1 className="text-2xl font-semibold tracking-tight">Add expense</h1>

        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-ink/55">Description</span>
          <input
            name="description"
            type="text"
            required
            autoFocus
            maxLength={200}
            placeholder="Dinner at Toit · cab back · groceries"
            className="h-12 px-4 rounded-xl bg-card border border-hairline
                       focus:border-accent focus:ring-2 focus:ring-accent/20
                       outline-none transition text-base"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-ink/55">
            Amount ({group.baseCurrency})
          </span>
          <input
            name="amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            required
            placeholder="0.00"
            className="h-14 px-4 rounded-xl bg-card border border-hairline
                       focus:border-accent focus:ring-2 focus:ring-accent/20
                       outline-none transition tabular text-3xl font-semibold"
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs uppercase tracking-wide text-ink/55 mb-1">Paid by</legend>
          <div className="flex flex-col gap-1.5">
            {members.map((m) => (
              <label
                key={String(m._id)}
                className="flex items-center gap-3 py-2 px-3 rounded-lg bg-card border border-hairline cursor-pointer hover:border-accent/40"
              >
                <input
                  type="radio"
                  name="paidByUserId"
                  value={String(m._id)}
                  defaultChecked={String(m._id) === session.userId}
                  className="accent-accent"
                />
                <span className="text-sm">
                  {m.name ?? m.email}
                  {String(m._id) === session.userId && (
                    <span className="text-xs text-ink/45 ml-2">· you</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs uppercase tracking-wide text-ink/55 mb-1">
            Split equally among
          </legend>
          <div className="flex flex-col gap-1.5">
            {members.map((m) => (
              <label
                key={String(m._id)}
                className="flex items-center gap-3 py-2 px-3 rounded-lg bg-card border border-hairline cursor-pointer hover:border-accent/40"
              >
                <input
                  type="checkbox"
                  name="splitUserIds"
                  value={String(m._id)}
                  defaultChecked
                  className="size-4 accent-accent"
                />
                <span className="text-sm">
                  {m.name ?? m.email}
                  {String(m._id) === session.userId && (
                    <span className="text-xs text-ink/45 ml-2">· you</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="submit"
          className="h-14 rounded-2xl bg-accent text-white font-medium text-base
                     active:scale-[0.99] transition-transform shadow-sm hover:bg-accent/90"
        >
          Save expense
        </button>

        <Link
          href={`/groups/${id}`}
          className="text-center text-sm text-ink/55 hover:text-ink"
        >
          Cancel
        </Link>
      </form>
    </main>
  );
}
