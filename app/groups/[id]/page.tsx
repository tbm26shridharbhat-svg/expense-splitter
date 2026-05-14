/**
 * /groups/[id] — group detail.
 */
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { Types } from "mongoose";
import { requireSession } from "@/lib/auth/require-auth";
import { connectDB, Group, Membership, User, BalanceView, Event } from "@/lib/db";
import { InviteSection } from "./invite-section";
import { formatAmount } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ExpenseThread } from "./expenses/expense-thread";
import { getSettleUpNudge } from "@/lib/events/nudge";
import { SettleUpNudge } from "./nudge";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function GroupDetailPage({ params }: PageProps) {
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

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const inviteUrl = group.shareToken
    ? `${proto}://${host}/join/${group.shareToken}`
    : null;

  const userIdToName = new Map(
    members.map((m) => [String(m._id), m.name ?? m.email]),
  );
  const myBalance = await BalanceView.findOne({
    groupId: id,
    userId: session.userId,
    currency: group.baseCurrency,
  }).lean();
  const balanceAmount = myBalance?.amount ?? 0;
  
  const nudge = await getSettleUpNudge(id);

  const recentExpenses = await Event.find({
    groupId: id,
    type: "expense_added",
  })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  const expenseIds = recentExpenses.map((e) => (e.payload as any).expenseId);
  const comments = await Event.find({
    groupId: id,
    type: "expense_commented",
    "payload.expenseId": { $in: expenseIds },
  })
    .sort({ createdAt: 1 })
    .lean();
  
  const commentsByExpense = new Map<string, any[]>();
  comments.forEach(c => {
    const eid = (c.payload as any).expenseId;
    if (!commentsByExpense.has(eid)) commentsByExpense.set(eid, []);
    commentsByExpense.get(eid)!.push({
      text: (c.payload as any).text,
      createdAt: c.createdAt,
      actorUserId: String(c.actorUserId),
    });
  });

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
          <div
            className={`amount text-3xl font-semibold tabular ${
              balanceAmount > 0.005
                ? "text-success"
                : balanceAmount < -0.005
                ? "text-debt"
                : "text-ink/30"
            }`}
          >
            {balanceAmount > 0.005 && "+"}
            {formatAmount(balanceAmount, group.baseCurrency)}
          </div>
          <p className="text-xs text-ink/55">
            {balanceAmount > 0.005
              ? "Others owe you, in net."
              : balanceAmount < -0.005
              ? "You owe, in net."
              : recentExpenses.length === 0
              ? "No expenses yet — add one to start the ledger."
              : "You're square."}
          </p>
        </section>

        {nudge && nudge.userId === session.userId && (
          <SettleUpNudge amount={nudge.amount} />
        )}

        {recentExpenses.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xs uppercase tracking-wide text-ink/55">Recent</h2>
            <ul className="flex flex-col gap-2">
              {recentExpenses.map((e) => {
                const p = e.payload as {
                  expenseId: string;
                  description: string;
                  totalAmount: number;
                  currency: string;
                  paidByUserId: string;
                  splits: { userId: string; amount: number }[];
                };
                const payerName = userIdToName.get(p.paidByUserId) ?? "unknown";
                return (
                  <li
                    key={String(e._id)}
                    className="bg-card border border-hairline rounded-xl p-4 flex flex-col"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm font-medium truncate">{p.description}</span>
                        <span className="text-xs text-ink/55">
                          {payerName} paid · split {p.splits.length} ways ·{" "}
                          {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <span className="amount text-sm font-medium tabular text-ink/85 whitespace-nowrap">
                        {formatAmount(p.totalAmount, p.currency)}
                      </span>
                    </div>
                    
                    <ExpenseThread
                      groupId={id}
                      expenseId={p.expenseId}
                      comments={commentsByExpense.get(p.expenseId) ?? []}
                      userMap={userIdToName}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        )}

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

        <InviteSection groupId={id} inviteUrl={inviteUrl} />

        <Link
          href={`/groups/${id}/expenses/new`}
          className="h-14 rounded-2xl bg-accent text-white font-medium text-base flex items-center justify-center
                     active:scale-[0.99] transition-transform shadow-sm hover:bg-accent/90"
        >
          Add expense
        </Link>
      </section>
    </main>
  );
}
