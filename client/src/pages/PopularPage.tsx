import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Star, BookOpen, TrendingUp } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface PopularItem {
  id: string;
  title: string;
  coverImageUrl?: string;
  rating?: number;
  status: string;
  genres?: string[];
  author?: string;
  rank?: number;
}

export default function PopularPage() {
  const [popularItems, setPopularItems] = useState<PopularItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [, navigate] = useLocation();

  useEffect(() => {
    const fetchPopularSeries = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/sections/popular-today');
        if (response.ok) {
          const data = await response.json();
          const dataWithRank = data.map((item: any, index: number) => ({
            ...item,
            rank: index + 1
          }));
          setPopularItems(dataWithRank);
        }
      } catch (error) {
        console.error('Error fetching popular series:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPopularSeries();
  }, []);

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return "bg-gradient-to-r from-yellow-500 to-amber-500 text-white";
    if (rank === 2) return "bg-gradient-to-r from-gray-300 to-gray-400 text-gray-900";
    if (rank === 3) return "bg-gradient-to-r from-orange-600 to-amber-700 text-white";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Popular Series - AmourScans"
        description="Discover the most popular manga and manhwa series. Browse weekly, monthly, and all-time favorites."
        keywords="popular manga, trending manga, top manga, best manga"
      />
      <Navigation />
      
      <main className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-primary via-primary/80 to-accent rounded-lg flex items-center justify-center shadow-lg">
              <TrendingUp className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Popular Series
              </h1>
              <p className="text-sm text-muted-foreground">Most loved titles by readers</p>
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
          ) : popularItems.length === 0 ? (
            <div className="text-center py-16">
              <Star className="w-16 h-16 mx-auto text-muted-foreground mb-4 opacity-50" />
              <p className="text-lg text-muted-foreground">No popular series available at the moment</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {popularItems.map((item) => (
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
                    
                    {item.rank && (
                      <div className={`absolute top-2 left-2 ${getRankBadgeColor(item.rank)} px-2.5 py-1 rounded-md font-bold text-sm shadow-lg`}>
                        #{item.rank}
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
