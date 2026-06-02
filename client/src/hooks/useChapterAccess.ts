import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { fetchWithCsrf } from "@/lib/csrf";

interface ChapterAccessResponse {
  hasAccess: boolean;
  accessType: string;
  unlockCost: number;
  alreadyUnlocked: boolean;
}

export function useChapterAccess(chapterId: string | undefined) {
  return useQuery<ChapterAccessResponse>({
    queryKey: ["/api/chapters", chapterId, "access"],
    queryFn: async () => {
      if (!chapterId) {
        throw new Error("Chapter ID is required");
      }

      const response = await fetch(`/api/chapters/${chapterId}/access`, {
        credentials: "include",
      });

      if (response.status === 401) {
        throw new Error("UNAUTHORIZED");
      }

      if (!response.ok) {
        throw new Error("Failed to check chapter access");
      }

      return response.json();
    },
    enabled: !!chapterId,
    retry: false,
  });
}

export function useUnlockChapter() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (chapterId: string) => {
      const response = await fetchWithCsrf(`/api/chapters/${chapterId}/unlock`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to unlock chapter");
      }

      return response.json();
    },
    onSuccess: (_, chapterId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chapters", chapterId, "access"] });
      queryClient.invalidateQueries({ queryKey: ["/api/currency/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/currency/transactions"] });
      toast({
        title: "Chapter Unlocked",
        description: "You can now read this chapter!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Unlock Failed",
        description: error.message,
        variant: "error",
      });
    },
  });
}
