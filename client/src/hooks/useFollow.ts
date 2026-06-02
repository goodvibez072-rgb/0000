import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Series } from "@shared/schema";

interface FollowItem {
  id: string;
  userId: string;
  seriesId: string;
  followedAt: string;
  notificationsEnabled: boolean;
  series: Series;
}

interface FollowStatusResponse {
  isFollowing: boolean;
  notificationsEnabled?: boolean;
}

interface FollowerCountResponse {
  count: number;
}

export function useFollows() {
  const { data: follows, isLoading, error, isError } = useQuery<FollowItem[]>({
    queryKey: ["/api/follow"],
    queryFn: async () => {
      const response = await fetch("/api/follow", {
        credentials: "include",
      });
      
      if (response.status === 401) {
        return [];
      }
      
      if (!response.ok) {
        throw new Error("Failed to fetch follows");
      }
      
      return response.json();
    },
    retry: false,
  });

  return {
    follows: follows || [],
    isLoading,
    error,
    isError,
  };
}

export function useFollowStatus(seriesId: string | undefined) {
  const { data, isLoading } = useQuery<FollowStatusResponse>({
    queryKey: ["/api/follow/check", seriesId],
    queryFn: async () => {
      if (!seriesId) {
        return { isFollowing: false };
      }
      
      const response = await fetch(`/api/follow/check/${seriesId}`, {
        credentials: "include",
      });
      
      if (response.status === 401) {
        return { isFollowing: false };
      }
      
      if (!response.ok) {
        throw new Error("Failed to check follow status");
      }
      
      return response.json();
    },
    enabled: !!seriesId,
    retry: false,
  });

  return {
    isFollowing: data?.isFollowing || false,
    notificationsEnabled: data?.notificationsEnabled,
    isLoading,
  };
}

export function useFollowSeries() {
  const { toast } = useToast();

  const followSeriesMutation = useMutation({
    mutationFn: async ({ seriesId, notificationsEnabled }: { seriesId: string; notificationsEnabled?: boolean }) => {
      return apiRequest("POST", `/api/follow/${seriesId}`, { notificationsEnabled });
    },
    onMutate: async ({ seriesId }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/follow"] });
      await queryClient.cancelQueries({ queryKey: ["/api/follow/check", seriesId] });

      const previousFollows = queryClient.getQueryData<FollowItem[]>(["/api/follow"]);
      const previousStatus = queryClient.getQueryData<FollowStatusResponse>(["/api/follow/check", seriesId]);

      queryClient.setQueryData<FollowStatusResponse>(
        ["/api/follow/check", seriesId],
        { isFollowing: true, notificationsEnabled: true }
      );

      return { previousFollows, previousStatus, seriesId };
    },
    onSuccess: (data, { seriesId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/follow"] });
      queryClient.invalidateQueries({ queryKey: ["/api/follow/check", seriesId] });
      queryClient.invalidateQueries({ queryKey: ["/api/series", seriesId, "followers"] });
      
      toast({
        title: "Following series",
        description: "You will receive notifications for new chapters.",
      });
    },
    onError: (error: any, { seriesId }, context) => {
      if (context?.previousStatus) {
        queryClient.setQueryData(
          ["/api/follow/check", seriesId],
          context.previousStatus
        );
      }
      
      if (context?.previousFollows) {
        queryClient.setQueryData(["/api/follow"], context.previousFollows);
      }

      const errorMessage = error.message === "You are already following this series"
        ? "You are already following this series"
        : "Failed to follow series";

      toast({
        title: "Error",
        description: errorMessage,
        variant: "error",
      });
    },
  });

  return {
    followSeries: followSeriesMutation.mutate,
    isFollowing: followSeriesMutation.isPending,
  };
}

export function useUnfollowSeries() {
  const { toast } = useToast();

  const unfollowSeriesMutation = useMutation({
    mutationFn: async (seriesId: string) => {
      return apiRequest("DELETE", `/api/follow/${seriesId}`);
    },
    onMutate: async (seriesId: string) => {
      await queryClient.cancelQueries({ queryKey: ["/api/follow"] });
      await queryClient.cancelQueries({ queryKey: ["/api/follow/check", seriesId] });

      const previousFollows = queryClient.getQueryData<FollowItem[]>(["/api/follow"]);
      const previousStatus = queryClient.getQueryData<FollowStatusResponse>(["/api/follow/check", seriesId]);

      if (previousFollows) {
        queryClient.setQueryData<FollowItem[]>(
          ["/api/follow"],
          previousFollows.filter((item) => item.seriesId !== seriesId)
        );
      }

      queryClient.setQueryData<FollowStatusResponse>(
        ["/api/follow/check", seriesId],
        { isFollowing: false }
      );

      return { previousFollows, previousStatus, seriesId };
    },
    onSuccess: (data, seriesId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/follow"] });
      queryClient.invalidateQueries({ queryKey: ["/api/follow/check", seriesId] });
      queryClient.invalidateQueries({ queryKey: ["/api/series", seriesId, "followers"] });
      
      toast({
        title: "Unfollowed series",
        description: "You will no longer receive notifications for this series.",
      });
    },
    onError: (error: any, seriesId, context) => {
      if (context?.previousStatus) {
        queryClient.setQueryData(
          ["/api/follow/check", seriesId],
          context.previousStatus
        );
      }
      
      if (context?.previousFollows) {
        queryClient.setQueryData(["/api/follow"], context.previousFollows);
      }

      toast({
        title: "Error",
        description: "Failed to unfollow series",
        variant: "error",
      });
    },
  });

  return {
    unfollowSeries: unfollowSeriesMutation.mutate,
    isUnfollowing: unfollowSeriesMutation.isPending,
  };
}

export function useToggleNotifications() {
  const { toast } = useToast();

  const toggleNotificationsMutation = useMutation({
    mutationFn: async ({ seriesId, enabled }: { seriesId: string; enabled: boolean }) => {
      return apiRequest("PATCH", `/api/follow/${seriesId}/notifications`, { enabled });
    },
    onMutate: async ({ seriesId, enabled }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/follow/check", seriesId] });

      const previousStatus = queryClient.getQueryData<FollowStatusResponse>(["/api/follow/check", seriesId]);

      queryClient.setQueryData<FollowStatusResponse>(
        ["/api/follow/check", seriesId],
        (old) => ({
          isFollowing: old?.isFollowing || true,
          notificationsEnabled: enabled,
        })
      );

      return { previousStatus, seriesId };
    },
    onSuccess: (data, { seriesId, enabled }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/follow"] });
      queryClient.invalidateQueries({ queryKey: ["/api/follow/check", seriesId] });
      
      toast({
        title: enabled ? "Notifications enabled" : "Notifications disabled",
        description: enabled 
          ? "You will receive notifications for new chapters."
          : "You will not receive notifications for new chapters.",
      });
    },
    onError: (error: any, { seriesId }, context) => {
      if (context?.previousStatus) {
        queryClient.setQueryData(
          ["/api/follow/check", seriesId],
          context.previousStatus
        );
      }

      toast({
        title: "Error",
        description: "Failed to update notification settings",
        variant: "error",
      });
    },
  });

  return {
    toggleNotifications: toggleNotificationsMutation.mutate,
    isToggling: toggleNotificationsMutation.isPending,
  };
}

export function useFollowerCount(seriesId: string | undefined) {
  const { data, isLoading } = useQuery<FollowerCountResponse>({
    queryKey: ["/api/series", seriesId, "followers"],
    queryFn: async () => {
      if (!seriesId) {
        return { count: 0 };
      }
      
      const response = await fetch(`/api/series/${seriesId}/followers`, {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch follower count");
      }
      
      return response.json();
    },
    enabled: !!seriesId,
    retry: false,
  });

  return {
    followerCount: data?.count || 0,
    isLoading,
  };
}
