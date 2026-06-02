import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Series } from "@shared/schema";

interface LibraryItem {
  id: string;
  userId: string;
  seriesId: string;
  status: string;
  addedAt: string;
  updatedAt: string;
  series: Series;
}

interface LibraryStatusResponse {
  inLibrary: boolean;
}

export function useLibrary(isAuthenticated: boolean = false) {
  const { data: library, isLoading, error, isError } = useQuery<LibraryItem[]>({
    queryKey: ["/api/library"],
    queryFn: async () => {
      const response = await fetch("/api/library", {
        credentials: "include",
      });
      
      if (response.status === 401) {
        return [];
      }
      
      if (!response.ok) {
        throw new Error("Failed to fetch library");
      }
      
      return response.json();
    },
    enabled: isAuthenticated,
    retry: false,
  });

  return {
    library: library || [],
    isLoading,
    error,
    isError,
  };
}

export function useLibraryStatus(seriesId: string | undefined) {
  const { data, isLoading } = useQuery<LibraryStatusResponse>({
    queryKey: ["/api/library/check", seriesId],
    queryFn: async () => {
      if (!seriesId) {
        return { inLibrary: false };
      }
      
      const response = await fetch(`/api/library/check/${seriesId}`, {
        credentials: "include",
      });
      
      if (response.status === 401) {
        return { inLibrary: false };
      }
      
      if (!response.ok) {
        throw new Error("Failed to check library status");
      }
      
      return response.json();
    },
    enabled: !!seriesId,
    retry: false,
  });

  return {
    inLibrary: data?.inLibrary || false,
    isLoading,
  };
}

export function useAddToLibrary() {
  const { toast } = useToast();

  const addToLibraryMutation = useMutation({
    mutationFn: async ({ seriesId, status = "reading" }: { seriesId: string; status?: string }) => {
      return apiRequest("POST", `/api/library/${seriesId}`, { status });
    },
    onMutate: async ({ seriesId }: { seriesId: string; status?: string }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/library"] });
      await queryClient.cancelQueries({ queryKey: ["/api/library/check", seriesId] });

      const previousLibrary = queryClient.getQueryData<LibraryItem[]>(["/api/library"]);
      const previousStatus = queryClient.getQueryData<LibraryStatusResponse>(["/api/library/check", seriesId]);

      queryClient.setQueryData<LibraryStatusResponse>(
        ["/api/library/check", seriesId],
        { inLibrary: true }
      );

      return { previousLibrary, previousStatus, seriesId };
    },
    onSuccess: (data, { seriesId }: { seriesId: string; status?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      queryClient.invalidateQueries({ queryKey: ["/api/library/check", seriesId] });
      
      toast({
        title: "Added to library",
        description: "Series has been added to your library.",
      });
    },
    onError: (error: any, { seriesId }: { seriesId: string; status?: string }, context) => {
      if (context?.previousStatus) {
        queryClient.setQueryData(
          ["/api/library/check", seriesId],
          context.previousStatus
        );
      }
      
      if (context?.previousLibrary) {
        queryClient.setQueryData(["/api/library"], context.previousLibrary);
      }

      const errorMessage = error.message === "Series is already in your library"
        ? "This series is already in your library"
        : "Failed to add series to library";

      toast({
        title: "Error",
        description: errorMessage,
        variant: "error",
      });
    },
  });

  return {
    addToLibrary: (seriesId: string, status?: string) => addToLibraryMutation.mutate({ seriesId, status }),
    isAdding: addToLibraryMutation.isPending,
  };
}

export function useRemoveFromLibrary() {
  const { toast } = useToast();

  const removeFromLibraryMutation = useMutation({
    mutationFn: async (seriesId: string) => {
      return apiRequest("DELETE", `/api/library/${seriesId}`);
    },
    onMutate: async (seriesId: string) => {
      await queryClient.cancelQueries({ queryKey: ["/api/library"] });
      await queryClient.cancelQueries({ queryKey: ["/api/library/check", seriesId] });

      const previousLibrary = queryClient.getQueryData<LibraryItem[]>(["/api/library"]);
      const previousStatus = queryClient.getQueryData<LibraryStatusResponse>(["/api/library/check", seriesId]);

      if (previousLibrary) {
        queryClient.setQueryData<LibraryItem[]>(
          ["/api/library"],
          previousLibrary.filter((item) => item.seriesId !== seriesId)
        );
      }

      queryClient.setQueryData<LibraryStatusResponse>(
        ["/api/library/check", seriesId],
        { inLibrary: false }
      );

      return { previousLibrary, previousStatus, seriesId };
    },
    onSuccess: (data, seriesId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      queryClient.invalidateQueries({ queryKey: ["/api/library/check", seriesId] });
      
      toast({
        title: "Removed from library",
        description: "Series has been removed from your library.",
      });
    },
    onError: (error: any, seriesId, context) => {
      if (context?.previousStatus) {
        queryClient.setQueryData(
          ["/api/library/check", seriesId],
          context.previousStatus
        );
      }
      
      if (context?.previousLibrary) {
        queryClient.setQueryData(["/api/library"], context.previousLibrary);
      }

      toast({
        title: "Error",
        description: "Failed to remove series from library",
        variant: "error",
      });
    },
  });

  return {
    removeFromLibrary: removeFromLibraryMutation.mutate,
    isRemoving: removeFromLibraryMutation.isPending,
  };
}

export function useUpdateLibraryStatus() {
  const { toast } = useToast();

  const updateStatusMutation = useMutation({
    mutationFn: async ({ seriesId, status }: { seriesId: string; status: string }) => {
      return apiRequest("PATCH", `/api/library/${seriesId}/status`, { status });
    },
    onSuccess: (data, { seriesId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      queryClient.invalidateQueries({ queryKey: ["/api/library/check", seriesId] });
      
      toast({
        title: "Status updated",
        description: "Reading status has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to update reading status",
        variant: "error",
      });
    },
  });

  return {
    updateStatus: (seriesId: string, status: string) => updateStatusMutation.mutate({ seriesId, status }),
    isUpdating: updateStatusMutation.isPending,
  };
}
