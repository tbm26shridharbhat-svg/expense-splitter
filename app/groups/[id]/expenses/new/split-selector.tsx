"use client";

import { useState, useEffect } from "react";

interface Member {
  _id: string;
  name?: string | null;
  email: string;
}

interface SplitSelectorProps {
  members: Member[];
  totalAmount: number;
  currency: string;
  currentUserId: string;
}

export function SplitSelector({ members, totalAmount, currency, currentUserId }: SplitSelectorProps) {
  const [mode, setMode] = useState<"equal" | "uneven">("equal");
  const [shares, setShares] = useState<Record<string, string>>({});
  const [enabledMembers, setEnabledMembers] = useState<Record<string, boolean>>(
    Object.fromEntries(members.map(m => [m._id, true]))
  );

  // Initialize shares when mode or totalAmount changes
  useEffect(() => {
    if (mode === "equal") {
      const activeCount = Object.values(enabledMembers).filter(Boolean).length;
      if (activeCount > 0) {
        const share = (totalAmount / activeCount).toFixed(2);
        const newShares: Record<string, string> = {};
        let sum = 0;
        const activeMembers = members.filter(m => enabledMembers[m._id]);
        
        activeMembers.forEach((m, i) => {
          if (i === activeMembers.length - 1) {
            newShares[m._id] = (totalAmount - sum).toFixed(2);
          } else {
            newShares[m._id] = share;
            sum += parseFloat(share);
          }
        });
        setShares(newShares);
      }
    }
  }, [mode, totalAmount, enabledMembers, members]);

  const toggleMember = (id: string) => {
    setEnabledMembers(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const updateShare = (id: string, value: string) => {
    setShares(prev => ({ ...prev, [id]: value }));
  };

  const totalSplit = Object.entries(shares)
    .filter(([id]) => enabledMembers[id])
    .reduce((sum, [_, val]) => sum + (parseFloat(val) || 0), 0);
  
  const diff = Math.round((totalAmount - totalSplit) * 100) / 100;

  return (
    <fieldset className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <legend className="text-xs uppercase tracking-wide text-ink/55 font-medium">Split</legend>
        <div className="flex bg-card border border-hairline rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setMode("equal")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition ${
              mode === "equal" ? "bg-accent text-white shadow-sm" : "text-ink/65 hover:text-ink"
            }`}
          >
            Equally
          </button>
          <button
            type="button"
            onClick={() => setMode("uneven")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition ${
              mode === "uneven" ? "bg-accent text-white shadow-sm" : "text-ink/65 hover:text-ink"
            }`}
          >
            Unevenly
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {members.map((m) => (
          <div
            key={m._id}
            className={`flex items-center gap-3 p-3 rounded-xl border transition ${
              enabledMembers[m._id] 
                ? "bg-card border-hairline" 
                : "bg-ink/5 border-transparent opacity-60"
            }`}
          >
            <input
              type="checkbox"
              checked={enabledMembers[m._id]}
              onChange={() => toggleMember(m._id)}
              className="size-5 accent-accent cursor-pointer"
            />
            
            <div className="flex-1 min-w-0" onClick={() => !enabledMembers[m._id] && toggleMember(m._id)}>
              <p className="text-sm font-medium truncate">{m.name ?? m.email}</p>
              {m._id === currentUserId && <p className="text-[10px] text-accent font-medium uppercase">You</p>}
            </div>

            {enabledMembers[m._id] && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink/45">{currency}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={shares[m._id] || ""}
                  onChange={(e) => updateShare(m._id, e.target.value)}
                  disabled={mode === "equal"}
                  className={`w-24 h-9 px-2 rounded-lg bg-white border border-hairline text-right text-sm font-semibold tabular-nums outline-none focus:border-accent transition ${
                    mode === "equal" ? "opacity-80" : "focus:ring-2 focus:ring-accent/10"
                  }`}
                />
              </div>
            )}
            
            <input 
              type="hidden" 
              name="splitUserIds" 
              value={enabledMembers[m._id] ? m._id : ""} 
              disabled={!enabledMembers[m._id]}
            />
            <input 
              type="hidden" 
              name={`splitAmount_${m._id}`} 
              value={shares[m._id] || "0"} 
              disabled={!enabledMembers[m._id]}
            />
          </div>
        ))}
      </div>

      {mode === "uneven" && diff !== 0 && (
        <p className={`text-xs font-medium text-center ${diff > 0 ? "text-accent" : "text-debt"}`}>
          {diff > 0 ? `Remaining: ${currency} ${diff.toFixed(2)}` : `Over by: ${currency} ${Math.abs(diff).toFixed(2)}`}
        </p>
      )}
      
      {mode === "uneven" && diff === 0 && (
        <p className="text-xs text-green-600 font-medium text-center">
          ✓ Split is exact
        </p>
      )}
    </fieldset>
  );
}
