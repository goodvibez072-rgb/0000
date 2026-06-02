import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Clock, Star, BookOpen } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

interface UpdateItem {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  chapter?: string;
  rating?: number;
  status: "Ongoing" | "Completed";
  updatedAt?: string;
  genres?: string[];
  author?: string;
}

export default function LatestUpdatesPage() {
  const [updateItems, setUpdateItems] = useState<UpdateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [, navigate] = useLocation();

  useEffect(() => {
    const fetchLatestUpdates = async () => {
      try {
        const response = await fetch('/api/sections/latest-updates');
        if (response.ok) {
          const data = await response.json();
          setUpdateItems(data);
        }
      } catch (error) {
        console.error('Error fetching latest updates:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLatestUpdates();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Latest Updates - AmourScans"
        description="Stay up to date with the latest manga and manhwa chapter releases. Fresh content updated daily."
        keywords="latest manga, new chapters, manga updates, recent manga"
      />
      <Navigation />
      
      <main className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
                Latest Updates
              </h1>
              <p className="text-sm text-muted-foreground">Fresh content updated daily</p>
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
          ) : updateItems.length === 0 ? (
            <div className="text-center py-16">
              <Clock className="w-16 h-16 mx-auto text-muted-foreground mb-4 opacity-50" />
              <p className="text-lg text-muted-foreground">No recent updates available at the moment</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {updateItems.map((item) => (
                <Card
                  key={item.id}
                  className="group cursor-pointer overflow-hidden border-border/50 hover:border-blue-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 hover:-translate-y-1"
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
                    
                    {item.chapter && (
                      <div className="absolute top-2 left-2 bg-blue-500/90 backdrop-blur-sm px-2 py-1 rounded-md">
                        <span className="text-xs font-semibold text-white">{item.chapter}</span>
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
                    <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-blue-500 transition-colors">
                      {item.title}
                    </h3>
                    {item.updatedAt && (
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}
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
