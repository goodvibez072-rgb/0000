import { useState, useEffect, useMemo, useCallback } from "react";
import React from "react";
import { Star, TrendingUp, Crown, Medal, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";

interface PopularItem {
  id: string;
  rank: number;
  title: string;
  coverImageUrl?: string;
  rating?: number;
  status: string;
  genres?: string[];
}

export default function PopularSeries() {
  const [activeTab, setActiveTab] = useState<"weekly" | "monthly" | "all">("weekly");
  const [popularSeries, setPopularSeries] = useState<PopularItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [, navigate] = useLocation();

  useEffect(() => {
    const fetchPopularSeries = async () => {
      try {
        const response = await fetch('/api/sections/popular-today');
        if (response.ok) {
          const data = await response.json();
          // Add rank to items
          const dataWithRank = data.map((item: any, index: number) => ({
            ...item,
            rank: index + 1
          }));
          setPopularSeries(dataWithRank);
        }
      } catch (error) {
        // Error fetching popular series - fail silently and show empty state
      } finally {
        setLoading(false);
      }
    };

    fetchPopularSeries();
  }, []);

  const tabs = [
    { key: "weekly" as const, label: "Weekly" },
    { key: "monthly" as const, label: "Monthly" },
    { key: "all" as const, label: "All Time" }
  ];

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-[#1e1e76]/10 via-card to-[#4b4bc3]/10 backdrop-blur-sm rounded-2xl border border-[#707ff5]/20 p-6 shadow-xl shadow-[#4b4bc3]/10 animate-pulse">
        <div className="text-center py-12">
          <div className="flex items-center justify-center gap-3 mb-3">
            <TrendingUp className="w-6 h-6 text-[#707ff5] animate-bounce" />
            <div className="h-8 w-48 bg-gradient-to-r from-[#4b4bc3]/30 via-[#707ff5]/30 to-[#a195f9]/30 rounded-lg" />
          </div>
          <p className="text-muted-foreground text-sm">Loading popular series...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-[#1e1e76]/10 via-card to-[#4b4bc3]/10 backdrop-blur-sm rounded-2xl border border-[#707ff5]/20 p-6 shadow-xl shadow-[#4b4bc3]/10 hover:shadow-2xl hover:shadow-[#707ff5]/20 transition-all duration-300">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-card-foreground flex items-center">
          <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-[#707ff5] drop-shadow-md animate-pulse" />
          <span className="bg-gradient-to-r from-[#707ff5] via-[#a195f9] to-[#f2a1f2] bg-clip-text text-transparent">Popular Series</span>
        </h2>
      </div>

      {popularSeries.length === 0 ? (
        <div className="text-center py-12 bg-gradient-to-br from-[#1e1e76]/5 to-[#4b4bc3]/5 rounded-xl border border-[#707ff5]/10">
          <p className="text-muted-foreground text-sm sm:text-base">
            No popular series assigned yet. Use the admin panel to assign series to this section.
          </p>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex space-x-1 mb-6 bg-gradient-to-r from-[#1e1e76]/20 via-[#4b4bc3]/20 to-[#1e1e76]/20 backdrop-blur-sm rounded-xl p-1 border border-[#707ff5]/20 shadow-inner">
            {tabs.map((tab) => (
              <Button
                key={tab.key}
                variant={activeTab === tab.key ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 transition-all duration-300 text-sm sm:text-base ${
                  activeTab === tab.key 
                    ? 'bg-gradient-to-r from-[#4b4bc3] via-[#707ff5] to-[#a195f9] text-white shadow-lg shadow-[#707ff5]/30 backdrop-blur-sm' 
                    : 'hover:bg-[#707ff5]/10 hover:text-[#707ff5] backdrop-blur-sm text-muted-foreground'
                }`}
                data-testid={`popular-tab-${tab.key}`}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          {/* Series List */}
          <div className="space-y-3">
        {popularSeries.map((series, index) => (
            <PopularSeriesItem
              key={series.id}
              series={series}
              navigate={navigate}
            />
        ))}
      </div>

          {/* View More */}
          <Button 
            variant="outline" 
            className="w-full mt-6 bg-gradient-to-r from-[#1e1e76]/10 via-[#4b4bc3]/10 to-[#707ff5]/10 hover:from-[#4b4bc3]/20 hover:via-[#707ff5]/20 hover:to-[#a195f9]/20 backdrop-blur-sm border-[#707ff5]/30 hover:border-[#707ff5]/60 hover:shadow-lg hover:shadow-[#707ff5]/20 transition-all duration-300 text-[#a195f9] hover:text-[#707ff5] font-semibold" 
            data-testid="view-more-popular"
            onClick={() => navigate("/browse?sort=popular")}
          >
            View More Popular Series
          </Button>
        </>
      )}
    </div>
  );
}

// Memoized series item component for better performance
const PopularSeriesItem = React.memo(({ series, navigate }: { 
  series: PopularItem; 
  navigate: (path: string) => void;
}) => {
  const getRankDisplay = useMemo(() => {
    if (series.rank === 1) {
      return (
        <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-lg">
          <Crown className="w-4 h-4 text-white" />
        </div>
      );
    }
    if (series.rank === 2) {
      return (
        <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-gray-300 to-gray-500 rounded-full flex items-center justify-center shadow-lg">
          <Medal className="w-4 h-4 text-white" />
        </div>
      );
    }
    if (series.rank === 3) {
      return (
        <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center shadow-lg">
          <Award className="w-4 h-4 text-white" />
        </div>
      );
    }
    return (
      <div className="flex-shrink-0 w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
        <span className="text-sm font-bold text-primary">
          {series.rank}
        </span>
      </div>
    );
  }, [series.rank]);

  const handleClick = useCallback(() => {
    navigate(`/manga/${series.id}`);
  }, [navigate, series.id]);

  return (
    <div
      onClick={handleClick}
      className={`flex items-center space-x-3 p-2 rounded-lg hover-elevate cursor-pointer group ${
        series.rank <= 3 ? 'bg-gradient-to-r from-card to-card/50 border-l-2 ' +
        (series.rank === 1 ? 'border-l-yellow-400' : 
         series.rank === 2 ? 'border-l-gray-400' : 'border-l-orange-400') : ''
      }`}
      data-testid={`popular-series-${series.id}`}
    >
      {/* Rank */}
      {getRankDisplay}

      {/* Thumbnail */}
      <div className="relative w-12 h-16 rounded overflow-hidden flex-shrink-0">
        {series.coverImageUrl ? (
          <img
            src={series.coverImageUrl}
            alt={series.title}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = '/api/covers/placeholder';
            }}
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <span className="text-muted-foreground text-xs">No cover</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-card-foreground group-hover:text-primary transition-colors line-clamp-1">
          {series.title}
        </h4>
        
        <div className="flex items-center space-x-2 mt-1">
          <div className="flex items-center space-x-1">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            <span className="text-sm text-muted-foreground">{series.rating}</span>
          </div>
          
          <Badge 
            variant={series.status === "Ongoing" ? "default" : "secondary"}
            className="text-xs"
          >
            {series.status}
          </Badge>
        </div>
        
        {series.genres && series.genres.length > 0 && (
          <div className="flex space-x-1 mt-1">
            {series.genres.slice(0, 2).map((genre) => (
              <span key={genre} className="text-xs text-muted-foreground">
                {genre}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});