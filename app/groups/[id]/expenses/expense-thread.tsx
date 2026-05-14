"use client";

import { useActionState, useRef, useTransition } from "react";
import { addCommentAction } from "./comment-actions";
import { voidExpenseAction } from "./void-actions";

interface Comment {
  text: string;
  createdAt: string;
  actorUserId: string;
}

interface ExpenseThreadProps {
  groupId: string;
  expenseId: string;
  comments: Comment[];
  userMap: Map<string, string>;
}

export function ExpenseThread({ groupId, expenseId, comments, userMap }: ExpenseThreadProps) {
  const [_, formAction, isPending] = useActionState(addCommentAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [isVoidPending, startVoidTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3 mt-3 pt-3 border-t border-hairline">
      <button
        onClick={() => startVoidTransition(() => voidExpenseAction(groupId, expenseId))}
        disabled={isVoidPending}
        className="text-xs text-debt"
      >
        Void Expense
      </button>
      <ul className="flex flex-col gap-2">
        {comments.map((c: Comment, i: number) => (
          <li key={i} className="text-xs text-ink/70">
            <span className="font-semibold">{userMap.get(c.actorUserId)}</span>: {c.text}
          </li>
        ))}
      </ul>
      <form
        ref={formRef}
        action={async (fd) => {
          await formAction(fd);
          formRef.current?.reset();
        }}
        className="flex gap-2"
      >
        <input type="hidden" name="groupId" value={groupId} />
        <input type="hidden" name="expenseId" value={expenseId} />
        <input
          name="text"
          placeholder="Add a comment..."
          className="flex-1 h-9 px-3 rounded-lg bg-card border border-hairline text-sm outline-none focus:border-accent"
          required
        />
        <button
          type="submit"
          disabled={isPending}
          className="px-3 h-9 rounded-lg bg-accent text-white text-xs font-medium disabled:opacity-50"
        >
          Post
        </button>
      </form>
    </div>
  );
}
