import { useEffect, useRef, useState } from "react";
import { useAds, useTrackClick, useAdImpression, type Advertisement } from "@/hooks/useAds";
import { useAdIntensity } from "@/hooks/useAdIntensity";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

type AdType = 'banner' | 'sidebar' | 'popup' | 'inline';
type Page = 'homepage' | 'manga_detail' | 'reader' | 'search_results';
type Location = 'top_banner' | 'bottom_banner' | 'sidebar' | 'in_content_1' | 'in_content_2';

interface AdDisplayProps {
  page: Page;
  location?: Location;
  type?: AdType;
  className?: string;
  maxAds?: number;
}

export default function AdDisplay({ page, location, type, className, maxAds = 1 }: AdDisplayProps) {
  const { ads, isLoading } = useAds(page, location);
  const { trackClick } = useTrackClick();
  const { level: adIntensityLevel, enabled: adsEnabled } = useAdIntensity();

  // Check VIP subscription for ad-free perk
  const { data: subscription } = useQuery({
    queryKey: ["/api/subscriptions/current"],
    queryFn: async () => {
      const response = await fetch("/api/subscriptions/current", {
        credentials: "include",
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("Failed to fetch subscription");
      return response.json();
    },
    staleTime: 60000, // Cache for 1 minute
    retry: 1,
  });

  // Priority 1: Check if ads are globally disabled (Ad-Free Mode)
  if (!adsEnabled) {
    return null;
  }

  // Priority 2: Check if user has active VIP subscription with ad-free perk
  if (subscription?.status === "active" && (subscription?.isAdFree === "true" || subscription?.isAdFree === true)) {
    return null;
  }

  // Ad Intensity Level Logic (5-Level System) - DOUBLED for ad-driven revenue model:
  // Level 1 (Minimal): 2 ads per page - Conservative start
  // Level 2 (Low): 4 ads on big pages, 2 on small - Light monetization
  // Level 3 (Standard): 6 ads on big pages, 3 on small - Balanced revenue
  // Level 4 (High): 8 ads on big pages, 4 on small - Strong monetization
  // Level 5 (Maximum): 15 ads on big pages, 8 on small - Maximum revenue for ad-only sites
  const getMaxAdsForPlacement = () => {
    const isBigPage = page === 'homepage' || page === 'search_results';
    
    switch (adIntensityLevel) {
      case 1:
        // Minimal: 2 ads everywhere (doubled from 1)
        return 2;
      case 2:
        // Low: 4 ads on big pages, 2 on small (doubled from 2/1)
        return isBigPage ? 4 : 2;
      case 3:
        // Standard: 6 ads on big pages, 3 on small (doubled from 3/2)
        return isBigPage ? 6 : 3;
      case 4:
        // High: 8 ads on big pages, 4 on small (doubled from 4/3)
        return isBigPage ? 8 : 4;
      case 5:
        // Maximum: 15 ads on big pages, 8 on small (increased from 6/4)
        return isBigPage ? 15 : 8;
      default:
        // Fallback to standard
        return isBigPage ? 6 : 3;
    }
  };

  const effectiveMaxAds = Math.min(maxAds, getMaxAdsForPlacement());

  const filteredAds = ads
    .filter((ad) => {
      if (type && ad.type !== type) return false;
      
      // Levels 1-2: No popup ads (less intrusive)
      // Levels 3-5: Popups allowed for higher revenue
      if (adIntensityLevel <= 2 && ad.type === 'popup') {
        return false;
      }
      
      const now = new Date();
      if (ad.startDate && new Date(ad.startDate) > now) return false;
      if (ad.endDate && new Date(ad.endDate) < now) return false;
      
      return ad.isActive === 'true';
    })
    .sort((a, b) => b.displayOrder - a.displayOrder)
    .slice(0, effectiveMaxAds);

  if (isLoading || filteredAds.length === 0) {
    return null;
  }

  return (
    <div className={cn("ad-container", className)}>
      {filteredAds.map((ad) => (
        <AdCard key={ad.id} ad={ad} trackClick={trackClick} />
      ))}
    </div>
  );
}

interface AdCardProps {
  ad: Advertisement;
  trackClick: (adId: string) => void;
}

function AdCard({ ad, trackClick }: AdCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useAdImpression(ad.id, isVisible);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.5 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => {
      if (cardRef.current) {
        observer.unobserve(cardRef.current);
      }
    };
  }, []);

  const handleClick = () => {
    trackClick(ad.id);
    window.open(ad.linkUrl, '_blank', 'noopener,noreferrer');
  };

  const getAdStyles = () => {
    switch (ad.type) {
      case 'banner':
        return 'w-full aspect-[6/1] sm:aspect-[8/1]';
      case 'sidebar':
        return 'w-full aspect-[2/3]';
      case 'inline':
        return 'w-full aspect-[4/1] sm:aspect-[5/1]';
      case 'popup':
        return 'w-full aspect-[3/2]';
      default:
        return 'w-full aspect-[4/1]';
    }
  };

  return (
    <div ref={cardRef} className="mb-4">
      <Card
        className={cn(
          "overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] group relative",
          getAdStyles()
        )}
        onClick={handleClick}
      >
        <div className="absolute top-2 right-2 z-10 bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
          Advertisement
        </div>
        
        <div className="relative w-full h-full">
          <img
            src={ad.imageUrl}
            alt={ad.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm sm:text-base line-clamp-1">{ad.title}</h3>
                  {ad.description && (
                    <p className="text-xs sm:text-sm text-gray-200 line-clamp-2 mt-1">
                      {ad.description}
                    </p>
                  )}
                </div>
                <ExternalLink className="w-5 h-5 ml-2 flex-shrink-0" />
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function BannerAd({ page, location, className }: { page: Page; location?: Location; className?: string }) {
  return (
    <AdDisplay
      page={page}
      location={location}
      type="banner"
      className={className}
      maxAds={1}
    />
  );
}

export function SidebarAd({ page, location, className }: { page: Page; location?: Location; className?: string }) {
  return (
    <AdDisplay
      page={page}
      location={location}
      type="sidebar"
      className={cn("sticky top-4", className)}
      maxAds={2}
    />
  );
}

export function InlineAd({ page, location, className }: { page: Page; location?: Location; className?: string }) {
  return (
    <AdDisplay
      page={page}
      location={location}
      type="inline"
      className={className}
      maxAds={1}
    />
  );
}
