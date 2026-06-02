import { Skeleton } from "@/components/ui/skeleton";

export default function SeriesCardSkeleton() {
  return (
    <div className="bg-card rounded-xl overflow-hidden border border-border/40 relative">
      <div className="relative w-full" style={{ aspectRatio: '3/4' }}>
        <Skeleton className="w-full h-full rounded-none" />
        
        <div className="absolute top-2 left-2 flex flex-col gap-1.5">
          <Skeleton className="w-16 h-6 rounded-md" />
        </div>
        
        <div className="absolute top-2 right-2">
          <Skeleton className="w-14 h-5 rounded-md" />
        </div>
      </div>
      
      <div className="p-3 space-y-2">
        <div className="space-y-1">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-10" />
        </div>
        
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>

      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />
    </div>
  );
}
