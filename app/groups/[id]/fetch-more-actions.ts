"use server";

import { connectDB, Event } from "@/lib/db";

export async function fetchMoreExpensesAction(groupId: string, skip: number) {
  await connectDB();
  const expenses = await Event.find({ groupId, type: "expense_added" })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(5)
    .lean();
  return JSON.parse(JSON.stringify(expenses));
}
