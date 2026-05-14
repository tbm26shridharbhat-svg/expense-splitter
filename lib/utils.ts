/** Lightweight class-merging helper. */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a paise/cent integer or a decimal string as a currency display.
 * We store currency amounts as `numeric(12,2)` (rupees, decimal) — this helper
 * just produces the user-facing string. Tabular-num friendly.
 */
export function formatAmount(value: number | string, currency = "INR"): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  const rounded = Math.round(num);
  if (currency === "INR") return `₹${rounded.toLocaleString("en-IN")}`;
  return `${currency} ${rounded.toLocaleString("en-US")}`;
}
