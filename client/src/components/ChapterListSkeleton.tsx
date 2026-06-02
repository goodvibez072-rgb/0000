import { Skeleton } from "@/components/ui/skeleton";

export function ChapterListSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700"
        >
          <div className="flex items-center gap-4 flex-1">
            <Skeleton className="h-16 w-16 rounded" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
            </div>
          </div>
          <Skeleton className="h-9 w-20" />
        </div>
      ))}
    </div>
  );
}
