import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

interface MangaDetailData {
  id: string;
  title: string;
  description?: string;
  author?: string;
  artist?: string;
  status: string;
  type: string;
  genres?: string;
  coverImageUrl?: string;
  rating?: string;
  totalChapters?: number;
  publishedYear?: number;
  isAdult: string;
  createdAt?: string;
  updatedAt?: string;
}

export function useMangaDetail(id: string) {
  const { data: manga, isLoading, error, isError } = useQuery<MangaDetailData>({
    queryKey: ["/api/series", id],
    queryFn: getQueryFn({ on401: "throw" }),
    retry: false,
    enabled: !!id, // Only run query if id is provided
  });

  return {
    manga,
    isLoading,
    error,
    isError,
  };
}