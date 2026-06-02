import { useState, useEffect, useRef, memo, useCallback } from "react";
import { ChevronRight, Lock, Heart, Bookmark, Flame, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import SeriesCardSkeleton from "@/components/ui/SeriesCardSkeleton";

// Utility function to calculate time ago from timestamp
function getTimeAgo(timestamp: string): string {
  const now = new Date();
  const created = new Date(timestamp);
  const diffMs = now.getTime() - created.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffMs / 604800000);
  const diffMonths = Math.floor(diffMs / 2592000000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  return `${diffMonths}mo ago`;
}

interface ChapterInfo {
  id: string;
  chapterNumber: string;
  title: string | null;
  createdAt: string;
  totalPages: number;
  hasLock?: boolean;
  isNew?: boolean;
}

interface PopularItem {
  id: string;
  title: string;
  coverImageUrl?: string;
  rating?: number;
  status: string;
  genres?: string[];
  updatedAt?: string;
  chapterCount?: number;
  latestChapters?: ChapterInfo[];
}

export default function PopularToday() {
  const [popularItems, setPopularItems] = useState<PopularItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'hot' | 'new'>('hot');
  const [, navigate] = useLocation();

  const fetchPopularSeries = async (forceRefresh = false) => {
    setLoading(true);
    try {
      // Add cache busting parameter if force refresh is requested
      const url = forceRefresh 
        ? `/api/sections/popular-today?t=${Date.now()}`
        : '/api/sections/popular-today';
      
      const response = await fetch(url, {
        // Force bypass cache when manually refreshing
        cache: forceRefresh ? 'no-cache' : 'default'
      });
      
      if (response.ok) {
        const data = await response.json();
        setPopularItems(data);
      }
    } catch (error) {
      // Error fetching popular series - fail silently and show empty state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPopularSeries();
  }, []);

  if (loading) {
    return (
      <section className="py-6 sm:py-8 w-full">
        <div className="max-w-none mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-10 sm:mb-8 lg:mb-10 gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-[#707ff5] via-[#a195f9] to-[#f2a1f2] rounded-lg flex items-center justify-center shadow-lg shadow-[#a195f9]/30">
                <Flame className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-white" />
              </div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-white">
                Latest <span className="bg-gradient-to-r from-[#a195f9] to-[#f2a1f2] bg-clip-text text-transparent">Releases</span>
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-[4vw] sm:gap-6 w-full">
            {[...Array(8)].map((_, i) => (
              <SeriesCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-6 sm:py-8 w-full">
      <div className="max-w-none mx-auto px-4 sm:px-6 lg:px-8">
        {/* Modern Header with Toggle Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-10 sm:mb-8 lg:mb-10 gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-[#707ff5] via-[#a195f9] to-[#f2a1f2] rounded-lg flex items-center justify-center shadow-lg shadow-[#a195f9]/30 transition-transform hover:scale-105">
              <Flame className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-white" />
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-white">
              Latest <span className="bg-gradient-to-r from-[#a195f9] to-[#f2a1f2] bg-clip-text text-transparent">Releases</span>
            </h2>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4">
            <div className="flex items-center space-x-2">
              <Button 
                variant={activeFilter === 'hot' ? 'default' : 'outline'}
                size="sm" 
                className={`px-5 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${
                  activeFilter === 'hot' 
                    ? 'bg-gradient-to-r from-[#f2a1f2] via-[#a195f9] to-[#f2a1f2] hover:from-[#a195f9] hover:to-[#f2a1f2] text-white shadow-lg shadow-[#f2a1f2]/40 hover:shadow-xl hover:shadow-[#a195f9]/50 hover:scale-105' 
                    : 'bg-transparent border-2 border-[#f2a1f2]/30 text-[#f2a1f2] hover:text-white hover:bg-[#f2a1f2]/20 hover:border-[#f2a1f2]'
                }`}
                onClick={() => setActiveFilter('hot')}
                aria-pressed={activeFilter === 'hot'}
              >
                <span className="mr-1">🔥</span>HOT
              </Button>
              <Button 
                variant={activeFilter === 'new' ? 'default' : 'outline'}
                size="sm" 
                className={`px-5 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${
                  activeFilter === 'new' 
                    ? 'bg-gradient-to-r from-[#707ff5] to-[#4b4bc3] hover:from-[#4b4bc3] hover:to-[#1e1e76] text-white shadow-lg shadow-[#707ff5]/40 hover:shadow-xl hover:shadow-[#4b4bc3]/50 hover:scale-105' 
                    : 'bg-transparent border-2 border-[#707ff5]/30 text-[#707ff5] hover:text-white hover:bg-[#707ff5]/20 hover:border-[#707ff5]'
                }`}
                onClick={() => setActiveFilter('new')}
                aria-pressed={activeFilter === 'new'}
              >
                <span className="mr-1">✨</span>NEW
              </Button>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-muted-foreground hover:text-foreground transition-colors duration-200 flex items-center space-x-1"
              onClick={() => navigate('/browse')}
            >
              <span className="hidden sm:inline">VIEW ALL</span>
              <span className="sm:hidden">ALL</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Show message if no series assigned */}
        {popularItems.length === 0 ? (
          <div className="text-center py-8 bg-muted/30 rounded-lg">
            <p className="text-muted-foreground">
              No recent series assigned yet. Use the admin panel to assign series to this section.
            </p>
          </div>
        ) : (
          /* Professional Responsive Grid Layout */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-[4vw] sm:gap-6 w-full">
            {popularItems.slice(0, 12).map((item, index) => (
              <MangaCard 
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

// Memoized separate component for each manga card with dynamic chapter rendering
const MangaCard = memo(function MangaCard({ item, navigate }: { 
  item: PopularItem; 
  navigate: (path: string) => void;
}) {
  const [visibleChapters, setVisibleChapters] = useState(4);
  const cardRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);

  // Get real chapters from API data or empty array
  const realChapters = item.latestChapters || [];

  useEffect(() => {
    const calculateVisibleChapters = () => {
      if (!cardRef.current || !contentRef.current || !titleRef.current) return;

      const cardHeight = cardRef.current.offsetHeight;
      const titleHeight = titleRef.current.offsetHeight;
      const padding = 32; // Total padding (p-2 sm:p-3 lg:p-4)
      const availableHeight = cardHeight - titleHeight - padding;
      
      // Each chapter takes approximately 28px (including spacing)
      const chapterHeight = 28;
      const maxChapters = Math.floor(availableHeight / chapterHeight);
      
      // Always show at least 1 chapter, max 4
      const chaptersToShow = Math.max(1, Math.min(maxChapters, Math.min(4, realChapters.length)));
      setVisibleChapters(chaptersToShow);
    };

    // Calculate on mount and resize
    calculateVisibleChapters();
    
    const resizeObserver = new ResizeObserver(calculateVisibleChapters);
    if (cardRef.current) {
      resizeObserver.observe(cardRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [realChapters.length]);

  const handleMangaClick = useCallback(() => {
    navigate(`/manga/${item.id}`);
  }, [navigate, item.id]);

  const handleChapterClick = useCallback((chapterNumber: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/manga/${item.id}/chapter/${chapterNumber}`);
  }, [navigate, item.id]);

  return (
    <div
      ref={cardRef}
      onClick={handleMangaClick}
      className="group anime-card bg-gradient-to-br from-card/80 to-card/60 backdrop-blur-md rounded-2xl border border-border/40 p-0 transition-all duration-300 hover:border-primary/60 hover:from-card/90 hover:to-card/80 relative overflow-hidden hover:shadow-2xl hover:shadow-primary/20 hover:scale-[1.02] cursor-pointer"
      style={{ aspectRatio: '4.5 / 2.5' }}
      data-testid={`popular-item-${item.id}`}
    >
      <div className="flex h-full">
        {/* Cover Image - Left Side */}
        <div 
          className="relative flex-shrink-0" 
          style={{ width: '42%' }}
        >
          <div className="relative w-full h-full overflow-hidden">
            {item.coverImageUrl ? (
              <img
                src={item.coverImageUrl}
                alt={item.title}
                loading="lazy"
                decoding="async"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, 25vw"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/api/covers/placeholder';
                }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-muted/80 to-muted/60 flex items-center justify-center">
                <span className="text-muted-foreground text-xs font-medium">No cover</span>
              </div>
            )}
            
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-background/10"></div>
            
            {/* Genre Badge */}
            <div className="absolute top-2 left-2">
              <Badge className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-[10px] px-2 py-1 rounded-full font-medium shadow-lg backdrop-blur-sm border border-primary/20">
                {item.genres?.[0] || 'Manhwa'}
              </Badge>
            </div>
            
            {/* Pinned Badge */}
            <div className="absolute bottom-2 left-2">
              <div className="bg-black/60 backdrop-blur-sm rounded-full p-1.5 shadow-lg">
                <Bookmark className="w-3 h-3 text-white" fill="currentColor" />
              </div>
            </div>
          </div>
        </div>

        {/* Content - Right Side */}
        <div ref={contentRef} className="flex flex-col min-w-0 p-2 sm:p-3 lg:p-4" style={{ width: '58%' }}>
          {/* Title and Rating */}
          <div ref={titleRef} className="mb-2 sm:mb-3 flex-shrink-0">
            <h3 className="text-foreground font-bold text-xs sm:text-sm lg:text-base line-clamp-2 mb-1 sm:mb-2 group-hover:text-primary transition-colors duration-300 leading-tight break-words">
              {item.title}
            </h3>
          </div>
          
          {/* Chapter List - Dynamic based on available space */}
          <div className="space-y-1 flex-1">
            {realChapters.length === 0 ? (
              <div className="text-muted-foreground text-xs text-center py-2">
                No chapters yet
              </div>
            ) : (
              realChapters.slice(0, visibleChapters).map((chapter: ChapterInfo, index: number) => (
                <div 
                  key={chapter.id}
                  onClick={handleChapterClick(chapter.chapterNumber)}
                  className={`group/chapter transition-all duration-300 cursor-pointer hover:shadow-md ${
                    index === 0 
                      ? 'bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/30 hover:from-primary/20 hover:to-accent/20 hover:border-primary/50 relative overflow-hidden'
                      : index === 1
                      ? 'bg-card/40 border border-border/20 hover:bg-card/60 hover:border-border/40'
                      : 'bg-card/30 border border-border/10 hover:bg-card/50 hover:border-border/30'
                  } rounded-md px-2 py-1`}
                >
                  {index === 0 && (
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover/chapter:opacity-100 transition-opacity duration-300"></div>
                  )}
                  <div className="flex items-center justify-between relative z-10 min-w-0">
                    <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                      {chapter.hasLock ? (
                        <Lock className={`w-2.5 h-2.5 ${index === 0 ? 'text-amber-500' : 'text-amber-500/80'} flex-shrink-0`} />
                      ) : (
                        <div className="w-2.5 h-2.5 flex items-center justify-center flex-shrink-0">
                          <div className="w-1.5 h-1.5 bg-foreground/40 rounded-full"></div>
                        </div>
                      )}
                      <span className={`font-medium truncate text-[11px] sm:text-xs ${
                        index === 0 ? 'text-foreground' : index === 1 ? 'text-foreground/90' : 'text-foreground/80'
                      }`}>
                        Chapter {chapter.chapterNumber}
                      </span>
                      {chapter.isNew && (
                        <div className="bg-gradient-to-r from-red-500 to-red-600 text-white text-[8px] px-1 py-0.5 rounded-full font-medium shadow-sm hidden sm:inline-flex items-center">
                          <Flame className="w-2 h-2" />
                        </div>
                      )}
                    </div>
                    <span className="text-muted-foreground text-[9px] sm:text-[10px] font-medium flex-shrink-0 ml-1">
                      {getTimeAgo(chapter.createdAt)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
});