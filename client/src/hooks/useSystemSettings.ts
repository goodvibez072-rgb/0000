import { useQuery } from "@tanstack/react-query";

export interface SystemSetting {
  key: string;
  value: string;
  type: string;
}

export function useSystemSettings(keys: string[]) {
  return useQuery({
    queryKey: ["/api/settings/system", ...keys],
    queryFn: async () => {
      const params = new URLSearchParams();
      keys.forEach(key => params.append('keys', key));
      
      const response = await fetch(`/api/settings/system?${params.toString()}`, {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch system settings");
      }
      
      return response.json() as Promise<Record<string, SystemSetting>>;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

export function useSystemSetting(key: string) {
  const { data, ...rest } = useSystemSettings([key]);
  return {
    ...rest,
    data: data?.[key]?.value,
    setting: data?.[key],
  };
}

export function useBattlePassSettings() {
  return useSystemSettings(['battle_pass_enabled', 'battle_pass_mode']);
}
