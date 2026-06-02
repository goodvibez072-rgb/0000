import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { fetchWithCsrf } from "@/lib/csrf";

interface RatingStats {
  averageRating: number;
  totalRatings: number;
}

interface UserRating {
  id: string;
  userId: string;
  seriesId: string;
  rating: number;
  review: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SeriesRating extends UserRating {
  username: string;
}

export function useRatings(seriesId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const ratingsQuery = useQuery({
    queryKey: ["ratings", seriesId],
    queryFn: async () => {
      if (!seriesId) return [];
      const response = await fetch(`/api/ratings/${seriesId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch ratings");
      }
      return response.json() as Promise<SeriesRating[]>;
    },
    enabled: !!seriesId,
  });

  const statsQuery = useQuery({
    queryKey: ["ratings", seriesId, "stats"],
    queryFn: async () => {
      if (!seriesId) return { averageRating: 0, totalRatings: 0 };
      const response = await fetch(`/api/ratings/${seriesId}/stats`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch rating stats");
      }
      return response.json() as Promise<RatingStats>;
    },
    enabled: !!seriesId,
  });

  const userRatingQuery = useQuery({
    queryKey: ["ratings", seriesId, "user"],
    queryFn: async () => {
      if (!seriesId) return null;
      const response = await fetch(`/api/ratings/${seriesId}/user`, {
        credentials: "include",
      });
      if (response.status === 401) {
        return null;
      }
      if (!response.ok) {
        throw new Error("Failed to fetch user rating");
      }
      return response.json() as Promise<UserRating | null>;
    },
    enabled: !!seriesId,
  });

  const submitRatingMutation = useMutation({
    mutationFn: async ({ rating, review }: { rating: number; review?: string }) => {
      if (!seriesId) throw new Error("Series ID is required");

      const response = await fetchWithCsrf(`/api/ratings/${seriesId}`, {
        method: "POST",
        body: JSON.stringify({ rating, review }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to submit rating");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ratings", seriesId] });
      queryClient.invalidateQueries({ queryKey: ["ratings", seriesId, "stats"] });
      queryClient.invalidateQueries({ queryKey: ["ratings", seriesId, "user"] });
      toast({
        title: "Rating submitted",
        description: "Your rating has been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to submit rating",
        description: error.message,
        variant: "error",
      });
    },
  });

  const deleteRatingMutation = useMutation({
    mutationFn: async () => {
      if (!seriesId) throw new Error("Series ID is required");

      const response = await fetchWithCsrf(`/api/ratings/${seriesId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete rating");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ratings", seriesId] });
      queryClient.invalidateQueries({ queryKey: ["ratings", seriesId, "stats"] });
      queryClient.invalidateQueries({ queryKey: ["ratings", seriesId, "user"] });
      toast({
        title: "Rating deleted",
        description: "Your rating has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete rating",
        description: error.message,
        variant: "error",
      });
    },
  });

  return {
    ratings: ratingsQuery.data ?? [],
    isLoadingRatings: ratingsQuery.isLoading,
    stats: statsQuery.data ?? { averageRating: 0, totalRatings: 0 },
    isLoadingStats: statsQuery.isLoading,
    userRating: userRatingQuery.data,
    isLoadingUserRating: userRatingQuery.isLoading,
    submitRating: submitRatingMutation.mutate,
    isSubmittingRating: submitRatingMutation.isPending,
    deleteRating: deleteRatingMutation.mutate,
    isDeletingRating: deleteRatingMutation.isPending,
  };
}
