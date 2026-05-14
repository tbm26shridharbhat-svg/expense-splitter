"use client";

import { useActionState, useState } from "react";
import { addGoalAction } from "./actions";
import { motion, AnimatePresence } from "framer-motion";

export function AddGoalForm({ groupId }: { groupId: string }) {
  const [_, formAction, isPending] = useActionState(addGoalAction.bind(null, groupId), {});
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      {!isOpen ? (
        <button 
          onClick={() => setIsOpen(true)}
          className="text-sm font-semibold text-accent hover:text-accent/80 transition"
        >
          + Add a Savings Goal
        </button>
      ) : (
        <motion.form 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          action={async (fd) => {
            await formAction(fd);
            setIsOpen(false);
          }} 
          className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col gap-4"
        >
          <h3 className="font-bold text-ink">New Savings Goal</h3>
          <div className="flex flex-col gap-2">
             <input name="description" placeholder="e.g., Goa Trip" required className="w-full h-12 px-4 rounded-xl border border-hairline focus:border-accent outline-none" />
             <input name="targetAmount" type="number" placeholder="Target Amount (₹)" required className="w-full h-12 px-4 rounded-xl border border-hairline focus:border-accent outline-none" />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setIsOpen(false)} className="flex-1 h-12 rounded-xl border font-bold text-sm">Cancel</button>
            <button type="submit" disabled={isPending} className="flex-1 h-12 bg-accent text-white rounded-xl font-bold text-sm hover:opacity-90">
              Create Goal
            </button>
          </div>
        </motion.form>
      )}
    </div>
  );
}
