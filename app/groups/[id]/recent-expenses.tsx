"use client";

import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { formatAmount } from "@/lib/utils";
import { ExpenseThread } from "./expenses/expense-thread";
import { useState } from "react";
import { fetchMoreExpensesAction } from "./fetch-more-actions";

interface RecentExpensesProps {
  initialExpenses: any[];
  userIdToName: Record<string, string>;
  groupId: string;
  commentsByExpense: Record<string, any[]>;
}

export function RecentExpenses({ initialExpenses, userIdToName, groupId, commentsByExpense }: RecentExpensesProps) {
  const [expenses, setExpenses] = useState(initialExpenses);
  const [skip, setSkip] = useState(initialExpenses.length);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialExpenses.length >= 5);
  const userMap = new Map(Object.entries(userIdToName));
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadMore = async () => {
    setLoading(true);
    const newExpenses = await fetchMoreExpensesAction(groupId, skip);
    setExpenses([...expenses, ...newExpenses]);
    setSkip(skip + newExpenses.length);
    setHasMore(newExpenses.length === 5);
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <motion.ul 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3"
      >
        {expenses.map((e) => {
          const p = e.payload as {
            expenseId: string;
            description: string;
            totalAmount: number;
            currency: string;
            paidByUserId: string;
            splits: { userId: string; amount: number }[];
          };
          const payerName = userMap.get(p.paidByUserId) ?? "unknown";
          const isExpanded = expandedId === p.expenseId;

          return (
            <li
              key={String(e._id)}
              className="bg-white border border-hairline rounded-2xl p-4 shadow-sm cursor-pointer hover:border-accent/30 transition"
              onClick={() => setExpandedId(isExpanded ? null : p.expenseId)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-semibold text-ink truncate">{p.description}</span>
                  <span className="text-xs text-ink/50">
                    {payerName} · {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <span className="amount text-sm font-bold text-ink tabular whitespace-nowrap">
                  {formatAmount(p.totalAmount, p.currency)}
                </span>
              </div>
              
              {isExpanded && (
                <ExpenseThread
                  groupId={groupId}
                  expenseId={p.expenseId}
                  comments={commentsByExpense[p.expenseId] ?? []}
                  userMap={userMap}
                />
              )}
            </li>
          );
        })}
      </motion.ul>
      
      {hasMore && (
        <button 
          onClick={loadMore} 
          disabled={loading}
          className="text-sm text-accent font-medium p-2"
        >
          {loading ? "Loading..." : "Load more"}
        </button>
      )}
    </div>
  );
}
