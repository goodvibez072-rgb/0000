import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Library as LibraryIcon, Filter, Grid, List, Trash2, BookOpen, Clock, ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLibrary } from "@/hooks/useLibrary";
import { useUserProgress } from "@/hooks/useReadingProgress";
import { useAuth } from "@/hooks/useAuth";
import SeriesCardSkeleton from "@/components/ui/SeriesCardSkeleton";
import { SEO } from "@/components/SEO";

export default function Library() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { library, isLoading } = useLibrary(isAuthenticated);
  const { progressList } = useUserProgress(isAuthenticated);
  const [, navigate] = useLocation();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'progress'>('recent');

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <LibraryIcon className="w-20 h-20 text-primary/50 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-foreground mb-4">Sign in to view your library</h1>
          <p className="text-muted-foreground mb-8">
            Create an account or sign in to save your favorite manga and track your reading progress.
          </p>
          <div className="flex gap-4 justify-center">
            <Button 
              onClick={() => navigate("/login")}
              className="min-h-11 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
            >
              Sign In
            </Button>
            <Button 
              onClick={() => navigate("/signup")}
              variant="outline"
              className="min-h-11"
            >
              Create Account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const sortedLibrary = useMemo(() => {
    const progressMap = new Map(
      progressList.map(p => [p.seriesId, { 
        chapterNumber: p.chapterNumber, 
        lastReadAt: p.lastReadAt 
      }])
    );

    return [...library].sort((a, b) => {
      if (sortBy === 'recent') {
        return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
      } else if (sortBy === 'title') {
        return a.series.title.localeCompare(b.series.title);
      } else if (sortBy === 'progress') {
        const progressA = progressMap.get(a.seriesId);
        const progressB = progressMap.get(b.seriesId);
        
        const chapterNumA = progressA?.chapterNumber ? parseFloat(progressA.chapterNumber) : 0;
        const chapterNumB = progressB?.chapterNumber ? parseFloat(progressB.chapterNumber) : 0;
        
        const totalA = a.series.totalChapters || 0;
        const totalB = b.series.totalChapters || 0;
        
        const percentA = totalA > 0 ? (chapterNumA / totalA) * 100 : 0;
        const percentB = totalB > 0 ? (chapterNumB / totalB) * 100 : 0;
        
        if (percentA === 0 && percentB === 0) return 0;
        if (percentA === 0) return 1;
        if (percentB === 0) return -1;
        
        if (percentA !== percentB) {
          return percentB - percentA;
        }
        
        const timeA = progressA?.lastReadAt ? new Date(progressA.lastReadAt).getTime() : 0;
        const timeB = progressB?.lastReadAt ? new Date(progressB.lastReadAt).getTime() : 0;
        return timeB - timeA;
      }
      return 0;
    });
  }, [library, progressList, sortBy]);

  return (
    <div className="min-h-screen bg-background w-full overflow-x-hidden">
      <SEO 
        title="My Manga Library - Manage Your Collection & Progress"
        description="Manage your personal manga collection and reading lists on AmourScans. Track your progress, organize your favorites, and continue where you left off."
        keywords="manga library, my manga, reading list, manga collection, track reading, manga progress"
      />
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="min-h-11 w-fit text-muted-foreground hover:text-primary mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center shadow-lg">
              <LibraryIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-primary via-accent to-purple-400 bg-clip-text text-transparent">
                My Library
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                {library.length} {library.length === 1 ? 'series' : 'series'} saved
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="min-h-11 hidden sm:flex">
                  <Filter className="w-4 h-4 mr-2" />
                  Sort: {sortBy === 'recent' ? 'Recent' : sortBy === 'title' ? 'Title' : 'Progress'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSortBy('recent')}>
                  Most Recent
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('title')}>
                  Title (A-Z)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('progress')}>
                  Reading Progress
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="hidden sm:flex border border-border rounded-lg p-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
            {[...Array(10)].map((_, i) => (
              <SeriesCardSkeleton key={i} />
            ))}
          </div>
        )}

        {!isLoading && library.length === 0 && (
          <Card className="bg-card/80 backdrop-blur-md border-border/50">
            <CardContent className="py-16 text-center">
              <LibraryIcon className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">Your library is empty</h3>
              <p className="text-muted-foreground mb-6">
                Start adding manga to your library to keep track of your favorites!
              </p>
              <Button 
                onClick={() => navigate("/browse")}
                className="min-h-11 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
              >
                Browse Manga
              </Button>
            </CardContent>
          </Card>
        )}

        {!isLoading && library.length > 0 && (
          <div className={viewMode === 'grid' 
            ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6" 
            : "space-y-4"
          }>
            {sortedLibrary.map((item) => (
              viewMode === 'grid' ? (
                <Card 
                  key={item.id}
                  className="group bg-card/80 backdrop-blur-md border-border/50 hover:border-primary/60 transition-all duration-300 overflow-hidden cursor-pointer hover:shadow-lg hover:shadow-primary/20"
                  onClick={() => navigate(`/manga/${item.series.id}`)}
                >
                  <div className="relative aspect-[3/4] overflow-hidden">
                    {item.series.coverImageUrl ? (
                      <img
                        src={item.series.coverImageUrl}
                        alt={item.series.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-muted/80 to-muted/60 flex items-center justify-center">
                        <BookOpen className="w-12 h-12 text-muted-foreground/50" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    {item.series.status && (
                      <Badge className="absolute top-2 right-2 bg-primary/90 backdrop-blur-sm">
                        {item.series.status}
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <h3 className="font-semibold text-sm line-clamp-2 text-foreground group-hover:text-primary transition-colors mb-2">
                      {item.series.title}
                    </h3>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Clock className="w-3 h-3 mr-1" />
                      Added {formatDistanceToNow(new Date(item.addedAt), { addSuffix: true })}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card 
                  key={item.id}
                  className="group bg-card/80 backdrop-blur-md border-border/50 hover:border-primary/60 transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-primary/20"
                  onClick={() => navigate(`/manga/${item.series.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="relative w-24 h-32 flex-shrink-0 overflow-hidden rounded-lg">
                        {item.series.coverImageUrl ? (
                          <img
                            src={item.series.coverImageUrl}
                            alt={item.series.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-muted/80 to-muted/60 flex items-center justify-center">
                            <BookOpen className="w-8 h-8 text-muted-foreground/50" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors mb-2">
                          {item.series.title}
                        </h3>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {(() => {
                            const genres = typeof item.series.genres === 'string' 
                              ? JSON.parse(item.series.genres) 
                              : item.series.genres;
                            return Array.isArray(genres) && genres.slice(0, 3).map((genre: string) => (
                              <Badge key={genre} variant="outline" className="text-xs">
                                {genre}
                              </Badge>
                            ));
                          })()}
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Clock className="w-4 h-4 mr-1" />
                          Added {formatDistanceToNow(new Date(item.addedAt), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
