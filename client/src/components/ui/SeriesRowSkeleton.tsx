import { Skeleton } from "@/components/ui/skeleton";

interface SeriesRowSkeletonProps {
  variant?: 'trending' | 'default';
}

export default function SeriesRowSkeleton({ variant = 'default' }: SeriesRowSkeletonProps) {
  const gradientBg = variant === 'trending' 
    ? 'bg-gradient-to-br from-muted/40 to-muted/20' 
    : 'bg-card';

  return (
    <div className={`flex items-center w-full rounded-xl relative overflow-hidden ${gradientBg}`}>
      {/* Image Skeleton - Left Side */}
      <div className="relative w-[90px] lg:w-[102px] flex-shrink-0">
        <div className="aspect-[3/4] overflow-hidden rounded-l-xl">
          <Skeleton className="w-full h-full rounded-none" />
        </div>
        
        {/* Rank Badge Skeleton (for trending variant) */}
        {variant === 'trending' && (
          <div className="absolute top-2 left-2">
            <Skeleton className="w-8 h-8 lg:w-10 lg:h-10 rounded-full" />
          </div>
        )}
      </div>

      {/* Content Skeleton - Right Side */}
      <div className="flex-1 p-3 lg:p-4 min-w-0">
        {/* Title Skeleton */}
        <div className="mb-3 lg:mb-4">
          <Skeleton className="h-4 lg:h-5 w-full mb-1.5" />
          <Skeleton className="h-4 lg:h-5 w-2/3" />
        </div>

        {/* Genre Badges Skeleton */}
        <div className="flex gap-1.5 flex-wrap">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      </div>

      {/* Shimmer effect overlay */}
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />
    </div>
  );
}
