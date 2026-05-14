"use server";

import { requireSession } from "@/lib/auth/require-auth";
import { connectDB, Event } from "@/lib/db";

export async function exportCsvAction(groupId: string): Promise<string> {
  await requireSession();
  await connectDB();

  const events = await Event.find({ groupId }).sort({ createdAt: 1 }).lean();
  
  const headers = ["Date", "Type", "Description", "Amount", "Payer"];
  const rows = events.map(e => {
    const p = e.payload as any;
    return [
      e.createdAt.toISOString(),
      e.type,
      (p.description || "").replace(/,/g, ""),
      p.totalAmount || "",
      p.paidByUserId || ""
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}
