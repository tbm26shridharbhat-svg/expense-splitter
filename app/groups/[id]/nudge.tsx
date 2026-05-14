export function SettleUpNudge({ amount }: { amount: number }) {
  return (
    <div className="bg-debt/5 border border-debt/10 rounded-2xl p-4 flex items-center justify-between">
      <p className="text-sm text-debt">
        You owe a total of <strong>₹{amount.toFixed(0)}</strong>. Time to settle up?
      </p>
    </div>
  );
}
