/**
 * /groups/[id]/expenses/new — add an expense.
 */
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Types } from "mongoose";
import { randomUUID } from "node:crypto";
import { requireSession } from "@/lib/auth/require-auth";
import { connectDB, Group, Membership, User } from "@/lib/db";
import { addExpenseAction } from "./actions";
import { ExpenseForm } from "./expense-form";

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

  if (members.length < 2) {
    redirect(`/groups/${id}?reason=invite-first`);
  }

  const clientEventId = randomUUID();
  const submit = addExpenseAction.bind(null, id);

  const serializedMembers = members.map(m => ({
    _id: String(m._id),
    name: m.name,
    email: m.email,
  }));

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

      <ExpenseForm
        groupId={id}
        members={serializedMembers}
        baseCurrency={group.baseCurrency}
        currentUserId={session.userId}
        clientEventId={clientEventId}
        submitAction={submit}
      />
    </main>
  );
}
