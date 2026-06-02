import { useState, useEffect, useRef, useMemo, memo } from "react";
import { useLocation } from "wouter";
import { 
  ArrowLeft, 
  X, 
  SlidersHorizontal, 
  Search, 
  Star,
  Flame,
  Sparkles,
  BookOpen,
  TrendingUp,
  ArrowUpDown,
  Filter as FilterIcon,
  BookX
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SeriesCardSkeleton from "@/components/ui/SeriesCardSkeleton";
import { SEO } from "@/components/SEO";
import { BannerAd } from "@/components/AdDisplay";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LatestChapter {
  id: string;
  chapterNumber: string;
  title?: string;
  createdAt: string;
  totalPages: number;
}

interface Series {
  id: string;
  title: string;
  coverImageUrl?: string;
  rating?: number;
  status: string;
  genres?: string[];
  updatedAt?: string;
  createdAt?: string;
  chapterCount?: number;
  latestChapters?: LatestChapter[];
}

const GENRE_OPTIONS = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mystery", "Romance", 
  "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller", "Historical", 
  "Psychological", "School", "Martial Arts", "Mecha"
];

const TOP_GENRES = ["Action", "Romance", "Fantasy", "Comedy", "Drama", "Thriller"];

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "ongoing", label: "Ongoing" },
  { value: "completed", label: "Completed" },
  { value: "hiatus", label: "Hiatus" },
];

const TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "manga", label: "Manga" },
  { value: "manhwa", label: "Manhwa" },
  { value: "manhua", label: "Manhua" },
  { value: "webtoon", label: "Webtoon" },
];

const SORT_OPTIONS = [
  { value: "updated", label: "Recently Updated", icon: TrendingUp },
  { value: "rating", label: "Highest Rated", icon: Star },
  { value: "alphabetical", label: "A-Z", icon: BookOpen },
  { value: "chapters", label: "Most Chapters", icon: BookOpen },
];

const RECENT_SEARCHES_KEY = "mangaverse_recent_searches";
const MAX_RECENT_SEARCHES = 5;

export default function Browse() {
  const [series, setSeries] = useState<Series[]>([]);
  const [allSeries, setAllSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'hot' | 'new'>('all');
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("updated");
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  
  const searchDebounceRef = useRef<NodeJS.Timeout>();
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (stored) {
      try {
        setRecentSearches(JSON.parse(stored));
      } catch (e) {
        // Failed to parse stored searches, reset to empty
        localStorage.removeItem(RECENT_SEARCHES_KEY);
      }
    }
  }, []);

  const saveRecentSearch = (query: string) => {
    if (!query.trim()) return;
    
    const updated = [
      query,
      ...recentSearches.filter(s => s.toLowerCase() !== query.toLowerCase())
    ].slice(0, MAX_RECENT_SEARCHES);
    
    setRecentSearches(updated);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  };

  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    
    searchDebounceRef.current = setTimeout(() => {
      setSearchQuery(searchInput);
      if (searchInput.trim()) {
        saveRecentSearch(searchInput.trim());
      }
    }, 300);
    
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchInput]);

  const searchSuggestions = useMemo(() => {
    if (!searchInput.trim() || searchInput === searchQuery) return [];
    
    const query = searchInput.toLowerCase();
    return allSeries
      .filter(s => s.title.toLowerCase().includes(query))
      .slice(0, 5)
      .map(s => s.title);
  }, [searchInput, searchQuery, allSeries]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const filter = params.get('filter');
    
    if (filter === 'hot' || filter === 'popular') {
      setActiveFilter('hot');
    } else if (filter === 'new' || filter === 'latest') {
      setActiveFilter('new');
    } else if (filter === 'all') {
      setActiveFilter('all');
    }
  }, [location]);

  useEffect(() => {
    const fetchSeries = async () => {
      setLoading(true);
      try {
        let endpoint = '/api/series';
        
        if (activeFilter === 'hot') {
          endpoint = '/api/sections/popular-today';
        } else if (activeFilter === 'new') {
          endpoint = '/api/sections/latest-updates';
        }
        
        const response = await fetch(endpoint, {
          cache: 'no-cache'
        });
        if (response.ok) {
          const data = await response.json();
          setAllSeries(data);
          setSeries(data);
        } else {
          toast({
            title: "Unable to load series",
            description: "Failed to fetch manga series. Please try again later.",
            variant: "error",
          });
        }
      } catch (error) {
        toast({
          title: "Connection error",
          description: "Unable to connect to the server. Please check your internet connection.",
          variant: "error",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSeries();
  }, [activeFilter]);

  const parseGenres = (genres: any): string[] => {
    if (!genres) return [];
    if (Array.isArray(genres)) return genres;
    if (typeof genres === 'string') {
      try {
        const parsed = JSON.parse(genres);
        if (Array.isArray(parsed)) return parsed;
        if (typeof parsed === 'string') return [parsed];
        if (typeof parsed === 'number') return [String(parsed)];
        return [];
      } catch {
        return genres.split(',').map(g => g.trim()).filter(Boolean);
      }
    }
    return [];
  };

  const isNewSeries = (createdAt?: string) => {
    if (!createdAt) return false;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return new Date(createdAt).getTime() > sevenDaysAgo;
  };

  const isHotSeries = (item: Series): boolean => {
    return Boolean((item.rating && item.rating >= 4.5) || (item.chapterCount && item.chapterCount >= 50));
  };

  useEffect(() => {
    let filtered = [...allSeries];
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s => {
        const titleMatch = s.title.toLowerCase().includes(query);
        const genreMatch = parseGenres(s.genres).some((g: string) => g.toLowerCase().includes(query));
        return titleMatch || genreMatch;
      });
    }
    
    if (selectedGenres.length > 0) {
      filtered = filtered.filter(s => {
        const genres = parseGenres(s.genres);
        return selectedGenres.some(g => genres.includes(g));
      });
    }
    
    if (selectedStatus !== "all") {
      filtered = filtered.filter(s => s.status === selectedStatus);
    }
    
    if (selectedType !== "all") {
      filtered = filtered.filter(s => (s as any).type === selectedType);
    }
    
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case "rating":
          comparison = (b.rating || 0) - (a.rating || 0);
          break;
        case "alphabetical":
          comparison = a.title.localeCompare(b.title);
          break;
        case "chapters":
          comparison = (b.chapterCount || 0) - (a.chapterCount || 0);
          break;
        case "updated":
        default:
          comparison = new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
          break;
      }
      
      return sortDirection === 'asc' ? -comparison : comparison;
    });
    
    setSeries(filtered);
  }, [allSeries, selectedGenres, selectedStatus, selectedType, sortBy, sortDirection, searchQuery]);

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  const clearAllFilters = () => {
    setSelectedGenres([]);
    setSelectedStatus("all");
    setSelectedType("all");
    setSortBy("updated");
    setSortDirection("desc");
    setSearchInput("");
    setSearchQuery("");
  };

  const activeFiltersCount = selectedGenres.length + 
    (selectedStatus !== "all" ? 1 : 0) + 
    (selectedType !== "all" ? 1 : 0) +
    (sortBy !== "updated" ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0);

  const handleSearchSelect = (query: string) => {
    setSearchInput(query);
    setSearchQuery(query);
    setShowSuggestions(false);
    saveRecentSearch(query);
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  };

  const toggleSortDirection = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  return (
    <div className="min-h-screen bg-background w-full overflow-x-hidden">
      <SEO 
        title="Browse Manga"
        description="Browse our extensive collection of manga and manhwa. Filter by genre, status, and popularity to find your next favorite series."
        keywords="browse manga, manga collection, manhwa library, manga genres"
      />
      <Navigation />
      
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 sm:pb-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="w-fit text-muted-foreground hover:text-primary mb-4 -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        
        <div className="mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">Discover Series</h1>
          
          <div className="relative mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5 z-10" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Search by title or genre..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="pl-10 pr-32 h-12 sm:h-14 text-base bg-card/50 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1 z-10">
                {searchInput && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-muted"
                    onClick={() => {
                      setSearchInput("");
                      setSearchQuery("");
                    }}
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
                <Sheet open={showFilters} onOpenChange={setShowFilters}>
                  <SheetTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-8 px-3 relative hover:bg-muted"
                      aria-label={`Open advanced filters${activeFiltersCount > 0 ? ` (${activeFiltersCount} active)` : ''}`}
                    >
                      <FilterIcon className="w-4 h-4" />
                      {activeFiltersCount > 0 && (
                        <Badge className="ml-1 px-1.5 py-0 h-4 min-w-4 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                          {activeFiltersCount}
                        </Badge>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[95vw] sm:w-[400px] overflow-y-auto">
                    <SheetHeader className="mb-6">
                      <SheetTitle className="text-xl">Advanced Filters</SheetTitle>
                      <SheetDescription>
                        Refine your search to find the perfect series
                      </SheetDescription>
                    </SheetHeader>
                    
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold">Status</Label>
                        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                          <SelectTrigger className="min-h-[44px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold">Type</Label>
                        <Select value={selectedType} onValueChange={setSelectedType}>
                          <SelectTrigger className="min-h-[44px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TYPE_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold">All Genres</Label>
                        <div className="grid grid-cols-2 gap-3">
                          {GENRE_OPTIONS.map(genre => (
                            <div key={genre} className="flex items-center space-x-2 min-h-[44px]">
                              <Checkbox
                                id={`genre-${genre}`}
                                checked={selectedGenres.includes(genre)}
                                onCheckedChange={() => toggleGenre(genre)}
                                className="min-w-[20px] min-h-[20px]"
                              />
                              <Label
                                htmlFor={`genre-${genre}`}
                                className="text-sm font-normal cursor-pointer leading-tight"
                              >
                                {genre}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {activeFiltersCount > 0 && (
                        <Button
                          variant="outline"
                          onClick={clearAllFilters}
                          className="w-full min-h-[44px] border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Clear All Filters
                        </Button>
                      )}
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
            
            {showSuggestions && (searchSuggestions.length > 0 || recentSearches.length > 0) && (
              <div className="absolute z-50 w-full mt-2 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
                {searchSuggestions.length > 0 && (
                  <div className="p-2">
                    <div className="text-xs font-medium text-muted-foreground px-3 py-2">Suggestions</div>
                    {searchSuggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        className="w-full text-left px-3 py-2 hover:bg-muted rounded-md transition-colors text-sm"
                        onClick={() => handleSearchSelect(suggestion)}
                      >
                        <Search className="w-3 h-3 inline mr-2 text-muted-foreground" />
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
                
                {!searchInput && recentSearches.length > 0 && (
                  <div className="p-2 border-t border-border">
                    <div className="flex items-center justify-between px-3 py-2">
                      <div className="text-xs font-medium text-muted-foreground">Recent Searches</div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={clearRecentSearches}
                      >
                        Clear
                      </Button>
                    </div>
                    {recentSearches.map((search, idx) => (
                      <button
                        key={idx}
                        className="w-full text-left px-3 py-2 hover:bg-muted rounded-md transition-colors text-sm"
                        onClick={() => handleSearchSelect(search)}
                      >
                        <Search className="w-3 h-3 inline mr-2 text-muted-foreground" />
                        {search}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2 flex-wrap gap-2 mb-4">
            <Button 
              variant={activeFilter === 'all' ? 'default' : 'outline'}
              className={`min-h-[44px] px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition-all duration-200 ${
                activeFilter === 'all' 
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg' 
                  : 'bg-transparent border-border text-muted-foreground hover:text-foreground hover:border-primary'
              }`}
              onClick={() => setActiveFilter('all')}
            >
              📚 All
            </Button>
            <Button 
              variant={activeFilter === 'hot' ? 'default' : 'outline'}
              className={`min-h-[44px] px-5 py-2 rounded-xl text-sm sm:text-base font-bold transition-all duration-300 ${
                activeFilter === 'hot' 
                  ? 'bg-gradient-to-r from-[#f2a1f2] via-[#a195f9] to-[#f2a1f2] hover:from-[#a195f9] hover:to-[#f2a1f2] text-white shadow-lg shadow-[#f2a1f2]/40 hover:shadow-xl hover:shadow-[#a195f9]/50 hover:scale-105' 
                  : 'bg-transparent border-2 border-[#f2a1f2]/30 text-[#f2a1f2] hover:text-white hover:bg-[#f2a1f2]/20 hover:border-[#f2a1f2]'
              }`}
              onClick={() => setActiveFilter('hot')}
            >
              <Flame className="w-4 h-4 mr-1.5" />
              HOT
            </Button>
            <Button 
              variant={activeFilter === 'new' ? 'default' : 'outline'}
              className={`min-h-[44px] px-5 py-2 rounded-xl text-sm sm:text-base font-bold transition-all duration-300 ${
                activeFilter === 'new' 
                  ? 'bg-gradient-to-r from-[#707ff5] to-[#4b4bc3] hover:from-[#4b4bc3] hover:to-[#1e1e76] text-white shadow-lg shadow-[#707ff5]/40 hover:shadow-xl hover:shadow-[#4b4bc3]/50 hover:scale-105' 
                  : 'bg-transparent border-2 border-[#707ff5]/30 text-[#707ff5] hover:text-white hover:bg-[#707ff5]/20 hover:border-[#707ff5]'
              }`}
              onClick={() => setActiveFilter('new')}
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              NEW
            </Button>
          </div>
          
          <div className="mb-4">
            <ScrollArea className="w-full">
              <div className="flex items-center space-x-2 pb-2">
                {TOP_GENRES.map(genre => (
                  <Button
                    key={genre}
                    variant={selectedGenres.includes(genre) ? 'default' : 'outline'}
                    size="sm"
                    className={`min-h-[44px] px-4 py-2 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                      selectedGenres.includes(genre)
                        ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-md'
                        : 'bg-card/50 border-border/50 hover:border-primary hover:bg-primary/10'
                    }`}
                    onClick={() => toggleGenre(genre)}
                  >
                    {genre}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <div className="flex items-center gap-2 flex-wrap" role="status" aria-live="polite" aria-label="Active filters">
                {selectedStatus !== "all" && (
                  <Badge variant="secondary" className="gap-1.5 min-h-[36px] px-3 text-sm">
                    {STATUS_OPTIONS.find(s => s.value === selectedStatus)?.label}
                    <button
                      onClick={() => setSelectedStatus("all")}
                      aria-label={`Remove ${STATUS_OPTIONS.find(s => s.value === selectedStatus)?.label} status filter`}
                      className="inline-flex hover:bg-background rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
                {selectedType !== "all" && (
                  <Badge variant="secondary" className="gap-1.5 min-h-[36px] px-3 text-sm">
                    {TYPE_OPTIONS.find(t => t.value === selectedType)?.label}
                    <button
                      onClick={() => setSelectedType("all")}
                      aria-label={`Remove ${TYPE_OPTIONS.find(t => t.value === selectedType)?.label} type filter`}
                      className="inline-flex hover:bg-background rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
                {selectedGenres.slice(0, 2).map(genre => (
                  <Badge key={genre} variant="secondary" className="gap-1.5 min-h-[36px] px-3 text-sm">
                    {genre}
                    <button
                      onClick={() => toggleGenre(genre)}
                      aria-label={`Remove ${genre} genre filter`}
                      className="inline-flex hover:bg-background rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                {selectedGenres.length > 2 && (
                  <Badge variant="secondary" className="min-h-[36px] px-3 text-sm">
                    +{selectedGenres.length - 2} more
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Label className="text-sm text-muted-foreground whitespace-nowrap hidden sm:block">Sort:</Label>
              <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="min-h-[44px] flex-1 sm:w-[180px] bg-card/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map(opt => {
                      const Icon = opt.icon;
                      return (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center">
                            <Icon className="w-4 h-4 mr-2" />
                            {opt.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  className="min-h-[44px] min-w-[44px] bg-card/50"
                  onClick={toggleSortDirection}
                  aria-label={`Sort ${sortDirection === 'asc' ? 'ascending' : 'descending'}`}
                >
                  <ArrowUpDown className={`w-4 h-4 transition-transform ${sortDirection === 'asc' ? 'rotate-180' : ''}`} />
                </Button>
              </div>
            </div>
          </div>
          
          {!loading && (
            <div className="text-sm sm:text-base text-muted-foreground mt-4 flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              <span>
                Showing <span className="font-semibold text-foreground">{series.length}</span> of{" "}
                <span className="font-semibold text-foreground">{allSeries.length}</span> series
              </span>
            </div>
          )}
        </div>

        <BannerAd page="search_results" location="top_banner" className="mb-8" />

        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6 card-grid">
            {[...Array(12)].map((_, i) => (
              <SeriesCardSkeleton key={i} />
            ))}
          </div>
        )}

        {!loading && series.length === 0 && (
          <div className="text-center py-16 bg-gradient-to-br from-muted/30 to-muted/10 rounded-2xl border border-border/50">
            <BookX className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No series found</h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-6 max-w-md mx-auto px-4">
              {searchQuery 
                ? `No results for "${searchQuery}". Try different keywords or browse all series.`
                : "Try adjusting your filters or search terms to find more series."}
            </p>
            {activeFiltersCount > 0 && (
              <Button
                variant="outline"
                onClick={clearAllFilters}
                className="min-h-[44px]"
              >
                <X className="w-4 h-4 mr-2" />
                Clear All Filters
              </Button>
            )}
          </div>
        )}

        {!loading && series.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6 card-grid">
            {series.map((item) => (
              <SeriesCard 
                key={item.id}
                item={item}
                navigate={navigate}
                isNew={isNewSeries(item.createdAt)}
                isHot={isHotSeries(item)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// PERFORMANCE: Memoize SeriesCard to prevent unnecessary re-renders
const SeriesCard = memo(function SeriesCard({ item, navigate, isNew, isHot }: { 
  item: Series; 
  navigate: (path: string) => void;
  isNew: boolean;
  isHot: boolean;
}) {
  const parseGenres = (genres: any): string[] => {
    if (!genres) return [];
    if (Array.isArray(genres)) return genres;
    if (typeof genres === 'string') {
      try {
        const parsed = JSON.parse(genres);
        if (Array.isArray(parsed)) return parsed;
        return [];
      } catch {
        return genres.split(',').map(g => g.trim()).filter(Boolean);
      }
    }
    return [];
  };

  const genres = parseGenres(item.genres);
  const timeAgo = item.updatedAt 
    ? formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })
    : '';

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'ongoing': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'completed': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'hiatus': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default: return 'bg-muted/50 text-muted-foreground border-border/30';
    }
  };

  return (
    <div
      className="group relative bg-card/80 backdrop-blur-sm rounded-xl overflow-hidden border border-border/40 cursor-pointer will-change-transform shadow-lg"
      style={{
        transition: 'transform 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1)',
        transform: 'translateZ(0)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-10px) translateZ(0)';
        e.currentTarget.style.boxShadow = '0 12px 24px rgba(112, 127, 245, 0.3), 0 8px 16px rgba(161, 149, 249, 0.2), 0 4px 8px rgba(0,0,0,0.15)';
        e.currentTarget.style.borderColor = 'rgba(112, 127, 245, 0.5)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateZ(0)';
        e.currentTarget.style.boxShadow = '';
        e.currentTarget.style.borderColor = '';
      }}
      onClick={() => navigate(`/manga/${item.id}`)}
      data-testid={`series-item-${item.id}`}
    >
      <div className="relative w-full bg-muted" style={{ aspectRatio: '3/4' }}>
        {item.coverImageUrl ? (
          <img
            src={item.coverImageUrl}
            alt={item.title}
            width={300}
            height={400}
            className="w-full h-full object-cover will-change-transform"
            style={{
              transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
              transform: 'translateZ(0)'
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLImageElement).style.transform = 'scale(1.1) translateZ(0)';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLImageElement).style.transform = 'translateZ(0)';
            }}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-muted/80 to-muted/60 flex items-center justify-center">
            <BookOpen className="w-12 h-12 text-muted-foreground/30" />
          </div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
        
        <div className="absolute top-2 left-2 flex flex-col gap-1.5">
          {isNew && (
            <Badge className="bg-gradient-to-r from-[#707ff5] to-[#4b4bc3] text-white text-xs px-2 py-1 rounded-md font-bold shadow-lg border-0">
              <Sparkles className="w-3 h-3 mr-1" />
              NEW
            </Badge>
          )}
          {isHot && (
            <Badge className="bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs px-2 py-1 rounded-md font-bold shadow-lg border-0">
              <Flame className="w-3 h-3 mr-1" />
              HOT
            </Badge>
          )}
        </div>
        
        {genres[0] && (
          <div className="absolute top-2 right-2">
            <Badge variant="info" className="text-xs px-2 py-1 rounded-md">
              {genres[0]}
            </Badge>
          </div>
        )}
      </div>
      
      <div className="p-3 space-y-2">
        <h3 className="font-bold text-sm line-clamp-2 text-foreground group-hover:text-primary transition-colors min-h-[2.5rem] leading-tight">
          {item.title}
        </h3>
        
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
            <span className="font-semibold text-foreground">
              {item.rating ? Number(item.rating).toFixed(1) : 'N/A'}
            </span>
          </div>
          
          {item.chapterCount !== undefined && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <BookOpen className="w-3.5 h-3.5" />
              <span>{item.chapterCount}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between gap-2">
          <Badge 
            variant="outline" 
            className={`text-xs px-2 py-0.5 font-medium border ${getStatusColor(item.status)}`}
          >
            {item.status}
          </Badge>
          
          {timeAgo && (
            <span className="text-xs text-muted-foreground truncate">
              {timeAgo.replace('about ', '').replace('less than ', '')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
