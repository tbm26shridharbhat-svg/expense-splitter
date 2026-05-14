"use client";

import { useActionState, useState, useEffect } from "react";
import { settleUpAction } from "./actions";
import { getDebtAction } from "./debt-actions";
import Link from "next/link";

interface Member {
  _id: string;
  name?: string | null;
  email: string;
}

export function SettleUpForm({ groupId, members, currentUserId }: { groupId: string, members: Member[], currentUserId: string }) {
  const [_, formAction, isPending] = useActionState(settleUpAction.bind(null, groupId), {});
  const [fromUser, setFromUser] = useState(currentUserId);
  const [toUser, setToUser] = useState(members.find(m => m._id !== currentUserId)?._id ?? members[0]?._id);
  const [debt, setDebt] = useState<number>(0);
  const [mode, setMode] = useState<"full" | "custom">("full");
  const [amount, setAmount] = useState<number>(0);

  useEffect(() => {
    getDebtAction(groupId, fromUser, toUser).then(setDebt);
  }, [groupId, fromUser, toUser]);

  useEffect(() => {
    if (mode === "full") setAmount(debt);
  }, [mode, debt]);

  return (
    <main className="min-h-screen bg-paper p-6">
      <form action={formAction} className="max-w-md mx-auto bg-white p-8 rounded-3xl border shadow-sm flex flex-col gap-6">
        <h3 className="text-2xl font-extrabold text-ink tracking-tight">Settle Up</h3>
        
        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase tracking-widest text-ink/40 font-bold">Paying (From)</label>
          <select name="fromUserId" value={fromUser} onChange={e => setFromUser(e.target.value)} className="h-14 px-4 rounded-xl border border-hairline bg-paper text-sm font-medium">
            {members.map(m => <option key={m._id} value={m._id}>{m.name || "Member"}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase tracking-widest text-ink/40 font-bold">To</label>
          <select name="toUserId" value={toUser} onChange={e => setToUser(e.target.value)} className="h-14 px-4 rounded-xl border border-hairline bg-paper text-sm font-medium">
            {members.map(m => <option key={m._id} value={m._id}>{m.name || "Member"}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-3 p-4 bg-paper rounded-xl border">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="radio" checked={mode === "full"} onChange={() => setMode("full")} className="accent-accent" />
            Settle Full Debt (₹{debt.toFixed(0)})
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="radio" checked={mode === "custom"} onChange={() => setMode("custom")} className="accent-accent" />
            Custom Amount
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase tracking-widest text-ink/40 font-bold">Amount (₹)</label>
          <input 
            name="amount" 
            type="number" 
            step="0.01" 
            required 
            value={amount}
            onChange={e => setAmount(Number(e.target.value))}
            readOnly={mode === "full"}
            className="h-14 px-4 rounded-xl border border-hairline bg-paper text-xl font-bold tabular-nums focus:border-accent outline-none disabled:bg-paper" 
          />
        </div>

        <div className="flex flex-col gap-3 mt-4">
          <button type="submit" disabled={isPending} className="h-14 bg-accent text-white rounded-2xl font-bold text-sm hover:opacity-90 shadow-md">
            Record Settlement
          </button>
          <Link href={`/groups/${groupId}`} className="h-14 rounded-2xl border border-hairline font-bold text-sm flex items-center justify-center hover:bg-paper">
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
