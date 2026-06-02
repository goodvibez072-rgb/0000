import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Pin, Star, BookOpen } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface PinnedItem {
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

export default function PinnedPage() {
  const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [, navigate] = useLocation();

  useEffect(() => {
    const fetchPinnedSeries = async () => {
      try {
        const response = await fetch('/api/sections/pinned');
        if (response.ok) {
          const data = await response.json();
          setPinnedItems(data);
        }
      } catch (error) {
        console.error('Error fetching pinned series:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPinnedSeries();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Pinned Series - AmourScans"
        description="Browse our pinned manga and manhwa series. Essential reading titles that you shouldn't miss."
        keywords="pinned manga, must read manga, essential manga, pinned manhwa"
      />
      <Navigation />
      
      <main className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-[#f2a1f2] via-[#f2a1f2] to-[#a195f9] rounded-lg flex items-center justify-center shadow-lg shadow-[#f2a1f2]/30">
              <Pin className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-[#f2a1f2] to-[#a195f9] bg-clip-text text-transparent">
                Pinned Series
              </h1>
              <p className="text-sm text-muted-foreground">Essential reads you shouldn't miss</p>
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
          ) : pinnedItems.length === 0 ? (
            <div className="text-center py-16">
              <Pin className="w-16 h-16 mx-auto text-muted-foreground mb-4 opacity-50" />
              <p className="text-lg text-muted-foreground">No pinned series available at the moment</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {pinnedItems.map((item) => (
                <Card
                  key={item.id}
                  className="group cursor-pointer overflow-hidden border-border/50 hover:border-[#f2a1f2]/50 transition-all duration-300 hover:shadow-lg hover:shadow-[#f2a1f2]/20 hover:-translate-y-1"
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
                    <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-[#f2a1f2] transition-colors">
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
