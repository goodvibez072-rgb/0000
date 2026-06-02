import { Award, Eye, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

interface UpdateItem {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  chapter?: string;
  rating?: number;
  status: "Ongoing" | "Completed";
  updatedAt?: string;
  views?: string;
  genres?: string[];
  author?: string;
}

export default function LatestUpdates() {
  const [latestUpdates, setLatestUpdates] = useState<UpdateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [, navigate] = useLocation();

  useEffect(() => {
    const fetchLatestUpdates = async () => {
      try {
        const response = await fetch('/api/sections/latest-updates');
        if (response.ok) {
          const data = await response.json();
          setLatestUpdates(data);
        }
      } catch (error) {
        // Error fetching latest updates - fail silently and show empty state
      } finally {
        setLoading(false);
      }
    };

    fetchLatestUpdates();
  }, []);

  // Carousel state and logic - declared first
  const [centerIndex, setCenterIndex] = useState(0);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [prevFeaturedIndex, setPrevFeaturedIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredCards, setHoveredCards] = useState<Set<number>>(new Set());
  
  // Screen size detection for responsive thumbnail grid
  const [screenSize, setScreenSize] = useState(getScreenSize());
  
  function getScreenSize() {
    if (typeof window === 'undefined') return 'sm';
    const width = window.innerWidth;
    if (width >= 1280) return 'xl'; // 4 cards
    if (width >= 1024) return 'lg'; // 3 cards
    if (width >= 768) return 'md';  // 2 cards
    return 'sm'; // 1 card
  }
  
  const getCardCount = (size: string) => {
    switch (size) {
      case 'xl': return 8;
      case 'lg': return 6;
      case 'md': return 5;
      case 'sm': return 4;
      default: return 3;
    }
  };
  
  const thumbnailGrid = latestUpdates.slice(0, getCardCount(screenSize));
  
  // Get featured manga
  const featuredManga = latestUpdates[featuredIndex];
  
  // Refs for scroll management
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  // Handle responsive breakpoints
  useEffect(() => {
    const handleResize = () => {
      const newScreenSize = getScreenSize();
      if (newScreenSize !== screenSize) {
        setScreenSize(newScreenSize);
        // Reset carousel position when switching between responsive modes
        setCenterIndex(0);
        setFeaturedIndex(0);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [screenSize]);
  
  // Reset indices when data loads
  useEffect(() => {
    if (latestUpdates.length > 0 && (centerIndex >= latestUpdates.length || featuredIndex >= latestUpdates.length)) {
      setCenterIndex(0);
      setFeaturedIndex(0);
    }
  }, [latestUpdates.length, centerIndex, featuredIndex]);
  
  // Get card position and styling for single-card loop animation
  const getCardStyle = (index: number) => {
    let offset = index - centerIndex;
    
    // Handle infinite loop wrapping
    if (offset > latestUpdates.length / 2) {
      offset -= latestUpdates.length;
    } else if (offset < -latestUpdates.length / 2) {
      offset += latestUpdates.length;
    }

    const isCenter = offset === 0;
    const distance = Math.abs(offset);
    
    // Only show the center card and immediate neighbors for smooth transitions
    const isVisible = distance <= 1;
    
    return {
      position: 'absolute' as const,
      top: '50%',
      left: '50%',
      transform: `translate(-50%, -50%) translateX(${offset * 120}%) scale(${isCenter ? 1 : 0.8}) ${isCenter ? '' : 'translateY(2vh)'}`,
      opacity: isVisible ? (isCenter ? 1 : 0.3) : 0,
      zIndex: isCenter ? 30 : 20 - distance,
      transition: 'transform 800ms cubic-bezier(0.23, 1, 0.32, 1), opacity 600ms ease-out, z-index 0ms'
    };
  };

  // Auto-advance carousel every 3.5 seconds
  const nextSlide = useCallback(() => {
    if (thumbnailGrid.length > 0) {
      setCenterIndex((prev) => (prev + 1) % thumbnailGrid.length);
    }
  }, [thumbnailGrid.length]);

  useEffect(() => {
    if (!isHovered && thumbnailGrid.length > 0) {
      const interval = setInterval(nextSlide, 3500);
      return () => clearInterval(interval);
    }
  }, [isHovered, nextSlide, thumbnailGrid.length]);
  
  // Safety check to reset indices if they become NaN
  useEffect(() => {
    if (isNaN(centerIndex) || isNaN(featuredIndex)) {
      setCenterIndex(0);
      setFeaturedIndex(0);
    }
  }, [centerIndex, featuredIndex]);

  // Handle card click - update both center and featured
  const handleCardClick = (index: number) => {
    setCenterIndex(index);
    setFeaturedIndex(index);
  };
  
  // Handle card hover for enhanced effects
  const handleCardHover = (cardId: number, isEntering: boolean) => {
    if (isEntering) {
      setHoveredCards(prev => new Set(prev).add(cardId));
    } else {
      setHoveredCards(prev => {
        const newSet = new Set(prev);
        newSet.delete(cardId);
        return newSet;
      });
    }
  };

  // Sync featured index with center index for automatic updates with proper crossfade timing
  useEffect(() => {
    if (centerIndex !== featuredIndex) {
      setPrevFeaturedIndex(featuredIndex);
      setFeaturedIndex(centerIndex);
      
      // After fade completes (500ms), align prevFeaturedIndex to avoid duplicate renders
      const timer = setTimeout(() => {
        setPrevFeaturedIndex(centerIndex);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [centerIndex]);

  if (loading) {
    return (
      <div className="mt-[4vh] sm:mt-[6vh] lg:mt-[8vh] w-full">
        {/* Header Skeleton */}
        <div className="flex items-center gap-3 sm:gap-4 mb-10 sm:mb-8 lg:mb-10 px-4 sm:px-6 lg:px-8">
          <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-[#4b4bc3] via-[#707ff5] to-[#a195f9] rounded-lg flex items-center justify-center shadow-lg shadow-[#707ff5]/30">
            <Award className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-white" />
          </div>
          <h2 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-white">
            EDITOR'S <span className="bg-gradient-to-r from-[#a195f9] to-[#f2a1f2] bg-clip-text text-transparent">Pick !</span>
          </h2>
        </div>

        {/* Featured Section Skeleton */}
        <div className="px-[1%] sm:px-[2%] md:px-[3%] lg:px-[4%] xl:px-[6%] w-full">
          <div className="mb-[3vh] relative rounded-[8px] sm:rounded-[12px] lg:rounded-[16px] overflow-hidden shadow-2xl bg-gradient-to-br from-[#1e1e76]/95 via-[#4b4bc3]/90 to-[#1e1e76]/95">
            <div className="flex flex-col-reverse lg:flex-row items-start min-h-[280px] sm:min-h-[320px] md:min-h-[361px] lg:min-h-[320px] xl:min-h-[350px]">
              {/* Left Side Content Skeleton */}
              <div className="w-full lg:w-[55%] p-4 sm:p-6 lg:p-8 xl:p-10 space-y-3 sm:space-y-4 lg:space-y-6">
                <Skeleton className="h-8 sm:h-10 w-3/4" />
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-[4.5rem] rounded-full" />
                </div>
                <Skeleton className="h-16 sm:h-20 w-full" />
                <div className="flex gap-2 sm:gap-3">
                  <Skeleton className="h-24 sm:h-32 flex-1" />
                  <Skeleton className="h-24 sm:h-32 flex-1" />
                  <Skeleton className="h-24 sm:h-32 flex-1 hidden sm:block" />
                  <Skeleton className="h-24 sm:h-32 flex-1 hidden md:block" />
                </div>
              </div>
              {/* Right Side Cover Skeleton */}
              <div className="w-full lg:w-[45%] lg:absolute lg:right-0 lg:top-0 lg:h-full">
                <Skeleton className="w-full h-48 lg:h-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Shimmer effect overlay */}
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />
      </div>
    );
  }

  if (latestUpdates.length === 0) {
    return (
      <div className="mt-[4vh] sm:mt-[6vh] lg:mt-[8vh] w-full">
        {/* Header - Enhanced with better spacing and icon */}
        <div className="flex items-center gap-3 sm:gap-4 mb-10 sm:mb-8 lg:mb-10 px-4 sm:px-6 lg:px-8">
          <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-[#4b4bc3] via-[#707ff5] to-[#a195f9] rounded-lg flex items-center justify-center shadow-lg shadow-[#707ff5]/30 transition-transform hover:scale-105">
            <Award className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-white" />
          </div>
          <h2 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-white">
            EDITOR'S <span className="bg-gradient-to-r from-[#a195f9] to-[#f2a1f2] bg-clip-text text-transparent">Pick !</span>
          </h2>
        </div>
        <div className="text-center py-8 bg-muted/30 rounded-lg mx-[2%] sm:mx-[3%] lg:mx-[4%]">
          <p className="text-muted-foreground">
            No latest updates assigned yet. Use the admin panel to assign series to this section.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-[4vh] sm:mt-[6vh] lg:mt-[8vh] w-full">
      {/* Header - Enhanced with better spacing and icon */}
      <div className="flex items-center gap-3 sm:gap-4 mb-10 sm:mb-8 lg:mb-10 px-4 sm:px-6 lg:px-8">
        <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-[#4b4bc3] via-[#707ff5] to-[#a195f9] rounded-lg flex items-center justify-center shadow-lg shadow-[#707ff5]/30 transition-transform hover:scale-105">
          <Award className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-white" />
        </div>
        <h2 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-white">
          EDITOR'S <span className="bg-gradient-to-r from-[#a195f9] to-[#f2a1f2] bg-clip-text text-transparent">Pick !</span>
        </h2>
      </div>

      {/* Featured Section - Allow overflow for floating effect */}
      <div className="px-[1%] sm:px-[2%] md:px-[3%] lg:px-[4%] xl:px-[6%] w-full">
        <div 
          className="mb-[3vh] relative rounded-[8px] sm:rounded-[12px] lg:rounded-[16px] overflow-visible transition-all duration-500 shadow-2xl bg-gradient-to-br from-[#1e1e76]/95 via-[#4b4bc3]/90 to-[#1e1e76]/95"
          style={{
            backgroundImage: `linear-gradient(135deg, rgba(30,30,118,0.92), rgba(75,75,195,0.88), rgba(30,30,118,0.92)), url(${featuredManga?.coverImageUrl || ''})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center center',
            backgroundRepeat: 'no-repeat'
          }}
        >
          {/* Inner container to maintain background bounds while allowing cover to float */}
          <div className="rounded-[8px] sm:rounded-[12px] lg:rounded-[16px] overflow-visible">
            {/* Modern gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#1e1e76]/90 via-[#4b4bc3]/85 to-[#1e1e76]/90 z-10"></div>
          
            <div className="relative z-20 flex flex-col-reverse lg:flex-row items-start min-h-[280px] sm:min-h-[320px] md:min-h-[361px] lg:min-h-[320px] xl:min-h-[350px]">
              {/* Left Side - Content and Carousel - Responsive width */}
              <div className="w-full lg:w-[55%] p-4 sm:p-6 lg:p-8 xl:p-10 space-y-3 sm:space-y-4 lg:space-y-6">
                {/* Title - Responsive and modern */}
                <h3 className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl 2xl:text-4xl font-bold bg-gradient-to-r from-white via-gray-100 to-white bg-clip-text text-transparent leading-tight line-clamp-1">
                  {featuredManga?.title || 'Loading...'}
                </h3>
                
                {/* Category Tags - Modern glassmorphism design */}
                <div className="flex flex-wrap items-center gap-[0.8vw]">
                  {featuredManga?.genres ? (
                    featuredManga.genres.slice(0, 5).map((genre, index) => (
                      <Badge key={genre} className={`backdrop-blur-sm text-xs sm:text-sm px-[1.5vw] py-[0.5vh] border border-opacity-30 rounded-full transition-all duration-300 hover:scale-105 ${
                        index === 0 ? 'bg-gradient-to-r from-[#f2a1f2]/25 to-[#a195f9]/25 text-[#f2a1f2] border-[#f2a1f2]/40 hover:from-[#f2a1f2]/35 hover:to-[#a195f9]/35 hover:border-[#f2a1f2]/60' :
                        index === 1 ? 'bg-gradient-to-r from-[#a195f9]/25 to-[#707ff5]/25 text-[#c7bfff] border-[#a195f9]/40 hover:from-[#a195f9]/35 hover:to-[#707ff5]/35 hover:border-[#a195f9]/60' :
                        index === 2 ? 'bg-gradient-to-r from-[#707ff5]/25 to-[#4b4bc3]/25 text-[#a195f9] border-[#707ff5]/40 hover:from-[#707ff5]/35 hover:to-[#4b4bc3]/35 hover:border-[#707ff5]/60' :
                        index === 3 ? 'bg-gradient-to-r from-[#f2a1f2]/25 to-[#707ff5]/25 text-[#f2a1f2] border-[#f2a1f2]/40 hover:from-[#f2a1f2]/35 hover:to-[#707ff5]/35 hover:border-[#f2a1f2]/60' :
                        'bg-gradient-to-r from-[#a195f9]/25 to-[#f2a1f2]/25 text-[#c7bfff] border-[#a195f9]/40 hover:from-[#a195f9]/35 hover:to-[#f2a1f2]/35 hover:border-[#a195f9]/60'
                      }`}>
                        {genre}
                      </Badge>
                    ))
                  ) : (
                    <>
                      <Badge className="bg-gradient-to-r from-[#f2a1f2]/25 to-[#a195f9]/25 backdrop-blur-sm text-[#f2a1f2] text-xs sm:text-sm px-[1.5vw] py-[0.5vh] border border-[#f2a1f2]/40 rounded-full hover:from-[#f2a1f2]/35 hover:to-[#a195f9]/35 hover:border-[#f2a1f2]/60 transition-all duration-300 hover:scale-105">
                        shoujo
                      </Badge>
                      <Badge className="bg-gradient-to-r from-[#a195f9]/25 to-[#707ff5]/25 backdrop-blur-sm text-[#c7bfff] text-xs sm:text-sm px-[1.5vw] py-[0.5vh] border border-[#a195f9]/40 rounded-full hover:from-[#a195f9]/35 hover:to-[#707ff5]/35 hover:border-[#a195f9]/60 transition-all duration-300 hover:scale-105">
                        Drama
                      </Badge>
                    </>
                  )}
                </div>
                
                {/* Divider Line - Modern gradient */}
                <div className="w-full h-[0.15vh] bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
                
                {/* Description - Modern styling */}
                <p className="text-xs sm:text-sm md:text-base lg:text-base xl:text-lg text-gray-300 leading-relaxed line-clamp-2 max-w-lg">
                  {featuredManga?.description || 'No description available'}
                </p>

                {/* Thumbnails Row - Responsive layout */}
                <div 
                  className="relative py-4"
                  onMouseEnter={() => setIsHovered(true)}
                  onMouseLeave={() => setIsHovered(false)}
                >
                  {/* Responsive flex container - no wrapping, cards shrink */}
                  <div className="flex flex-nowrap gap-2 sm:gap-3 md:gap-4 lg:gap-2 xl:gap-3 w-[78.7%] md:w-[58.6%] lg:w-[90.5%] mx-auto">
                    {thumbnailGrid.map((item, index) => (
                      <div
                        key={item.id}
                        className={`cursor-pointer group flex-shrink min-w-0 flex-1 max-w-[86%] transition-all ease-out duration-300 ${
                          index === centerIndex 
                            ? 'scale-105 opacity-100' 
                            : 'opacity-60 hover:opacity-100 hover:scale-[1.03] hover:-translate-y-1'
                        }`}
                        onClick={() => handleCardClick(index)}
                        onMouseEnter={() => handleCardHover(index, true)}
                        onMouseLeave={() => handleCardHover(index, false)}
                        data-testid={`carousel-card-${item.id}`}
                      >
                        {/* Thumbnail with proper 3:4 aspect ratio - modern styling */}
                        <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden transition-all ease-out duration-300 group-hover:shadow-[0_12px_40px_-10px_rgba(161,149,249,0.6)] ring-1 ring-white/10 backdrop-blur-sm">
                          {/* Glowing ring on hover */}
                          <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-10 ring-2 ring-[#a195f9]/70 shadow-lg shadow-[#a195f9]/40"></div>
                          
                          <img
                            src={item.coverImageUrl}
                            alt={item.title}
                            width={240}
                            height={320}
                            className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-110"
                            loading="lazy"
                          />
                          
                          {/* Enhanced Shine Effect - Modern manga style */}
                          <div className="absolute inset-0 pointer-events-none overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent transform -skew-x-12 -translate-x-full opacity-0 group-hover:opacity-100 group-hover:translate-x-full transition-all duration-500 ease-out"></div>
                          </div>
                          
                          {/* Focus indicator ring - Modern manga style */}
                          {index === centerIndex && (
                            <div className="absolute inset-0 rounded-xl ring-2 ring-[#a195f9] shadow-xl shadow-[#a195f9]/60 ring-opacity-100 animate-pulse z-20"></div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Right Side - Modern clean cover design with upward floating */}
              <div 
                className="relative w-full lg:w-[45%] flex justify-center lg:justify-center p-2 sm:p-4 md:pt-4 lg:pt-0 lg:pr-4 lg:pb-4 lg:pl-4 xl:pr-6 xl:pb-6 xl:pl-6 overflow-visible md:items-start lg:items-start lg:-mt-16 xl:-mt-20"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                {/* Desktop layout - Large cover breaking boundaries naturally */}
                <div className="hidden lg:block relative overflow-visible group z-40">
                  <div className="w-72 md:w-[240px] lg:w-[319px] xl:w-[357px] 2xl:w-[391px] aspect-[3/4] rounded-xl overflow-visible cursor-pointer relative z-30">
                    <div className="relative w-full h-full rounded-xl overflow-hidden shadow-2xl transition-all duration-300 ease-out group-hover:scale-105 group-hover:-translate-y-4 group-hover:-translate-x-2 group-hover:-rotate-2 group-hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] transform-gpu z-50 ring-2 ring-white/5 backdrop-blur-sm">
                      {/* True crossfade container with overlapping images */}
                      <div className="relative w-full h-full">
                        {/* Previous image - fading out */}
                        {latestUpdates[prevFeaturedIndex]?.coverImageUrl && (
                          <img
                            src={latestUpdates[prevFeaturedIndex]?.coverImageUrl}
                            alt={latestUpdates[prevFeaturedIndex]?.title}
                            width={357}
                            height={476}
                            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ease-in-out ${
                              featuredIndex !== prevFeaturedIndex ? 'opacity-0' : 'opacity-100'
                            }`}
                            loading="lazy"
                          />
                        )}
                        {/* Current image - fading in */}
                        {featuredManga?.coverImageUrl ? (
                          <img
                            src={featuredManga.coverImageUrl}
                            alt={featuredManga.title}
                            width={357}
                            height={476}
                            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ease-in-out ${
                              featuredIndex !== prevFeaturedIndex ? 'opacity-100' : 'opacity-0'
                            }`}
                            loading="lazy"
                          />
                        ) : (
                          <div className="absolute inset-0 w-full h-full bg-muted flex items-center justify-center">
                            <span className="text-muted-foreground">No cover</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Premium Shine Effect for Large Cover */}
                      <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1200 ease-out"></div>
                      </div>
                      
                      {/* Read it now button - appears only on hover */}
                      <div className="absolute bottom-4 right-4 z-30 opacity-0 group-hover:opacity-100 transition-all duration-300 ease-out">
                        <Button 
                          onClick={() => navigate(`/manga/${featuredManga?.id}`)}
                          className="bg-gradient-to-r from-[#707ff5] to-[#a195f9] hover:from-[#4b4bc3] hover:to-[#707ff5] text-white px-3 py-1.5 md:px-4 md:py-2 lg:px-4 lg:py-2 xl:px-5 xl:py-3 rounded-lg text-xs sm:text-sm md:text-sm lg:text-sm xl:text-base font-medium transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 backdrop-blur-sm border border-[#a195f9]/30"
                          data-testid="read-featured"
                        >
                          Read it now
                        </Button>
                      </div>
                      
                    </div>
                  </div>
                </div>
                
                {/* Mobile/Tablet layout - Featured cover at top with upward floating */}
                <div className="lg:hidden relative flex justify-center -mt-8 sm:-mt-12 md:-mt-16">
                  <div className="w-[55vw] max-w-[240px] h-[73vw] max-h-[320px] sm:w-[45vw] sm:max-w-[300px] sm:h-[60vw] sm:max-h-[400px] md:w-[31.8vw] md:max-w-[302px] md:h-[42.7vw] md:max-h-[403px] rounded-2xl overflow-hidden shadow-2xl relative group cursor-pointer ring-2 ring-white/10 transition-all duration-300">
                    {/* True crossfade container for mobile covers */}
                    <div className="relative w-full h-full">
                      {/* Previous image - fading out */}
                      {latestUpdates[prevFeaturedIndex]?.coverImageUrl && (
                        <img
                          src={latestUpdates[prevFeaturedIndex]?.coverImageUrl}
                          alt={latestUpdates[prevFeaturedIndex]?.title}
                          width={302}
                          height={403}
                          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ease-in-out ${
                            featuredIndex !== prevFeaturedIndex ? 'opacity-0' : 'opacity-100'
                          }`}
                          loading="lazy"
                        />
                      )}
                      {/* Current image */}
                      {featuredManga?.coverImageUrl ? (
                        <img
                          src={featuredManga.coverImageUrl}
                          alt={featuredManga.title}
                          width={302}
                          height={403}
                          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ease-in-out ${
                            featuredIndex !== prevFeaturedIndex ? 'opacity-100' : 'opacity-0'
                          }`}
                          loading="lazy"
                        />
                      ) : (
                        <div className="absolute inset-0 w-full h-full bg-muted flex items-center justify-center">
                          <span className="text-muted-foreground">No cover</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Read it now button - always visible on mobile, hover on desktop */}
                    <div className="absolute bottom-4 right-4 z-30 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-500">
                      <Button 
                        onClick={() => navigate(`/manga/${featuredManga?.id}`)}
                        className="bg-gradient-to-r from-[#707ff5] to-[#a195f9] hover:from-[#4b4bc3] hover:to-[#707ff5] text-white px-2 py-1.5 sm:px-3 sm:py-2 md:px-3 md:py-2 rounded-lg text-[10px] sm:text-xs md:text-sm font-medium transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 backdrop-blur-sm border border-[#a195f9]/30"
                        data-testid="read-featured"
                      >
                        Read it now
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}