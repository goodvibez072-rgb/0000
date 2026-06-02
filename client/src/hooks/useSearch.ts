import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

interface SearchFilters {
  genre?: string;
  status?: string;
  type?: string;
}

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  author?: string;
  artist?: string;
  status: string;
  type: string;
  genres: string[];
  coverImageUrl?: string;
  rating?: string;
  totalChapters?: number;
  publishedYear?: number;
  createdAt: string;
  updatedAt: string;
}

interface SearchResponse {
  query: string;
  filters: SearchFilters;
  results: SearchResult[];
  total: number;
}

export function useSearch(query: string, filters?: SearchFilters, enabled = true, browseMode = false) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['search', query, filters, browseMode],
    queryFn: async (): Promise<SearchResponse> => {
      const params = new URLSearchParams();
      
      if (query) {
        params.append('q', query);
      }
      
      if (filters?.genre) {
        params.append('genre', filters.genre);
      }
      
      if (filters?.status) {
        params.append('status', filters.status);
      }
      
      if (filters?.type) {
        params.append('type', filters.type);
      }
      
      // Add browse parameter to allow browsing all series
      if (browseMode) {
        params.append('browse', 'true');
      }

      const response = await fetch(`/api/search?${params.toString()}`, {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: enabled && (!!query?.trim() || !!filters?.genre || !!filters?.status || !!filters?.type || browseMode),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    results: data?.results ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    refetch,
    isEmpty: !isLoading && (data?.results?.length === 0),
  };
}

export function useSearchState() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [isSearchActive, setIsSearchActive] = useState(false);

  const updateFilter = useCallback((key: keyof SearchFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined,
    }));
  }, []);

  const clearSearch = useCallback(() => {
    setQuery('');
    setFilters({});
    setIsSearchActive(false);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  return {
    query,
    setQuery,
    filters,
    setFilters,
    updateFilter,
    clearSearch,
    clearFilters,
    isSearchActive,
    setIsSearchActive,
  };
}