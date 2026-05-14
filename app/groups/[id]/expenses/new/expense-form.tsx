"use client";

import { useState } from "react";
import Link from "next/link";
import { SplitSelector } from "./split-selector";

interface Member {
  _id: string;
  name?: string | null;
  email: string;
}

interface ExpenseFormProps {
  groupId: string;
  members: Member[];
  baseCurrency: string;
  currentUserId: string;
  clientEventId: string;
  submitAction: (formData: FormData) => Promise<void>;
}

export function ExpenseForm({
  groupId,
  members,
  baseCurrency,
  currentUserId,
  clientEventId,
  submitAction,
}: ExpenseFormProps) {
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState("");

  return (
    <form action={submitAction} className="max-w-md w-full mx-auto flex flex-col gap-6">
      <input type="hidden" name="clientEventId" value={clientEventId} />

      <h1 className="text-2xl font-semibold tracking-tight">Add expense</h1>

      <label className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wide text-ink/55 font-medium">Description</span>
        <input
          name="description"
          type="text"
          required
          autoFocus
          maxLength={200}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Dinner at Toit · cab back · groceries"
          className="h-12 px-4 rounded-xl bg-card border border-hairline
                     focus:border-accent focus:ring-2 focus:ring-accent/20
                     outline-none transition text-base"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wide text-ink/55 font-medium">
          Amount ({baseCurrency})
        </span>
        <input
          name="amount"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          required
          value={amount || ""}
          onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
          placeholder="0.00"
          className="h-14 px-4 rounded-xl bg-card border border-hairline
                     focus:border-accent focus:ring-2 focus:ring-accent/20
                     outline-none transition tabular text-3xl font-semibold"
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs uppercase tracking-wide text-ink/55 mb-1 font-medium">Paid by</legend>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <label
              key={String(m._id)}
              className="flex items-center gap-2 py-2 px-3 rounded-xl bg-card border border-hairline cursor-pointer hover:border-accent/40 has-[:checked]:border-accent has-[:checked]:bg-accent/5 transition"
            >
              <input
                type="radio"
                name="paidByUserId"
                value={String(m._id)}
                defaultChecked={String(m._id) === currentUserId}
                className="accent-accent"
              />
              <span className="text-sm font-medium">
                {m.name ?? m.email.split("@")[0]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <SplitSelector
        members={members}
        totalAmount={amount}
        currency={baseCurrency}
        currentUserId={currentUserId}
      />

      <div className="flex flex-col gap-3 pt-2">
        <button
          type="submit"
          className="h-14 rounded-2xl bg-accent text-white font-medium text-base
                     active:scale-[0.99] transition-transform shadow-sm hover:bg-accent/90"
        >
          Save expense
        </button>

        <Link
          href={`/groups/${groupId}`}
          className="text-center text-sm text-ink/55 hover:text-ink py-2"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
