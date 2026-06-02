import { Skeleton } from "@/components/ui/skeleton";

export default function MangaDetailSkeleton() {
  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white pb-24">
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0d1117]/80 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex gap-4 items-center">
              <Skeleton className="w-10 h-10 rounded-full" />
              <Skeleton className="hidden sm:block w-32 h-6" />
            </div>
            <Skeleton className="sm:hidden w-32 h-6" />
            <Skeleton className="w-10 h-10 rounded-full" />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid lg:grid-cols-[auto,1fr] gap-6 lg:gap-8 mb-6">
          <div className="flex justify-center lg:justify-start">
            <Skeleton className="w-48 sm:w-64 aspect-[0.7] rounded-2xl" />
          </div>

          <div className="space-y-4">
            <div>
              <Skeleton className="h-12 sm:h-16 w-full mb-3" />
              <Skeleton className="h-12 sm:h-16 w-3/4 mb-4" />
              
              <div className="flex flex-wrap gap-2 mb-4">
                <Skeleton className="h-8 w-24 rounded-full" />
                <Skeleton className="h-8 w-20 rounded-full" />
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                <Skeleton className="h-7 w-20 rounded-full" />
                <Skeleton className="h-7 w-24 rounded-full" />
                <Skeleton className="h-7 w-20 rounded-full" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="text-center space-y-2">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-4 w-3/4 mx-auto" />
                  </div>
                ))}
              </div>

              <Skeleton className="h-5 w-48 mt-4" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white/5 border border-white/10 p-1 rounded-xl">
            <div className="grid grid-cols-3 gap-1">
              <Skeleton className="h-10 rounded-lg" />
              <Skeleton className="h-10 rounded-lg" />
              <Skeleton className="h-10 rounded-lg" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-9 w-32 rounded-lg" />
            </div>

            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-4">
                    <Skeleton className="hidden sm:block w-16 h-16 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="w-10 h-10 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-[#0d1117] via-[#0d1117]/95 to-transparent pt-4 pb-safe">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-2 sm:gap-3">
            <Skeleton className="flex-1 h-12 sm:h-14 rounded-xl" />
            <Skeleton className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl" />
            <Skeleton className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl" />
            <Skeleton className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl" />
          </div>
        </div>
      </div>

      <div className="fixed inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />
    </div>
  );
}
