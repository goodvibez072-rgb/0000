import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWithCsrf } from "@/lib/csrf";

export function useTestMode() {
  return useQuery<{ testMode: boolean }>({
    queryKey: ["/api/auth/test-mode"],
    queryFn: async () => {
      const response = await fetch("/api/auth/test-mode", {
        credentials: "include",
      });
      
      if (response.status === 401) {
        return { testMode: false };
      }
      
      if (!response.ok) {
        throw new Error("Failed to fetch test mode status");
      }
      
      return response.json();
    },
    retry: false,
  });
}

export function useToggleTestMode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (enable: boolean) => {
      const endpoint = enable ? "/api/auth/test-mode/enable" : "/api/auth/test-mode/disable";
      const response = await fetchWithCsrf(endpoint, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to toggle test mode");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/test-mode"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chapters"] });
    },
  });
}
