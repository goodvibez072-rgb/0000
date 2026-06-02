import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { 
  DollarSign, TrendingUp, Users, Coins, Crown, Zap, 
  ShoppingCart, ArrowLeft, Calendar, BarChart3, Package,
  Tag, Download, FileText, UserPlus, Trash2, RefreshCw,
  AlertCircle, CheckCircle, Plus, Minus, Search, History,
  Settings as SettingsIcon, BookOpen, Activity, Filter,
  ArrowUpDown, ChevronDown, ChevronUp, Receipt, Gift, Edit
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchWithCsrf, fetchCsrfToken } from "@/lib/csrf";
import { Line, Bar, Pie } from "react-chartjs-2";
import { ShopControl } from "@/components/admin/ShopControl";
import { BattlePassControl } from "@/components/admin/BattlePassControl";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface RevenueStats {
  totalRevenue: number;
  monthlyRevenue: number;
  revenueGrowth: number;
  activeSubscriptions: number;
  subscriptionRevenue: number;
  coinSalesRevenue: number;
  flashSalesRevenue: number;
  averageOrderValue: number;
  conversionRate: number;
  mrr: number;
}

interface TopSellingPackage {
  id: string;
  name: string;
  totalSales: number;
  revenue: string;
}

interface PackageData {
  currency: any[];
  subscriptions: any[];
  bundles: any[];
}

interface Coupon {
  id: string;
  code: string;
  type: string;
  value: string;
  minPurchaseAmount?: string;
  maxUses?: number;
  currentUses: number;
  expiresAt?: string;
  isActive: string;
  createdAt: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  userId: string;
  totalAmount: string;
  taxAmount: string;
  discountAmount: string;
  finalAmount: string;
  status: string;
  pdfPath?: string;
  createdAt: string;
}

interface Assignment {
  id: string;
  userId: string;
  packageId: string;
  packageType: string;
  assignedBy: string;
  reason: string;
  expiresAt?: string;
  isActive: string;
  createdAt: string;
}

interface OfflinePurchase {
  id: string;
  userId: string;
  packageId?: string;
  amountPaid: string;
  currencyReceived: number;
  paymentProvider: string;
  status: string;
  isOffline: string;
  createdAt: string;
}

interface TransactionLog {
  id: string;
  userId: string;
  username: string;
  type: string;
  amount: number;
  reason: string;
  createdAt: string;
}

interface DetailedUser {
  id: string;
  username: string;
  email: string | null;
  role: string;
  isAdmin: boolean;
  currencyBalance: number;
  subscription: {
    packageId: string;
    packageName: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
  } | null;
}

async function fetchPackages(): Promise<PackageData> {
  const response = await fetch("/api/admin/packages", {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to fetch packages");
  return response.json();
}

async function fetchCoupons(): Promise<Coupon[]> {
  const response = await fetch("/api/admin/coupons", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch coupons");
  return response.json();
}

async function fetchInvoices(): Promise<Invoice[]> {
  const response = await fetch("/api/admin/invoices", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch invoices");
  return response.json();
}

async function fetchAssignments(): Promise<Assignment[]> {
  const response = await fetch("/api/admin/manual-assignments", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch assignments");
  return response.json();
}

async function fetchOfflinePurchases(): Promise<OfflinePurchase[]> {
  const response = await fetch("/api/admin/offline-purchases", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch offline purchases");
  return response.json();
}

async function fetchTransactions(): Promise<TransactionLog[]> {
  const response = await fetch("/api/admin/currency/transactions", {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch transactions");
  }
  
  return response.json();
}

async function fetchCurrencyStats() {
  const response = await fetch("/api/admin/currency/stats", {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch currency stats");
  }
  
  return response.json();
}

async function fetchDetailedUsers(): Promise<DetailedUser[]> {
  const response = await fetch("/api/admin/users-detailed", {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch users");
  }
  
  return response.json();
}

async function fetchUserTransactions(userId: string): Promise<TransactionLog[]> {
  const response = await fetch(`/api/admin/user-transactions/${userId}`, {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch user transactions");
  }
  
  return response.json();
}

export default function AdminMonetization() {
  const [, navigate] = useLocation();
  const { isAdmin, isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [timeRange, setTimeRange] = useState("30d");

  const [showCouponDialog, setShowCouponDialog] = useState(false);
  const [couponFormData, setCouponFormData] = useState({
    code: "",
    type: "percentage",
    value: "",
    minPurchaseAmount: "",
    maxUses: "",
    expiresAt: "",
    isActive: "true"
  });

  const [subscriberFilters, setSubscriberFilters] = useState({
    status: "all",
    packageId: "",
    startDate: "",
    endDate: ""
  });

  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [assignmentFormData, setAssignmentFormData] = useState({
    userId: "",
    packageId: "",
    packageType: "currency",
    reason: "",
    expiresAt: ""
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedUsername, setSelectedUsername] = useState("");
  const [userBalance, setUserBalance] = useState(0);
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<"add" | "deduct">("add");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");

  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [membershipFilter, setMembershipFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<"username" | "role" | "balance">("username");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedUserForDrawer, setSelectedUserForDrawer] = useState<DetailedUser | null>(null);
  const [showUserDrawer, setShowUserDrawer] = useState(false);

  const [showCurrencyPackageDialog, setShowCurrencyPackageDialog] = useState(false);
  const [editingCurrencyPackage, setEditingCurrencyPackage] = useState<any>(null);
  const [currencyPackageFormData, setCurrencyPackageFormData] = useState({
    name: "",
    description: "",
    currencyAmount: "",
    priceUSD: "",
    bonusPercentage: "0",
    isActive: "true",
    displayOrder: "0"
  });

  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<any>(null);
  const [subscriptionFormData, setSubscriptionFormData] = useState({
    name: "",
    description: "",
    priceUSD: "",
    billingCycle: "monthly",
    features: "",
    coinBonus: "0",
    discountPercentage: "0",
    isAdFree: "false",
    trialDays: "0",
    isActive: "true",
    displayOrder: "0",
    stripePriceId: ""
  });

  const [showBundleDialog, setShowBundleDialog] = useState(false);
  const [editingBundle, setEditingBundle] = useState<any>(null);
  const [bundleFormData, setBundleFormData] = useState({
    name: "",
    description: "",
    bundleType: "currency",
    priceUSD: "",
    items: "",
    isActive: "true",
    displayOrder: "0"
  });


  const { data: stats, isLoading: statsLoading } = useQuery<RevenueStats>({
    queryKey: ["/api/admin/monetization/stats", timeRange],
    queryFn: async () => {
      const response = await fetch(`/api/admin/monetization/stats?range=${timeRange}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
    enabled: isAdmin && isAuthenticated,
  });

  const { data: topPackages, isLoading: packagesLoading } = useQuery<TopSellingPackage[]>({
    queryKey: ["/api/admin/monetization/top-packages"],
    queryFn: async () => {
      const response = await fetch("/api/admin/monetization/top-packages", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch top packages");
      return response.json();
    },
    enabled: isAdmin && isAuthenticated,
  });

  const { data: revenueHistory, isLoading: historyLoading } = useQuery({
    queryKey: ["/api/admin/monetization/revenue-history", timeRange],
    queryFn: async () => {
      const response = await fetch(`/api/admin/monetization/revenue-history?range=${timeRange}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch revenue history");
      return response.json();
    },
    enabled: isAdmin && isAuthenticated,
  });

  const { data: packages, isLoading: packagesDataLoading } = useQuery({
    queryKey: ["admin-packages"],
    queryFn: fetchPackages,
    enabled: isAdmin && isAuthenticated,
  });

  const { data: coupons, isLoading: couponsLoading } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: fetchCoupons,
    enabled: isAdmin && isAuthenticated,
  });

  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ["admin-invoices"],
    queryFn: fetchInvoices,
    enabled: isAdmin && isAuthenticated,
  });

  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ["admin-assignments"],
    queryFn: fetchAssignments,
    enabled: isAdmin && isAuthenticated,
  });

  const { data: offlinePurchases, isLoading: purchasesLoading } = useQuery({
    queryKey: ["admin-offline-purchases"],
    queryFn: fetchOfflinePurchases,
    enabled: isAdmin && isAuthenticated,
  });

  const { data: transactions, isLoading: transactionsLoading, refetch: refetchTransactions } = useQuery({
    queryKey: ["admin-currency-transactions"],
    queryFn: fetchTransactions,
    enabled: isAdmin && isAuthenticated,
  });

  const { data: currencyStats, isLoading: currencyStatsLoading } = useQuery({
    queryKey: ["admin-currency-stats"],
    queryFn: fetchCurrencyStats,
    enabled: isAdmin && isAuthenticated,
  });

  const { data: detailedUsers, isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ["admin-detailed-users"],
    queryFn: fetchDetailedUsers,
    enabled: isAdmin && isAuthenticated,
  });

  const { data: userTransactions, isLoading: userTransactionsLoading } = useQuery({
    queryKey: ["admin-user-transactions", selectedUserForDrawer?.id],
    queryFn: () => selectedUserForDrawer ? fetchUserTransactions(selectedUserForDrawer.id) : Promise.resolve([]),
    enabled: isAdmin && isAuthenticated && !!selectedUserForDrawer,
  });

  const createCouponMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetchWithCsrf("/api/admin/coupons", {
        method: "POST",
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error("Failed to create coupon");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
      toast({ title: "Success", description: "Coupon created successfully", variant: "success" });
      setShowCouponDialog(false);
      resetCouponForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create coupon", variant: "error" });
    }
  });

  const deleteCouponMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchWithCsrf(`/api/admin/coupons/${id}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error("Failed to delete coupon");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
      toast({ title: "Success", description: "Coupon deleted successfully", variant: "success" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete coupon", variant: "error" });
    }
  });

  const generateInvoicePDFMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await fetchWithCsrf(`/api/admin/invoices/${invoiceId}/pdf`, {
        method: "POST"
      });
      if (!response.ok) throw new Error("Failed to generate PDF");
      return response.json();
    },
    onSuccess: (data) => {
      if (data.pdfPath) {
        const link = document.createElement('a');
        link.href = data.pdfPath;
        link.download = data.pdfPath.split('/').pop() || 'invoice.pdf';
        link.click();
      }
      toast({ title: "Success", description: "Invoice PDF downloaded successfully", variant: "success" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate PDF", variant: "error" });
    }
  });

  const createAssignmentMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetchWithCsrf("/api/admin/manual-assignments", {
        method: "POST",
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error("Failed to create assignment");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-assignments"] });
      toast({ title: "Success", description: "Package assigned successfully", variant: "success" });
      setShowAssignmentDialog(false);
      setAssignmentFormData({ userId: "", packageId: "", packageType: "currency", reason: "", expiresAt: "" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to assign package", variant: "error" });
    }
  });

  const revokeAssignmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchWithCsrf(`/api/admin/manual-assignments/${id}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error("Failed to revoke assignment");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-assignments"] });
      toast({ title: "Success", description: "Assignment revoked successfully", variant: "success" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to revoke assignment", variant: "error" });
    }
  });

  const reconcilePurchaseMutation = useMutation({
    mutationFn: async (purchaseId: string) => {
      const response = await fetchWithCsrf(`/api/admin/purchases/${purchaseId}/reconcile`, {
        method: "POST",
        body: JSON.stringify({ status: "completed" })
      });
      if (!response.ok) throw new Error("Failed to reconcile purchase");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-offline-purchases"] });
      toast({ title: "Success", description: "Purchase reconciled successfully", variant: "success" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reconcile purchase", variant: "error" });
    }
  });

  const createCurrencyPackageMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetchWithCsrf("/api/currency/packages", {
        method: "POST",
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error("Failed to create currency package");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-packages"] });
      toast({ title: "Success", description: "Currency package created successfully", variant: "success" });
      setShowCurrencyPackageDialog(false);
      resetCurrencyPackageForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create currency package", variant: "error" });
    }
  });

  const updateCurrencyPackageMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await fetchWithCsrf(`/api/currency/packages/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error("Failed to update currency package");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-packages"] });
      toast({ title: "Success", description: "Currency package updated successfully", variant: "success" });
      setShowCurrencyPackageDialog(false);
      setEditingCurrencyPackage(null);
      resetCurrencyPackageForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update currency package", variant: "error" });
    }
  });

  const deleteCurrencyPackageMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchWithCsrf(`/api/currency/packages/${id}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error("Failed to delete currency package");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-packages"] });
      toast({ title: "Success", description: "Currency package deleted successfully", variant: "success" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete currency package", variant: "error" });
    }
  });

  const createSubscriptionMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetchWithCsrf("/api/admin/subscriptions", {
        method: "POST",
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error("Failed to create subscription");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-packages"] });
      toast({ title: "Success", description: "Subscription created successfully", variant: "success" });
      setShowSubscriptionDialog(false);
      resetSubscriptionForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create subscription", variant: "error" });
    }
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await fetchWithCsrf(`/api/admin/subscriptions/${id}`, {
        method: "PUT",
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error("Failed to update subscription");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-packages"] });
      toast({ title: "Success", description: "Subscription updated successfully", variant: "success" });
      setShowSubscriptionDialog(false);
      setEditingSubscription(null);
      resetSubscriptionForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update subscription", variant: "error" });
    }
  });

  const deleteSubscriptionMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchWithCsrf(`/api/admin/subscriptions/${id}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error("Failed to delete subscription");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-packages"] });
      toast({ title: "Success", description: "Subscription deleted successfully", variant: "success" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete subscription", variant: "error" });
    }
  });

  const createBundleMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetchWithCsrf("/api/admin/bundles", {
        method: "POST",
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error("Failed to create bundle");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-packages"] });
      toast({ title: "Success", description: "Bundle created successfully", variant: "success" });
      setShowBundleDialog(false);
      resetBundleForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create bundle", variant: "error" });
    }
  });

  const updateBundleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await fetchWithCsrf(`/api/admin/bundles/${id}`, {
        method: "PUT",
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error("Failed to update bundle");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-packages"] });
      toast({ title: "Success", description: "Bundle updated successfully", variant: "success" });
      setShowBundleDialog(false);
      setEditingBundle(null);
      resetBundleForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update bundle", variant: "error" });
    }
  });

  const deleteBundleMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchWithCsrf(`/api/admin/bundles/${id}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error("Failed to delete bundle");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-packages"] });
      toast({ title: "Success", description: "Bundle deleted successfully", variant: "success" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete bundle", variant: "error" });
    }
  });

  const filteredAndSortedUsers = useMemo(() => {
    if (!detailedUsers) return [];

    let filtered = [...detailedUsers];

    if (userSearchTerm) {
      const search = userSearchTerm.toLowerCase();
      filtered = filtered.filter(user => 
        user.username.toLowerCase().includes(search) ||
        (user.email || '').toLowerCase().includes(search)
      );
    }

    if (roleFilter !== "all") {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    if (membershipFilter === "vip") {
      filtered = filtered.filter(user => user.subscription !== null);
    } else if (membershipFilter === "none") {
      filtered = filtered.filter(user => user.subscription === null);
    }

    filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortField) {
        case "username":
          aVal = a.username.toLowerCase();
          bVal = b.username.toLowerCase();
          break;
        case "role":
          aVal = a.role;
          bVal = b.role;
          break;
        case "balance":
          aVal = a.currencyBalance;
          bVal = b.currencyBalance;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [detailedUsers, userSearchTerm, roleFilter, membershipFilter, sortField, sortDirection]);

  const resetCouponForm = () => {
    setCouponFormData({
      code: "",
      type: "percentage",
      value: "",
      minPurchaseAmount: "",
      maxUses: "",
      expiresAt: "",
      isActive: "true"
    });
  };

  const resetCurrencyPackageForm = () => {
    setCurrencyPackageFormData({
      name: "",
      description: "",
      currencyAmount: "",
      priceUSD: "",
      bonusPercentage: "0",
      isActive: "true",
      displayOrder: "0"
    });
  };

  const resetSubscriptionForm = () => {
    setSubscriptionFormData({
      name: "",
      description: "",
      priceUSD: "",
      billingCycle: "monthly",
      features: "",
      coinBonus: "0",
      discountPercentage: "0",
      isAdFree: "false",
      trialDays: "0",
      isActive: "true",
      displayOrder: "0",
      stripePriceId: ""
    });
  };

  const resetBundleForm = () => {
    setBundleFormData({
      name: "",
      description: "",
      bundleType: "currency",
      priceUSD: "",
      items: "",
      isActive: "true",
      displayOrder: "0"
    });
  };

  const handleCreateCurrencyPackage = () => {
    resetCurrencyPackageForm();
    setEditingCurrencyPackage(null);
    setShowCurrencyPackageDialog(true);
  };

  const handleEditCurrencyPackage = (pkg: any) => {
    setEditingCurrencyPackage(pkg);
    setCurrencyPackageFormData({
      name: pkg.name || "",
      description: pkg.description || "",
      currencyAmount: pkg.currencyAmount?.toString() || "",
      priceUSD: pkg.priceUSD || "",
      bonusPercentage: pkg.bonusPercentage?.toString() || "0",
      isActive: pkg.isActive || "true",
      displayOrder: pkg.displayOrder?.toString() || "0"
    });
    setShowCurrencyPackageDialog(true);
  };

  const handleSaveCurrencyPackage = () => {
    const data = {
      name: currencyPackageFormData.name,
      description: currencyPackageFormData.description,
      currencyAmount: parseInt(currencyPackageFormData.currencyAmount),
      priceUSD: currencyPackageFormData.priceUSD,
      bonusPercentage: parseInt(currencyPackageFormData.bonusPercentage),
      isActive: currencyPackageFormData.isActive,
      displayOrder: parseInt(currencyPackageFormData.displayOrder)
    };

    if (editingCurrencyPackage) {
      updateCurrencyPackageMutation.mutate({ id: editingCurrencyPackage.id, data });
    } else {
      createCurrencyPackageMutation.mutate(data);
    }
  };

  const handleCreateSubscription = () => {
    resetSubscriptionForm();
    setEditingSubscription(null);
    setShowSubscriptionDialog(true);
  };

  const handleEditSubscription = (sub: any) => {
    setEditingSubscription(sub);
    setSubscriptionFormData({
      name: sub.name || "",
      description: sub.description || "",
      priceUSD: sub.priceUSD || "",
      billingCycle: sub.billingCycle || "monthly",
      features: Array.isArray(sub.features) ? sub.features.join(", ") : (sub.features || ""),
      coinBonus: sub.coinBonus?.toString() || "0",
      discountPercentage: sub.discountPercentage?.toString() || "0",
      isAdFree: sub.isAdFree || "false",
      trialDays: sub.trialDays?.toString() || "0",
      isActive: sub.isActive || "true",
      displayOrder: sub.displayOrder?.toString() || "0",
      stripePriceId: sub.stripePriceId || ""
    });
    setShowSubscriptionDialog(true);
  };

  const handleSaveSubscription = () => {
    const data = {
      name: subscriptionFormData.name,
      description: subscriptionFormData.description,
      priceUSD: subscriptionFormData.priceUSD,
      billingCycle: subscriptionFormData.billingCycle,
      features: subscriptionFormData.features.split(",").map(f => f.trim()).filter(f => f),
      coinBonus: parseInt(subscriptionFormData.coinBonus),
      discountPercentage: parseInt(subscriptionFormData.discountPercentage),
      isAdFree: subscriptionFormData.isAdFree,
      trialDays: parseInt(subscriptionFormData.trialDays),
      isActive: subscriptionFormData.isActive,
      displayOrder: parseInt(subscriptionFormData.displayOrder),
      stripePriceId: subscriptionFormData.stripePriceId || null
    };

    if (editingSubscription) {
      updateSubscriptionMutation.mutate({ id: editingSubscription.id, data });
    } else {
      createSubscriptionMutation.mutate(data);
    }
  };

  const handleCreateBundle = () => {
    resetBundleForm();
    setEditingBundle(null);
    setShowBundleDialog(true);
  };

  const handleEditBundle = (bundle: any) => {
    setEditingBundle(bundle);
    setBundleFormData({
      name: bundle.name || "",
      description: bundle.description || "",
      bundleType: bundle.bundleType || "currency",
      priceUSD: bundle.priceUSD || "",
      items: typeof bundle.items === 'string' ? bundle.items : JSON.stringify(bundle.items || []),
      isActive: bundle.isActive || "true",
      displayOrder: bundle.displayOrder?.toString() || "0"
    });
    setShowBundleDialog(true);
  };

  const handleSaveBundle = () => {
    const data = {
      name: bundleFormData.name,
      description: bundleFormData.description,
      bundleType: bundleFormData.bundleType,
      priceUSD: bundleFormData.priceUSD,
      items: bundleFormData.items,
      isActive: bundleFormData.isActive,
      displayOrder: parseInt(bundleFormData.displayOrder)
    };

    if (editingBundle) {
      updateBundleMutation.mutate({ id: editingBundle.id, data });
    } else {
      createBundleMutation.mutate(data);
    }
  };

  const handleExportSubscribers = async () => {
    try {
      const params = new URLSearchParams();
      if (subscriberFilters.status && subscriberFilters.status !== "all") params.append("status", subscriberFilters.status);
      if (subscriberFilters.packageId) params.append("packageId", subscriberFilters.packageId);
      if (subscriberFilters.startDate) params.append("startDate", subscriberFilters.startDate);
      if (subscriberFilters.endDate) params.append("endDate", subscriberFilters.endDate);

      const response = await fetch(`/api/admin/subscribers?${params.toString()}`, {
        credentials: "include"
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.message || `Server returned ${response.status}`;
        throw new Error(errorMessage);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `subscribers-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      
      toast({ title: "Success", description: "Subscribers exported successfully", variant: "success" });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to export subscribers";
      toast({ title: "Export Error", description: errorMessage, variant: "error" });
    }
  };

  const handleSearchUser = async () => {
    if (!searchTerm.trim()) {
      toast({
        title: "Error",
        description: "Please enter a username to search",
        variant: "error",
      });
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/search?q=${encodeURIComponent(searchTerm)}`, {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("User not found");
      }
      
      const users = await response.json();
      if (users.length === 0) {
        toast({
          title: "Not Found",
          description: "No user found with that username",
          variant: "error",
        });
        return;
      }
      
      const user = users[0];
      setSelectedUserId(user.id);
      setSelectedUsername(user.username);
      setUserBalance(user.currencyBalance || 0);
      
      toast({
        title: "User Found",
        description: `User: ${user.username} (Balance: ${user.currencyBalance || 0} coins)`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to search user",
        variant: "error",
      });
    }
  };

  const handleAdjustment = async () => {
    if (!selectedUserId) {
      toast({
        title: "Error",
        description: "Please select a user first",
        variant: "error",
      });
      return;
    }

    if (!adjustmentAmount || parseInt(adjustmentAmount) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "error",
      });
      return;
    }

    if (!adjustmentReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for this adjustment",
        variant: "error",
      });
      return;
    }

    try {
      const csrfToken = await fetchCsrfToken();
      
      const response = await fetch("/api/admin/currency/adjust", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        credentials: "include",
        body: JSON.stringify({
          userId: selectedUserId,
          amount: adjustmentType === "add" ? parseInt(adjustmentAmount) : -parseInt(adjustmentAmount),
          reason: adjustmentReason,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to adjust balance");
      }

      const data = await response.json();
      
      toast({
        title: "Success",
        description: `Balance ${adjustmentType === "add" ? "added" : "deducted"} successfully. New balance: ${data.newBalance} coins`,
        variant: "success",
      });

      setUserBalance(data.newBalance);
      setShowAdjustDialog(false);
      setAdjustmentAmount("");
      setAdjustmentReason("");
      
      queryClient.invalidateQueries({ queryKey: ["admin-currency-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-detailed-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-transactions"] });
      
      if (selectedUserForDrawer && selectedUserForDrawer.id === selectedUserId) {
        setSelectedUserForDrawer({
          ...selectedUserForDrawer,
          currencyBalance: data.newBalance
        });
      }
      
      refetchTransactions();
      refetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to adjust balance",
        variant: "error",
      });
    }
  };

  const handleUserClick = (user: DetailedUser) => {
    setSelectedUserForDrawer(user);
    setShowUserDrawer(true);
  };

  const handleAdjustUserBalance = (user: DetailedUser, type: "add" | "deduct") => {
    setSelectedUserId(user.id);
    setSelectedUsername(user.username);
    setUserBalance(user.currencyBalance);
    setAdjustmentType(type);
    setShowAdjustDialog(true);
  };

  const toggleSort = (field: "username" | "role" | "balance") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-card/80 backdrop-blur-md border-border/50">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <DollarSign className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Admin Access Required</CardTitle>
            <CardDescription className="mt-2">
              You need admin privileges to access monetization management
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate("/")}
              className="w-full"
            >
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (statsLoading || packagesLoading || historyLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95 p-8">
        <Skeleton className="h-12 w-96 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const revenueChartData = {
    labels: revenueHistory?.map((d: any) => d.date) || [],
    datasets: [
      {
        label: "Revenue ($)",
        data: revenueHistory?.map((d: any) => d.revenue) || [],
        borderColor: "rgb(168, 85, 247)",
        backgroundColor: "rgba(168, 85, 247, 0.1)",
        tension: 0.4,
      },
    ],
  };

  const packageDistributionData = {
    labels: topPackages?.map(p => p.name) || [],
    datasets: [
      {
        label: "Sales Count",
        data: topPackages?.map(p => p.totalSales) || [],
        backgroundColor: [
          "rgba(168, 85, 247, 0.8)",
          "rgba(236, 72, 153, 0.8)",
          "rgba(251, 146, 60, 0.8)",
          "rgba(59, 130, 246, 0.8)",
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95 p-2 sm:p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/admin")}
            className="text-muted-foreground hover:text-primary mb-3 sm:mb-4 min-h-11 w-full sm:w-auto justify-start"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Admin
          </Button>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">Monetization Dashboard</h1>
              <p className="text-sm sm:text-base text-muted-foreground">Complete revenue and monetization management</p>
            </div>
            
            <div className="flex gap-2 flex-wrap">
              {["7d", "30d", "90d", "1y"].map((range) => (
                <Button
                  key={range}
                  variant={timeRange === range ? "default" : "outline"}
                  onClick={() => setTimeRange(range)}
                  size="sm"
                  className="min-h-10"
                >
                  {range === "1y" ? "1 Year" : range}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
              <DollarSign className="w-4 h-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${stats?.totalRevenue?.toLocaleString() || "0"}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className={stats?.revenueGrowth && stats.revenueGrowth > 0 ? "text-green-500" : "text-red-500"}>
                  {stats?.revenueGrowth && stats.revenueGrowth > 0 ? "+" : ""}{stats?.revenueGrowth || 0}%
                </span> from last period
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Subscriptions</CardTitle>
              <Crown className="w-4 h-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.activeSubscriptions?.toLocaleString() || "0"}</div>
              <p className="text-xs text-muted-foreground mt-1">
                ${stats?.mrr?.toLocaleString() || "0"} MRR
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Coin Sales</CardTitle>
              <Coins className="w-4 h-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${stats?.coinSalesRevenue?.toLocaleString() || "0"}</div>
              <p className="text-xs text-muted-foreground mt-1">One-time purchases</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Flash Sales</CardTitle>
              <Zap className="w-4 h-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${stats?.flashSalesRevenue?.toLocaleString() || "0"}</div>
              <p className="text-xs text-muted-foreground mt-1">Limited time offers</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="packages">Packages</TabsTrigger>
            <TabsTrigger value="coupons">Coupons</TabsTrigger>
            <TabsTrigger value="subscribers">Subscribers</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
            <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
            <TabsTrigger value="currency">Currency</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Feature Controls Section */}
            <div>
              <h2 className="text-2xl font-bold mb-4">Feature Controls</h2>
              <p className="text-muted-foreground mb-6">Enable or disable monetization features</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ShopControl />
                <BattlePassControl />
              </div>
            </div>

            <Separator className="my-8" />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Trend</CardTitle>
                  <CardDescription>Revenue over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <Line
                    data={revenueChartData}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: { display: false },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                        },
                      },
                    }}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Selling Packages</CardTitle>
                  <CardDescription>By sales volume</CardDescription>
                </CardHeader>
                <CardContent>
                  <Bar
                    data={packageDistributionData}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: { display: false },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                        },
                      },
                    }}
                  />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Key Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold">${stats?.averageOrderValue?.toFixed(2) || "0"}</div>
                    <p className="text-sm text-muted-foreground mt-1">Average Order Value</p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold">{stats?.conversionRate?.toFixed(1) || "0"}%</div>
                    <p className="text-sm text-muted-foreground mt-1">Conversion Rate</p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold">${stats?.monthlyRevenue?.toLocaleString() || "0"}</div>
                    <p className="text-sm text-muted-foreground mt-1">This Month</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="packages" className="space-y-6">
            <Tabs defaultValue="currency" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="currency">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Currency Packages
                </TabsTrigger>
                <TabsTrigger value="subscriptions">
                  <Package className="h-4 w-4 mr-2" />
                  Subscriptions
                </TabsTrigger>
                <TabsTrigger value="bundles">
                  <Gift className="h-4 w-4 mr-2" />
                  Bundles
                </TabsTrigger>
              </TabsList>

              <TabsContent value="currency" className="space-y-4 mt-6">
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle>Currency Packages</CardTitle>
                        <CardDescription>Manage coin/point packages for sale</CardDescription>
                      </div>
                      <Button onClick={handleCreateCurrencyPackage}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Package
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {packagesDataLoading ? (
                      <p>Loading...</p>
                    ) : packages?.currency.length === 0 ? (
                      <p className="text-muted-foreground">No currency packages created yet</p>
                    ) : (
                      <div className="space-y-2">
                        {packages?.currency.map((pkg) => (
                          <div key={pkg.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div>
                              <h3 className="font-semibold">{pkg.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                {pkg.currencyAmount} coins - ${pkg.priceUSD}
                                {pkg.bonusPercentage > 0 && ` (+${pkg.bonusPercentage}% bonus)`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={pkg.isActive === "true" ? "default" : "secondary"}>
                                {pkg.isActive === "true" ? "Active" : "Inactive"}
                              </Badge>
                              <Button variant="ghost" size="sm" onClick={() => handleEditCurrencyPackage(pkg)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => deleteCurrencyPackageMutation.mutate(pkg.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="subscriptions" className="space-y-4 mt-6">
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle>Subscription Packages</CardTitle>
                        <CardDescription>Manage VIP/Premium memberships</CardDescription>
                      </div>
                      <Button onClick={handleCreateSubscription}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Subscription
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {packagesDataLoading ? (
                      <p>Loading...</p>
                    ) : packages?.subscriptions.length === 0 ? (
                      <p className="text-muted-foreground">No subscription packages created yet</p>
                    ) : (
                      <div className="space-y-2">
                        {packages?.subscriptions.map((pkg) => (
                          <div key={pkg.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div>
                              <h3 className="font-semibold">{pkg.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                ${pkg.priceUSD}/{pkg.billingCycle}
                                {pkg.trialDays > 0 && ` • ${pkg.trialDays} days trial`}
                                {pkg.coinBonus > 0 && ` • ${pkg.coinBonus} coins/month`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={pkg.isActive === "true" ? "default" : "secondary"}>
                                {pkg.isActive === "true" ? "Active" : "Inactive"}
                              </Badge>
                              <Button variant="ghost" size="sm" onClick={() => handleEditSubscription(pkg)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => deleteSubscriptionMutation.mutate(pkg.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="bundles" className="space-y-4 mt-6">
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle>Package Bundles</CardTitle>
                        <CardDescription>Special bundled offers</CardDescription>
                      </div>
                      <Button onClick={handleCreateBundle}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Bundle
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {packagesDataLoading ? (
                      <p>Loading...</p>
                    ) : packages?.bundles.length === 0 ? (
                      <p className="text-muted-foreground">No bundles created yet</p>
                    ) : (
                      <div className="space-y-2">
                        {packages?.bundles.map((bundle) => (
                          <div key={bundle.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div>
                              <h3 className="font-semibold">{bundle.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                ${bundle.priceUSD} • {bundle.bundleType}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={bundle.isActive === "true" ? "default" : "secondary"}>
                                {bundle.isActive === "true" ? "Active" : "Inactive"}
                              </Badge>
                              <Button variant="ghost" size="sm" onClick={() => handleEditBundle(bundle)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => deleteBundleMutation.mutate(bundle.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="coupons" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Coupon Management</h2>
                <p className="text-muted-foreground">Create and manage discount codes</p>
              </div>
              <Button onClick={() => setShowCouponDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Coupon
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Active Coupons</CardTitle>
                <CardDescription>Manage discount codes for your users</CardDescription>
              </CardHeader>
              <CardContent>
                {couponsLoading ? (
                  <p>Loading...</p>
                ) : (
                  <div className="space-y-2">
                    {coupons?.map((coupon) => (
                      <div key={coupon.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Tag className="h-4 w-4" />
                            <h3 className="font-semibold">{coupon.code}</h3>
                            <Badge variant={coupon.isActive === "true" ? "default" : "secondary"}>
                              {coupon.isActive === "true" ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {coupon.type === "percentage" ? `${coupon.value}% off` : `$${coupon.value} off`}
                            {coupon.minPurchaseAmount && ` • Min: $${coupon.minPurchaseAmount}`}
                            {coupon.maxUses && ` • ${coupon.currentUses}/${coupon.maxUses} used`}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => deleteCouponMutation.mutate(coupon.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscribers" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Subscribers</h2>
                <p className="text-muted-foreground">View and export subscriber data</p>
              </div>
              <Button onClick={handleExportSubscribers}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Export Filters</CardTitle>
                <CardDescription>Filter subscribers before exporting</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Status</Label>
                  <Select value={subscriberFilters.status} onValueChange={(value) => setSubscriberFilters({...subscriberFilters, status: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Start Date</Label>
                  <Input type="date" value={subscriberFilters.startDate} onChange={(e) => setSubscriberFilters({...subscriberFilters, startDate: e.target.value})} />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input type="date" value={subscriberFilters.endDate} onChange={(e) => setSubscriberFilters({...subscriberFilters, endDate: e.target.value})} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  <Users className="inline h-5 w-5 mr-2" />
                  Subscriber Information
                </CardTitle>
                <CardDescription>
                  Use the filters above and click "Export CSV" to download subscriber data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  The exported CSV will include: User ID, Username, Email, Package Name, Status, Trial Info, and Subscription Dates
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Invoices</h2>
              <p className="text-muted-foreground">View and manage invoices</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>All Invoices</CardTitle>
                <CardDescription>Purchase and subscription invoices</CardDescription>
              </CardHeader>
              <CardContent>
                {invoicesLoading ? (
                  <p>Loading...</p>
                ) : invoices?.length === 0 ? (
                  <p className="text-muted-foreground">No invoices found</p>
                ) : (
                  <div className="space-y-2">
                    {invoices?.map((invoice) => (
                      <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <h3 className="font-semibold">{invoice.invoiceNumber}</h3>
                            <Badge variant={invoice.status === "paid" ? "default" : "secondary"}>
                              {invoice.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Total: ${invoice.finalAmount}
                            {invoice.discountAmount !== "0.00" && ` (Discount: $${invoice.discountAmount})`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(invoice.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Button size="sm" onClick={() => generateInvoicePDFMutation.mutate(invoice.id)}>
                          <Download className="h-4 w-4 mr-2" />
                          PDF
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assignments" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Manual Assignments</h2>
                <p className="text-muted-foreground">Manually assign packages to users</p>
              </div>
              <Button onClick={() => setShowAssignmentDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Assign Package
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Active Assignments</CardTitle>
                <CardDescription>Manually assigned packages</CardDescription>
              </CardHeader>
              <CardContent>
                {assignmentsLoading ? (
                  <p>Loading...</p>
                ) : assignments?.length === 0 ? (
                  <p className="text-muted-foreground">No manual assignments yet</p>
                ) : (
                  <div className="space-y-2">
                    {assignments?.map((assignment) => (
                      <div key={assignment.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <div className="flex items-center gap-2">
                            <UserPlus className="h-4 w-4" />
                            <h3 className="font-semibold">User: {assignment.userId}</h3>
                            <Badge variant={assignment.isActive === "true" ? "default" : "secondary"}>
                              {assignment.isActive === "true" ? "Active" : "Revoked"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Type: {assignment.packageType} • Reason: {assignment.reason}
                            {assignment.expiresAt && ` • Expires: ${new Date(assignment.expiresAt).toLocaleDateString()}`}
                          </p>
                        </div>
                        {assignment.isActive === "true" && (
                          <Button variant="ghost" size="sm" onClick={() => revokeAssignmentMutation.mutate(assignment.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reconciliation" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Purchase Reconciliation</h2>
              <p className="text-muted-foreground">Reconcile offline and pending purchases</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Offline Purchases</CardTitle>
                <CardDescription>Purchases marked as offline need reconciliation</CardDescription>
              </CardHeader>
              <CardContent>
                {purchasesLoading ? (
                  <p>Loading...</p>
                ) : offlinePurchases?.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                    <p className="text-muted-foreground">All purchases reconciled! No pending items.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {offlinePurchases?.map((purchase) => (
                      <div key={purchase.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-orange-500" />
                            <h3 className="font-semibold">Purchase #{purchase.id.slice(0, 8)}</h3>
                            <Badge variant="secondary">{purchase.status}</Badge>
                            <Badge variant="destructive">Offline</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            User: {purchase.userId} • Amount: ${purchase.amountPaid} • Coins: {purchase.currencyReceived}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Provider: {purchase.paymentProvider} • {new Date(purchase.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Button size="sm" onClick={() => reconcilePurchaseMutation.mutate(purchase.id)}>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Reconcile
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="currency" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Currency Management</h2>
              <p className="text-muted-foreground">Manage user balances and chapter pricing</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Distributed</p>
                      <p className="text-2xl font-bold">{currencyStatsLoading ? "..." : (currencyStats?.totalDistributed || 0).toLocaleString()}</p>
                    </div>
                    <DollarSign className="w-8 h-8 text-primary" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Spent</p>
                      <p className="text-2xl font-bold">{currencyStatsLoading ? "..." : (currencyStats?.totalSpent || 0).toLocaleString()}</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-accent" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Active Users</p>
                      <p className="text-2xl font-bold">{currencyStatsLoading ? "..." : (currencyStats?.activeUsers || 0).toLocaleString()}</p>
                    </div>
                    <Users className="w-8 h-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Transactions</p>
                      <p className="text-2xl font-bold">{transactionsLoading ? "..." : (transactions?.length || 0).toLocaleString()}</p>
                    </div>
                    <Activity className="w-8 h-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="users">Users</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Users className="w-5 h-5" />
                          Adjust User Balance
                        </CardTitle>
                        <CardDescription>
                          Search for a user and adjust their currency balance
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <Label htmlFor="search">Username</Label>
                            <Input
                              id="search"
                              placeholder="Enter username..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleSearchUser()}
                            />
                          </div>
                          <Button onClick={handleSearchUser} className="mt-auto">
                            <Search className="w-4 h-4 mr-2" />
                            Search
                          </Button>
                        </div>

                        {selectedUserId && (
                          <div className="p-4 bg-muted rounded-lg space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold">{selectedUsername}</p>
                                <p className="text-sm text-muted-foreground">User ID: {selectedUserId}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">Current Balance</p>
                                <div className="flex items-center gap-2">
                                  <Coins className="w-5 h-5 text-primary" />
                                  <p className="text-2xl font-bold">{userBalance}</p>
                                </div>
                              </div>
                            </div>
                            <Separator />
                            <div className="flex gap-2">
                              <Button
                                onClick={() => {
                                  setAdjustmentType("add");
                                  setShowAdjustDialog(true);
                                }}
                                className="flex-1"
                                variant="outline"
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Add Coins
                              </Button>
                              <Button
                                onClick={() => {
                                  setAdjustmentType("deduct");
                                  setShowAdjustDialog(true);
                                }}
                                className="flex-1"
                                variant="outline"
                              >
                                <Minus className="w-4 h-4 mr-2" />
                                Deduct Coins
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2">
                            <History className="w-5 h-5" />
                            Transaction Log
                          </CardTitle>
                          <Button size="sm" variant="outline" onClick={() => refetchTransactions()}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Refresh
                          </Button>
                        </div>
                        <CardDescription>
                          Recent currency transactions and adjustments
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {transactionsLoading ? (
                          <p className="text-center py-8 text-muted-foreground">Loading transactions...</p>
                        ) : !transactions || transactions.length === 0 ? (
                          <p className="text-center py-8 text-muted-foreground">No transactions found</p>
                        ) : (
                          <div className="space-y-2 max-h-96 overflow-y-auto">
                            {transactions.map((tx) => (
                              <div key={tx.id} className="p-3 bg-muted/50 rounded-lg">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <p className="font-medium">{tx.username}</p>
                                    <p className="text-sm text-muted-foreground">{tx.reason}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {new Date(tx.createdAt).toLocaleString()}
                                    </p>
                                  </div>
                                  <Badge
                                    variant={tx.amount > 0 ? "default" : "secondary"}
                                    className={tx.amount > 0 ? "bg-green-500" : "bg-red-500"}
                                  >
                                    {tx.amount > 0 ? "+" : ""}{tx.amount} coins
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <SettingsIcon className="w-5 h-5" />
                          Quick Actions
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <Button
                          onClick={() => navigate("/admin/chapter-access")}
                          variant="outline"
                          className="w-full justify-start"
                        >
                          <BookOpen className="w-4 h-4 mr-2" />
                          Chapter Access Control
                        </Button>
                        <Button
                          onClick={() => navigate("/shop")}
                          variant="outline"
                          className="w-full justify-start"
                        >
                          <Coins className="w-4 h-4 mr-2" />
                          View Shop
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="users" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>View and manage user currency balances</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label>Search Users</Label>
                        <Input
                          placeholder="Search by username or email..."
                          value={userSearchTerm}
                          onChange={(e) => setUserSearchTerm(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Filter by Role</Label>
                        <Select value={roleFilter} onValueChange={setRoleFilter}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Roles</SelectItem>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Filter by Membership</Label>
                        <Select value={membershipFilter} onValueChange={setMembershipFilter}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="vip">VIP Only</SelectItem>
                            <SelectItem value="none">No Subscription</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="overflow-x-auto -mx-4 sm:mx-0">
                      <div className="inline-block min-w-full align-middle">
                        <div className="overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead onClick={() => toggleSort("username")} className="cursor-pointer">
                            <div className="flex items-center gap-1">
                              Username
                              {sortField === "username" && (sortDirection === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                            </div>
                          </TableHead>
                          <TableHead onClick={() => toggleSort("role")} className="cursor-pointer">
                            <div className="flex items-center gap-1">
                              Role
                              {sortField === "role" && (sortDirection === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                            </div>
                          </TableHead>
                          <TableHead onClick={() => toggleSort("balance")} className="cursor-pointer">
                            <div className="flex items-center gap-1">
                              Balance
                              {sortField === "balance" && (sortDirection === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                            </div>
                          </TableHead>
                          <TableHead>Subscription</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {usersLoading ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center">Loading...</TableCell>
                          </TableRow>
                        ) : filteredAndSortedUsers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground">No users found</TableCell>
                          </TableRow>
                        ) : (
                          filteredAndSortedUsers.map((user) => (
                            <TableRow key={user.id} className="cursor-pointer" onClick={() => handleUserClick(user)}>
                              <TableCell className="font-medium">{user.username}</TableCell>
                              <TableCell>
                                <Badge variant={user.isAdmin ? "default" : "secondary"}>
                                  {user.role}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Coins className="w-4 h-4 text-primary" />
                                  {user.currencyBalance}
                                </div>
                              </TableCell>
                              <TableCell>
                                {user.subscription ? (
                                  <Badge variant="outline">{user.subscription.packageName}</Badge>
                                ) : (
                                  <span className="text-muted-foreground">None</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleAdjustUserBalance(user, "add")}
                                  >
                                    <Plus className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleAdjustUserBalance(user, "deduct")}
                                  >
                                    <Minus className="w-3 h-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showCouponDialog} onOpenChange={setShowCouponDialog}>
        <DialogContent className="w-[95vw] max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Coupon</DialogTitle>
            <DialogDescription>Create a new discount coupon</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Code</Label>
              <Input value={couponFormData.code} onChange={(e) => setCouponFormData({...couponFormData, code: e.target.value.toUpperCase()})} placeholder="SUMMER2025" />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={couponFormData.type} onValueChange={(value) => setCouponFormData({...couponFormData, type: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Value</Label>
              <Input type="number" value={couponFormData.value} onChange={(e) => setCouponFormData({...couponFormData, value: e.target.value})} />
            </div>
            <div>
              <Label>Min Purchase Amount (optional)</Label>
              <Input type="number" value={couponFormData.minPurchaseAmount} onChange={(e) => setCouponFormData({...couponFormData, minPurchaseAmount: e.target.value})} />
            </div>
            <div>
              <Label>Max Uses (optional)</Label>
              <Input type="number" value={couponFormData.maxUses} onChange={(e) => setCouponFormData({...couponFormData, maxUses: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCouponDialog(false)}>Cancel</Button>
            <Button onClick={() => createCouponMutation.mutate(couponFormData)}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAssignmentDialog} onOpenChange={setShowAssignmentDialog}>
        <DialogContent className="w-[95vw] max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Package</DialogTitle>
            <DialogDescription>Manually assign a package to a user</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>User ID</Label>
              <Input value={assignmentFormData.userId} onChange={(e) => setAssignmentFormData({...assignmentFormData, userId: e.target.value})} placeholder="User ID" />
            </div>
            <div>
              <Label>Package Type</Label>
              <Select value={assignmentFormData.packageType} onValueChange={(value) => setAssignmentFormData({...assignmentFormData, packageType: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="currency">Currency Package</SelectItem>
                  <SelectItem value="subscription">Subscription</SelectItem>
                  <SelectItem value="bundle">Bundle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Package ID</Label>
              <Input value={assignmentFormData.packageId} onChange={(e) => setAssignmentFormData({...assignmentFormData, packageId: e.target.value})} placeholder="Package ID" />
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea value={assignmentFormData.reason} onChange={(e) => setAssignmentFormData({...assignmentFormData, reason: e.target.value})} placeholder="Reason for assignment" />
            </div>
            <div>
              <Label>Expiration Date (optional)</Label>
              <Input type="datetime-local" value={assignmentFormData.expiresAt} onChange={(e) => setAssignmentFormData({...assignmentFormData, expiresAt: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignmentDialog(false)}>Cancel</Button>
            <Button onClick={() => createAssignmentMutation.mutate(assignmentFormData)}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCurrencyPackageDialog} onOpenChange={setShowCurrencyPackageDialog}>
        <DialogContent className="w-[95vw] max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCurrencyPackage ? "Edit" : "Create"} Currency Package</DialogTitle>
            <DialogDescription>{editingCurrencyPackage ? "Update" : "Create a new"} currency package</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={currencyPackageFormData.name} onChange={(e) => setCurrencyPackageFormData({...currencyPackageFormData, name: e.target.value})} placeholder="Starter Pack" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={currencyPackageFormData.description} onChange={(e) => setCurrencyPackageFormData({...currencyPackageFormData, description: e.target.value})} placeholder="Perfect for getting started" />
            </div>
            <div>
              <Label>Currency Amount</Label>
              <Input type="number" value={currencyPackageFormData.currencyAmount} onChange={(e) => setCurrencyPackageFormData({...currencyPackageFormData, currencyAmount: e.target.value})} placeholder="100" />
            </div>
            <div>
              <Label>Price (USD)</Label>
              <Input type="number" step="0.01" value={currencyPackageFormData.priceUSD} onChange={(e) => setCurrencyPackageFormData({...currencyPackageFormData, priceUSD: e.target.value})} placeholder="9.99" />
            </div>
            <div>
              <Label>Bonus Percentage</Label>
              <Input type="number" value={currencyPackageFormData.bonusPercentage} onChange={(e) => setCurrencyPackageFormData({...currencyPackageFormData, bonusPercentage: e.target.value})} placeholder="0" />
            </div>
            <div>
              <Label>Display Order</Label>
              <Input type="number" value={currencyPackageFormData.displayOrder} onChange={(e) => setCurrencyPackageFormData({...currencyPackageFormData, displayOrder: e.target.value})} placeholder="0" />
            </div>
            <div>
              <Label>Active</Label>
              <Select value={currencyPackageFormData.isActive} onValueChange={(value) => setCurrencyPackageFormData({...currencyPackageFormData, isActive: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCurrencyPackageDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveCurrencyPackage}>{editingCurrencyPackage ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSubscriptionDialog} onOpenChange={setShowSubscriptionDialog}>
        <DialogContent className="w-[95vw] max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingSubscription ? "Edit" : "Create"} Subscription</DialogTitle>
            <DialogDescription>{editingSubscription ? "Update" : "Create a new"} subscription package</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
            <div>
              <Label>Name</Label>
              <Input value={subscriptionFormData.name} onChange={(e) => setSubscriptionFormData({...subscriptionFormData, name: e.target.value})} placeholder="Basic VIP" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={subscriptionFormData.description} onChange={(e) => setSubscriptionFormData({...subscriptionFormData, description: e.target.value})} placeholder="Access to exclusive content" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Price (USD)</Label>
                <Input type="number" step="0.01" value={subscriptionFormData.priceUSD} onChange={(e) => setSubscriptionFormData({...subscriptionFormData, priceUSD: e.target.value})} placeholder="9.99" />
              </div>
              <div>
                <Label>Billing Cycle</Label>
                <Select value={subscriptionFormData.billingCycle} onValueChange={(value) => setSubscriptionFormData({...subscriptionFormData, billingCycle: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Features (comma separated)</Label>
              <Textarea value={subscriptionFormData.features} onChange={(e) => setSubscriptionFormData({...subscriptionFormData, features: e.target.value})} placeholder="Ad-free reading, Early access, Exclusive badges" />
            </div>
            <div>
              <Label>Stripe Price ID (optional)</Label>
              <Input value={subscriptionFormData.stripePriceId} onChange={(e) => setSubscriptionFormData({...subscriptionFormData, stripePriceId: e.target.value})} placeholder="price_xxxxx" />
              <p className="text-xs text-muted-foreground mt-1">Leave empty to auto-create when Stripe integration is configured</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Monthly Coin Bonus</Label>
                <Input type="number" value={subscriptionFormData.coinBonus} onChange={(e) => setSubscriptionFormData({...subscriptionFormData, coinBonus: e.target.value})} placeholder="0" />
              </div>
              <div>
                <Label>Discount % on Purchases</Label>
                <Input type="number" value={subscriptionFormData.discountPercentage} onChange={(e) => setSubscriptionFormData({...subscriptionFormData, discountPercentage: e.target.value})} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Trial Days</Label>
                <Input type="number" value={subscriptionFormData.trialDays} onChange={(e) => setSubscriptionFormData({...subscriptionFormData, trialDays: e.target.value})} placeholder="0" />
              </div>
              <div>
                <Label>Display Order</Label>
                <Input type="number" value={subscriptionFormData.displayOrder} onChange={(e) => setSubscriptionFormData({...subscriptionFormData, displayOrder: e.target.value})} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Ad-Free</Label>
                <Select value={subscriptionFormData.isAdFree} onValueChange={(value) => setSubscriptionFormData({...subscriptionFormData, isAdFree: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Active</Label>
                <Select value={subscriptionFormData.isActive} onValueChange={(value) => setSubscriptionFormData({...subscriptionFormData, isActive: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubscriptionDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveSubscription}>{editingSubscription ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBundleDialog} onOpenChange={setShowBundleDialog}>
        <DialogContent className="w-[95vw] max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingBundle ? "Edit" : "Create"} Bundle</DialogTitle>
            <DialogDescription>{editingBundle ? "Update" : "Create a new"} package bundle</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={bundleFormData.name} onChange={(e) => setBundleFormData({...bundleFormData, name: e.target.value})} placeholder="Mega Pack" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={bundleFormData.description} onChange={(e) => setBundleFormData({...bundleFormData, description: e.target.value})} placeholder="Best value bundle" />
            </div>
            <div>
              <Label>Bundle Type</Label>
              <Select value={bundleFormData.bundleType} onValueChange={(value) => setBundleFormData({...bundleFormData, bundleType: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="currency">Currency</SelectItem>
                  <SelectItem value="subscription">Subscription</SelectItem>
                  <SelectItem value="chapter">Chapter</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Price (USD)</Label>
              <Input type="number" step="0.01" value={bundleFormData.priceUSD} onChange={(e) => setBundleFormData({...bundleFormData, priceUSD: e.target.value})} placeholder="19.99" />
            </div>
            <div>
              <Label>Items (JSON format)</Label>
              <Textarea value={bundleFormData.items} onChange={(e) => setBundleFormData({...bundleFormData, items: e.target.value})} placeholder='[{"type":"currency","amount":500},{"type":"chapter","id":"123"}]' />
            </div>
            <div>
              <Label>Display Order</Label>
              <Input type="number" value={bundleFormData.displayOrder} onChange={(e) => setBundleFormData({...bundleFormData, displayOrder: e.target.value})} placeholder="0" />
            </div>
            <div>
              <Label>Active</Label>
              <Select value={bundleFormData.isActive} onValueChange={(value) => setBundleFormData({...bundleFormData, isActive: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBundleDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveBundle}>{editingBundle ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <DialogContent className="w-[95vw] max-w-lg">
          <DialogHeader>
            <DialogTitle>{adjustmentType === "add" ? "Add" : "Deduct"} Coins</DialogTitle>
            <DialogDescription>
              {adjustmentType === "add" ? "Add coins to" : "Deduct coins from"} {selectedUsername}'s balance
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                placeholder="Enter amount..."
                value={adjustmentAmount}
                onChange={(e) => setAdjustmentAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea
                placeholder="Reason for adjustment..."
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjustDialog(false)}>Cancel</Button>
            <Button onClick={handleAdjustment}>
              {adjustmentType === "add" ? "Add Coins" : "Deduct Coins"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={showUserDrawer} onOpenChange={setShowUserDrawer}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>User Details</SheetTitle>
            <SheetDescription>
              {selectedUserForDrawer?.username}
            </SheetDescription>
          </SheetHeader>
          {selectedUserForDrawer && (
            <div className="mt-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="text-sm">{selectedUserForDrawer.email || "Not provided"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Role</Label>
                  <div className="mt-1">
                    <Badge variant={selectedUserForDrawer.isAdmin ? "default" : "secondary"}>
                      {selectedUserForDrawer.role}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Currency Balance</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Coins className="w-5 h-5 text-primary" />
                    <p className="text-2xl font-bold">{selectedUserForDrawer.currencyBalance}</p>
                  </div>
                </div>
                {selectedUserForDrawer.subscription && (
                  <div>
                    <Label className="text-muted-foreground">Subscription</Label>
                    <div className="mt-2 p-3 bg-muted rounded-lg">
                      <p className="font-medium">{selectedUserForDrawer.subscription.packageName}</p>
                      <p className="text-sm text-muted-foreground">
                        Status: <Badge variant="outline">{selectedUserForDrawer.subscription.status}</Badge>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(selectedUserForDrawer.subscription.currentPeriodStart).toLocaleDateString()} - {new Date(selectedUserForDrawer.subscription.currentPeriodEnd).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Transaction History
                </h3>
                {userTransactionsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : !userTransactions || userTransactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No transactions</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {userTransactions.map((tx) => (
                      <div key={tx.id} className="p-3 bg-muted/50 rounded-lg text-sm">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium">{tx.reason}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(tx.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <Badge
                            variant={tx.amount > 0 ? "default" : "secondary"}
                            className={tx.amount > 0 ? "bg-green-500" : "bg-red-500"}
                          >
                            {tx.amount > 0 ? "+" : ""}{tx.amount}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => {
                    handleAdjustUserBalance(selectedUserForDrawer, "add");
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Coins
                </Button>
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={() => {
                    handleAdjustUserBalance(selectedUserForDrawer, "deduct");
                  }}
                >
                  <Minus className="w-4 h-4 mr-2" />
                  Deduct Coins
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
