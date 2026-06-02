import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

export interface Advertisement {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  linkUrl: string;
  type: string;
  page: string;
  location: string;
  isActive: string;
  startDate?: string;
  endDate?: string;
  displayOrder: number;
  clickCount: number;
  impressionCount: number;
  createdAt?: string;
  updatedAt?: string;
}

type Page = 'homepage' | 'manga_detail' | 'reader' | 'search_results';
type Location = 'top_banner' | 'bottom_banner' | 'sidebar' | 'in_content_1' | 'in_content_2';

export function useAds(page: Page, location?: Location) {
  const { data: ads, isLoading, error } = useQuery<Advertisement[]>({
    queryKey: ['ads', page, location],
    queryFn: async () => {
      // Build query parameters
      const params = new URLSearchParams({ page });
      if (location) {
        params.append('location', location);
      }
      
      // Use the old endpoint for backwards compatibility
      const response = await fetch(`/api/ads/placement/${page}?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch ads');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  return {
    ads: ads || [],
    isLoading,
    error,
  };
}

export function useTrackImpression() {
  const trackedImpressions = useRef(new Set<string>());

  const mutation = useMutation({
    mutationFn: async (adId: string) => {
      const response = await fetch(`/api/ads/${adId}/impression`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to track impression');
      }
      return response.json();
    },
    onSuccess: (_, adId) => {
      trackedImpressions.current.add(adId);
    },
  });

  const trackImpression = (adId: string) => {
    if (!trackedImpressions.current.has(adId)) {
      mutation.mutate(adId);
    }
  };

  return { trackImpression };
}

export function useTrackClick() {
  const mutation = useMutation({
    mutationFn: async (adId: string) => {
      const response = await fetch(`/api/ads/${adId}/click`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to track click');
      }
      return response.json();
    },
  });

  const trackClick = (adId: string) => {
    mutation.mutate(adId);
  };

  return { trackClick };
}

export function useAdImpression(adId: string, enabled: boolean = true) {
  const { trackImpression } = useTrackImpression();
  const hasTracked = useRef(false);

  useEffect(() => {
    if (enabled && !hasTracked.current) {
      const timer = setTimeout(() => {
        trackImpression(adId);
        hasTracked.current = true;
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [adId, enabled, trackImpression]);
}
