import { Skeleton } from "@/components/ui/skeleton";

export default function PinnedCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Desktop/Tablet Layout */}
      <div className="hidden sm:block relative w-full h-56 sm:h-64 lg:h-72">
        <Skeleton className="w-full h-full rounded-lg" />
        
        {/* Pinned badge skeleton */}
        <div className="absolute top-3 left-3 z-10">
          <Skeleton className="w-20 h-6 rounded-full" />
        </div>

        {/* Title and description skeleton */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm p-4 z-10">
          <Skeleton className="h-5 w-3/4 mb-2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6 mt-1" />
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="sm:hidden flex rounded-lg overflow-hidden mx-2">
        {/* Image skeleton */}
        <div className="relative w-28 flex-shrink-0">
          <Skeleton className="w-full h-full aspect-[3/4] rounded-none" />
        </div>

        {/* Content skeleton */}
        <div className="flex-1 p-3 flex flex-col justify-center min-w-0 bg-black/50 backdrop-blur-sm">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="w-10 h-4 rounded-full flex-shrink-0" />
          </div>
          <Skeleton className="h-3 w-full mt-1" />
          <Skeleton className="h-3 w-3/4 mt-1" />
        </div>
      </div>

      {/* Shimmer effect overlay */}
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />
    </div>
  );
}
