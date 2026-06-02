import { useQuery } from "@tanstack/react-query";

interface AdIntensityResponse {
  level: number;
  description: string;
  enabled: boolean;
}

async function fetchAdIntensity(): Promise<AdIntensityResponse> {
  const response = await fetch("/api/settings/public/ad-intensity");
  
  if (!response.ok) {
    // Return default if fetch fails
    return { level: 3, description: "Standard", enabled: true };
  }
  
  return response.json();
}

export function useAdIntensity() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["ad-intensity"],
    queryFn: fetchAdIntensity,
    staleTime: 5 * 60 * 1000, // 5 minutes - ad settings don't change frequently
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes instead of 30 seconds
    refetchOnWindowFocus: false, // Reduced refetching for better performance
    refetchOnReconnect: true, // Keep reconnect refetch for important updates
    retry: 1,
  });

  return {
    level: data?.level ?? 3,
    description: data?.description ?? "Standard",
    enabled: data?.enabled ?? true,
    isLoading,
    error,
  };
}
