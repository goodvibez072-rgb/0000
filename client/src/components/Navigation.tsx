import { useState, useCallback, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { 
  Search, Menu, Star, Clock, TrendingUp, 
  History, Library, Settings, Filter,
  User, UserPlus, ChevronDown, Shield, LogOut, X, Coins, Home, Compass,
  Sparkles, Pin, ShoppingBag, Swords, TestTube
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useAuth, useLogout } from "@/hooks/useAuth";
import { useSearchState } from "@/hooks/useSearch";
import SearchResults from "@/components/SearchResults";
import MobileSearchOverlay from "@/components/MobileSearchOverlay";
import { useCurrencyBalance } from "@/hooks/useCurrency";
import { useTestMode, useToggleTestMode } from "@/hooks/useTestMode";
import { useBattlePassSettings } from "@/hooks/useSystemSettings";

export default function Navigation() {
  const { user, isAuthenticated, isAdmin, isLoading } = useAuth();
  const { logout, isLoggingOut } = useLogout();
  const [location, navigate] = useLocation();
  const { data: balanceData } = useCurrencyBalance();
  const { data: testModeData } = useTestMode();
  const { mutate: toggleTestMode } = useToggleTestMode();
  const { data: battlePassSettings } = useBattlePassSettings();
  
  const isBattlePassEnabled = battlePassSettings?.battle_pass_enabled?.value === 'true';
  
  const { 
    query: searchQuery, 
    setQuery: setSearchQuery, 
    filters, 
    updateFilter,
    isSearchActive,
    setIsSearchActive 
  } = useSearchState();
  
  const [isBrowseMode, setIsBrowseMode] = useState(false);
  
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(true);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  
  const [localSearchValue, setLocalSearchValue] = useState(searchQuery);
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  const genres = [
    "Action", "Romance", "Fantasy", "Drama", "Comedy", 
    "Adventure", "Supernatural", "Slice of Life"
  ];

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setSearchQuery(localSearchValue);
      setShowSearchResults(!!localSearchValue.trim());
      setIsSearchActive(!!localSearchValue.trim());
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [localSearchValue, setSearchQuery, setIsSearchActive]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY < 10) {
        setIsNavVisible(true);
      } else if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setIsNavVisible(false);
      } else if (currentScrollY < lastScrollY.current) {
        setIsNavVisible(true);
      }
      
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSearchInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearchValue(value);
  }, []);

  const handleSearchFocus = useCallback(() => {
    if (searchQuery.trim()) {
      setShowSearchResults(true);
    }
  }, [searchQuery]);

  const handleCloseSearch = useCallback(() => {
    setShowSearchResults(false);
    setShowAdvancedSearch(false);
  }, []);

  const handleResultClick = useCallback(() => {
    setShowSearchResults(false);
    setShowAdvancedSearch(false);
  }, []);

  const handleAdvancedSearchToggle = useCallback(() => {
    const newShowAdvancedSearch = !showAdvancedSearch;
    setShowAdvancedSearch(newShowAdvancedSearch);
    
    // If there are active filters and we're closing the advanced search, keep results visible
    const hasActiveFilters = !!(filters.genre || filters.status || filters.type);
    if (!newShowAdvancedSearch && hasActiveFilters) {
      setShowSearchResults(true);
    }
  }, [showAdvancedSearch, filters]);

  const handleGenreSelect = useCallback((genre: string) => {
    updateFilter('genre', genre);
    setIsBrowseMode(true);
    setShowSearchResults(true);
    setShowAdvancedSearch(false);
  }, [updateFilter]);

  const handleStatusSelect = useCallback((status: string) => {
    updateFilter('status', status);
    setIsBrowseMode(true);
    setShowSearchResults(true);
    setShowAdvancedSearch(false);
  }, [updateFilter]);

  const handleMobileFilterChange = useCallback((filterType: 'genre' | 'status', value: string) => {
    updateFilter(filterType, value);
  }, [updateFilter]);

  const handleOpenMobileSearch = useCallback(() => {
    setShowMobileSearch(true);
  }, []);

  const handleCloseMobileSearch = useCallback(() => {
    setShowMobileSearch(false);
  }, []);

  const isActive = (path: string) => location === path || location.startsWith(path);

  return (
    <>
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg"
        aria-label="Skip to main content"
      >
        Skip to main content
      </a>

      <nav 
        className={`bg-background/85 border-b border-border/30 backdrop-blur-2xl sticky top-0 z-50 w-full shadow-lg transition-transform duration-300 ${isNavVisible ? 'translate-y-0' : '-translate-y-full'}`}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="w-full mx-auto px-4 sm:px-5 lg:px-8 max-w-none">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <Link href="/">
            <div className="flex items-center space-x-2 min-w-0 cursor-pointer group">
              <img 
                src="/amourscans-icon.png" 
                alt="AmourScans" 
                className="w-7 h-7 sm:w-8 sm:h-8 object-contain drop-shadow-lg transition-all duration-300 group-hover:scale-110 group-active:scale-95"
              />
              <span className="text-base sm:text-lg lg:text-xl font-bold bg-gradient-to-r from-[#a195f9] via-[#f2a1f2] to-[#f2a1f2] bg-clip-text text-transparent truncate">
                AmourScans
              </span>
            </div>
          </Link>

          <div className="flex-1 max-w-2xl mx-4 sm:mx-6 lg:mx-10 hidden md:block">
            <div className="relative" ref={searchContainerRef} role="search" aria-label="Search manga">
              <div className="flex items-center gap-2.5">
                <div className="relative flex-1">
                  <Search strokeWidth={3} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5 z-10 pointer-events-none" />
                  <Input
                    type="search"
                    placeholder="Search manga, manhwa, characters..."
                    className="h-12 pl-12 pr-4 w-full bg-card/70 backdrop-blur-xl border border-border/40 focus:border-primary focus:ring-2 focus:ring-primary/40 focus:bg-card/90 transition-all duration-300 placeholder:text-muted-foreground/70 rounded-2xl text-base shadow-md hover:shadow-lg hover:bg-card/80 focus:shadow-xl"
                    value={localSearchValue}
                    onChange={handleSearchInputChange}
                    onFocus={handleSearchFocus}
                    data-testid="search-input"
                    aria-label="Search for manga, manhwa, or characters"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleAdvancedSearchToggle}
                  className={`h-12 w-12 rounded-2xl hover:bg-primary/15 active:scale-95 transition-all duration-300 shadow-md hover:shadow-lg ${showAdvancedSearch ? 'bg-primary/20 text-primary shadow-lg' : 'bg-card/70 border border-border/40'}`}
                  data-testid="advanced-search-toggle"
                  aria-label="Toggle advanced search filters"
                  aria-expanded={showAdvancedSearch}
                >
                  <Filter strokeWidth={3} className="w-5 h-5" />
                </Button>
              </div>

              <SearchResults
                query={searchQuery}
                filters={filters}
                isOpen={showSearchResults}
                onClose={handleCloseSearch}
                onResultClick={handleResultClick}
                browseMode={isBrowseMode}
              />

              {showAdvancedSearch && (
                <div className="absolute top-full left-0 right-0 mt-3 bg-card/97 backdrop-blur-2xl border border-border/40 rounded-2xl p-6 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-semibold mb-3 block text-foreground">Genre</label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full justify-between h-12 bg-background/60 rounded-xl border-border/40 hover:border-primary/60 hover:bg-background/80 transition-all active:scale-98">
                            {filters.genre || "Select Genre"} <ChevronDown strokeWidth={3} className="w-4 h-4 ml-2" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-48">
                          <DropdownMenuItem onClick={() => handleGenreSelect("")} className="hover:bg-primary/15 cursor-pointer">
                            All Genres
                          </DropdownMenuItem>
                          {genres.map((genre) => (
                            <DropdownMenuItem key={genre} onClick={() => handleGenreSelect(genre)} className="hover:bg-primary/15 cursor-pointer">
                              {genre}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div>
                      <label className="text-sm font-semibold mb-3 block text-foreground">Status</label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full justify-between h-12 bg-background/60 rounded-xl border-border/40 hover:border-primary/60 hover:bg-background/80 transition-all active:scale-98">
                            {filters.status || "Any Status"} <ChevronDown strokeWidth={3} className="w-4 h-4 ml-2" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => handleStatusSelect("")} className="hover:bg-primary/15 cursor-pointer">
                            Any Status
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusSelect("ongoing")} className="hover:bg-primary/15 cursor-pointer">
                            Ongoing
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusSelect("completed")} className="hover:bg-primary/15 cursor-pointer">
                            Completed
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusSelect("hiatus")} className="hover:bg-primary/15 cursor-pointer">
                            Hiatus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-2.5">
            {/* Mobile Search Icon */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-11 w-11 hover:bg-primary/10 hover:text-primary active:scale-95 transition-all duration-200 rounded-xl"
              onClick={handleOpenMobileSearch}
              aria-label="Search manga"
            >
              <Search className="w-5 h-5" />
            </Button>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center space-x-1.5 mr-2">
              <Link href="/shop">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`h-10 hover:bg-primary/10 hover:text-primary active:scale-95 transition-all duration-200 font-semibold rounded-xl px-3 ${isActive('/shop') ? 'bg-primary/10 text-primary' : ''}`}
                >
                  <ShoppingBag strokeWidth={2.5} className="w-4 h-4 mr-1.5" />
                  Shop
                </Button>
              </Link>
              {isAuthenticated && (
                <>
                  <Link href="/library">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className={`h-10 hover:bg-primary/10 hover:text-primary active:scale-95 transition-all duration-200 font-semibold rounded-xl px-3 ${isActive('/library') ? 'bg-primary/10 text-primary' : ''}`}
                    >
                      <Library strokeWidth={2.5} className="w-4 h-4 mr-1.5" />
                      Library
                    </Button>
                  </Link>
                  <Link href="/history">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className={`h-10 hover:bg-primary/10 hover:text-primary active:scale-95 transition-all duration-200 font-semibold rounded-xl px-3 ${isActive('/history') ? 'bg-primary/10 text-primary' : ''}`}
                    >
                      <History strokeWidth={2.5} className="w-4 h-4 mr-1.5" />
                      History
                    </Button>
                  </Link>
                </>
              )}
            </div>

            <div className="hidden md:flex items-center space-x-2.5">
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-10 h-10 bg-muted/50 animate-pulse rounded-full"></div>
                </div>
              ) : isAuthenticated ? (
                <>
                  <Link href="/shop">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-10 hover:bg-primary/10 hover:text-primary active:scale-95 transition-all duration-200 font-semibold rounded-xl px-3 border-primary/30"
                    >
                      <Coins strokeWidth={2.5} className="w-4 h-4 mr-1.5 text-primary" />
                      <span className="text-primary font-bold">{balanceData?.balance ?? 0}</span>
                    </Button>
                  </Link>
                  <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="relative h-10 w-10 rounded-full hover:bg-primary/15 active:scale-95 transition-all duration-300 ring-2 ring-transparent hover:ring-primary/30 hover:shadow-lg"
                      data-testid="profile-dropdown"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user?.profileImageUrl || user?.profilePicture || undefined} alt={user?.username || "Profile"} />
                        <AvatarFallback className="bg-gradient-to-br from-primary/25 to-accent/25 text-primary text-sm font-bold">
                          {user?.username?.charAt(0)?.toUpperCase() || user?.firstName?.charAt(0)?.toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 bg-card/97 backdrop-blur-2xl border-border/40 rounded-2xl shadow-2xl">
                    <div className="flex items-center gap-3 p-4">
                      <Avatar className="h-11 w-11 ring-2 ring-primary/20">
                        <AvatarImage src={user?.profileImageUrl || user?.profilePicture || undefined} alt={user?.username || "Profile"} />
                        <AvatarFallback className="bg-gradient-to-br from-primary/25 to-accent/25 text-primary text-sm font-bold">
                          {user?.username?.charAt(0)?.toUpperCase() || user?.firstName?.charAt(0)?.toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col space-y-1 flex-1 min-w-0">
                        <p className="text-sm font-bold leading-none truncate">
                          {user?.username || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "User"}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground truncate">
                          {user?.email || ""}
                        </p>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => navigate("/daily-rewards")} className="hover:bg-primary/15 cursor-pointer py-3 active:scale-98">
                      <Star strokeWidth={3} className="w-4 h-4 mr-3" />
                      <span className="font-semibold">Daily Rewards</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => navigate("/achievements")} className="hover:bg-primary/15 cursor-pointer py-3 active:scale-98">
                      <Star strokeWidth={3} className="w-4 h-4 mr-3" />
                      <span className="font-semibold">Achievements</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => navigate("/library")} className="hover:bg-primary/15 cursor-pointer py-3 active:scale-98">
                      <Library strokeWidth={3} className="w-4 h-4 mr-3" />
                      <span className="font-semibold">My Library</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => navigate("/settings")} className="hover:bg-primary/15 cursor-pointer py-3 active:scale-98">
                      <Settings strokeWidth={3} className="w-4 h-4 mr-3" />
                      <span className="font-semibold">Profile Settings</span>
                    </DropdownMenuItem>
                    {isAdmin && (
                      <>
                        <DropdownMenuItem onSelect={() => navigate("/admin")} className="hover:bg-primary/15 cursor-pointer py-3 active:scale-98">
                          <Shield strokeWidth={3} className="w-4 h-4 mr-3" />
                          <span className="font-semibold">Admin Panel</span>
                        </DropdownMenuItem>
                        <div className="px-2 py-3 hover:bg-primary/15 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <TestTube strokeWidth={3} className="w-4 h-4 text-orange-500" />
                              <span className="font-semibold text-sm">Test Mode</span>
                            </div>
                            <Switch 
                              checked={testModeData?.testMode || false}
                              onCheckedChange={(checked) => toggleTestMode(checked)}
                              className="data-[state=checked]:bg-orange-500"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 ml-7">Disable admin bypass for testing</p>
                        </div>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onSelect={() => logout()}
                      disabled={isLoggingOut}
                      className="hover:bg-destructive/15 focus:bg-destructive/15 focus:text-destructive cursor-pointer py-3 active:scale-98"
                      data-testid="logout-button"
                    >
                      <LogOut strokeWidth={3} className="w-4 h-4 mr-3" />
                      <span className="font-semibold">{isLoggingOut ? "Signing out..." : "Sign out"}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                </>
              ) : (
                <>
                  <Link href="/login">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-10 hover:bg-primary/15 hover:text-primary active:scale-95 transition-all duration-300 font-semibold rounded-xl px-4"
                      data-testid="nav-login"
                    >
                      <User strokeWidth={3} className="w-4 h-4 mr-2" />
                      Login
                    </Button>
                  </Link>
                  <Link href="/signup">
                    <Button 
                      size="sm" 
                      className="h-10 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white shadow-lg hover:shadow-xl active:scale-95 transition-all duration-300 font-semibold rounded-xl px-5"
                      data-testid="nav-signup"
                    >
                      <UserPlus strokeWidth={3} className="w-4 h-4 mr-2" />
                      Sign Up
                    </Button>
                  </Link>
                </>
              )}
            </div>

            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden h-11 w-11 hover:bg-primary/10 hover:text-primary active:scale-95 transition-all duration-200 rounded-xl" 
              data-testid="mobile-menu"
              onClick={() => setShowMobileMenu(true)}
              aria-label="Open mobile menu"
              aria-expanded={showMobileMenu}
            >
              <Menu strokeWidth={1.5} className="w-6 h-6" />
            </Button>
          </div>
        </div>
      </div>
    </nav>

      {/* Mobile Search Overlay */}
      <MobileSearchOverlay
        isOpen={showMobileSearch}
        onClose={handleCloseMobileSearch}
        initialQuery={searchQuery}
        filters={filters}
        onFilterChange={handleMobileFilterChange}
      />

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/85 backdrop-blur-2xl border-t border-border/30 shadow-[0_-4px_16px_rgba(0,0,0,0.12)] pb-safe">
        <div className="flex items-center justify-around h-[68px] px-2">
          <Link href="/">
            <button className={`flex flex-col items-center justify-center min-w-[60px] h-[60px] transition-all duration-200 rounded-xl active:scale-95 ${location === '/' ? 'text-primary bg-primary/10' : 'text-muted-foreground active:bg-muted/10'}`}>
              <Home strokeWidth={1.5} className={`w-6 h-6 mb-0.5 transition-transform duration-200 ${location === '/' ? 'scale-105' : ''}`} />
              <span className="text-[10px] font-semibold">Home</span>
            </button>
          </Link>
          
          <Link href="/browse">
            <button className={`flex flex-col items-center justify-center min-w-[60px] h-[60px] transition-all duration-200 rounded-xl active:scale-95 ${isActive('/browse') ? 'text-primary bg-primary/10' : 'text-muted-foreground active:bg-muted/10'}`}>
              <Compass strokeWidth={1.5} className={`w-6 h-6 mb-0.5 transition-transform duration-200 ${isActive('/browse') ? 'scale-105' : ''}`} />
              <span className="text-[10px] font-semibold">Browse</span>
            </button>
          </Link>
          
          {isAuthenticated ? (
            <>
              {isAdmin ? (
                <>
                  <Link href="/library">
                    <button className={`flex flex-col items-center justify-center min-w-[60px] h-[60px] transition-all duration-200 rounded-xl active:scale-95 ${isActive('/library') ? 'text-primary bg-primary/10' : 'text-muted-foreground active:bg-muted/10'}`}>
                      <Library strokeWidth={1.5} className={`w-6 h-6 mb-0.5 transition-transform duration-200 ${isActive('/library') ? 'scale-105' : ''}`} />
                      <span className="text-[10px] font-semibold">Library</span>
                    </button>
                  </Link>
                  
                  <Link href="/history">
                    <button className={`flex flex-col items-center justify-center min-w-[60px] h-[60px] transition-all duration-200 rounded-xl active:scale-95 ${isActive('/history') ? 'text-primary bg-primary/10' : 'text-muted-foreground active:bg-muted/10'}`}>
                      <History strokeWidth={1.5} className={`w-6 h-6 mb-0.5 transition-transform duration-200 ${isActive('/history') ? 'scale-105' : ''}`} />
                      <span className="text-[10px] font-semibold">History</span>
                    </button>
                  </Link>
                  
                  <Link href="/admin">
                    <button className={`flex flex-col items-center justify-center min-w-[60px] h-[60px] transition-all duration-200 rounded-xl active:scale-95 ${isActive('/admin') ? 'text-[#4b4bc3] bg-[#4b4bc3]/15' : 'text-muted-foreground active:bg-muted/10'}`}>
                      <Shield strokeWidth={1.5} className={`w-6 h-6 mb-0.5 transition-transform duration-200 ${isActive('/admin') ? 'scale-105' : ''}`} />
                      <span className="text-[10px] font-semibold">Admin</span>
                    </button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/library">
                    <button className={`flex flex-col items-center justify-center min-w-[60px] h-[60px] transition-all duration-200 rounded-xl active:scale-95 ${isActive('/library') ? 'text-primary bg-primary/10' : 'text-muted-foreground active:bg-muted/10'}`}>
                      <Library strokeWidth={1.5} className={`w-6 h-6 mb-0.5 transition-transform duration-200 ${isActive('/library') ? 'scale-105' : ''}`} />
                      <span className="text-[10px] font-semibold">Library</span>
                    </button>
                  </Link>
                  
                  <Link href="/history">
                    <button className={`flex flex-col items-center justify-center min-w-[60px] h-[60px] transition-all duration-200 rounded-xl active:scale-95 ${isActive('/history') ? 'text-primary bg-primary/10' : 'text-muted-foreground active:bg-muted/10'}`}>
                      <History strokeWidth={1.5} className={`w-6 h-6 mb-0.5 transition-transform duration-200 ${isActive('/history') ? 'scale-105' : ''}`} />
                      <span className="text-[10px] font-semibold">History</span>
                    </button>
                  </Link>
                  
                  <Link href="/shop">
                    <button className={`flex flex-col items-center justify-center min-w-[60px] h-[60px] transition-all duration-200 rounded-xl active:scale-95 ${isActive('/shop') ? 'text-primary bg-primary/10' : 'text-muted-foreground active:bg-muted/10'}`}>
                      <Coins strokeWidth={1.5} className={`w-6 h-6 mb-0.5 transition-transform duration-200 ${isActive('/shop') ? 'scale-105' : ''}`} />
                      <span className="text-[10px] font-semibold">Shop</span>
                    </button>
                  </Link>
                </>
              )}
            </>
          ) : (
            <>
              <Link href="/featured">
                <button className={`flex flex-col items-center justify-center min-w-[60px] h-[60px] transition-all duration-200 rounded-xl active:scale-95 ${isActive('/featured') ? 'text-primary bg-primary/10' : 'text-muted-foreground active:bg-muted/10'}`}>
                  <Sparkles strokeWidth={1.5} className={`w-6 h-6 mb-0.5 transition-transform duration-200 ${isActive('/featured') ? 'scale-105' : ''}`} />
                  <span className="text-[10px] font-semibold">Featured</span>
                </button>
              </Link>
              
              <Link href="/trending">
                <button className={`flex flex-col items-center justify-center min-w-[60px] h-[60px] transition-all duration-200 rounded-xl active:scale-95 ${isActive('/trending') ? 'text-primary bg-primary/10' : 'text-muted-foreground active:bg-muted/10'}`}>
                  <TrendingUp strokeWidth={1.5} className={`w-6 h-6 mb-0.5 transition-transform duration-200 ${isActive('/trending') ? 'scale-105' : ''}`} />
                  <span className="text-[10px] font-semibold">Trending</span>
                </button>
              </Link>
              
              <Link href="/login">
                <button className={`flex flex-col items-center justify-center min-w-[60px] h-[60px] transition-all duration-200 rounded-xl active:scale-95 ${isActive('/login') ? 'text-primary bg-primary/10' : 'text-muted-foreground active:bg-muted/10'}`}>
                  <User strokeWidth={1.5} className={`w-6 h-6 mb-0.5 transition-transform duration-200 ${isActive('/login') ? 'scale-105' : ''}`} />
                  <span className="text-[10px] font-semibold">Login</span>
                </button>
              </Link>
            </>
          )}
        </div>
      </div>

      <Sheet open={showMobileMenu} onOpenChange={setShowMobileMenu}>
        <SheetContent side="left" className="w-[340px] sm:w-[400px] bg-background/85 backdrop-blur-2xl border-border/30">
          <SheetHeader>
            <SheetTitle className="flex items-center space-x-3">
              <img 
                src="/amourscans-icon.png" 
                alt="AmourScans" 
                className="w-7 h-7 object-contain"
              />
              <span className="bg-gradient-to-r from-[#a195f9] via-[#f2a1f2] to-[#f2a1f2] bg-clip-text text-transparent font-bold text-xl">
                AmourScans
              </span>
            </SheetTitle>
          </SheetHeader>

          <div className="mt-8 flex flex-col space-y-5">
            {isLoading ? (
              <div className="flex items-center space-x-3 p-4 bg-muted/30 rounded-2xl animate-pulse">
                <div className="w-14 h-14 bg-muted rounded-full"></div>
                <div className="flex-1">
                  <div className="w-28 h-4 bg-muted rounded mb-2"></div>
                  <div className="w-36 h-3 bg-muted rounded"></div>
                </div>
              </div>
            ) : isAuthenticated ? (
              <>
                <div className="flex items-center space-x-3 p-4 bg-card/50 border border-border/30 rounded-2xl backdrop-blur-xl shadow-lg">
                  <Avatar className="h-14 w-14 ring-2 ring-primary/30">
                    <AvatarImage src={user?.profileImageUrl || user?.profilePicture || undefined} alt={user?.username || "Profile"} />
                    <AvatarFallback className="bg-gradient-to-br from-primary/25 to-accent/25 text-primary text-base font-bold">
                      {user?.username?.charAt(0)?.toUpperCase() || user?.firstName?.charAt(0)?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">
                      {user?.username || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "User"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user?.email || ""}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Coins strokeWidth={2} className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-xs font-bold text-amber-500">{balanceData?.balance ?? 0} Coins</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col space-y-3">
                <Link href="/login">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start h-12 rounded-xl hover:bg-primary/10 active:scale-98 transition-all"
                    onClick={() => setShowMobileMenu(false)}
                  >
                    <User strokeWidth={1.5} className="w-5 h-5 mr-3" />
                    <span className="font-semibold">Login</span>
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button 
                    className="w-full justify-start h-12 rounded-xl bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-lg active:scale-98 transition-all"
                    onClick={() => setShowMobileMenu(false)}
                  >
                    <UserPlus strokeWidth={1.5} className="w-5 h-5 mr-3" />
                    <span className="font-semibold">Sign Up</span>
                  </Button>
                </Link>
              </div>
            )}

            <Separator className="bg-border/30" />

            {isAuthenticated && (
              <>
                <div className="flex flex-col space-y-2">
                  <p className="text-[10px] font-extrabold text-muted-foreground px-3 mb-1 tracking-wider">QUICK ACCESS</p>
                  
                  {/* Admin Panel - Prominent placement for mobile */}
                  {isAdmin && (
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start h-12 rounded-xl bg-gradient-to-r from-primary/20 to-accent/20 hover:from-primary/30 hover:to-accent/30 border border-primary/30 transition-all active:scale-98 shadow-md"
                      onClick={() => {
                        navigate("/admin");
                        setShowMobileMenu(false);
                      }}
                    >
                      <Shield strokeWidth={2} className="w-5 h-5 mr-3 text-primary" />
                      <span className="flex-1 text-left font-bold text-primary">Admin Panel</span>
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-primary/40 text-primary-foreground rounded-md">
                        ADMIN
                      </span>
                    </Button>
                  )}
                  
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start hover:bg-primary/10 h-12 rounded-xl group transition-all active:scale-98"
                    onClick={() => {
                      navigate("/settings");
                      setShowMobileMenu(false);
                    }}
                  >
                    <User strokeWidth={1.5} className="w-5 h-5 mr-3" />
                    <span className="flex-1 text-left font-semibold">Profile</span>
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start hover:bg-primary/10 h-12 rounded-xl transition-all active:scale-98"
                    onClick={() => {
                      navigate("/shop");
                      setShowMobileMenu(false);
                    }}
                  >
                    <Coins strokeWidth={1.5} className="w-5 h-5 mr-3 text-primary" />
                    <span className="flex-1 text-left font-semibold">Shop</span>
                    <span className="px-3 py-1.5 text-xs font-bold bg-primary/20 text-primary rounded-full group-hover:bg-primary/30 transition-colors">
                      {balanceData?.balance || 0}
                    </span>
                  </Button>
                </div>
                
                <Separator className="bg-border/30" />
                
                <div className="flex flex-col space-y-2">
                  <p className="text-[10px] font-extrabold text-muted-foreground px-3 mb-1 tracking-wider">FEATURES</p>
                  {isBattlePassEnabled && (
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start hover:bg-primary/10 h-12 rounded-xl transition-all active:scale-98"
                      onClick={() => {
                        navigate("/battle-pass");
                        setShowMobileMenu(false);
                      }}
                    >
                      <TrendingUp strokeWidth={1.5} className="w-5 h-5 mr-3" />
                      <span className="font-semibold">Battle Pass</span>
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start hover:bg-primary/10 h-12 rounded-xl transition-all active:scale-98"
                    onClick={() => {
                      navigate("/daily-rewards");
                      setShowMobileMenu(false);
                    }}
                  >
                    <Star strokeWidth={1.5} className="w-5 h-5 mr-3" />
                    <span className="font-semibold">Daily Rewards</span>
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start hover:bg-primary/10 h-12 rounded-xl transition-all active:scale-98"
                    onClick={() => {
                      navigate("/achievements");
                      setShowMobileMenu(false);
                    }}
                  >
                    <Star strokeWidth={1.5} className="w-5 h-5 mr-3" />
                    <span className="font-semibold">Achievements</span>
                  </Button>
                </div>
                <Separator className="bg-border/30" />
              </>
            )}

            <div className="flex flex-col space-y-2">
              <p className="text-[10px] font-extrabold text-muted-foreground px-3 mb-1 tracking-wider">AVAILABLE PAGES</p>
              <Button 
                variant="ghost" 
                className="w-full justify-start hover:bg-primary/10 h-12 rounded-xl transition-all active:scale-98"
                onClick={() => {
                  navigate("/pinned");
                  setShowMobileMenu(false);
                }}
              >
                <Pin strokeWidth={1.5} className="w-5 h-5 mr-3" />
                <span className="font-semibold">Pinned</span>
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start hover:bg-primary/10 h-12 rounded-xl transition-all active:scale-98"
                onClick={() => {
                  navigate("/popular");
                  setShowMobileMenu(false);
                }}
              >
                <Star strokeWidth={1.5} className="w-5 h-5 mr-3" />
                <span className="font-semibold">Popular</span>
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start hover:bg-primary/10 h-12 rounded-xl transition-all active:scale-98"
                onClick={() => {
                  navigate("/latest-updates");
                  setShowMobileMenu(false);
                }}
              >
                <Clock strokeWidth={1.5} className="w-5 h-5 mr-3" />
                <span className="font-semibold">Latest Updates</span>
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start hover:bg-primary/10 h-12 rounded-xl transition-all active:scale-98"
                onClick={() => {
                  navigate("/trending");
                  setShowMobileMenu(false);
                }}
              >
                <TrendingUp strokeWidth={1.5} className="w-5 h-5 mr-3" />
                <span className="font-semibold">Trending</span>
              </Button>
            </div>

            {isAuthenticated && (
              <>
                <Separator className="bg-border/30" />

                <Button 
                  variant="ghost" 
                  className="w-full justify-start hover:bg-destructive/10 hover:text-destructive h-12 rounded-xl transition-all active:scale-98"
                  onClick={() => {
                    logout();
                    setShowMobileMenu(false);
                  }}
                  disabled={isLoggingOut}
                >
                  <LogOut strokeWidth={1.5} className="w-5 h-5 mr-3" />
                  <span className="font-semibold">{isLoggingOut ? "Signing out..." : "Sign out"}</span>
                </Button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
