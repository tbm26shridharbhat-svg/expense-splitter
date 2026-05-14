"use client";

import { exportCsvAction } from "./actions";

export function ExportCsvButton({ groupId }: { groupId: string }) {
  const download = async () => {
    const csv = await exportCsvAction(groupId);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `group-${groupId}-activity.csv`;
    a.click();
  };

  return (
    <button onClick={download} className="px-4 py-2 text-xs font-bold text-ink bg-ink/5 rounded-full hover:bg-ink/10 transition">
      Export CSV
    </button>
  );
}
