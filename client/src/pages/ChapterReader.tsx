import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { useParams, Link, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, Menu, X, Book, Home, Settings, Eye, EyeOff, Maximize, Minimize, List, Grid, BookOpen, Search, SlidersHorizontal, Play, Pause, Lock, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useChapterReader } from "@/hooks/useChapterReader";
import { useMangaDetail } from "@/hooks/useMangaDetail";
import { useChapters } from "@/hooks/useChapters";
import { useSaveProgress } from "@/hooks/useReadingProgress";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { useChapterAccess, useUnlockChapter } from "@/hooks/useChapterAccess";
import { useCurrencyBalance } from "@/hooks/useCurrency";
import { cn } from "@/lib/utils";
import AdDisplay from "@/components/AdDisplay";
import { SEO } from "@/components/SEO";

// PERFORMANCE: Lazy load CommentSection to reduce initial bundle size
const CommentSection = lazy(() => import("@/components/CommentSection"));

interface TouchPosition {
  x: number;
  y: number;
  distance?: number;
}

export default function ChapterReader() {
  const { seriesId, chapterNumber } = useParams<{ seriesId: string; chapterNumber: string }>();
  const [, navigate] = useLocation();
  
  // State management
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [showUI, setShowUI] = useState(true);
  const [imageLoading, setImageLoading] = useState<boolean[]>([]);
  const [touchStart, setTouchStart] = useState<TouchPosition | null>(null);
  
  // Modern reading features with persistence
  const [readingMode, setReadingMode] = useState<'single' | 'double' | 'webtoon'>(() => {
    const saved = localStorage.getItem('manga-reading-mode');
    // Migrate legacy 'vertical' mode to 'webtoon'
    if (saved === 'vertical') {
      localStorage.setItem('manga-reading-mode', 'webtoon');
      return 'webtoon';
    }
    // Validate and use saved mode, fallback to webtoon
    const validModes: ('single' | 'double' | 'webtoon')[] = ['single', 'double', 'webtoon'];
    return validModes.includes(saved as any) ? (saved as 'single' | 'double' | 'webtoon') : 'webtoon';
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fitWidth, setFitWidth] = useState(() => 
    localStorage.getItem('manga-fit-width') === 'true'
  );
  const [darkMode, setDarkMode] = useState(() => 
    localStorage.getItem('manga-dark-mode') !== 'false'
  );
  const [readingDirection, setReadingDirection] = useState<'ltr' | 'rtl'>(() =>
    (localStorage.getItem('manga-reading-direction') as 'ltr' | 'rtl') || 'ltr'
  );
  const [sidebarTab, setSidebarTab] = useState<'chapters' | 'pages'>('chapters');
  const [searchQuery, setSearchQuery] = useState('');
  const [rtlInitializing, setRtlInitializing] = useState(false);
  const [showJumpToPage, setShowJumpToPage] = useState(false);
  const [jumpPageInput, setJumpPageInput] = useState('');
  const [showContinueReading, setShowContinueReading] = useState(false);
  const [savedPageIndex, setSavedPageIndex] = useState<number | null>(null);
  const continueDismissedRef = useRef(false); // Track dismissal within session
  
  // Enhanced lazy loading and prefetching states
  const [preloadedPages, setPreloadedPages] = useState<Set<number>>(new Set([0, 1, 2, 3]));
  const [nextChapterPreloaded, setNextChapterPreloaded] = useState(false);
  
  // Auto-hide navbar on scroll state
  const [navbarVisible, setNavbarVisible] = useState(true);
  const lastScrollY = useRef(0);
  const scrollTimeout = useRef<NodeJS.Timeout>();
  
  // Refs
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelObserverRef = useRef<IntersectionObserver | null>(null);
  // Refs for observer stability
  const uiTimeoutRef = useRef<NodeJS.Timeout>();

  // Data hooks
  const { 
    currentChapter, 
    pages, 
    nextChapter, 
    previousChapter, 
    chapterIndex, 
    totalChapters,
    isLoading, 
    error, 
    isError 
  } = useChapterReader(seriesId!, chapterNumber!);

  const { manga } = useMangaDetail(seriesId!);
  const { chapters } = useChapters(seriesId!);
  const { saveProgress } = useSaveProgress();
  
  // Chapter access control
  const { data: accessData, isLoading: accessLoading, error: accessError } = useChapterAccess(currentChapter?.id);
  const { mutate: unlockChapter, isPending: isUnlocking } = useUnlockChapter();
  const { data: balanceData, isLoading: balanceLoading } = useCurrencyBalance();
  
  // Auto-scroll for webtoon mode
  const autoScroll = useAutoScroll({ 
    speed: parseInt(localStorage.getItem('manga-autoscroll-speed') || '100'), 
    enabled: false 
  });

  // Read Position Tracking Functions (must be declared before unified init effect)
  const getReadPositionKey = useCallback(() => {
    return `manga-read-position-${seriesId}-${chapterNumber}`;
  }, [seriesId, chapterNumber]);

  const saveReadPosition = useCallback((pageIndex: number) => {
    if (pages.length === 0) return;
    const key = getReadPositionKey();
    const position = {
      pageIndex,
      timestamp: Date.now(),
      totalPages: pages.length
    };
    localStorage.setItem(key, JSON.stringify(position));
  }, [getReadPositionKey, pages.length]);

  const loadReadPosition = useCallback(() => {
    const key = getReadPositionKey();
    const saved = localStorage.getItem(key);
    if (!saved) return null;
    
    try {
      const position = JSON.parse(saved);
      // Validate saved position is still valid for this chapter
      if (position.totalPages === pages.length && 
          position.pageIndex >= 0 && 
          position.pageIndex < pages.length) {
        return position;
      }
    } catch (e) {
      // Invalid saved data, remove it
      localStorage.removeItem(key);
    }
    return null;
  }, [getReadPositionKey, pages.length]);

  const clearReadPosition = useCallback(() => {
    const key = getReadPositionKey();
    localStorage.removeItem(key);
  }, [getReadPositionKey]);

  // Unified chapter initialization - consolidate all reset logic
  useEffect(() => {
    // Reset all UI state 
    setZoom(1);
    setShowUI(true);
    setShowContinueReading(false);
    setSavedPageIndex(null);
    continueDismissedRef.current = false; // Reset dismissal flag
    
    // Reset image loading states
    if (pages.length > 0) {
      setImageLoading(new Array(pages.length).fill(true));
      
      // Check for saved reading position
      const savedPosition = loadReadPosition();
      if (savedPosition && savedPosition.pageIndex > 0 && !continueDismissedRef.current) {
        // Show continue reading option
        setSavedPageIndex(savedPosition.pageIndex);
        setShowContinueReading(true);
        
        // Set initial page based on reading direction (don't jump to saved position yet)
        const initialPageIndex = readingDirection === 'rtl' ? pages.length - 1 : 0;
        setCurrentPageIndex(initialPageIndex);
      } else {
        // No saved position or dismissed, use default starting page
        const initialPageIndex = readingDirection === 'rtl' ? pages.length - 1 : 0;
        setCurrentPageIndex(initialPageIndex);
      }
      
      // Handle RTL webtoon scroll initialization
      if (readingMode === 'webtoon' && readingDirection === 'rtl') {
        setRtlInitializing(true);
        
        // Small delay to ensure DOM is updated, then scroll to last image
        setTimeout(() => {
          const lastImage = document.querySelector(`[data-page-index="${pages.length - 1}"]`) as HTMLImageElement;
          if (lastImage) {
            lastImage.scrollIntoView({ behavior: 'auto', block: 'start' });
          } else {
            window.scrollTo(0, document.body.scrollHeight);
          }
          setTimeout(() => setRtlInitializing(false), 300);
        }, 100);
      } else {
        setRtlInitializing(false);
        // Scroll to top for non-RTL or non-webtoon modes
        if (readingMode === 'webtoon') {
          window.scrollTo(0, 0);
        } else if (containerRef.current) {
          containerRef.current.scrollTo(0, 0);
        }
      }
    } else {
      setImageLoading([]);
      setCurrentPageIndex(0);
      setRtlInitializing(false);
    }
  }, [chapterNumber, seriesId, pages.length, readingDirection, readingMode, loadReadPosition]);

  // Track fullscreen state changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Track scroll progress in vertical mode using IntersectionObserver
  useEffect(() => {
    // Cleanup existing observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (readingMode !== 'webtoon' || pages.length === 0 || rtlInitializing) {
      return;
    }

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      // Skip if RTL is still initializing
      if (rtlInitializing) return;
      
      let maxVisibility = 0;
      let mostVisibleIndex = 0;

      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio > maxVisibility) {
          maxVisibility = entry.intersectionRatio;
          const imageElement = entry.target as HTMLElement;
          const index = parseInt(imageElement.dataset.pageIndex || '0');
          mostVisibleIndex = index;
        }
      });

      if (mostVisibleIndex !== currentPageIndex && maxVisibility > 0.5) {
        setCurrentPageIndex(mostVisibleIndex);
      }
    };

    const observer = new IntersectionObserver(observerCallback, {
      threshold: [0, 0.25, 0.5, 0.75, 1],
      rootMargin: '-20% 0px -20% 0px'
    });

    observerRef.current = observer;

    // Observe all webtoon page images
    const images = document.querySelectorAll('.webtoon-page-image');
    images.forEach((img) => observer.observe(img));

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [readingMode, pages.length, currentPageIndex, rtlInitializing, readingDirection]);

  // Auto-hide navbar on scroll for all reading modes
  useEffect(() => {
    const handleScroll = () => {
      // Clear existing timeout
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }

      // Throttle scroll handling
      scrollTimeout.current = setTimeout(() => {
        const currentScrollY = window.scrollY;
        const scrollDifference = currentScrollY - lastScrollY.current;
        
        // Only react to significant scroll movements (> 5px to avoid jitter)
        if (Math.abs(scrollDifference) > 5) {
          if (scrollDifference > 0 && currentScrollY > 100) {
            // Scrolling down & not at top - hide navbar
            setNavbarVisible(false);
          } else if (scrollDifference < 0) {
            // Scrolling up - show navbar
            setNavbarVisible(true);
          }
          
          // Always show navbar when near top (< 100px)
          if (currentScrollY < 100) {
            setNavbarVisible(true);
          }
        }
        
        lastScrollY.current = currentScrollY;
      }, 10); // 10ms throttle for smooth response
    };

    // Initialize last scroll position
    lastScrollY.current = window.scrollY;

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, []);

  // Persist preferences to localStorage
  useEffect(() => {
    localStorage.setItem('manga-reading-mode', readingMode);
  }, [readingMode]);

  useEffect(() => {
    localStorage.setItem('manga-fit-width', fitWidth.toString());
  }, [fitWidth]);

  useEffect(() => {
    localStorage.setItem('manga-dark-mode', darkMode.toString());
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('manga-reading-direction', readingDirection);
  }, [readingDirection]);

  // UI auto-hide functionality
  const resetUITimer = useCallback(() => {
    setShowUI(true);
    if (uiTimeoutRef.current) {
      clearTimeout(uiTimeoutRef.current);
    }
    uiTimeoutRef.current = setTimeout(() => {
      setShowUI(false);
    }, 3000);
  }, []);

  useEffect(() => {
    resetUITimer();
    return () => {
      if (uiTimeoutRef.current) {
        clearTimeout(uiTimeoutRef.current);
      }
    };
  }, [currentPageIndex, resetUITimer]);

  // Create a stable debounced save function with flush capability
  const debouncedSaveProgress = useMemo(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    let pendingData: { seriesId: string; chapterId: string; lastReadPage: number } | null = null;

    const save = (data: { seriesId: string; chapterId: string; lastReadPage: number }) => {
      pendingData = data;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        if (pendingData) {
          saveProgress(pendingData);
        }
        timeoutId = null;
        pendingData = null;
      }, 2000); // 2 second debounce (reduced from 5 seconds)
    };

    save.flush = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (pendingData) {
        saveProgress(pendingData);
        pendingData = null;
      }
    };

    return save;
  }, [saveProgress]);

  // Auto-save reading progress with debouncing and immediate flush on page change
  useEffect(() => {
    if (!seriesId || !currentChapter || pages.length === 0) return;

    // Immediately flush and save on page change to capture progress for fast readers
    const saveData = {
      seriesId,
      chapterId: currentChapter.id,
      lastReadPage: currentPageIndex,
    };
    
    // Flush any pending save first (ensures previous page is saved)
    debouncedSaveProgress.flush();
    
    // Then set up debounced save for this page
    debouncedSaveProgress(saveData);

    // Flush on unmount to ensure progress is saved when user navigates away
    return () => {
      debouncedSaveProgress.flush();
    };
  }, [seriesId, currentChapter, currentPageIndex, pages.length, debouncedSaveProgress]);

  // Navigation functions
  const handleNextPage = useCallback(() => {
    // In webtoon mode, scroll to next page
    if (readingMode === 'webtoon') {
      const images = document.querySelectorAll('.webtoon-page-image');
      const nextIndex = readingDirection === 'rtl' 
        ? Math.max(currentPageIndex - 1, 0)
        : Math.min(currentPageIndex + 1, images.length - 1);
      const nextImage = images[nextIndex] as HTMLElement;
      nextImage?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    // Calculate step based on reading mode  
    const step = readingMode === 'double' ? 2 : 1;
    
    // Apply reading direction - in RTL, "next" means going backwards through pages
    let targetIndex;
    let targetChapter;
    
    if (readingDirection === 'rtl') {
      targetIndex = currentPageIndex - step;
      targetChapter = previousChapter;
      
      // Check if we're at the beginning of the chapter
      if (targetIndex < 0) {
        if (targetChapter) {
          navigate(`/manga/${seriesId}/chapter/${targetChapter.chapterNumber}`);
        }
        return;
      }
    } else {
      targetIndex = currentPageIndex + step;
      targetChapter = nextChapter;
      
      // Check if we're at the end of the chapter
      if (targetIndex >= pages.length) {
        if (targetChapter) {
          navigate(`/manga/${seriesId}/chapter/${targetChapter.chapterNumber}`);
        }
        return;
      }
    }
    
    // Navigate within current chapter
    setCurrentPageIndex(targetIndex);
    resetUITimer();
  }, [currentPageIndex, pages.length, nextChapter, previousChapter, seriesId, navigate, resetUITimer, readingMode, readingDirection]);

  const handlePreviousPage = useCallback(() => {
    // In webtoon mode, scroll to previous page
    if (readingMode === 'webtoon') {
      const images = document.querySelectorAll('.webtoon-page-image');
      const prevIndex = readingDirection === 'rtl'
        ? Math.min(currentPageIndex + 1, images.length - 1)
        : Math.max(currentPageIndex - 1, 0);
      const prevImage = images[prevIndex] as HTMLElement;
      prevImage?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    // Calculate step based on reading mode
    const step = readingMode === 'double' ? 2 : 1;
    
    // Apply reading direction - in RTL, "previous" means going forwards through pages
    let targetIndex;
    let targetChapter;
    
    if (readingDirection === 'rtl') {
      targetIndex = currentPageIndex + step;
      targetChapter = nextChapter;
      
      // Check if we're at the end of the chapter
      if (targetIndex >= pages.length) {
        if (targetChapter) {
          navigate(`/manga/${seriesId}/chapter/${targetChapter.chapterNumber}`);
        }
        return;
      }
    } else {
      targetIndex = currentPageIndex - step;
      targetChapter = previousChapter;
      
      // Check if we're at the beginning of the chapter
      if (targetIndex < 0) {
        if (targetChapter) {
          navigate(`/manga/${seriesId}/chapter/${targetChapter.chapterNumber}`);
        }
        return;
      }
    }
    
    // Navigate within current chapter
    setCurrentPageIndex(targetIndex);
    resetUITimer();
  }, [currentPageIndex, previousChapter, nextChapter, seriesId, navigate, resetUITimer, readingMode, readingDirection]);

  const handleNextChapter = useCallback(() => {
    if (nextChapter) {
      navigate(`/manga/${seriesId}/chapter/${nextChapter.chapterNumber}`);
    }
  }, [nextChapter, seriesId, navigate]);

  const handlePreviousChapter = useCallback(() => {
    if (previousChapter) {
      navigate(`/manga/${seriesId}/chapter/${previousChapter.chapterNumber}`);
    }
  }, [previousChapter, seriesId, navigate]);

  // Zoom functions
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1);
  }, []);

  // Touch handlers for mobile gestures
  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
  }, []);

  const handleTouchEnd = useCallback((event: React.TouchEvent) => {
    if (!touchStart) return;

    const touch = event.changedTouches[0];
    const deltaX = touchStart.x - touch.clientX;
    const deltaY = Math.abs(touchStart.y - touch.clientY);
    
    // Only trigger if horizontal swipe is significantly larger than vertical
    if (Math.abs(deltaX) > 50 && deltaY < 100) {
      if (deltaX > 0) {
        handleNextPage(); // Swipe left = next page
      } else {
        handlePreviousPage(); // Swipe right = previous page
      }
    }

    setTouchStart(null);
  }, [touchStart, handleNextPage, handlePreviousPage]);

  // Image load handler
  const handleImageLoad = useCallback((index: number) => {
    setImageLoading(prev => {
      const newState = [...prev];
      newState[index] = false;
      return newState;
    });
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          handlePreviousPage();
          break;
        case "ArrowRight":
        case " ":
          event.preventDefault();
          handleNextPage();
          break;
        case "ArrowUp":
          event.preventDefault();
          handlePreviousChapter();
          break;
        case "ArrowDown":
          event.preventDefault();
          handleNextChapter();
          break;
        case "Escape":
          event.preventDefault();
          navigate(`/manga/${seriesId}`);
          break;
        case "f":
          event.preventDefault();
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePreviousPage, handleNextPage, handlePreviousChapter, handleNextChapter, navigate, seriesId, toggleFullscreen]);

  // Page click navigation
  const handlePageClick = useCallback((event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const clickPosition = x / rect.width;

    if (clickPosition < 0.3) {
      handlePreviousPage();
    } else if (clickPosition > 0.7) {
      handleNextPage();
    } else {
      resetUITimer();
    }
  }, [handleNextPage, handlePreviousPage, resetUITimer]);

  // Jump to page functionality
  const handleJumpToPage = useCallback((pageNumber: number) => {
    const targetPage = Math.max(1, Math.min(pageNumber, pages.length));
    const targetIndex = targetPage - 1;
    
    if (readingMode === 'webtoon') {
      // In webtoon mode, scroll to the target image and update currentPageIndex immediately for UI sync
      const images = document.querySelectorAll('.webtoon-page-image');
      const targetImage = images[targetIndex] as HTMLElement;
      if (targetImage) {
        setCurrentPageIndex(targetIndex); // Immediate sync for UI
        targetImage.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else if (readingMode === 'double') {
      // In double-page mode, align to proper spread boundaries
      let alignedIndex = targetIndex;
      
      // Ensure we show the requested page as the primary visible page
      // For LTR: align so target page is visible (prefer left side display)
      // For RTL: align so target page is visible (prefer right side display)
      if (readingDirection === 'rtl') {
        // In RTL, ensure target page appears on the right (primary) side
        // For odd targetIndex, keep it; for even targetIndex, adjust to make it the right page
        alignedIndex = targetIndex - ((targetIndex + 1) % 2);
      } else {
        // In LTR, ensure target page appears on the left (primary) side  
        // For even targetIndex, keep it; for odd targetIndex, align to make it the left page
        alignedIndex = targetIndex - (targetIndex % 2);
      }
      
      setCurrentPageIndex(Math.max(0, Math.min(alignedIndex, pages.length - 1)));
    } else {
      // In single-page mode, set the page index directly
      setCurrentPageIndex(targetIndex);
    }
    
    setShowJumpToPage(false);
    setJumpPageInput('');
    resetUITimer();
  }, [pages.length, readingMode, readingDirection, resetUITimer]);

  const handleJumpPageInputSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const pageNumber = parseInt(jumpPageInput);
    // Always jump even if input is invalid - clamp to valid range
    if (!isNaN(pageNumber)) {
      handleJumpToPage(pageNumber); // handleJumpToPage already clamps to valid range
    } else if (jumpPageInput.trim()) {
      // If input is non-empty but invalid, jump to page 1 as fallback
      handleJumpToPage(1);
    }
  }, [jumpPageInput, handleJumpToPage]);

  // Handle escape key to cancel jump-to-page
  const handleJumpPageKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowJumpToPage(false);
      setJumpPageInput('');
    }
  }, []);

  // Continue reading handlers
  const handleContinueReading = useCallback(() => {
    if (savedPageIndex !== null) {
      if (readingMode === 'webtoon') {
        setCurrentPageIndex(savedPageIndex);
        // In webtoon mode, scroll to the saved page
        setTimeout(() => {
          const images = document.querySelectorAll('.webtoon-page-image');
          const targetImage = images[savedPageIndex] as HTMLElement;
          if (targetImage) {
            targetImage.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      } else if (readingMode === 'double') {
        // Apply same spread alignment logic as handleJumpToPage
        let alignedIndex = savedPageIndex;
        
        if (readingDirection === 'rtl') {
          // In RTL, ensure target page appears on the right (primary) side
          alignedIndex = savedPageIndex - ((savedPageIndex + 1) % 2);
        } else {
          // In LTR, ensure target page appears on the left (primary) side  
          alignedIndex = savedPageIndex - (savedPageIndex % 2);
        }
        
        setCurrentPageIndex(Math.max(0, Math.min(alignedIndex, pages.length - 1)));
      } else {
        // Single-page mode, set directly
        setCurrentPageIndex(savedPageIndex);
      }
      
      setShowContinueReading(false);
    }
  }, [savedPageIndex, readingMode, readingDirection, pages.length]);

  const handleDismissContinueReading = useCallback(() => {
    setShowContinueReading(false);
    continueDismissedRef.current = true; // Mark as dismissed for this session
  }, []);

  // Check if jump page input is valid
  const isJumpPageInputValid = useCallback(() => {
    if (!jumpPageInput.trim()) return false;
    const pageNumber = parseInt(jumpPageInput);
    return !isNaN(pageNumber) && pageNumber >= 1 && pageNumber <= pages.length;
  }, [jumpPageInput, pages.length]);

  // Enhanced lazy loading helpers for non-vertical modes
  const updatePreloadedPages = useCallback((currentIndex: number) => {
    const bufferSize = readingMode === 'webtoon' ? 5 : readingMode === 'double' ? 2 : 1;
    const start = Math.max(0, currentIndex - bufferSize);
    const end = Math.min(pages.length - 1, currentIndex + bufferSize);
    
    const newPreloadedPages = new Set<number>();
    for (let i = start; i <= end; i++) {
      newPreloadedPages.add(i);
    }
    setPreloadedPages(newPreloadedPages);
  }, [pages.length, readingMode]);

  // Prefetch next chapter when near end
  const checkNextChapterPrefetch = useCallback(() => {
    if (!nextChapter || nextChapterPreloaded) return;
    
    const pagesRemaining = pages.length - currentPageIndex;
    const shouldPrefetch = pagesRemaining <= 3; // Prefetch when 3 pages or less remaining
    
    if (shouldPrefetch && nextChapter) {
      // Start prefetching next chapter's first few pages
      setNextChapterPreloaded(true);
      // Note: This would typically fetch from API, but for now just mark as prefetched
    }
  }, [currentPageIndex, pages.length, nextChapter, nextChapterPreloaded]);

  // Smart preloading based on reading direction and mode
  const getPreloadIndices = useCallback((currentIndex: number): number[] => {
    const preloadCount = readingMode === 'webtoon' ? 5 : 3;
    const indices: number[] = [];
    
    if (readingDirection === 'rtl') {
      // In RTL, preload previous pages
      for (let i = 1; i <= preloadCount; i++) {
        const idx = currentIndex - i;
        if (idx >= 0) indices.push(idx);
      }
    } else {
      // In LTR, preload next pages
      for (let i = 1; i <= preloadCount; i++) {
        const idx = currentIndex + i;
        if (idx < pages.length) indices.push(idx);
      }
    }
    
    return indices;
  }, [readingMode, readingDirection, pages.length]);

  // Update preloading when page changes (for next chapter prefetch)
  useEffect(() => {
    checkNextChapterPrefetch();
  }, [currentPageIndex, checkNextChapterPrefetch]);


  // Save reading position when user navigates (with debounce and guards)
  useEffect(() => {
    if (pages.length === 0 || currentPageIndex < 0) return;
    
    // Don't save if we're on the first page of the chapter
    if (currentPageIndex === 0) return;
    
    // Don't save while continue reading banner is showing to prevent overwriting
    if (showContinueReading) return;
    
    // Debounce saving to avoid excessive localStorage writes
    const timeoutId = setTimeout(() => {
      saveReadPosition(currentPageIndex);
    }, 1000); // Save after 1 second of no page changes
    
    return () => clearTimeout(timeoutId);
  }, [currentPageIndex, pages.length, showContinueReading, saveReadPosition]);

  // Preloaded pages management for non-webtoon modes only
  useEffect(() => {
    if (readingMode !== 'webtoon') {
      // For single/double page modes, use traditional preloading
      const preloadIndices = getPreloadIndices(currentPageIndex);
      const newPreloaded = new Set<number>();
      
      // Add current page and preload indices
      newPreloaded.add(currentPageIndex);
      preloadIndices.forEach(index => newPreloaded.add(index));
      
      setPreloadedPages(newPreloaded);
    }
    // Note: Vertical mode bypasses preloadedPages entirely - all pages render continuously
  }, [currentPageIndex, readingMode, getPreloadIndices]);

  // Reset lazy loading state when chapter changes
  useEffect(() => {
    if (pages.length === 0) return;
    
    // Initialize preloaded pages only for non-webtoon modes
    if (readingMode !== 'webtoon') {
      let initialPreloaded = new Set<number>();
      
      if (readingDirection === 'rtl') {
        // RTL: Start from the last page
        const lastPageIndex = pages.length - 1;
        const start = Math.max(0, lastPageIndex - 4);
        for (let i = start; i <= lastPageIndex; i++) {
          initialPreloaded.add(i);
        }
      } else {
        // LTR: Start from the first page
        const end = Math.min(4, pages.length - 1);
        for (let i = 0; i <= end; i++) {
          initialPreloaded.add(i);
        }
      }
      
      setPreloadedPages(initialPreloaded);
    }
    // Note: Vertical mode doesn't use preloadedPages - all images render continuously
    
    setNextChapterPreloaded(false);
  }, [chapterNumber, seriesId, pages.length, readingDirection, readingMode]);

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      if (sentinelObserverRef.current) {
        sentinelObserverRef.current.disconnect();
        sentinelObserverRef.current = null;
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading chapter...</p>
        </div>
      </div>
    );
  }

  if (accessLoading || balanceLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Checking access...</p>
        </div>
      </div>
    );
  }

  if (accessError) {
    const isUnauthorized = accessError.message === "UNAUTHORIZED";
    
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-gray-800/50 border-gray-700 backdrop-blur-md">
          <div className="p-8 text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-full flex items-center justify-center">
              <Lock className="w-10 h-10 text-yellow-500" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">
                {isUnauthorized ? "Login Required" : "Access Check Failed"}
              </h2>
              <p className="text-gray-400">
                {isUnauthorized 
                  ? "Please log in to check if you have access to this chapter"
                  : "Unable to verify chapter access. Please try again."}
              </p>
            </div>

            <div className="space-y-3">
              <Button
                onClick={() => navigate(isUnauthorized ? "/login?returnTo=" + encodeURIComponent(window.location.pathname) : `/series/${seriesId}`)}
                className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white"
                size="lg"
              >
                {isUnauthorized ? "Log In" : "Back to Series"}
              </Button>

              <Button
                variant="outline"
                onClick={() => navigate(`/manga/${seriesId}`)}
                className="w-full border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Series
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (accessData && !accessData.hasAccess) {
    const userBalance = balanceData?.balance || 0;
    const canAfford = userBalance >= accessData.unlockCost;

    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-gray-800/50 border-gray-700 backdrop-blur-md">
          <div className="p-8 text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center">
              <Lock className="w-10 h-10 text-primary" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">Premium Chapter</h2>
              <p className="text-gray-400">
                This chapter requires {accessData.unlockCost} coins to unlock
              </p>
            </div>

            <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Your Balance:</span>
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-primary" />
                  <span className="text-xl font-bold text-white">{userBalance}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {canAfford ? (
                <Button
                  onClick={() => currentChapter && unlockChapter(currentChapter.id)}
                  disabled={isUnlocking}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white"
                  size="lg"
                >
                  {isUnlocking ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Unlocking...
                    </>
                  ) : (
                    <>
                      <Lock className="w-5 h-5 mr-2" />
                      Unlock for {accessData.unlockCost} Coins
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={() => navigate("/shop")}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white"
                  size="lg"
                >
                  <Coins className="w-5 h-5 mr-2" />
                  Get More Coins
                </Button>
              )}

              <Button
                variant="outline"
                onClick={() => navigate(`/manga/${seriesId}`)}
                className="w-full border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Series
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (isError || !currentChapter) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Chapter Not Found</h1>
          <p className="text-gray-400 mb-6">
            {error instanceof Error ? error.message : "The chapter you're looking for doesn't exist."}
          </p>
          <Link href={`/manga/${seriesId}`}>
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Manga
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Show empty state when chapter exists but has no pages
  if (currentChapter && pages.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        {/* Clean header similar to kunmanga.com */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Link href={`/manga/${seriesId}`}>
                  <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900 hover:bg-gray-100">
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back
                  </Button>
                </Link>
                <Link href="/">
                  <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900 hover:bg-gray-100">
                    <Home className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
              
              <div className="flex gap-2">
                {previousChapter && (
                  <Link href={`/manga/${seriesId}/chapter/${previousChapter.chapterNumber}`}>
                    <Button variant="outline" size="sm" className="text-xs">
                      <ChevronLeft className="w-3 h-3 mr-1" />
                      Prev
                    </Button>
                  </Link>
                )}
                {nextChapter && (
                  <Link href={`/manga/${seriesId}/chapter/${nextChapter.chapterNumber}`}>
                    <Button size="sm" className="text-xs bg-indigo-600 hover:bg-indigo-700">
                      Next
                      <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
            
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                {manga?.title || "Loading..."}
              </h1>
              <h2 className="text-lg text-gray-600">
                Chapter {currentChapter.chapterNumber}
                {currentChapter.title && ` - ${currentChapter.title}`}
              </h2>
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center">
            {/* Clean notice box */}
            <div className="max-w-2xl mx-auto">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 mb-8">
                <div className="w-16 h-16 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                  <Book className="w-8 h-8 text-gray-400" />
                </div>
                
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  Chapter Not Available
                </h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  This chapter hasn't been uploaded yet. Please check back later or explore other available chapters.
                </p>
                
                {/* Chapter info */}
                <div className="bg-white border border-gray-100 rounded-md p-4 mb-6">
                  <div className="flex items-center justify-center gap-8 text-sm">
                    <div>
                      <span className="text-gray-500">Chapter:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {chapterIndex + 1} of {totalChapters}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Status:</span>
                      <span className="ml-2 text-orange-600 font-medium">Coming Soon</span>
                    </div>
                  </div>
                </div>

                {/* Navigation buttons */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link href={`/manga/${seriesId}`}>
                    <Button variant="outline" className="w-full sm:w-auto">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to Series
                    </Button>
                  </Link>
                  
                  {previousChapter && (
                    <Link href={`/manga/${seriesId}/chapter/${previousChapter.chapterNumber}`}>
                      <Button variant="outline" className="w-full sm:w-auto border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                        <ChevronLeft className="w-4 h-4 mr-2" />
                        Previous Chapter
                      </Button>
                    </Link>
                  )}
                  
                  {nextChapter && (
                    <Link href={`/manga/${seriesId}/chapter/${nextChapter.chapterNumber}`}>
                      <Button className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700">
                        Next Chapter
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom navigation bar similar to kunmanga.com */}
        <div className="border-t border-gray-200 bg-white">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              {previousChapter ? (
                <Link href={`/manga/${seriesId}/chapter/${previousChapter.chapterNumber}`}>
                  <Button variant="outline" className="flex items-center">
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Previous Chapter
                  </Button>
                </Link>
              ) : (
                <div></div>
              )}
              
              <div className="text-sm text-gray-500">
                Chapter {chapterIndex + 1} of {totalChapters}
              </div>
              
              {nextChapter ? (
                <Link href={`/manga/${seriesId}/chapter/${nextChapter.chapterNumber}`}>
                  <Button className="bg-indigo-600 hover:bg-indigo-700">
                    Next Chapter
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              ) : (
                <div></div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Guard progress calculation against division by zero
  const currentProgress = pages.length > 0 ? ((currentPageIndex + 1) / pages.length) * 100 : 0;

  return (
    <div className={cn(
      "min-h-screen relative flex flex-col transition-colors duration-300",
      darkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"
    )}>
      <SEO 
        title={
          manga?.title && currentChapter?.chapterNumber
            ? `${manga.title} - Chapter ${currentChapter.chapterNumber} | AmourScans`
            : "Read Manga Chapters Online - AmourScans Reader Platform"
        }
        description={
          manga?.title && currentChapter?.chapterNumber
            ? `Read ${manga.title} Chapter ${currentChapter.chapterNumber}${currentChapter.title ? ` - ${currentChapter.title}` : ''} online on AmourScans. Enjoy high-quality manga scans and the best reading experience.`
            : "Read manga chapters online on AmourScans. Continue your manga reading journey with high-quality scans, the latest chapters, and an amazing reading experience today."
        }
        keywords={`${manga?.title || 'manga'}, chapter ${currentChapter?.chapterNumber || ''}, read manga online, manga reader, manhwa reader`}
        type="article"
      />
      {/* Continue reading notification */}
      {showContinueReading && savedPageIndex !== null && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-40 animate-in slide-in-from-top duration-300">
          <div className={cn(
            "bg-white rounded-lg shadow-lg border p-4 mx-4 min-w-80",
            darkMode && "bg-gray-800 border-gray-700"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h4 className={cn(
                  "font-semibold text-sm mb-1",
                  darkMode ? "text-gray-100" : "text-gray-900"
                )}>
                  Continue Reading
                </h4>
                <p className={cn(
                  "text-sm",
                  darkMode ? "text-gray-300" : "text-gray-600"
                )}>
                  You were on page {savedPageIndex + 1} of {pages.length}
                </p>
              </div>
              
              <div className="flex space-x-2 ml-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDismissContinueReading}
                  className="text-xs"
                >
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  onClick={handleContinueReading}
                  className="text-xs"
                >
                  Continue
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modern Header */}
      <header 
        className={cn(
          "sticky top-0 z-50 border-b backdrop-blur-sm",
          darkMode 
            ? "bg-gray-900/95 border-gray-800" 
            : "bg-white/95 border-gray-200",
          showUI ? "opacity-100" : "opacity-90"
        )}
        style={{
          transform: navbarVisible ? 'translateY(0)' : 'translateY(-100%)',
          transition: 'transform 150ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left Section - Navigation */}
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowSidebar(!showSidebar)}
              className={cn(
                darkMode ? "text-gray-300 hover:text-white hover:bg-gray-800" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              )}
            >
              <Menu className="w-4 h-4" />
            </Button>
            
            <Link href={`/manga/${seriesId}`}>
              <Button 
                variant="ghost" 
                size="sm"
                className={cn(
                  darkMode ? "text-gray-300 hover:text-white hover:bg-gray-800" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                )}
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Back</span>
              </Button>
            </Link>
            
            <Link href="/">
              <Button 
                variant="ghost" 
                size="sm"
                className={cn(
                  darkMode ? "text-gray-300 hover:text-white hover:bg-gray-800" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                )}
              >
                <Home className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          {/* Center Section - Title */}
          <div className="flex-1 text-center mx-4 min-w-0">
            <h1 className={cn(
              "text-base font-semibold truncate",
              darkMode ? "text-white" : "text-gray-900"
            )}>
              {manga?.title || "Loading..."}
            </h1>
            <p className={cn(
              "text-xs truncate",
              darkMode ? "text-gray-400" : "text-gray-500"
            )}>
              Chapter {currentChapter?.chapterNumber}
              {currentChapter?.title && ` - ${currentChapter.title}`}
            </p>
          </div>

          {/* Right Section - Controls */}
          <div className="flex items-center gap-1">
            {/* Chapter Navigation */}
            <div className="hidden sm:flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePreviousChapter}
                disabled={!previousChapter}
                className={cn(
                  "text-xs",
                  darkMode ? "text-gray-300 hover:text-white hover:bg-gray-800" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                )}
              >
                <ChevronLeft className="w-3 h-3" />
                Prev
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNextChapter}
                disabled={!nextChapter}
                className={cn(
                  "text-xs",
                  darkMode ? "text-gray-300 hover:text-white hover:bg-gray-800" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                )}
              >
                Next
                <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
            
            {/* Settings */}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                darkMode ? "text-gray-300 hover:text-white hover:bg-gray-800" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              )}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        {pages.length > 0 && (
          <div className="px-4 pb-2">
            <div className={cn(
              "relative h-1 rounded-full overflow-hidden",
              darkMode ? "bg-gray-800" : "bg-gray-200"
            )}>
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  "bg-gradient-to-r from-blue-500 to-purple-500"
                )}
                style={{ width: `${currentProgress}%` }}
              />
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 relative overflow-hidden">
        {/* Sidebar */}
        <div className={cn(
          "fixed left-0 z-[70] w-64 transform transition-transform duration-300",
          "top-0",
          "bottom-0",
          showSidebar ? "translate-x-0" : "-translate-x-full",
          darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200",
          "border-r flex flex-col shadow-2xl"
        )}>
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b border-current border-opacity-20 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Button
                variant={sidebarTab === 'chapters' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSidebarTab('chapters')}
                className="text-xs"
              >
                <List className="w-3 h-3 mr-1" />
                Ch
              </Button>
              <Button
                variant={sidebarTab === 'pages' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSidebarTab('pages')}
                className="text-xs"
              >
                <Grid className="w-3 h-3 mr-1" />
                Pages
              </Button>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowSidebar(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          
          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto">
            {sidebarTab === 'chapters' && (
              <div className="p-2 space-y-3">
                {/* Search Input */}
                <div className="relative">
                  <Search className={cn(
                    "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4",
                    darkMode ? "text-gray-400" : "text-gray-500"
                  )} />
                  <input
                    type="text"
                    placeholder="Search chapters..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={cn(
                      "w-full pl-10 pr-4 py-2 text-sm rounded-md border transition-colors",
                      darkMode 
                        ? "bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                        : "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500",
                      "focus:outline-none"
                    )}
                  />
                </div>

                {/* Chapter List */}
                <div className="space-y-1">
                  {chapters?.filter(chapter => 
                    searchQuery === '' || 
                    chapter.chapterNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    chapter.title?.toLowerCase().includes(searchQuery.toLowerCase())
                  ).map((chapter) => (
                    <Link 
                      key={chapter.id} 
                      href={`/manga/${seriesId}/chapter/${chapter.chapterNumber}`}
                    >
                      <Button
                        variant={chapter.chapterNumber === currentChapter?.chapterNumber ? 'secondary' : 'ghost'}
                        className={cn(
                          "w-full justify-start text-left h-auto py-3 px-3 transition-colors",
                          chapter.chapterNumber === currentChapter?.chapterNumber && "bg-blue-100 dark:bg-blue-900/30"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">
                            Chapter {chapter.chapterNumber}
                          </div>
                          {chapter.title && (
                            <div className={cn(
                              "text-xs truncate",
                              darkMode ? "text-gray-400" : "text-gray-500"
                            )}>
                              {chapter.title}
                            </div>
                          )}
                        </div>
                        {chapter.chapterNumber === currentChapter?.chapterNumber && (
                          <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500"></div>
                        )}
                      </Button>
                    </Link>
                  ))}
                  
                  {/* No Results Message */}
                  {searchQuery && chapters?.filter(chapter => 
                    chapter.chapterNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    chapter.title?.toLowerCase().includes(searchQuery.toLowerCase())
                  ).length === 0 && (
                    <div className={cn(
                      "text-center py-8 text-sm",
                      darkMode ? "text-gray-400" : "text-gray-500"
                    )}>
                      No chapters found for "{searchQuery}"
                    </div>
                  )}
                </div>
              </div>
            )}

            {sidebarTab === 'pages' && pages.length > 0 && (
              <div className="p-2">
                <div className="grid grid-cols-2 gap-2">
                  {pages.map((page, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setCurrentPageIndex(index);
                        if (readingMode === 'webtoon') {
                          const pageElement = document.querySelector(`[data-page-index="${index}"]`);
                          pageElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                        setShowSidebar(false);
                      }}
                      className={cn(
                        "relative aspect-[3/4] rounded-md overflow-hidden border-2 transition-all duration-200",
                        index === currentPageIndex 
                          ? "border-blue-500 shadow-lg" 
                          : "border-gray-300 dark:border-gray-600 hover:border-gray-400",
                        "bg-gray-100 dark:bg-gray-700"
                      )}
                    >
                      <img
                        src={page}
                        alt={`Page ${index + 1}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className={cn(
                        "absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs py-1 px-2 text-center",
                        index === currentPageIndex && "bg-blue-500"
                      )}>
                        {index + 1}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Sidebar Ad - Non-intrusive at bottom */}
            <div className="p-2 border-t border-current border-opacity-20 mt-auto">
              <AdDisplay 
                page="reader" location="bottom_banner" 
                type="sidebar"
                className="w-full"
                maxAds={1}
              />
            </div>
          </div>
        </div>

        {/* Sidebar Overlay for mobile */}
        {showSidebar && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-[60] lg:hidden"
            onClick={() => setShowSidebar(false)}
          />
        )}

        {/* Main Reader Area */}
        <div 
          className="flex-1 relative overflow-hidden"
          onClick={(e) => {
            // Tap zones for mobile navigation (left 30%, right 30%, center 40%)
            if (readingMode !== 'webtoon') {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const relativeX = clickX / rect.width;
              
              // Respect reading direction for tap zones
              // RTL (manga): left=next, right=previous
              // LTR: left=previous, right=next
              if (relativeX < 0.3) {
                if (readingDirection === 'rtl') {
                  handleNextPage();
                } else {
                  handlePreviousPage();
                }
                return;
              }
              if (relativeX > 0.7) {
                if (readingDirection === 'rtl') {
                  handlePreviousPage();
                } else {
                  handleNextPage();
                }
                return;
              }
            }
            
            // Center tap - toggle UI
            setShowUI(true);
            if (uiTimeoutRef.current) {
              clearTimeout(uiTimeoutRef.current);
            }
            uiTimeoutRef.current = setTimeout(() => {
              setShowUI(false);
            }, 3000);
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Image Display Container */}
          <div className={cn(
            "relative w-full h-full flex items-center justify-center",
            darkMode ? "bg-gray-900" : "bg-gray-50"
          )}>
            {pages.length > 0 && (
              <>
                {/* Webtoon Mode - Continuous Vertical Reading */}
                {readingMode === 'webtoon' && (
                  <div className="w-full max-w-4xl mx-auto">
                    {pages.map((pageUrl, index) => {
                      return (
                        <div
                          key={index}
                          className="flex justify-center relative"
                          data-page-index={index}
                        >
                          {/* Individual loading spinner for each image */}
                          {imageLoading[index] && (
                            <div className="absolute inset-0 flex items-center justify-center z-10">
                              <div className={cn(
                                "flex flex-col items-center justify-center p-8 rounded-lg",
                                darkMode ? "bg-gray-800/80" : "bg-white/80"
                              )}>
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
                                <p className={cn(
                                  "text-sm font-medium",
                                  darkMode ? "text-gray-300" : "text-gray-600"
                                )}>
                                  Loading Page {index + 1}...
                                </p>
                              </div>
                            </div>
                          )}
                          
                          <img
                            src={pageUrl}
                            alt={`Page ${index + 1}`}
                            className={cn(
                              "webtoon-page-image max-w-full h-auto transition-opacity duration-300 block",
                              imageLoading[index] ? "opacity-30" : "opacity-100",
                              fitWidth ? "w-full" : "max-h-screen"
                            )}
                            style={{ 
                              transform: `scale(${zoom})`,
                              transformOrigin: 'center top'
                            }}
                            onLoad={() => handleImageLoad(index)}
                            onError={() => handleImageLoad(index)}
                            draggable={false}
                            loading="lazy" // Use browser native lazy loading for all images
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Single Page Mode */}
                {readingMode === 'single' && (
                  <div className="relative flex items-center justify-center w-full h-full">
                    <img
                      ref={imageRef}
                      src={pages[currentPageIndex]}
                      alt={`Page ${currentPageIndex + 1}`}
                      className={cn(
                        "max-w-full max-h-full object-contain transition-all duration-200",
                        imageLoading[currentPageIndex] ? "opacity-0" : "opacity-100"
                      )}
                      style={{
                        transform: `scale(${zoom})`,
                        width: fitWidth ? '100%' : 'auto',
                        height: fitWidth ? 'auto' : '100%',
                      }}
                      onLoad={() => handleImageLoad(currentPageIndex)}
                      onError={() => handleImageLoad(currentPageIndex)}
                      onClick={handlePageClick}
                      draggable={false}
                    />
                  </div>
                )}

                {/* Double Page Mode */}
                {readingMode === 'double' && (
                  <div className="relative flex items-center justify-center w-full h-full gap-2">
                    {/* Left Page */}
                    {readingDirection === 'rtl' ? (
                      currentPageIndex + 1 < pages.length && (
                        <img
                          src={pages[currentPageIndex + 1]}
                          alt={`Page ${currentPageIndex + 2}`}
                          className={cn(
                            "max-h-full object-contain transition-all duration-200",
                            imageLoading[currentPageIndex + 1] ? "opacity-0" : "opacity-100"
                          )}
                          style={{
                            transform: `scale(${zoom})`,
                            maxWidth: '50%',
                          }}
                          onLoad={() => handleImageLoad(currentPageIndex + 1)}
                          onError={() => handleImageLoad(currentPageIndex + 1)}
                          onClick={handlePreviousPage}
                          draggable={false}
                        />
                      )
                    ) : (
                      <img
                        src={pages[currentPageIndex]}
                        alt={`Page ${currentPageIndex + 1}`}
                        className={cn(
                          "max-h-full object-contain transition-all duration-200",
                          imageLoading[currentPageIndex] ? "opacity-0" : "opacity-100"
                        )}
                        style={{
                          transform: `scale(${zoom})`,
                          maxWidth: '50%',
                        }}
                        onLoad={() => handleImageLoad(currentPageIndex)}
                        onError={() => handleImageLoad(currentPageIndex)}
                        onClick={handlePreviousPage}
                        draggable={false}
                      />
                    )}

                    {/* Right Page */}
                    {readingDirection === 'rtl' ? (
                      <img
                        src={pages[currentPageIndex]}
                        alt={`Page ${currentPageIndex + 1}`}
                        className={cn(
                          "max-h-full object-contain transition-all duration-200",
                          imageLoading[currentPageIndex] ? "opacity-0" : "opacity-100"
                        )}
                        style={{
                          transform: `scale(${zoom})`,
                          maxWidth: '50%',
                        }}
                        onLoad={() => handleImageLoad(currentPageIndex)}
                        onError={() => handleImageLoad(currentPageIndex)}
                        onClick={handleNextPage}
                        draggable={false}
                      />
                    ) : (
                      currentPageIndex + 1 < pages.length && (
                        <img
                          src={pages[currentPageIndex + 1]}
                          alt={`Page ${currentPageIndex + 2}`}
                          className={cn(
                            "max-h-full object-contain transition-all duration-200",
                            imageLoading[currentPageIndex + 1] ? "opacity-0" : "opacity-100"
                          )}
                          style={{
                            transform: `scale(${zoom})`,
                            maxWidth: '50%',
                          }}
                          onLoad={() => handleImageLoad(currentPageIndex + 1)}
                          onError={() => handleImageLoad(currentPageIndex + 1)}
                          onClick={handleNextPage}
                          draggable={false}
                        />
                      )
                    )}
                  </div>
                )}
              </>
            )}

            {/* Loading indicator */}
            {pages.length > 0 && imageLoading.some(loading => loading) && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            )}


            {/* Mobile touch areas for navigation */}
            <div className="md:hidden absolute inset-0 pointer-events-none">
              <div 
                className="absolute left-0 top-0 bottom-0 w-1/3 pointer-events-auto"
                onClick={handlePreviousPage}
              />
              <div 
                className="absolute right-0 top-0 bottom-0 w-1/3 pointer-events-auto"
                onClick={handleNextPage}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Modern Footer */}
      {pages.length > 0 && (
        <footer className={cn(
          "sticky bottom-0 z-50 border-t backdrop-blur-sm transition-all duration-300",
          darkMode 
            ? "bg-gray-900/95 border-gray-800" 
            : "bg-white/95 border-gray-200",
          showUI ? "opacity-100" : "opacity-90"
        )}>
          <div className="flex items-center justify-between px-4 py-3">
            {/* Left - Page Info */}
            <div className="flex items-center gap-3">
              <span className={cn(
                "text-sm font-medium",
                darkMode ? "text-gray-300" : "text-gray-600"
              )}>
                {currentPageIndex + 1} / {pages.length}
              </span>
              <div className={cn(
                "text-xs px-2 py-1 rounded",
                darkMode ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-500"
              )}>
                {Math.round(currentProgress)}%
              </div>
            </div>

            {/* Center - Page Navigation & Jump Control */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={currentPageIndex === 0 && !previousChapter}
                className={cn(
                  "text-xs",
                  darkMode ? "border-gray-600 text-gray-300 hover:bg-gray-800" : "border-gray-300 text-gray-600 hover:bg-gray-50"
                )}
              >
                <ChevronLeft className="w-3 h-3" />
              </Button>
              
              {/* Jump to Page Control */}
              {showJumpToPage ? (
                <form onSubmit={handleJumpPageInputSubmit} className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={1}
                    max={pages.length}
                    value={jumpPageInput}
                    onChange={(e) => setJumpPageInput(e.target.value)}
                    onKeyDown={handleJumpPageKeyDown}
                    placeholder={`1-${pages.length}`}
                    className={cn(
                      "w-16 h-8 text-xs text-center px-2",
                      darkMode 
                        ? "bg-gray-800 border-gray-600 text-gray-300 placeholder:text-gray-500" 
                        : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-400",
                      // Add visual feedback for invalid input
                      jumpPageInput.trim() && !isJumpPageInputValid() 
                        ? (darkMode ? "border-red-500" : "border-red-400")
                        : ""
                    )}
                    autoFocus
                    onBlur={(e) => {
                      // Only close if not clicking on the Go button
                      if (!e.relatedTarget?.hasAttribute('data-jump-go')) {
                        setShowJumpToPage(false);
                        setJumpPageInput('');
                      }
                    }}
                  />
                  <Button
                    type="submit"
                    data-jump-go="true"
                    variant="outline"
                    size="sm"
                    disabled={!jumpPageInput.trim()} // Disable when empty
                    className={cn(
                      "h-8 px-2 text-xs",
                      darkMode ? "border-gray-600 text-gray-300 hover:bg-gray-800" : "border-gray-300 text-gray-600 hover:bg-gray-50",
                      !jumpPageInput.trim() && (darkMode ? "opacity-50" : "opacity-50")
                    )}
                  >
                    Go
                  </Button>
                </form>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowJumpToPage(true);
                    setJumpPageInput((currentPageIndex + 1).toString());
                  }}
                  className={cn(
                    "text-xs px-2 h-8",
                    darkMode ? "text-gray-400 hover:text-gray-300 hover:bg-gray-800" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                  )}
                  title="Jump to page"
                >
                  {currentPageIndex + 1} / {pages.length}
                </Button>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPageIndex === pages.length - 1 && !nextChapter}
                className={cn(
                  "text-xs",
                  darkMode ? "border-gray-600 text-gray-300 hover:bg-gray-800" : "border-gray-300 text-gray-600 hover:bg-gray-50"
                )}
              >
                <ChevronRight className="w-3 h-3" />
              </Button>
            </div>

            {/* Right - Controls */}
            <div className="flex items-center gap-2">
              {/* Zoom Controls */}
              <div className="hidden sm:flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomOut}
                  disabled={zoom <= 0.5}
                  className={cn(
                    "text-xs w-8 h-8 p-0",
                    darkMode ? "text-gray-300 hover:bg-gray-800" : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  <ZoomOut className="w-3 h-3" />
                </Button>
                <span className={cn(
                  "text-xs w-12 text-center",
                  darkMode ? "text-gray-400" : "text-gray-500"
                )}>
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomIn}
                  disabled={zoom >= 3}
                  className={cn(
                    "text-xs w-8 h-8 p-0",
                    darkMode ? "text-gray-300 hover:bg-gray-800" : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  <ZoomIn className="w-3 h-3" />
                </Button>
              </div>

              {/* Fullscreen Toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFullscreen}
                className={cn(
                  "text-xs w-8 h-8 p-0",
                  darkMode ? "text-gray-300 hover:bg-gray-800" : "text-gray-600 hover:bg-gray-100"
                )}
              >
                {isFullscreen ? <Minimize className="w-3 h-3" /> : <Maximize className="w-3 h-3" />}
              </Button>
            </div>
          </div>
        </footer>
      )}

      {/* Modern Settings Panel */}
      {showSettings && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className={cn(
            "w-[95vw] max-w-2xl sm:max-w-3xl max-h-[80vh] overflow-y-auto",
            darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          )}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className={cn(
                  "text-lg font-semibold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Reading Settings
                </h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowSettings(false)}
                  className={cn(
                    darkMode ? "text-gray-400 hover:text-white hover:bg-gray-700" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  )}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-6">
                {/* Reading Mode */}
                <div className="space-y-3">
                  <label className={cn(
                    "text-sm font-medium",
                    darkMode ? "text-gray-200" : "text-gray-700"
                  )}>
                    Reading Mode
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { mode: 'single', label: 'Single' },
                      { mode: 'double', label: 'Double' },
                      { mode: 'webtoon', label: 'Webtoon' }
                    ].map(({ mode, label }) => (
                      <Button
                        key={mode}
                        variant={readingMode === mode ? "default" : "outline"}
                        size="sm"
                        onClick={() => setReadingMode(mode as 'single' | 'double' | 'webtoon')}
                        className={cn(
                          "transition-colors duration-200",
                          readingMode === mode 
                            ? "bg-blue-600 text-white" 
                            : darkMode 
                              ? "border-gray-600 text-gray-300 hover:bg-gray-800" 
                              : "border-gray-300 text-gray-700 hover:bg-gray-100"
                        )}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Dark Mode Toggle */}
                <div className="flex items-center justify-between">
                  <label className={cn(
                    "text-sm font-medium",
                    darkMode ? "text-gray-200" : "text-gray-700"
                  )}>
                    Dark Mode
                  </label>
                  <Switch 
                    checked={darkMode} 
                    onCheckedChange={setDarkMode}
                  />
                </div>

                {/* Fit Width Toggle */}
                <div className="flex items-center justify-between">
                  <label className={cn(
                    "text-sm font-medium",
                    darkMode ? "text-gray-200" : "text-gray-700"
                  )}>
                    Fit to Width
                  </label>
                  <Switch 
                    checked={fitWidth} 
                    onCheckedChange={setFitWidth}
                  />
                </div>

                {/* Zoom Control */}
                <div className="space-y-3">
                  <label className={cn(
                    "text-sm font-medium",
                    darkMode ? "text-gray-200" : "text-gray-700"
                  )}>
                    Zoom: {Math.round(zoom * 100)}%
                  </label>
                  <Slider
                    value={[zoom]}
                    onValueChange={(value) => setZoom(value[0])}
                    min={0.5}
                    max={3}
                    step={0.1}
                    className="w-full"
                  />
                  <div className="flex gap-2 justify-center">
                    <Button size="sm" variant="outline" onClick={handleZoomOut}>
                      <ZoomOut className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={resetZoom}>
                      <RotateCcw className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleZoomIn}>
                      <ZoomIn className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {/* Auto-Scroll for Webtoon Mode */}
                {readingMode === 'webtoon' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className={cn(
                        "text-sm font-medium",
                        darkMode ? "text-gray-200" : "text-gray-700"
                      )}>
                        Auto-Scroll
                      </label>
                      <Button
                        size="sm"
                        variant={autoScroll.isAutoScrolling ? "default" : "outline"}
                        onClick={autoScroll.toggleAutoScroll}
                        className={cn(
                          "transition-colors duration-200",
                          autoScroll.isAutoScrolling 
                            ? "bg-blue-600 text-white" 
                            : darkMode 
                              ? "border-gray-600 text-gray-300 hover:bg-gray-800" 
                              : "border-gray-300 text-gray-700 hover:bg-gray-100"
                        )}
                      >
                        {autoScroll.isAutoScrolling ? <Pause className="w-3 h-3 mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                        {autoScroll.isAutoScrolling ? 'Pause' : 'Start'}
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <label className={cn(
                        "text-xs font-medium",
                        darkMode ? "text-gray-400" : "text-gray-600"
                      )}>
                        Speed: {autoScroll.speed}px/s
                      </label>
                      <Slider
                        value={[autoScroll.speed]}
                        onValueChange={(value) => {
                          autoScroll.setSpeed(value[0]);
                          localStorage.setItem('manga-autoscroll-speed', value[0].toString());
                        }}
                        min={50}
                        max={300}
                        step={10}
                        className="w-full"
                      />
                    </div>
                  </div>
                )}

                {/* Quick Actions */}
                <div className="space-y-3">
                  <label className={cn(
                    "text-sm font-medium",
                    darkMode ? "text-gray-200" : "text-gray-700"
                  )}>
                    Quick Actions
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={toggleFullscreen}
                      className={cn(
                        darkMode 
                          ? "border-gray-600 text-gray-300 hover:bg-gray-800" 
                          : "border-gray-300 text-gray-700 hover:bg-gray-100"
                      )}
                    >
                      {isFullscreen ? <Minimize className="w-3 h-3 mr-2" /> : <Maximize className="w-3 h-3 mr-2" />}
                      {isFullscreen ? 'Exit' : 'Fullscreen'}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setCurrentPageIndex(0)}
                      className={cn(
                        darkMode 
                          ? "border-gray-600 text-gray-300 hover:bg-gray-800" 
                          : "border-gray-300 text-gray-700 hover:bg-gray-100"
                      )}
                    >
                      <Book className="w-3 h-3 mr-2" />
                      First Page
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Comments Section */}
      {currentChapter && readingMode === 'webtoon' && (
        <div className="py-8">
          <Suspense fallback={
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          }>
            <CommentSection chapterId={currentChapter.id} />
          </Suspense>
        </div>
      )}

    </div>
  );
}