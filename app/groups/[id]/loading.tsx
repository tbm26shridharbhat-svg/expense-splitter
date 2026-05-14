import { Skeleton } from "@/lib/ui/skeleton";

export default function Loading() {
  return (
    <main className="min-h-dvh bg-paper p-6">
      <div className="max-w-lg mx-auto flex flex-col gap-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </main>
  );
}
