import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CurrencyPackage {
  id: string;
  name: string;
  currencyAmount: number;
  priceUSD: string;
  bonusPercentage: number;
  isActive: string;
  displayOrder: number;
}

interface CurrencyTransaction {
  id: string;
  userId: string;
  amount: number;
  type: string;
  description: string;
  relatedEntityId?: string;
  createdAt: string;
}

interface UserPurchase {
  id: string;
  userId: string;
  packageId?: string;
  amountPaid: string;
  currencyReceived: number;
  paymentProvider: string;
  transactionId?: string;
  status: string;
  createdAt: string;
}

// Hook to get user's currency balance
export function useCurrencyBalance() {
  return useQuery<{ balance: number }>({
    queryKey: ["/api/currency/balance"],
    queryFn: async () => {
      const response = await fetch("/api/currency/balance", {
        credentials: "include",
      });
      
      if (response.status === 401) {
        return { balance: 0 };
      }
      
      if (!response.ok) {
        throw new Error("Failed to fetch currency balance");
      }
      
      return response.json();
    },
    retry: false,
    staleTime: 0, // Always consider data stale to ensure fresh balance
    refetchOnMount: true, // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });
}

// Hook to get available currency packages
export function useCurrencyPackages(activeOnly: boolean = true) {
  return useQuery<CurrencyPackage[]>({
    queryKey: ["/api/currency/packages", { activeOnly }],
    queryFn: async () => {
      const response = await fetch(`/api/currency/packages?activeOnly=${activeOnly}`, {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch currency packages");
      }
      
      return response.json();
    },
  });
}

// Hook to get user's transaction history
export function useCurrencyTransactions(limit: number = 50, offset: number = 0) {
  return useQuery<CurrencyTransaction[]>({
    queryKey: ["/api/currency/transactions", { limit, offset }],
    queryFn: async () => {
      const response = await fetch(
        `/api/currency/transactions?limit=${limit}&offset=${offset}`,
        { credentials: "include" }
      );
      
      if (response.status === 401) {
        return [];
      }
      
      if (!response.ok) {
        throw new Error("Failed to fetch transactions");
      }
      
      return response.json();
    },
    retry: false,
  });
}

// Hook to get user's purchase history
export function useUserPurchases() {
  return useQuery<UserPurchase[]>({
    queryKey: ["/api/currency/purchases"],
    queryFn: async () => {
      const response = await fetch("/api/currency/purchases", {
        credentials: "include",
      });
      
      if (response.status === 401) {
        return [];
      }
      
      if (!response.ok) {
        throw new Error("Failed to fetch purchases");
      }
      
      return response.json();
    },
    retry: false,
  });
}

// Hook to create a payment intent for purchasing currency
export function usePurchaseCurrency() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (packageId: string) => {
      const response = await fetch("/api/currency/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "include",
        body: JSON.stringify({ packageId }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create purchase");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/currency/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/currency/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/currency/purchases"] });
      toast({
        title: "Purchase Successful",
        description: "Currency has been added to your account!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Purchase Failed",
        description: error.message,
        variant: "error",
      });
    },
  });
}
