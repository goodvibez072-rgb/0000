import { useState, useEffect, useCallback, useRef } from "react";
import { Search, X, TrendingUp, Clock, Filter as FilterIcon, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSearch } from "@/hooks/useSearch";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { Series } from "@/types/admin";

interface MobileSearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
  filters: {
    genre?: string;
    status?: string;
    type?: string;
  };
  onFilterChange: (filterType: 'genre' | 'status', value: string) => void;
}

const RECENT_SEARCHES_KEY = 'mangaverse_recent_searches';
const MAX_RECENT_SEARCHES = 5;

const QUICK_GENRES = [
  "Action", "Romance", "Fantasy", "Drama", "Comedy", "Adventure"
];

const STATUS_OPTIONS = [
  { label: "All", value: "" },
  { label: "Ongoing", value: "ongoing" },
  { label: "Completed", value: "completed" },
  { label: "Hiatus", value: "hiatus" }
];

export default function MobileSearchOverlay({ 
  isOpen, 
  onClose, 
  initialQuery = "", 
  filters,
  onFilterChange 
}: MobileSearchOverlayProps) {
  const [searchValue, setSearchValue] = useState(initialQuery);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  const [debouncedQuery, setDebouncedQuery] = useState(searchValue);

  // Fetch trending manga
  const { data: trendingData } = useQuery<Series[]>({
    queryKey: ['trending-search'],
    queryFn: async () => {
      const response = await fetch('/api/sections/trending');
      if (!response.ok) throw new Error('Failed to fetch trending');
      return response.json();
    },
    enabled: isOpen,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Search with debounced query
  const { results, isLoading } = useSearch(
    debouncedQuery, 
    filters, 
    isOpen && !!debouncedQuery.trim()
  );

  // Load recent searches from localStorage
  useEffect(() => {
    if (isOpen) {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        try {
          setRecentSearches(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to parse recent searches', e);
        }
      }
      // Focus input when overlay opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Debounce search input
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(searchValue);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchValue]);

  const saveRecentSearch = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setRecentSearches(prev => {
      const updated = [trimmed, ...prev.filter(s => s !== trimmed)].slice(0, MAX_RECENT_SEARCHES);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
  };

  const handleRecentSearchClick = (query: string) => {
    setSearchValue(query);
    setDebouncedQuery(query);
  };

  const handleClearRecent = () => {
    setRecentSearches([]);
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  };

  const handleResultClick = (query: string) => {
    saveRecentSearch(query);
    onClose();
  };

  const handleClose = () => {
    if (searchValue.trim()) {
      saveRecentSearch(searchValue);
    }
    onClose();
  };

  const handleGenreClick = (genre: string) => {
    onFilterChange('genre', filters.genre === genre ? '' : genre);
  };

  const handleStatusClick = (status: string) => {
    onFilterChange('status', status);
  };

  if (!isOpen) return null;

  const showResults = debouncedQuery.trim().length > 0;
  const showTrending = !showResults && trendingData && trendingData.length > 0;
  const showRecent = !showResults && recentSearches.length > 0;

  return (
    <div className="fixed inset-0 z-[100] bg-background md:hidden">
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-xl border-b border-border/40 px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="h-11 w-11 rounded-xl shrink-0 active:scale-95 transition-transform"
            aria-label="Close search"
          >
            <X className="w-5 h-5" />
          </Button>
          
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5 pointer-events-none" />
            <Input
              ref={inputRef}
              type="search"
              placeholder="Search manga, manhwa..."
              value={searchValue}
              onChange={handleSearchChange}
              className="h-12 pl-12 pr-4 text-base bg-card/50 border-border/40 focus:border-primary focus:ring-2 focus:ring-primary/40 rounded-xl"
              autoComplete="off"
            />
          </div>
        </div>

        {/* Quick Filters */}
        <div className="mt-3 space-y-2">
          {/* Genre chips */}
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-2 pb-2">
              {QUICK_GENRES.map((genre) => (
                <Badge
                  key={genre}
                  variant={filters.genre === genre ? "default" : "outline"}
                  className={`cursor-pointer px-3 py-1.5 text-xs font-semibold rounded-full shrink-0 active:scale-95 transition-all ${
                    filters.genre === genre 
                      ? 'bg-primary text-primary-foreground shadow-md' 
                      : 'hover:bg-primary/10'
                  }`}
                  onClick={() => handleGenreClick(genre)}
                >
                  {genre}
                </Badge>
              ))}
            </div>
          </ScrollArea>

          {/* Status chips */}
          <div className="flex gap-2 flex-wrap">
            {STATUS_OPTIONS.map((option) => (
              <Badge
                key={option.value}
                variant={filters.status === option.value ? "default" : "outline"}
                className={`cursor-pointer px-3 py-1.5 text-xs font-semibold rounded-full active:scale-95 transition-all ${
                  filters.status === option.value 
                    ? 'bg-primary text-primary-foreground shadow-md' 
                    : 'hover:bg-primary/10'
                }`}
                onClick={() => handleStatusClick(option.value)}
              >
                {option.label}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="h-[calc(100vh-180px)]">
        <div className="px-4 py-4">
          {/* Search Results */}
          {showResults && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-muted-foreground">
                  {isLoading ? 'Searching...' : `${results.length} Results`}
                </h3>
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex gap-3 animate-pulse">
                      <div className="w-16 h-24 bg-muted rounded-lg shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded w-3/4" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                        <div className="h-3 bg-muted rounded w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : results.length > 0 ? (
                <div className="space-y-3">
                  {results.map((manga) => (
                    <Link 
                      key={manga.id} 
                      href={`/manga/${manga.id}`}
                      onClick={() => handleResultClick(searchValue)}
                    >
                      <div className="flex gap-3 p-3 rounded-xl hover:bg-card/50 active:bg-card/70 transition-colors active:scale-[0.98] cursor-pointer">
                        <img
                          src={manga.coverImageUrl || '/placeholder.png'}
                          alt={manga.title}
                          className="w-16 h-24 object-cover rounded-lg shadow-md shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm line-clamp-2 mb-1">
                            {manga.title}
                          </h4>
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                            {manga.description}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray(manga.genres) && manga.genres.slice(0, 2).map((genre) => (
                              <Badge key={genre} variant="secondary" className="text-[10px] px-1.5 py-0.5">
                                {genre}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Search className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">No results found</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Try different keywords or filters</p>
                </div>
              )}
            </div>
          )}

          {/* Recent Searches */}
          {showRecent && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Recent Searches
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearRecent}
                  className="text-xs h-7 px-2 hover:bg-destructive/10 hover:text-destructive"
                >
                  Clear
                </Button>
              </div>

              <div className="space-y-2">
                {recentSearches.map((search, index) => (
                  <button
                    key={index}
                    onClick={() => handleRecentSearchClick(search)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-card/50 active:bg-card/70 transition-colors text-left active:scale-[0.98]"
                  >
                    <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm flex-1 truncate">{search}</span>
                    <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Trending */}
          {showTrending && (
            <div className="space-y-3 mt-6">
              <h3 className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Trending Now
              </h3>

              <div className="grid grid-cols-2 gap-3">
                {trendingData.slice(0, 6).map((manga) => (
                  <Link 
                    key={manga.id} 
                    href={`/manga/${manga.id}`}
                    onClick={onClose}
                  >
                    <div className="group cursor-pointer active:scale-[0.97] transition-transform">
                      <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-lg mb-2">
                        <img
                          src={manga.coverImageUrl || '/placeholder.png'}
                          alt={manga.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <div className="absolute top-2 right-2">
                          <Badge className="bg-primary/90 text-primary-foreground text-[10px] px-2 py-0.5">
                            <Sparkles className="w-3 h-3 mr-1 inline" />
                            Hot
                          </Badge>
                        </div>
                      </div>
                      <h4 className="font-bold text-xs line-clamp-2 leading-tight">
                        {manga.title}
                      </h4>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!showResults && !showRecent && !showTrending && (
            <div className="text-center py-12">
              <Search className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-sm text-muted-foreground">Start typing to search</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Find your favorite manga and manhwa</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
