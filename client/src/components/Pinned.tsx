import { useState, useEffect, memo, useCallback } from "react";
import { Pin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import PinnedCardSkeleton from "@/components/ui/PinnedCardSkeleton";

interface PinnedItem {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  rating?: number;
  status: string;
  genres?: string[];
  updatedAt?: string;
}

export default function Pinned() {
  const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [, navigate] = useLocation();

  useEffect(() => {
    const fetchPinnedSeries = async () => {
      try {
        const response = await fetch('/api/sections/pinned');
        if (response.ok) {
          const data = await response.json();
          setPinnedItems(data);
        }
      } catch (error) {
        // Error fetching pinned series - fail silently and show empty state
      } finally {
        setLoading(false);
      }
    };

    fetchPinnedSeries();
  }, []);

  if (loading) {
    return (
      <section className="py-6 sm:py-8 w-full">
        <div className="max-w-none mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 sm:gap-4 mb-10 sm:mb-8 lg:mb-10">
            <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-[#f2a1f2] via-[#f2a1f2] to-[#a195f9] rounded-lg flex items-center justify-center shadow-lg shadow-[#f2a1f2]/30">
              <Pin className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-white" />
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-white">
              <span className="bg-gradient-to-r from-[#f2a1f2] to-[#f2a1f2] bg-clip-text text-transparent">Pinned</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full">
            {[...Array(6)].map((_, i) => (
              <PinnedCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-6 sm:py-8 w-full">
      <div className="max-w-none mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 sm:gap-4 mb-10 sm:mb-8 lg:mb-10">
          <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-[#f2a1f2] via-[#f2a1f2] to-[#a195f9] rounded-lg flex items-center justify-center shadow-lg shadow-[#f2a1f2]/30 transition-transform duration-300 ease-out hover:scale-105 transform-gpu">
            <Pin className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-white" />
          </div>
          <h2 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-white">
            <span className="bg-gradient-to-r from-[#f2a1f2] to-[#f2a1f2] bg-clip-text text-transparent">Pinned</span>
          </h2>
        </div>

        {pinnedItems.length === 0 ? (
          <div className="text-center py-8 bg-muted/30 rounded-lg">
            <p className="text-muted-foreground">
              No pinned series yet. Use the admin panel to pin series to this section.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full">
            {pinnedItems.slice(0, 6).map((item) => (
              <PinnedCard 
                key={item.id}
                item={item}
                navigate={navigate}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

const PinnedCard = memo(function PinnedCard({ item, navigate }: { 
  item: PinnedItem; 
  navigate: (path: string) => void;
}) {
  const handleClick = useCallback(() => {
    navigate(`/manga/${item.id}`);
  }, [navigate, item.id]);

  return (
    <div
      className="group relative overflow-visible rounded-lg cursor-pointer transition-all duration-300 ease-out hover:shadow-[0_20px_60px_-15px_rgba(161,149,249,0.5)] hover:-translate-y-2 hover:scale-[1.02] will-change-transform transform-gpu"
      onClick={handleClick}
      data-testid={`pinned-item-${item.id}`}
    >
      {/* Glowing ring effect on hover */}
      <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 ease-out pointer-events-none z-30 ring-2 ring-[#a195f9]/60 shadow-[0_0_20px_rgba(161,149,249,0.4)]"></div>
      
      {/* Premium sparkle/shine effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out pointer-events-none z-20 overflow-hidden rounded-lg">
        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent group-hover:animate-shimmer w-[200%] transform-gpu"></div>
      </div>

      {/* Desktop/Tablet Layout - Full width image with overlay text */}
      <div className="hidden sm:block relative w-full h-56 sm:h-64 lg:h-72 rounded-lg overflow-hidden">
        {/* Image */}
        {item.coverImageUrl ? (
          <img
            src={item.coverImageUrl}
            alt={item.title}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.1] transform-gpu"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = '/api/covers/placeholder';
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#a195f9]/30 to-[#707ff5]/20 flex items-center justify-center">
            <span className="text-muted-foreground text-sm font-medium">No cover</span>
          </div>
        )}

        {/* Pinned badge - top left */}
        <div className="absolute top-3 left-3 z-10 transition-transform duration-300 ease-out group-hover:scale-110 transform-gpu">
          <Badge className="bg-gradient-to-r from-[#a195f9] to-[#707ff5] text-white text-xs px-3 py-1 rounded-full font-semibold shadow-lg border-0">
            <Pin className="w-3 h-3 mr-1 inline" />
            Pinned
          </Badge>
        </div>

        {/* Title and description - bottom overlay with black transparent background */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm p-4 z-10 transition-all duration-300 ease-out group-hover:bg-black/80">
          <h3 className="text-white font-bold text-base sm:text-lg mb-1.5 line-clamp-2 sm:line-clamp-1 leading-tight transition-colors duration-300 ease-out group-hover:text-[#a195f9]">
            {item.title}
          </h3>
          <p className="text-white/90 text-xs sm:text-sm line-clamp-3 leading-relaxed">
            {item.description || 'No description available'}
          </p>
        </div>
      </div>

      {/* Mobile Layout - Horizontal card without background */}
      <div className="sm:hidden flex rounded-lg overflow-hidden mx-2">
        {/* Image - left side */}
        <div className="relative w-28 flex-shrink-0">
          {item.coverImageUrl ? (
            <img
              src={item.coverImageUrl}
              alt={item.title}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-110 transform-gpu"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = '/api/covers/placeholder';
              }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#a195f9]/30 to-[#707ff5]/20 flex items-center justify-center">
              <span className="text-muted-foreground text-xs">No cover</span>
            </div>
          )}
        </div>

        {/* Content - right side */}
        <div className="flex-1 p-3 flex flex-col justify-center min-w-0 bg-black/50 backdrop-blur-sm transition-all duration-300 ease-out group-hover:bg-black/60">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3 className="text-white font-bold text-sm line-clamp-2 leading-tight flex-1 transition-colors duration-300 ease-out group-hover:text-[#a195f9]">
              {item.title}
            </h3>
            <Badge className="bg-gradient-to-r from-[#a195f9] to-[#707ff5] text-white text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0">
              <Pin className="w-2.5 h-2.5 inline" />
            </Badge>
          </div>
          <p className="text-white/80 text-xs line-clamp-2 leading-relaxed">
            {item.description || 'No description available'}
          </p>
        </div>
      </div>
    </div>
  );
});
