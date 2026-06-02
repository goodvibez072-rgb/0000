// Replit Auth integration - useAuth hook
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SafeUserWithAdmin } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading } = useQuery<SafeUserWithAdmin | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnMount: false, // Don't refetch if data is fresh
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: !!user?.isAdmin,
    // Role-based permission helpers
    isOwner: user?.role === 'owner',
    isStaff: ['staff', 'admin', 'owner'].includes(user?.role || '') || !!user?.isAdmin,
    isPremium: ['premium', 'staff', 'admin', 'owner'].includes(user?.role || '') || !!user?.isAdmin,
    isStaffOrAbove: ['staff', 'admin', 'owner'].includes(user?.role || '') || !!user?.isAdmin,
  };
}

export function useLogout() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      // Immediately clear user data for instant UI update
      queryClient.setQueryData(["/api/auth/user"], null);
      
      // Invalidate user-specific queries while keeping the null user state
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key !== "/api/auth/user" && (
            key.includes("/api/user/") || 
            key.includes("/api/admin/") ||
            key.includes("user-specific")
          );
        }
      });
      
      toast({
        title: "Signed out",
        description: "You've been successfully signed out.",
      });
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Sign out failed",
        description: error.message || "Unable to sign out. Please try again.",
        variant: "error",
      });
    },
  });

  return {
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}