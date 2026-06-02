import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import SeriesRowSkeleton from "@/components/ui/SeriesRowSkeleton";

interface TrendingItem {
  id: string;
  title: string;
  coverImageUrl?: string;
  rating?: number;
  status: string;
  genres?: string[];
  updatedAt?: string;
  author?: string;
}

export default function Trending() {
  const [trendingItems, setTrendingItems] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [, navigate] = useLocation();

  useEffect(() => {
    const fetchTrendingSeries = async () => {
      try {
        const response = await fetch('/api/sections/trending');
        if (response.ok) {
          const data = await response.json();
          setTrendingItems(data);
        }
      } catch (error) {
        // Error fetching trending series - fail silently and show empty state
      } finally {
        setLoading(false);
      }
    };

    fetchTrendingSeries();
  }, []);

  const getCardColors = (rank: number) => {
    switch (rank) {
      case 1:
        return {
          cardBg: 'bg-gradient-to-br from-[#f2a1f2] via-[#a195f9] to-[#f2a1f2]',
          badgeBg: 'bg-gradient-to-br from-[#1e1e76] to-[#4b4bc3]',
          badgeText: 'text-[#f2a1f2]',
          genreBg: 'rgba(242, 161, 242, 0.3)',
          genreBorder: 'rgba(242, 161, 242, 0.6)'
        };
      case 2:
        return {
          cardBg: 'bg-gradient-to-br from-[#707ff5] via-[#4b4bc3] to-[#707ff5]',
          badgeBg: 'bg-gradient-to-br from-[#f2a1f2] to-[#a195f9]',
          badgeText: 'text-[#1e1e76]',
          genreBg: 'rgba(112, 127, 245, 0.3)',
          genreBorder: 'rgba(112, 127, 245, 0.6)'
        };
      case 3:
        return {
          cardBg: 'bg-gradient-to-br from-[#a195f9] via-[#707ff5] to-[#a195f9]',
          badgeBg: 'bg-gradient-to-br from-[#4b4bc3] to-[#1e1e76]',
          badgeText: 'text-[#f2a1f2]',
          genreBg: 'rgba(161, 149, 249, 0.3)',
          genreBorder: 'rgba(161, 149, 249, 0.6)'
        };
      default:
        return {
          cardBg: 'bg-gradient-to-br from-[#1e1e76] via-[#4b4bc3] to-[#1e1e76]',
          badgeBg: 'bg-gradient-to-br from-[#707ff5] to-[#a195f9]',
          badgeText: 'text-[#1e1e76]',
          genreBg: 'rgba(75, 75, 195, 0.25)',
          genreBorder: 'rgba(75, 75, 195, 0.5)'
        };
    }
  };

  if (loading) {
    return (
      <section className="py-7 sm:py-10 w-full">
        <div className="max-w-none mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 sm:gap-4 mb-10 sm:mb-8 lg:mb-10">
            <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-[#f2a1f2] via-[#a195f9] to-[#707ff5] rounded-lg flex items-center justify-center shadow-lg shadow-[#f2a1f2]/30">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-white"
              >
                <path
                  fillRule="evenodd"
                  d="M12.963 2.286a.75.75 0 0 0-1.071-.136 9.742 9.742 0 0 0-3.539 6.176 7.547 7.547 0 0 1-1.705-1.715.75.75 0 0 0-1.152-.082A9 9 0 1 0 15.68 4.534a7.46 7.46 0 0 1-2.717-2.248ZM15.75 14.25a3.75 3.75 0 1 1-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 0 1 1.925-3.546 3.75 3.75 0 0 1 3.255 3.718Z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-white">
              Most <span className="bg-gradient-to-r from-[#f2a1f2] to-[#a195f9] bg-clip-text text-transparent">Popular</span>
            </h2>
          </div>
          
          <div className="flex flex-col gap-12 px-6">
            <div className="w-full md:w-[38%] md:mx-auto">
              <SeriesRowSkeleton variant="trending" />
            </div>
            <div className="flex flex-col md:flex-row justify-center gap-6 md:gap-12">
              <div className="w-full md:w-[38%]">
                <SeriesRowSkeleton variant="trending" />
              </div>
              <div className="w-full md:w-[38%]">
                <SeriesRowSkeleton variant="trending" />
              </div>
            </div>
            <div className="flex flex-col md:flex-row justify-between gap-6">
              <div className="w-full md:w-[46%]">
                <SeriesRowSkeleton variant="trending" />
              </div>
              <div className="w-full md:w-[46%]">
                <SeriesRowSkeleton variant="trending" />
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const trendingMangaWithRank = trendingItems.slice(0, 5).map((item, index) => ({
    ...item,
    rank: index + 1,
    thumbnail: item.coverImageUrl || '/placeholder-cover.jpg'
  }));

  const renderCard = (item: typeof trendingMangaWithRank[0]) => {
    const cardColors = getCardColors(item.rank);
    
    return (
      <div
        key={item.rank}
        onClick={() => navigate(`/manga/${item.id}`)}
        className={`group flex items-center w-full rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.15)] relative overflow-hidden cursor-pointer ${cardColors.cardBg}`}
        data-testid={`trending-manga-${item.id}`}
      >
        {/* Hover shine effect */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-700">
          <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000" />
        </div>

        {/* Image - Integrated into card, sharing rounded corners */}
        <div className="relative w-[90px] lg:w-[102px] flex-shrink-0">
          <div className="aspect-[3/4] overflow-hidden rounded-l-xl">
            <img
              alt={item.title}
              width={102}
              height={136}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              src={item.thumbnail}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = '/api/covers/placeholder';
              }}
            />
          </div>
          
          {/* Rank badge overlay on top-left */}
          <div className={`absolute top-2 left-2 w-8 h-8 lg:w-10 lg:h-10 ${cardColors.badgeBg} rounded-full flex items-center justify-center shadow-lg ring-2 ring-white/20`}>
            <span className={`text-sm lg:text-base font-bold ${cardColors.badgeText}`}>
              {item.rank}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-3 lg:p-4 min-w-0">
          <div className="font-bold text-sm lg:text-lg line-clamp-2 transition-colors duration-300 group-hover:text-white mb-4 lg:mb-3">
            {item.title}
          </div>

          {item.genres && item.genres.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {item.genres.slice(0, 3).map((genre, index) => (
                <div
                  key={index}
                  className="rounded-full px-2 py-0.5 text-xs border transition-transform duration-300 group-hover:scale-105"
                  style={{
                    backgroundColor: cardColors.genreBg,
                    borderColor: cardColors.genreBorder,
                  }}
                >
                  {genre}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <section className="py-7 sm:py-10 w-full">
      <div className="max-w-none mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 sm:gap-4 mb-10 sm:mb-8 lg:mb-10">
          <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-[#f2a1f2] via-[#a195f9] to-[#707ff5] rounded-lg flex items-center justify-center shadow-lg shadow-[#f2a1f2]/30 transition-transform hover:scale-105">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
              className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-white"
            >
              <path
                fillRule="evenodd"
                d="M12.963 2.286a.75.75 0 0 0-1.071-.136 9.742 9.742 0 0 0-3.539 6.176 7.547 7.547 0 0 1-1.705-1.715.75.75 0 0 0-1.152-.082A9 9 0 1 0 15.68 4.534a7.46 7.46 0 0 1-2.717-2.248ZM15.75 14.25a3.75 3.75 0 1 1-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 0 1 1.925-3.546 3.75 3.75 0 0 1 3.255 3.718Z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h2 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-white">
            Most <span className="bg-gradient-to-r from-[#f2a1f2] to-[#a195f9] bg-clip-text text-transparent">Popular</span>
          </h2>
        </div>

        {trendingItems.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <p className="text-muted-foreground">No popular items to display</p>
          </div>
        ) : (
          <div className="flex flex-col gap-12 px-6">
            {/* First card - 38% width, centered */}
            {trendingMangaWithRank[0] && (
              <div className="w-full md:w-[38%] md:mx-auto">
                {renderCard(trendingMangaWithRank[0])}
              </div>
            )}
            
            {/* Second and third cards - 38% each, close together */}
            {(trendingMangaWithRank[1] || trendingMangaWithRank[2]) && (
              <div className="flex flex-col md:flex-row justify-center gap-6 md:gap-12">
                {trendingMangaWithRank[1] && (
                  <div className="w-full md:w-[38%]">
                    {renderCard(trendingMangaWithRank[1])}
                  </div>
                )}
                {trendingMangaWithRank[2] && (
                  <div className="w-full md:w-[38%]">
                    {renderCard(trendingMangaWithRank[2])}
                  </div>
                )}
              </div>
            )}
            
            {/* Fourth and fifth cards - 46% each, far apart */}
            {(trendingMangaWithRank[3] || trendingMangaWithRank[4]) && (
              <div className="flex flex-col md:flex-row justify-between gap-6">
                {trendingMangaWithRank[3] && (
                  <div className="w-full md:w-[46%]">
                    {renderCard(trendingMangaWithRank[3])}
                  </div>
                )}
                {trendingMangaWithRank[4] && (
                  <div className="w-full md:w-[46%]">
                    {renderCard(trendingMangaWithRank[4])}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
