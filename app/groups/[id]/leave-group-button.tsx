"use client";

import { useTransition } from "react";
import { leaveGroupAction } from "./leave-actions";

export function LeaveGroupButton({ groupId }: { groupId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => leaveGroupAction(groupId))}
      disabled={isPending}
      className="px-4 py-2 text-xs font-bold text-debt bg-debt/10 rounded-full hover:bg-debt/20 transition"
    >
      Leave group
    </button>
  );
}
