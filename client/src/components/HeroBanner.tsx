import { useState, useEffect, useCallback, useRef, memo } from "react";
import { Star, Heart, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

interface HeroItem {
  id: string;
  title: string;
  chapter?: string;
  description?: string;
  rating?: number;
  genres?: string[];
  coverImageUrl?: string;
  status: "Ongoing" | "Completed";
  author?: string;
  updatedAt?: string;
}

export default function HeroBanner() {
  const [heroItems, setHeroItems] = useState<HeroItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [, navigate] = useLocation();

  useEffect(() => {
    const fetchFeaturedSeries = async () => {
      try {
        const response = await fetch('/api/sections/featured');
        if (response.ok) {
          const data = await response.json();
          setHeroItems(data);
        }
      } catch (error) {
        console.error('[HeroBanner] Error loading featured series:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFeaturedSeries();
  }, []);

  const [isPaused, setIsPaused] = useState(false);
  const [translateX, setTranslateX] = useState(0);
  
  // Touch gesture state
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Dynamic card width based on screen size
  const [cardWidth, setCardWidth] = useState(310);
  
  useEffect(() => {
    const updateCardWidth = () => {
      // Mobile: 200px + 10px padding = 210px
      // Tablet and up: 300px + 10px padding = 310px
      if (window.innerWidth < 640) {
        setCardWidth(210);
      } else {
        setCardWidth(310);
      }
    };
    
    updateCardWidth();
    window.addEventListener('resize', updateCardWidth);
    return () => window.removeEventListener('resize', updateCardWidth);
  }, []);
  
  const CARD_WIDTH = cardWidth;

  // Initialize position at middle set when items load
  useEffect(() => {
    if (heroItems.length > 0) {
      setTranslateX(-(CARD_WIDTH * heroItems.length));
    }
  }, [heroItems.length, CARD_WIDTH]);

  // Create duplicated items for infinite scroll
  const duplicatedItems = heroItems.length > 0 ? [...heroItems, ...heroItems, ...heroItems] : [];

  // Smooth continuous sliding animation with seamless loop
  useEffect(() => {
    if (isPaused || heroItems.length === 0) return;
    
    let animationId: number;
    const moveSpeed = 0.6;
    
    const animate = () => {
      setTranslateX(prev => {
        const newTranslateX = prev - moveSpeed;
        
        const singleSetWidth = CARD_WIDTH * heroItems.length;
        const resetThreshold = -singleSetWidth * 2;
        
        if (newTranslateX <= resetThreshold) {
          return newTranslateX + singleSetWidth;
        }
        
        return newTranslateX;
      });
      animationId = requestAnimationFrame(animate);
    };
    
    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [heroItems.length, isPaused, CARD_WIDTH]);

  const goToPrevious = useCallback(() => {
    setTranslateX(prev => {
      const newTranslateX = prev + CARD_WIDTH;
      const middlePoint = -CARD_WIDTH * heroItems.length;
      
      if (newTranslateX >= 0) {
        return middlePoint;
      }
      
      return newTranslateX;
    });
  }, [heroItems.length, CARD_WIDTH]);

  const goToNext = useCallback(() => {
    setTranslateX(prev => {
      const newTranslateX = prev - CARD_WIDTH;
      const resetPoint = -CARD_WIDTH * heroItems.length * 2;
      const middlePoint = -CARD_WIDTH * heroItems.length;
      return newTranslateX <= resetPoint ? middlePoint : newTranslateX;
    });
  }, [heroItems.length, CARD_WIDTH]);

  // Touch gesture handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setIsPaused(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const swipeThreshold = 50;
    const diff = touchStartX.current - touchEndX.current;
    
    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        goToNext();
      } else {
        goToPrevious();
      }
    }
    
    setIsPaused(false);
  }, [goToNext, goToPrevious]);

  // Mouse hover handlers for pause-on-hover
  const handleMouseEnter = useCallback(() => {
    setIsPaused(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsPaused(false);
  }, []);

  if (loading) {
    return (
      <div className="relative min-h-[280px] h-[40vh] sm:h-[45vh] md:h-[48vh] lg:h-[50vh] w-full overflow-hidden bg-background">
        <div className="relative z-10 px-2 sm:px-4 lg:px-1 w-full h-full flex items-center">
          <div className="relative max-w-none lg:max-w-[95vw] mx-auto w-full">
            <div className="relative overflow-hidden h-full">
              <div className="flex h-full gap-5">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-[200px] sm:w-[300px] px-2.5 h-full flex items-center">
                    <Skeleton className="w-full rounded-lg bg-card/50" style={{aspectRatio: '3/4'}} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (heroItems.length === 0) {
    return (
      <div className="relative min-h-screen w-full overflow-hidden bg-background">
        <div className="relative z-10 text-center pt-16 sm:pt-20 lg:pt-24 pb-8 sm:pb-12 lg:pb-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold bg-gradient-to-r from-foreground via-primary to-primary bg-clip-text text-transparent mb-4 sm:mb-6 tracking-tight">
              Featured Series
            </h1>
            <p className="text-base sm:text-lg lg:text-xl text-muted-foreground font-light leading-relaxed mb-8">
              Discover amazing manga and manhwa series
            </p>
          </div>
        </div>

        <div className="relative z-10 text-center py-12">
          <div className="text-center py-8 bg-muted/30 rounded-lg mx-8">
            <p className="text-muted-foreground">
              No featured series assigned yet. Use the admin panel to assign series to this section.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[280px] h-[40vh] sm:h-[45vh] md:h-[48vh] lg:h-[50vh] w-full overflow-hidden bg-background">

      {/* Horizontal Banner */}
      <div className="relative z-10 px-2 sm:px-4 lg:px-1 w-full h-full flex items-center">
        <div className="relative max-w-none lg:max-w-[95vw] mx-auto w-full h-full">
          
          {/* Banner Container */}
          <div 
            ref={containerRef}
            className="relative overflow-hidden h-full"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Cards Container */}
            <div 
              className="flex h-full"
              style={{
                transform: `translateX(${translateX}px)`,
                transition: isPaused ? 'transform 0.3s ease-out' : 'none'
              }}
            >
              {duplicatedItems.map((item, index) => (
                <HeroCard
                  key={`${item.id}-${index}`}
                  item={item}
                  navigate={navigate}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Memoized HeroCard component for better performance
const HeroCard = memo(function HeroCard({ 
  item, 
  navigate 
}: { 
  item: HeroItem; 
  navigate: (path: string) => void;
}) {
  const handleClick = useCallback(() => {
    navigate(`/manga/${item.id}`);
  }, [navigate, item.id]);

  return (
    <div
      className="flex-shrink-0 w-[200px] sm:w-[300px] px-2.5 cursor-pointer h-full flex items-center bg-transparent"
      onClick={handleClick}
      data-testid={`hero-card-${item.id}`}
    >
      {/* Clean Card Design */}
      <div className="relative w-full mx-auto transition-transform duration-150 hover:scale-105" style={{aspectRatio: '3/4'}}>
        {/* Cover Image */}
        <img
          src={item.coverImageUrl || '/api/covers/placeholder'}
          alt={item.title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover object-center rounded-lg shadow-lg"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (target.src !== '/api/covers/placeholder') {
              target.src = '/api/covers/placeholder';
            }
          }}
        />
      </div>
    </div>
  );
});
