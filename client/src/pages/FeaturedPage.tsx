import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Sparkles, Star, BookOpen, Filter, X } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FeaturedItem {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  rating?: number;
  status: string;
  genres?: string[];
  author?: string;
  updatedAt?: string;
}

export default function FeaturedPage() {
  const [featuredItems, setFeaturedItems] = useState<FeaturedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("default");
  const [, navigate] = useLocation();

  useEffect(() => {
    const fetchFeaturedSeries = async () => {
      try {
        const response = await fetch('/api/sections/featured');
        if (response.ok) {
          const data = await response.json();
          setFeaturedItems(data);
        }
      } catch (error) {
        console.error('Error fetching featured series:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFeaturedSeries();
  }, []);

  const allGenres = useMemo(() => {
    const genresSet = new Set<string>();
    featuredItems.forEach(item => {
      item.genres?.forEach(genre => genresSet.add(genre));
    });
    return Array.from(genresSet).sort();
  }, [featuredItems]);

  const filteredAndSortedItems = useMemo(() => {
    let filtered = [...featuredItems];

    if (selectedGenre !== "all") {
      filtered = filtered.filter(item => 
        item.genres?.includes(selectedGenre)
      );
    }

    if (selectedStatus !== "all") {
      filtered = filtered.filter(item => 
        item.status.toLowerCase() === selectedStatus.toLowerCase()
      );
    }

    switch (sortBy) {
      case "title-asc":
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "title-desc":
        filtered.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case "rating":
        filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      default:
        break;
    }

    return filtered;
  }, [featuredItems, selectedGenre, selectedStatus, sortBy]);

  const clearFilters = () => {
    setSelectedGenre("all");
    setSelectedStatus("all");
    setSortBy("default");
  };

  const hasActiveFilters = selectedGenre !== "all" || selectedStatus !== "all" || sortBy !== "default";

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Featured Series - AmourScans"
        description="Browse our handpicked featured manga and manhwa series. Discover the best titles recommended by our editors."
        keywords="featured manga, recommended manga, best manga, featured manhwa"
      />
      <Navigation />
      
      <main className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-primary via-primary/80 to-accent rounded-lg flex items-center justify-center shadow-lg">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Featured Series
              </h1>
              <p className="text-sm text-muted-foreground">Handpicked titles just for you</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-8 items-start sm:items-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="w-4 h-4" />
              <span className="font-medium">Filter & Sort:</span>
            </div>
            
            <div className="flex flex-wrap gap-2 flex-1">
              <Select value={selectedGenre} onValueChange={setSelectedGenre}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Genres" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Genres</SelectItem>
                  {allGenres.map(genre => (
                    <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default Order</SelectItem>
                  <SelectItem value="title-asc">Title (A-Z)</SelectItem>
                  <SelectItem value="title-desc">Title (Z-A)</SelectItem>
                  <SelectItem value="rating">Highest Rated</SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="gap-2"
                >
                  <X className="w-4 h-4" />
                  Clear Filters
                </Button>
              )}
            </div>
            
            <div className="text-sm text-muted-foreground">
              {filteredAndSortedItems.length} {filteredAndSortedItems.length === 1 ? 'series' : 'series'}
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[2/3] w-full rounded-lg" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : filteredAndSortedItems.length === 0 ? (
            <div className="text-center py-16">
              <Sparkles className="w-16 h-16 mx-auto text-muted-foreground mb-4 opacity-50" />
              <p className="text-lg text-muted-foreground mb-2">
                {featuredItems.length === 0 ? 'No featured series available at the moment' : 'No series match your filters'}
              </p>
              {hasActiveFilters && (
                <Button onClick={clearFilters} variant="outline">
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredAndSortedItems.map((item) => (
                <Card
                  key={item.id}
                  className="group cursor-pointer overflow-hidden border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1"
                  onClick={() => navigate(`/manga/${item.id}`)}
                >
                  <div className="aspect-[2/3] relative overflow-hidden bg-muted">
                    {item.coverImageUrl ? (
                      <img
                        src={item.coverImageUrl}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                        <BookOpen className="w-12 h-12 text-muted-foreground opacity-30" />
                      </div>
                    )}
                    
                    {item.rating && typeof item.rating === 'number' && (
                      <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-md flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                        <span className="text-xs font-semibold text-white">{item.rating.toFixed(1)}</span>
                      </div>
                    )}
                    
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3">
                      <Badge 
                        variant={item.status === "Ongoing" ? "default" : "secondary"}
                        className="text-[10px] mb-1"
                      >
                        {item.status}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="p-3 space-y-1">
                    <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    {item.author && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {item.author}
                      </p>
                    )}
                    {item.genres && item.genres.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {item.genres.slice(0, 2).map((genre, idx) => (
                          <Badge key={idx} variant="outline" className="text-[10px] px-1 py-0">
                            {genre}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
