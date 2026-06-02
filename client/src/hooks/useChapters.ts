import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

interface ChapterData {
  id: string;
  seriesId: string;
  chapterNumber: string;
  title?: string;
  pages: string[];
  totalPages: number;
  coverImageUrl?: string;
  isPublished: string;
  uploadedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function useChapters(seriesId: string) {
  const { data: chapters, isLoading, error, isError } = useQuery<ChapterData[]>({
    queryKey: [`/api/series/${seriesId}/chapters`],
    queryFn: getQueryFn({ on401: "throw" }),
    retry: false,
    enabled: !!seriesId, // Only run query if seriesId is provided
  });

  return {
    chapters: chapters || [],
    isLoading,
    error,
    isError,
  };
}