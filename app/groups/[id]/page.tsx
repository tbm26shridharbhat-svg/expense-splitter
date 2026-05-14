/**
 * /groups/[id] — group detail.
 */
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { Types } from "mongoose";
import { requireSession } from "@/lib/auth/require-auth";
import { connectDB, Group, Membership, User, BalanceView, Event, Goal } from "@/lib/db";
import { InviteSection } from "./invite-section";
import { formatAmount } from "@/lib/utils";
import { getSettleUpNudge } from "@/lib/events/nudge";
import { SettleUpNudge } from "./nudge";
import { AddGoalForm } from "./goals/add-goal-form";
import { LeaveGroupButton } from "./leave-group-button";
import { ExportCsvButton } from "./export/export-csv-button";
import { RecentExpenses } from "./recent-expenses";

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
  const host = h.get("host") ?? "localhost:3000";
  const inviteUrl = group.shareToken
    ? `https://${host}/join/${group.shareToken}`
    : null;

  const userIdToName: Record<string, string> = {};
  members.forEach(m => userIdToName[String(m._id)] = m.name ?? m.email);

  // Fetch all balances
  const balances = await BalanceView.find({
    groupId: id,
    currency: group.baseCurrency,
  }).lean();
  
  const myBalance = balances.find(b => String(b.userId) === session.userId);
  const balanceAmount = myBalance?.amount ?? 0;
  
  const nudge = await getSettleUpNudge(id);
  const goals = await Goal.find({ groupId: id }).lean();

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
  
  const commentsByExpense: Record<string, any[]> = {};
  comments.forEach(c => {
    const eid = (c.payload as any).expenseId;
    if (!commentsByExpense[eid]) commentsByExpense[eid] = [];
    commentsByExpense[eid].push({
      text: (c.payload as any).text,
      createdAt: c.createdAt,
      actorUserId: String(c.actorUserId),
    });
  });

  const serializedExpenses = JSON.parse(JSON.stringify(recentExpenses));

  return (
    <main className="min-h-dvh bg-paper pb-24">
      <header className="px-6 py-4 border-b border-hairline flex items-center justify-between">
        <Link href="/groups" className="text-sm font-medium text-ink/60 hover:text-ink">
          ← All groups
        </Link>
      </header>

      <section className="max-w-lg w-full mx-auto px-6 py-6 flex flex-col gap-6">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-bold tracking-tight text-ink">{group.name}</h1>
          <p className="text-sm text-ink/50">
            {members.length} member{members.length === 1 ? "" : "s"} · {group.baseCurrency}
          </p>
        </div>

        {/* Hero Balance */}
        <section className="bg-white rounded-2xl p-6 flex flex-col gap-1 shadow-sm border border-hairline">
          <h2 className="text-[10px] uppercase tracking-widest text-ink/40 font-bold">Total Net Balance</h2>
          <div
            className={`amount text-4xl font-extrabold tabular ${
              balanceAmount > 0.005 ? "text-success" : balanceAmount < -0.005 ? "text-debt" : "text-ink"
            }`}
          >
            {balanceAmount > 0.005 && "+"}
            {formatAmount(balanceAmount, group.baseCurrency)}
          </div>
          <p className="text-xs text-ink/60">
            {balanceAmount > 0.005 ? "You are owed" : balanceAmount < -0.005 ? "You owe" : "You're square"}
          </p>
        </section>

        {/* Individual Balances Breakdown */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-hairline">
          <h2 className="text-xs font-bold text-ink/70 uppercase tracking-wide mb-4">Breakdown</h2>
          <ul className="flex flex-col gap-3">
            {balances.map(b => {
              if (String(b.userId) === session.userId) return null;
              if (Math.abs(b.amount) < 0.005) return null;
              return (
                <li key={String(b.userId)} className="flex justify-between items-center text-sm">
                  <span className="font-medium text-ink">{userIdToName[String(b.userId)]}</span>
                  <span className={`font-bold tabular ${b.amount > 0 ? "text-success" : "text-debt"}`}>
                    {b.amount > 0 ? "owes you " : "you owe "}
                    {formatAmount(Math.abs(b.amount), group.baseCurrency)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {nudge && nudge.userId === session.userId && <SettleUpNudge amount={nudge.amount} />}

        {goals.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-bold text-ink/70 uppercase tracking-wide">Savings Goals</h2>
            {goals.map(g => (
              <div key={String(g._id)} className="bg-white p-4 rounded-xl border shadow-sm">
                <div className="flex justify-between text-xs font-semibold text-ink mb-1">
                  <span>{g.description}</span>
                  <span className="text-ink/50">{Math.round((g.currentAmount / g.targetAmount) * 100)}%</span>
                </div>
                <div className="h-1.5 bg-ink/5 rounded-full overflow-hidden">
                  <div className="h-full bg-accent" style={{ width: `${Math.min(100, (g.currentAmount / g.targetAmount) * 100)}%` }} />
                </div>
              </div>
            ))}
          </section>
        )}
        <AddGoalForm groupId={id} />

        {recentExpenses.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-bold text-ink/70 uppercase tracking-wide">Activity</h2>
            <RecentExpenses 
              initialExpenses={serializedExpenses} 
              userIdToName={userIdToName} 
              groupId={id} 
              commentsByExpense={commentsByExpense} 
            />
          </section>
        )}

        <section className="bg-white p-5 rounded-2xl border shadow-sm">
          <h2 className="text-xs font-bold text-ink/70 uppercase tracking-wide mb-3">Group Settings</h2>
          <div className="flex flex-col gap-3">
            <InviteSection groupId={id} inviteUrl={inviteUrl} />
            <div className="flex gap-4 pt-3 border-t">
              <LeaveGroupButton groupId={id} />
              <ExportCsvButton groupId={id} />
            </div>
          </div>
        </section>
      </section>

      {/* Floating CTA Area */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-paper/90 backdrop-blur-sm border-t">
        <div className="max-w-lg mx-auto flex gap-3">
          <Link href={`/groups/${id}/settle`} className="flex-1 h-12 rounded-xl bg-white border border-hairline font-bold text-sm flex items-center justify-center shadow-sm hover:bg-paper">
            Settle
          </Link>
          <Link href={`/groups/${id}/expenses/new`} className="flex-1 h-12 rounded-xl bg-accent text-white font-bold text-sm flex items-center justify-center shadow-md hover:opacity-90">
            + Add Expense
          </Link>
        </div>
      </div>
    </main>
  );
}
