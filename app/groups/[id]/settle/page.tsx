import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { requireSession } from "@/lib/auth/require-auth";
import { connectDB, Membership, User } from "@/lib/db";
import { SettleUpForm } from "./settle-up-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SettleUpPage({ params }: PageProps) {
  const session = await requireSession();
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) notFound();

  await connectDB();
  const memberships = await Membership.find({ groupId: id, leftAt: null }).lean();
  const memberUserIds = memberships.map((m) => m.userId);
  const members = await User.find({ _id: { $in: memberUserIds } })
    .select({ email: 1, name: 1 })
    .lean();

  return (
    <main className="p-6">
      <SettleUpForm groupId={id} members={members.map(m => ({ _id: String(m._id), name: m.name, email: m.email }))} currentUserId={session.userId} />
    </main>
  );
}
