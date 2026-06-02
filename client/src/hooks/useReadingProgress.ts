import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ReadingProgress, ReadingProgressWithSeries } from "@shared/schema";

export function useReadingProgress(seriesId: string | undefined) {
  const { data: progress, isLoading, error, isError } = useQuery<ReadingProgress>({
    queryKey: ["/api/series/:seriesId/progress", seriesId],
    queryFn: async () => {
      if (!seriesId) {
        throw new Error("Series ID is required");
      }
      
      const response = await fetch(`/api/series/${seriesId}/progress`, {
        credentials: "include",
      });
      
      if (response.status === 401) {
        return null;
      }
      
      if (response.status === 404) {
        return null;
      }
      
      if (!response.ok) {
        throw new Error("Failed to fetch reading progress");
      }
      
      return response.json();
    },
    enabled: !!seriesId,
    retry: false,
  });

  return {
    progress: progress || null,
    isLoading,
    error,
    isError,
  };
}

export function useSaveProgress() {
  const saveProgressMutation = useMutation({
    mutationFn: async ({ 
      seriesId, 
      chapterId, 
      lastReadPage 
    }: { 
      seriesId: string; 
      chapterId: string | null; 
      lastReadPage: number;
    }) => {
      return apiRequest("POST", `/api/series/${seriesId}/progress`, {
        chapterId,
        lastReadPage,
      });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/series/:seriesId/progress", variables.seriesId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/progress"] 
      });
    },
  });

  return {
    saveProgress: saveProgressMutation.mutate,
    saveProgressAsync: saveProgressMutation.mutateAsync,
    isSaving: saveProgressMutation.isPending,
    error: saveProgressMutation.error,
  };
}

export function useUserProgress(isAuthenticated: boolean = false) {
  const { data: progressList, isLoading, error, isError } = useQuery<ReadingProgressWithSeries[]>({
    queryKey: ["/api/progress"],
    queryFn: async () => {
      const response = await fetch("/api/progress", {
        credentials: "include",
      });
      
      if (response.status === 401) {
        return [];
      }
      
      if (!response.ok) {
        throw new Error("Failed to fetch user reading progress");
      }
      
      return response.json();
    },
    enabled: isAuthenticated,
    retry: false,
  });

  return {
    progressList: progressList || [],
    isLoading,
    error,
    isError,
  };
}

export function useDeleteProgress() {
  const deleteProgressMutation = useMutation({
    mutationFn: async (seriesId: string) => {
      return apiRequest("DELETE", `/api/series/${seriesId}/progress`);
    },
    onSuccess: (data, seriesId) => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/series/:seriesId/progress", seriesId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/progress"] 
      });
    },
  });

  return {
    deleteProgress: deleteProgressMutation.mutate,
    isDeleting: deleteProgressMutation.isPending,
  };
}
