export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-ink/5 rounded-xl ${className}`} />;
}
