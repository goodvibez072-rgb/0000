import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageUpload } from "@/components/ui/image-upload";
import { AdPreview } from "@/components/admin/AdPreview";
import { AdAnalyticsDashboard } from "@/components/admin/AdAnalyticsDashboard";
import { AdVariantManager } from "@/components/admin/AdVariantManager";
import { AdIntensityControl } from "@/components/admin/AdIntensityControl";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWithCsrf } from "@/lib/csrf";
import { 
  Monitor, ArrowLeft, Activity, TrendingUp, Eye, MousePointerClick,
  Plus, Edit, Trash2, Image as ImageIcon, Link as LinkIcon, Calendar,
  Search, X, ExternalLink, BarChart3, FlaskConical, RefreshCw, Clock,
  Globe, Smartphone, Users, Languages, DollarSign, Target, Tag, FileText,
  Download, Upload, CheckSquare, Square, Power, PowerOff, Shield
} from "lucide-react";

interface Advertisement {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  linkUrl: string;
  type: string;
  page: string;
  location: string;
  isActive: string;
  startDate?: string;
  endDate?: string;
  displayOrder: number;
  clickCount: number;
  impressionCount: number;
  variantGroup?: string;
  variantName?: string;
  targetCountries?: string;
  targetDeviceTypes?: string;
  targetUserRoles?: string;
  targetLanguages?: string;
  budget?: string;
  costPerClick?: string;
  costPerImpression?: string;
  conversionGoal?: string;
  frequencyCap?: number;
  dailyBudget?: string;
  tags?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface AdFormData {
  title: string;
  description: string;
  imageUrl: string;
  linkUrl: string;
  type: string;
  page: string;
  location: string;
  displayOrder: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  targetCountries: string[];
  targetDeviceTypes: string[];
  targetUserRoles: string[];
  targetLanguages: string[];
  budget: string;
  costPerClick: string;
  costPerImpression: string;
  conversionGoal: string;
  frequencyCap: number;
  dailyBudget: string;
  tags: string[];
  notes: string;
}

const PAGE_LOCATION_MAP: Record<string, Array<{value: string; label: string}>> = {
  homepage: [
    { value: 'top_banner', label: 'Top Banner' },
    { value: 'sidebar', label: 'Sidebar' },
    { value: 'in_content_1', label: 'In Content 1' },
    { value: 'in_content_2', label: 'In Content 2' },
    { value: 'bottom_banner', label: 'Bottom Banner' },
  ],
  manga_detail: [
    { value: 'top_banner', label: 'Top Banner' },
    { value: 'sidebar', label: 'Sidebar' },
    { value: 'in_content_1', label: 'In Content 1' },
    { value: 'bottom_banner', label: 'Bottom Banner' },
  ],
  reader: [
    { value: 'top_banner', label: 'Top Banner' },
    { value: 'bottom_banner', label: 'Bottom Banner' },
  ],
  search_results: [
    { value: 'top_banner', label: 'Top Banner' },
    { value: 'sidebar', label: 'Sidebar' },
    { value: 'in_content_1', label: 'In Content 1' },
    { value: 'bottom_banner', label: 'Bottom Banner' },
  ],
};

const PAGE_OPTIONS = [
  { value: 'homepage', label: 'Homepage' },
  { value: 'manga_detail', label: 'Manga Detail Page' },
  { value: 'reader', label: 'Chapter Reader' },
  { value: 'search_results', label: 'Search Results' },
];

async function fetchAds(): Promise<Advertisement[]> {
  const response = await fetch("/api/admin/ads", {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch advertisements");
  }
  
  return response.json();
}

export default function AdminAds() {
  const { isAdmin, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null);
  const [deleteAdId, setDeleteAdId] = useState<string | null>(null);
  const [selectedAdIds, setSelectedAdIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importErrors, setImportErrors] = useState<Array<{row: number, field: string, message: string}>>([]);
  
  const [formData, setFormData] = useState<AdFormData>({
    title: "",
    description: "",
    imageUrl: "",
    linkUrl: "",
    type: "banner",
    page: "homepage",
    location: "top_banner",
    displayOrder: 0,
    startDate: "",
    endDate: "",
    isActive: true,
    targetCountries: [],
    targetDeviceTypes: [],
    targetUserRoles: [],
    targetLanguages: [],
    budget: "",
    costPerClick: "",
    costPerImpression: "",
    conversionGoal: "",
    frequencyCap: 0,
    dailyBudget: "",
    tags: [],
    notes: "",
  });

  const { data: ads, isLoading } = useQuery({
    queryKey: ["admin-ads"],
    queryFn: fetchAds,
    enabled: isAdmin && isAuthenticated,
  });

  const createAdMutation = useMutation({
    mutationFn: async (data: AdFormData) => {
      const payload: any = {
        ...data,
        isActive: data.isActive ? "true" : "false",
        displayOrder: Number(data.displayOrder) || 0,
        startDate: data.startDate?.trim() || null,
        endDate: data.endDate?.trim() || null,
        targetCountries: data.targetCountries.length > 0 ? JSON.stringify(data.targetCountries) : null,
        targetDeviceTypes: data.targetDeviceTypes.length > 0 ? JSON.stringify(data.targetDeviceTypes) : null,
        targetUserRoles: data.targetUserRoles.length > 0 ? JSON.stringify(data.targetUserRoles) : null,
        targetLanguages: data.targetLanguages.length > 0 ? JSON.stringify(data.targetLanguages) : null,
        budget: data.budget?.trim() || null,
        costPerClick: data.costPerClick?.trim() || null,
        costPerImpression: data.costPerImpression?.trim() || null,
        conversionGoal: data.conversionGoal?.trim() || null,
        frequencyCap: data.frequencyCap > 0 ? data.frequencyCap : null,
        dailyBudget: data.dailyBudget?.trim() || null,
        tags: data.tags.length > 0 ? JSON.stringify(data.tags) : null,
        notes: data.notes?.trim() || null,
      };
      
      if (payload.startDate === null) delete payload.startDate;
      if (payload.endDate === null) delete payload.endDate;
      if (payload.targetCountries === null) delete payload.targetCountries;
      if (payload.targetDeviceTypes === null) delete payload.targetDeviceTypes;
      if (payload.targetUserRoles === null) delete payload.targetUserRoles;
      if (payload.targetLanguages === null) delete payload.targetLanguages;
      if (payload.budget === null) delete payload.budget;
      if (payload.costPerClick === null) delete payload.costPerClick;
      if (payload.costPerImpression === null) delete payload.costPerImpression;
      if (payload.conversionGoal === null) delete payload.conversionGoal;
      if (payload.frequencyCap === null) delete payload.frequencyCap;
      if (payload.dailyBudget === null) delete payload.dailyBudget;
      if (payload.tags === null) delete payload.tags;
      if (payload.notes === null) delete payload.notes;
      
      const response = await fetchWithCsrf("/api/admin/ads", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create advertisement");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ads"] });
      toast({
        title: "Success",
        description: "Advertisement created successfully",
      });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create advertisement",
        variant: "error",
      });
    },
  });

  const updateAdMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AdFormData }) => {
      const payload: any = {
        ...data,
        isActive: data.isActive ? "true" : "false",
        displayOrder: Number(data.displayOrder) || 0,
        startDate: data.startDate?.trim() || null,
        endDate: data.endDate?.trim() || null,
        targetCountries: data.targetCountries.length > 0 ? JSON.stringify(data.targetCountries) : null,
        targetDeviceTypes: data.targetDeviceTypes.length > 0 ? JSON.stringify(data.targetDeviceTypes) : null,
        targetUserRoles: data.targetUserRoles.length > 0 ? JSON.stringify(data.targetUserRoles) : null,
        targetLanguages: data.targetLanguages.length > 0 ? JSON.stringify(data.targetLanguages) : null,
        budget: data.budget?.trim() || null,
        costPerClick: data.costPerClick?.trim() || null,
        costPerImpression: data.costPerImpression?.trim() || null,
        conversionGoal: data.conversionGoal?.trim() || null,
        frequencyCap: data.frequencyCap > 0 ? data.frequencyCap : null,
        dailyBudget: data.dailyBudget?.trim() || null,
        tags: data.tags.length > 0 ? JSON.stringify(data.tags) : null,
        notes: data.notes?.trim() || null,
      };
      
      if (payload.startDate === null) delete payload.startDate;
      if (payload.endDate === null) delete payload.endDate;
      if (payload.targetCountries === null) delete payload.targetCountries;
      if (payload.targetDeviceTypes === null) delete payload.targetDeviceTypes;
      if (payload.targetUserRoles === null) delete payload.targetUserRoles;
      if (payload.targetLanguages === null) delete payload.targetLanguages;
      if (payload.budget === null) delete payload.budget;
      if (payload.costPerClick === null) delete payload.costPerClick;
      if (payload.costPerImpression === null) delete payload.costPerImpression;
      if (payload.conversionGoal === null) delete payload.conversionGoal;
      if (payload.frequencyCap === null) delete payload.frequencyCap;
      if (payload.dailyBudget === null) delete payload.dailyBudget;
      if (payload.tags === null) delete payload.tags;
      if (payload.notes === null) delete payload.notes;
      
      const response = await fetchWithCsrf(`/api/admin/ads/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update advertisement");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ads"] });
      toast({
        title: "Success",
        description: "Advertisement updated successfully",
      });
      setShowEditDialog(false);
      setEditingAd(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update advertisement",
        variant: "error",
      });
    },
  });

  const deleteAdMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchWithCsrf(`/api/admin/ads/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete advertisement");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ads"] });
      toast({
        title: "Success",
        description: "Advertisement deleted successfully",
      });
      setDeleteAdId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete advertisement",
        variant: "error",
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await fetchWithCsrf(`/api/admin/ads/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          isActive: isActive ? "true" : "false",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to toggle advertisement status");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ads"] });
      toast({
        title: "Success",
        description: "Advertisement status updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update advertisement status",
        variant: "error",
      });
    },
  });

  const refreshSchedulesMutation = useMutation({
    mutationFn: async () => {
      const response = await fetchWithCsrf("/api/admin/ads/refresh-schedules", {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to refresh schedules");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-ads"] });
      toast({
        title: "Schedules Refreshed",
        description: data.message || `${data.activated} ads activated, ${data.deactivated} ads deactivated`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to refresh schedules",
        variant: "error",
      });
    },
  });

  const bulkEnableMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await fetchWithCsrf("/api/admin/ads/bulk-enable", {
        method: "POST",
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to enable ads");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ads"] });
      toast({
        title: "Success",
        description: `${selectedAdIds.size} ad(s) enabled successfully`,
      });
      setSelectedAdIds(new Set());
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to enable ads",
        variant: "error",
      });
    },
  });

  const bulkDisableMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await fetchWithCsrf("/api/admin/ads/bulk-disable", {
        method: "POST",
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to disable ads");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ads"] });
      toast({
        title: "Success",
        description: `${selectedAdIds.size} ad(s) disabled successfully`,
      });
      setSelectedAdIds(new Set());
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to disable ads",
        variant: "error",
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await fetchWithCsrf("/api/admin/ads/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete ads");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ads"] });
      toast({
        title: "Success",
        description: `${selectedAdIds.size} ad(s) deleted successfully`,
      });
      setSelectedAdIds(new Set());
      setShowBulkDeleteDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete ads",
        variant: "error",
      });
    },
  });

  const importAdsMutation = useMutation({
    mutationFn: async (adsData: any[]) => {
      const response = await fetchWithCsrf("/api/admin/ads/import", {
        method: "POST",
        body: JSON.stringify({ ads: adsData }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to import ads");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-ads"] });
      if (data.errors && data.errors.length > 0) {
        setImportErrors(data.errors);
        toast({
          title: "Partial Import",
          description: `${data.success} ad(s) imported, ${data.errors.length} error(s)`,
          variant: "error",
        });
      } else {
        toast({
          title: "Success",
          description: `${data.success} ad(s) imported successfully`,
        });
        setShowImportDialog(false);
        setImportFile(null);
        setImportErrors([]);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to import ads",
        variant: "error",
      });
    },
  });

  // Helper function to determine schedule status
  const getScheduleStatus = (ad: Advertisement): { status: string; badge: string; color: string } => {
    const now = new Date().toISOString();
    
    if (!ad.startDate && !ad.endDate) {
      return { status: "", badge: "", color: "" };
    }

    // Expired: end date has passed
    if (ad.endDate && ad.endDate <= now) {
      return { 
        status: "expired", 
        badge: "Expired", 
        color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300" 
      };
    }

    // Upcoming: start date in future
    if (ad.startDate && ad.startDate > now) {
      return { 
        status: "upcoming", 
        badge: "Upcoming", 
        color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300" 
      };
    }

    // Active: start date has passed and (no end date OR end date in future)
    if (ad.startDate && ad.startDate <= now && (!ad.endDate || ad.endDate > now)) {
      return { 
        status: "active", 
        badge: "Active", 
        color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" 
      };
    }

    return { status: "", badge: "", color: "" };
  };

  // Selection management helpers
  const toggleAdSelection = (adId: string) => {
    const newSelected = new Set(selectedAdIds);
    if (newSelected.has(adId)) {
      newSelected.delete(adId);
    } else {
      newSelected.add(adId);
    }
    setSelectedAdIds(newSelected);
  };

  // Export handlers
  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const response = await fetch(`/api/admin/ads/export?format=${format}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to export ads");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ads-export-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: `Ads exported as ${format.toUpperCase()} successfully`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to export ads",
        variant: "error",
      });
    }
  };

  // Import handlers
  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportErrors([]);

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    if (fileExtension === 'json') {
      try {
        const text = await file.text();
        const adsData = JSON.parse(text);
        if (!Array.isArray(adsData)) {
          throw new Error("JSON must be an array of advertisements");
        }
        importAdsMutation.mutate(adsData);
      } catch (error) {
        let errorMessage = "Failed to process JSON file";
        
        if (error instanceof SyntaxError) {
          errorMessage = "Invalid JSON format - please check the file syntax";
        } else if (error instanceof Error) {
          if (error.message.includes("array")) {
            errorMessage = error.message;
          } else if (error.message.includes("read")) {
            errorMessage = "Failed to read the file - please try again";
          } else {
            errorMessage = error.message;
          }
        }
        
        toast({
          title: "Import Error",
          description: errorMessage,
          variant: "error",
        });
      }
    } else if (fileExtension === 'csv') {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        toast({
          title: "Error",
          description: "CSV file must have headers and at least one data row",
          variant: "error",
        });
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim());
      const adsData = lines.slice(1).map((line, index) => {
        const values = line.split(',').map(v => v.trim());
        const ad: any = {};
        
        headers.forEach((header, i) => {
          const value = values[i] || '';
          
          if (header === 'targetCountries' || header === 'targetDeviceTypes' || 
              header === 'targetUserRoles' || header === 'targetLanguages' || header === 'tags') {
            ad[header] = value ? JSON.stringify(value.split('|').map(v => v.trim())) : null;
          } else if (header === 'displayOrder' || header === 'frequencyCap') {
            ad[header] = value ? parseInt(value) : 0;
          } else if (header === 'isActive') {
            ad[header] = value === 'true' ? 'true' : 'false';
          } else if (value) {
            ad[header] = value;
          }
        });
        
        return ad;
      });

      importAdsMutation.mutate(adsData);
    } else {
      toast({
        title: "Error",
        description: "Please upload a CSV or JSON file",
        variant: "error",
      });
    }
  };

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-card/80 backdrop-blur-md border-border/50">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Admin Access Required</CardTitle>
            <CardDescription className="mt-2">
              You need admin privileges to access advertisement management
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/")} className="w-full">
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      imageUrl: "",
      linkUrl: "",
      type: "banner",
      page: "homepage",
      location: "top_banner",
      displayOrder: 0,
      startDate: "",
      endDate: "",
      isActive: true,
      targetCountries: [],
      targetDeviceTypes: [],
      targetUserRoles: [],
      targetLanguages: [],
      budget: "",
      costPerClick: "",
      costPerImpression: "",
      conversionGoal: "",
      frequencyCap: 0,
      dailyBudget: "",
      tags: [],
      notes: "",
    });
  };

  const handleCreateAd = () => {
    if (!formData.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Title is required",
        variant: "error",
      });
      return;
    }

    if (!formData.imageUrl.trim()) {
      toast({
        title: "Validation Error",
        description: "Image URL is required",
        variant: "error",
      });
      return;
    }

    if (!formData.linkUrl.trim()) {
      toast({
        title: "Validation Error",
        description: "Link URL is required",
        variant: "error",
      });
      return;
    }

    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      if (start >= end) {
        toast({
          title: "Validation Error",
          description: "Start date must be before end date",
          variant: "error",
        });
        return;
      }
    }

    createAdMutation.mutate(formData);
  };

  const handleEditAd = () => {
    if (!editingAd) return;

    if (!formData.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Title is required",
        variant: "error",
      });
      return;
    }

    if (!formData.imageUrl.trim()) {
      toast({
        title: "Validation Error",
        description: "Image URL is required",
        variant: "error",
      });
      return;
    }

    if (!formData.linkUrl.trim()) {
      toast({
        title: "Validation Error",
        description: "Link URL is required",
        variant: "error",
      });
      return;
    }

    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      if (start >= end) {
        toast({
          title: "Validation Error",
          description: "Start date must be before end date",
          variant: "error",
        });
        return;
      }
    }

    updateAdMutation.mutate({ id: editingAd.id, data: formData });
  };

  const handleDelete = () => {
    if (deleteAdId) {
      deleteAdMutation.mutate(deleteAdId);
    }
  };

  const openEditDialog = (ad: Advertisement) => {
    setEditingAd(ad);
    
    // Parse JSON strings back to arrays
    const parseJsonArray = (jsonString?: string): string[] => {
      if (!jsonString) return [];
      try {
        return JSON.parse(jsonString);
      } catch {
        return [];
      }
    };
    
    setFormData({
      title: ad.title,
      description: ad.description || "",
      imageUrl: ad.imageUrl,
      linkUrl: ad.linkUrl,
      type: ad.type,
      page: ad.page,
      location: ad.location,
      displayOrder: ad.displayOrder,
      startDate: ad.startDate || "",
      endDate: ad.endDate || "",
      isActive: ad.isActive === "true",
      targetCountries: parseJsonArray(ad.targetCountries),
      targetDeviceTypes: parseJsonArray(ad.targetDeviceTypes),
      targetUserRoles: parseJsonArray(ad.targetUserRoles),
      targetLanguages: parseJsonArray(ad.targetLanguages),
      budget: ad.budget || "",
      costPerClick: ad.costPerClick || "",
      costPerImpression: ad.costPerImpression || "",
      conversionGoal: ad.conversionGoal || "",
      frequencyCap: ad.frequencyCap || 0,
      dailyBudget: ad.dailyBudget || "",
      tags: parseJsonArray(ad.tags),
      notes: ad.notes || "",
    });
    setShowEditDialog(true);
  };

  const filteredAds = ads?.filter(ad =>
    ad.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ad.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ad.page.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ad.location.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Selection helpers that depend on filteredAds
  const toggleSelectAll = () => {
    if (selectedAdIds.size === filteredAds.length) {
      setSelectedAdIds(new Set());
    } else {
      setSelectedAdIds(new Set(filteredAds.map(ad => ad.id)));
    }
  };

  const isAllSelected = filteredAds.length > 0 && selectedAdIds.size === filteredAds.length;
  const isSomeSelected = selectedAdIds.size > 0 && selectedAdIds.size < filteredAds.length;

  const totalAds = ads?.length || 0;
  const activeAds = ads?.filter(ad => ad.isActive === "true").length || 0;
  const totalClicks = ads?.reduce((sum, ad) => sum + ad.clickCount, 0) || 0;
  const totalImpressions = ads?.reduce((sum, ad) => sum + ad.impressionCount, 0) || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95 p-2 sm:p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/admin")}
            className="text-muted-foreground hover:text-primary min-h-11 w-full sm:w-auto justify-start"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Admin
          </Button>
          <div className="flex items-center gap-2">
            <Monitor className="w-6 h-6 sm:w-8 sm:h-8 text-primary flex-shrink-0" />
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary via-accent to-purple-400 bg-clip-text text-transparent">
              Advertisement Management
            </h1>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
          <Card className="bg-card/80 backdrop-blur-md border-border/50">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Ads</p>
                  <p className="text-2xl font-bold">{totalAds}</p>
                </div>
                <Monitor className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-md border-border/50">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Ads</p>
                  <p className="text-2xl font-bold">{activeAds}</p>
                </div>
                <Activity className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-md border-border/50">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Clicks</p>
                  <p className="text-2xl font-bold">{totalClicks.toLocaleString()}</p>
                </div>
                <MousePointerClick className="w-8 h-8 text-accent" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-md border-border/50">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Impressions</p>
                  <p className="text-2xl font-bold">{totalImpressions.toLocaleString()}</p>
                </div>
                <Eye className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Ad Intensity Control */}
        <div className="mb-8">
          <AdIntensityControl />
        </div>

        <Tabs defaultValue="ads" className="w-full">
          <TabsList className="grid w-full max-w-3xl grid-cols-2 md:grid-cols-4 mb-6">
            <TabsTrigger value="ads" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
              <Monitor className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Ads Management</span>
              <span className="sm:hidden">Ads</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
              <Clock className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Schedule</span>
              <span className="sm:hidden">Schedule</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
              <BarChart3 className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Analytics</span>
              <span className="sm:hidden">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="ab-testing" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
              <FlaskConical className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">A/B Testing</span>
              <span className="sm:hidden">A/B Test</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ads" className="mt-0">
            {selectedAdIds.size > 0 && (
              <div className="sticky top-0 z-10 mb-4 p-4 bg-primary/10 border border-primary/20 rounded-lg backdrop-blur-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-5 h-5 text-primary" />
                    <span className="font-medium">{selectedAdIds.size} ad(s) selected</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => bulkEnableMutation.mutate(Array.from(selectedAdIds))}
                      disabled={bulkEnableMutation.isPending}
                      className="h-10 sm:h-9"
                    >
                      <Power className="w-4 h-4 mr-2" />
                      <span className="hidden sm:inline">Enable Selected</span>
                      <span className="sm:hidden">Enable</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => bulkDisableMutation.mutate(Array.from(selectedAdIds))}
                      disabled={bulkDisableMutation.isPending}
                      className="h-10 sm:h-9"
                    >
                      <PowerOff className="w-4 h-4 mr-2" />
                      <span className="hidden sm:inline">Disable Selected</span>
                      <span className="sm:hidden">Disable</span>
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={() => setShowBulkDeleteDialog(true)}
                      className="h-10 sm:h-9"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      <span className="hidden sm:inline">Delete Selected</span>
                      <span className="sm:hidden">Delete</span>
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={() => setSelectedAdIds(new Set())}
                      className="h-10 sm:h-9"
                    >
                      <X className="w-4 h-4 mr-2" />
                      <span className="hidden sm:inline">Clear Selection</span>
                      <span className="sm:hidden">Clear</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <Card className="bg-card/80 backdrop-blur-md border-border/50">
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Monitor className="w-5 h-5" />
                      All Advertisements
                    </CardTitle>
                    <CardDescription>
                      Manage and monitor your advertisements
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <Button 
                      variant="outline"
                      onClick={() => handleExport('csv')}
                      className="flex-1 sm:flex-none h-10 sm:h-9"
                    >
                      <Download className="w-4 h-4 sm:mr-2" />
                      <span className="hidden sm:inline">Export CSV</span>
                      <span className="sm:hidden">CSV</span>
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => handleExport('json')}
                      className="flex-1 sm:flex-none h-10 sm:h-9"
                    >
                      <Download className="w-4 h-4 sm:mr-2" />
                      <span className="hidden sm:inline">Export JSON</span>
                      <span className="sm:hidden">JSON</span>
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setShowImportDialog(true)}
                      className="flex-1 sm:flex-none h-10 sm:h-9"
                    >
                      <Upload className="w-4 h-4 sm:mr-2" />
                      <span className="hidden sm:inline">Import</span>
                      <span className="sm:hidden">Import</span>
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => refreshSchedulesMutation.mutate()}
                      disabled={refreshSchedulesMutation.isPending}
                      className="flex-1 sm:flex-none h-10 sm:h-9"
                    >
                      <RefreshCw className={`w-4 h-4 sm:mr-2 ${refreshSchedulesMutation.isPending ? 'animate-spin' : ''}`} />
                      <span className="hidden sm:inline">Refresh</span>
                      <span className="sm:hidden">Refresh</span>
                    </Button>
                    <Button 
                      onClick={() => { resetForm(); setShowCreateDialog(true); }}
                      className="w-full sm:w-auto h-10 sm:h-9"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create New Ad
                    </Button>
                  </div>
                </div>
              </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search ads by title, type, or placement..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-background/50"
                />
              </div>
              {filteredAds.length > 0 && (
                <div className="flex items-center gap-2 justify-end sm:justify-start">
                  <Checkbox 
                    checked={isAllSelected}
                    onCheckedChange={toggleSelectAll}
                    className={isSomeSelected ? "data-[state=checked]:bg-primary/50" : ""}
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">Select All</span>
                </div>
              )}
            </div>

            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading advertisements...</p>
              </div>
            ) : filteredAds.length === 0 ? (
              <div className="text-center py-8">
                <Monitor className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  {searchTerm ? "No advertisements found matching your search." : "No advertisements yet. Create your first ad!"}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAds.map((ad) => (
                  <div
                    key={ad.id}
                    className="flex flex-col sm:flex-row items-start gap-4 p-4 bg-background/50 rounded-lg border border-border/50"
                  >
                    <div className="flex gap-3 sm:gap-4 w-full sm:w-auto">
                      <Checkbox 
                        checked={selectedAdIds.has(ad.id)}
                        onCheckedChange={() => toggleAdSelection(ad.id)}
                        className="mt-1"
                      />
                      <div className="w-20 h-20 sm:w-24 sm:h-24 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                        {ad.imageUrl ? (
                          <img
                            src={ad.imageUrl}
                            alt={ad.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 sm:hidden">
                        <h3 className="font-semibold text-base">{ad.title}</h3>
                        <div className="flex gap-2 mt-1">
                          <Badge
                            className={
                              ad.isActive === "true"
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 text-xs"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300 text-xs"
                            }
                          >
                            {ad.isActive === "true" ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 w-full sm:w-auto">
                      <div className="hidden sm:flex flex-wrap items-start justify-between gap-2 mb-2">
                        <div>
                          <h3 className="font-semibold text-lg">{ad.title}</h3>
                          {ad.description && (
                            <p className="text-sm text-muted-foreground mt-1">{ad.description}</p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge
                            className={
                              ad.isActive === "true"
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
                            }
                          >
                            {ad.isActive === "true" ? "Active" : "Inactive"}
                          </Badge>
                          {getScheduleStatus(ad).badge && (
                            <Badge className={getScheduleStatus(ad).color}>
                              {getScheduleStatus(ad).badge}
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      {ad.description && (
                        <p className="text-sm text-muted-foreground mt-1 mb-2 sm:hidden">{ad.description}</p>
                      )}

                      <div className="flex flex-wrap gap-2 mb-3">
                        <Badge variant="secondary">
                          Type: {ad.type}
                        </Badge>
                        <Badge variant="secondary">
                          Page: {PAGE_OPTIONS.find(p => p.value === ad.page)?.label || ad.page}
                        </Badge>
                        <Badge variant="secondary">
                          Location: {PAGE_LOCATION_MAP[ad.page]?.find(l => l.value === ad.location)?.label || ad.location}
                        </Badge>
                        <Badge variant="secondary">
                          Order: {ad.displayOrder}
                        </Badge>
                        {ad.variantGroup && (
                          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                            <FlaskConical className="w-3 h-3 mr-1" />
                            Variant {ad.variantName} ({ad.variantGroup})
                          </Badge>
                        )}
                        {ad.startDate && (
                          <Badge variant="outline" className="text-xs">
                            <Calendar className="w-3 h-3 mr-1" />
                            Start: {new Date(ad.startDate).toLocaleDateString()}
                          </Badge>
                        )}
                        {ad.endDate && (
                          <Badge variant="outline" className="text-xs">
                            <Calendar className="w-3 h-3 mr-1" />
                            End: {new Date(ad.endDate).toLocaleDateString()}
                          </Badge>
                        )}
                        {ad.targetCountries && (() => {
                          try {
                            const countries = JSON.parse(ad.targetCountries);
                            if (countries.length > 0) {
                              return (
                                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                                  <Globe className="w-3 h-3 mr-1" />
                                  {countries.slice(0, 3).join(', ')}{countries.length > 3 ? ` +${countries.length - 3}` : ''}
                                </Badge>
                              );
                            }
                          } catch {}
                          return null;
                        })()}
                        {ad.targetDeviceTypes && (() => {
                          try {
                            const devices = JSON.parse(ad.targetDeviceTypes);
                            if (devices.length > 0) {
                              return (
                                <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300">
                                  <Smartphone className="w-3 h-3 mr-1" />
                                  {devices.join(', ')}
                                </Badge>
                              );
                            }
                          } catch {}
                          return null;
                        })()}
                        {ad.targetUserRoles && (() => {
                          try {
                            const roles = JSON.parse(ad.targetUserRoles);
                            if (roles.length > 0) {
                              return (
                                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
                                  <Users className="w-3 h-3 mr-1" />
                                  {roles.join(', ')}
                                </Badge>
                              );
                            }
                          } catch {}
                          return null;
                        })()}
                        {ad.targetLanguages && (() => {
                          try {
                            const languages = JSON.parse(ad.targetLanguages);
                            if (languages.length > 0) {
                              return (
                                <Badge className="bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300">
                                  <Languages className="w-3 h-3 mr-1" />
                                  {languages.slice(0, 2).join(', ')}{languages.length > 2 ? ` +${languages.length - 2}` : ''}
                                </Badge>
                              );
                            }
                          } catch {}
                          return null;
                        })()}
                        {ad.budget && (
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300">
                            <DollarSign className="w-3 h-3 mr-1" />
                            Budget: ${ad.budget}
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MousePointerClick className="w-4 h-4" />
                          <span>{ad.clickCount} clicks</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          <span>{ad.impressionCount} impressions</span>
                        </div>
                        <a
                          href={ad.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span className="truncate max-w-[200px]">{ad.linkUrl}</span>
                        </a>
                      </div>
                    </div>

                    <div className="flex flex-row sm:flex-col gap-2 w-full sm:w-auto mt-3 sm:mt-0">
                      <Button
                        variant="outline"
                        onClick={() => toggleActiveMutation.mutate({ id: ad.id, isActive: ad.isActive !== "true" })}
                        className="flex-1 sm:flex-none h-10 sm:h-9"
                      >
                        <span className="hidden sm:inline">{ad.isActive === "true" ? "Deactivate" : "Activate"}</span>
                        <span className="sm:hidden">{ad.isActive === "true" ? "Off" : "On"}</span>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => openEditDialog(ad)}
                        className="flex-1 sm:flex-none h-10 sm:h-9"
                      >
                        <Edit className="w-4 h-4 sm:mr-1" />
                        <span className="hidden sm:inline">Edit</span>
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => setDeleteAdId(ad.id)}
                        className="flex-1 sm:flex-none h-10 sm:h-9"
                      >
                        <Trash2 className="w-4 h-4 sm:mr-1" />
                        <span className="hidden sm:inline">Delete</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="schedule" className="mt-0">
            <div className="space-y-4">
              {(() => {
                const now = new Date().toISOString();
                const upcomingAds = ads?.filter(ad => ad.startDate && ad.startDate > now) || [];
                const activeScheduledAds = ads?.filter(ad => 
                  ad.isActive === "true" && 
                  ad.startDate && 
                  ad.startDate <= now && 
                  (!ad.endDate || ad.endDate > now)
                ) || [];
                const expiredAds = ads?.filter(ad => ad.endDate && ad.endDate <= now) || [];
                const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
                const recentlyExpiredAds = expiredAds.filter(ad => ad.endDate && ad.endDate >= sevenDaysAgo);

                return (
                  <>
                    <Card className="bg-card/80 backdrop-blur-md border-border/50">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Clock className="w-5 h-5 text-blue-500" />
                          Upcoming Ads ({upcomingAds.length})
                        </CardTitle>
                        <CardDescription>
                          Ads scheduled to start in the future
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {upcomingAds.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            No upcoming scheduled ads
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {upcomingAds.map(ad => (
                              <div key={ad.id} className="p-3 bg-background/50 rounded-lg border border-blue-200 dark:border-blue-800">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <h4 className="font-semibold">{ad.title}</h4>
                                    <div className="flex flex-wrap gap-2 mt-2 text-sm">
                                      <span className="text-muted-foreground">
                                        <Calendar className="w-3 h-3 inline mr-1" />
                                        Starts: {new Date(ad.startDate!).toLocaleDateString()} at {new Date(ad.startDate!).toLocaleTimeString()}
                                      </span>
                                      {ad.endDate && (
                                        <span className="text-muted-foreground">
                                          • Ends: {new Date(ad.endDate).toLocaleDateString()}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                                    Upcoming
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="bg-card/80 backdrop-blur-md border-border/50">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Activity className="w-5 h-5 text-green-500" />
                          Currently Active Scheduled Ads ({activeScheduledAds.length})
                        </CardTitle>
                        <CardDescription>
                          Active ads with scheduled end dates
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {activeScheduledAds.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            No active scheduled ads
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {activeScheduledAds.map(ad => (
                              <div key={ad.id} className="p-3 bg-background/50 rounded-lg border border-green-200 dark:border-green-800">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <h4 className="font-semibold">{ad.title}</h4>
                                    <div className="flex flex-wrap gap-2 mt-2 text-sm">
                                      <span className="text-muted-foreground">
                                        <Calendar className="w-3 h-3 inline mr-1" />
                                        Ends: {new Date(ad.endDate!).toLocaleDateString()} at {new Date(ad.endDate!).toLocaleTimeString()}
                                      </span>
                                      <span className="text-green-600 dark:text-green-400">
                                        • {ad.clickCount} clicks, {ad.impressionCount} impressions
                                      </span>
                                    </div>
                                  </div>
                                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                    Active
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="bg-card/80 backdrop-blur-md border-border/50">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <X className="w-5 h-5 text-red-500" />
                          Recently Expired ({recentlyExpiredAds.length})
                        </CardTitle>
                        <CardDescription>
                          Ads that expired in the last 7 days
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {recentlyExpiredAds.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            No recently expired ads
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {recentlyExpiredAds.map(ad => (
                              <div key={ad.id} className="p-3 bg-background/50 rounded-lg border border-red-200 dark:border-red-800">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <h4 className="font-semibold">{ad.title}</h4>
                                    <div className="flex flex-wrap gap-2 mt-2 text-sm">
                                      <span className="text-muted-foreground">
                                        <Calendar className="w-3 h-3 inline mr-1" />
                                        Expired: {new Date(ad.endDate!).toLocaleDateString()} at {new Date(ad.endDate!).toLocaleTimeString()}
                                      </span>
                                      <span className="text-red-600 dark:text-red-400">
                                        • Final stats: {ad.clickCount} clicks, {ad.impressionCount} impressions
                                      </span>
                                    </div>
                                  </div>
                                  <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                                    Expired
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </>
                );
              })()}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="mt-0">
            <AdAnalyticsDashboard ads={ads || []} />
          </TabsContent>

          <TabsContent value="ab-testing" className="mt-0">
            <AdVariantManager />
          </TabsContent>
        </Tabs>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="w-[95vw] max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Advertisement</DialogTitle>
            <DialogDescription>
              Add a new advertisement to display on your site
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
            <div>
              <Label htmlFor="create-title">Title *</Label>
              <Input
                id="create-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter ad title"
              />
            </div>

            <div>
              <Label htmlFor="create-description">Description</Label>
              <Textarea
                id="create-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter ad description (optional)"
                rows={3}
              />
            </div>

            <div>
              <Label>Ad Image *</Label>
              <ImageUpload
                value={formData.imageUrl}
                onChange={(url) => setFormData({ ...formData, imageUrl: url })}
                accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                maxSize={10}
                uploadEndpoint="/api/admin/upload-ad-image"
              />
            </div>

            <div>
              <Label htmlFor="create-linkUrl">Link URL *</Label>
              <Input
                id="create-linkUrl"
                value={formData.linkUrl}
                onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
                placeholder="https://example.com/landing-page"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="create-type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger id="create-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="banner">Banner</SelectItem>
                    <SelectItem value="sidebar">Sidebar</SelectItem>
                    <SelectItem value="popup">Popup</SelectItem>
                    <SelectItem value="inline">Inline</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="create-displayOrder">Display Order</Label>
                <Input
                  id="create-displayOrder"
                  type="number"
                  value={formData.displayOrder}
                  onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="create-page">Page *</Label>
                <Select
                  value={formData.page}
                  onValueChange={(value) => {
                    const availableLocations = PAGE_LOCATION_MAP[value] || [];
                    const newLocation = availableLocations[0]?.value || 'top_banner';
                    setFormData({ ...formData, page: value, location: newLocation });
                  }}
                >
                  <SelectTrigger id="create-page">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_OPTIONS.map(page => (
                      <SelectItem key={page.value} value={page.value}>
                        {page.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="create-location">Location *</Label>
                <Select
                  value={formData.location}
                  onValueChange={(value) => setFormData({ ...formData, location: value })}
                >
                  <SelectTrigger id="create-location">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(PAGE_LOCATION_MAP[formData.page] || []).map(location => (
                      <SelectItem key={location.value} value={location.value}>
                        {location.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="create-startDate">Start Date (Optional)</Label>
                <Input
                  id="create-startDate"
                  type="datetime-local"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="create-endDate">End Date (Optional)</Label>
                <Input
                  id="create-endDate"
                  type="datetime-local"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>

            <Separator className="my-4" />

            {/* Advanced Targeting Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Target className="w-4 h-4" />
                Advanced Targeting
              </h3>
              <p className="text-xs text-muted-foreground">Leave empty to target all users</p>

              <div>
                <Label className="text-xs">Target Countries</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {['US', 'UK', 'CA', 'AU', 'DE', 'FR', 'JP', 'ES', 'IT', 'BR'].map((country) => (
                    <div key={country} className="flex items-center space-x-2">
                      <Checkbox
                        id={`create-country-${country}`}
                        checked={formData.targetCountries.includes(country)}
                        onCheckedChange={(checked) => {
                          setFormData({
                            ...formData,
                            targetCountries: checked
                              ? [...formData.targetCountries, country]
                              : formData.targetCountries.filter(c => c !== country)
                          });
                        }}
                      />
                      <Label htmlFor={`create-country-${country}`} className="text-xs cursor-pointer">
                        {country}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs">Target Device Types</Label>
                <div className="flex gap-4 mt-2">
                  {['mobile', 'tablet', 'desktop'].map((device) => (
                    <div key={device} className="flex items-center space-x-2">
                      <Checkbox
                        id={`create-device-${device}`}
                        checked={formData.targetDeviceTypes.includes(device)}
                        onCheckedChange={(checked) => {
                          setFormData({
                            ...formData,
                            targetDeviceTypes: checked
                              ? [...formData.targetDeviceTypes, device]
                              : formData.targetDeviceTypes.filter(d => d !== device)
                          });
                        }}
                      />
                      <Label htmlFor={`create-device-${device}`} className="text-xs cursor-pointer capitalize">
                        {device}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs">Target User Roles</Label>
                <div className="flex gap-4 mt-2">
                  {['user', 'premium', 'staff', 'admin'].map((role) => (
                    <div key={role} className="flex items-center space-x-2">
                      <Checkbox
                        id={`create-role-${role}`}
                        checked={formData.targetUserRoles.includes(role)}
                        onCheckedChange={(checked) => {
                          setFormData({
                            ...formData,
                            targetUserRoles: checked
                              ? [...formData.targetUserRoles, role]
                              : formData.targetUserRoles.filter(r => r !== role)
                          });
                        }}
                      />
                      <Label htmlFor={`create-role-${role}`} className="text-xs cursor-pointer capitalize">
                        {role}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs">Target Languages</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {[
                    { code: 'en', name: 'English' },
                    { code: 'es', name: 'Spanish' },
                    { code: 'fr', name: 'French' },
                    { code: 'de', name: 'German' },
                    { code: 'ja', name: 'Japanese' },
                    { code: 'zh', name: 'Chinese' },
                  ].map((lang) => (
                    <div key={lang.code} className="flex items-center space-x-2">
                      <Checkbox
                        id={`create-lang-${lang.code}`}
                        checked={formData.targetLanguages.includes(lang.code)}
                        onCheckedChange={(checked) => {
                          setFormData({
                            ...formData,
                            targetLanguages: checked
                              ? [...formData.targetLanguages, lang.code]
                              : formData.targetLanguages.filter(l => l !== lang.code)
                          });
                        }}
                      />
                      <Label htmlFor={`create-lang-${lang.code}`} className="text-xs cursor-pointer">
                        {lang.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Performance & Budget Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Performance & Budget
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="create-budget" className="text-xs">Total Budget ($)</Label>
                  <Input
                    id="create-budget"
                    value={formData.budget}
                    onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                    placeholder="e.g., 1000.00"
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="create-dailyBudget" className="text-xs">Daily Budget ($)</Label>
                  <Input
                    id="create-dailyBudget"
                    value={formData.dailyBudget}
                    onChange={(e) => setFormData({ ...formData, dailyBudget: e.target.value })}
                    placeholder="e.g., 50.00"
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="create-costPerClick" className="text-xs">Cost Per Click ($)</Label>
                  <Input
                    id="create-costPerClick"
                    value={formData.costPerClick}
                    onChange={(e) => setFormData({ ...formData, costPerClick: e.target.value })}
                    placeholder="e.g., 0.50"
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="create-costPerImpression" className="text-xs">Cost Per Impression ($)</Label>
                  <Input
                    id="create-costPerImpression"
                    value={formData.costPerImpression}
                    onChange={(e) => setFormData({ ...formData, costPerImpression: e.target.value })}
                    placeholder="e.g., 0.01"
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="create-conversionGoal" className="text-xs">Conversion Goal</Label>
                  <Select
                    value={formData.conversionGoal}
                    onValueChange={(value) => setFormData({ ...formData, conversionGoal: value })}
                  >
                    <SelectTrigger id="create-conversionGoal" className="text-sm">
                      <SelectValue placeholder="Select goal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="click">Click</SelectItem>
                      <SelectItem value="signup">Sign Up</SelectItem>
                      <SelectItem value="purchase">Purchase</SelectItem>
                      <SelectItem value="download">Download</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="create-frequencyCap" className="text-xs">Frequency Cap (per user/day)</Label>
                  <Input
                    id="create-frequencyCap"
                    type="number"
                    value={formData.frequencyCap || ""}
                    onChange={(e) => setFormData({ ...formData, frequencyCap: parseInt(e.target.value) || 0 })}
                    placeholder="e.g., 3"
                    className="text-sm"
                  />
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Metadata Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Metadata
              </h3>

              <div>
                <Label htmlFor="create-tags" className="text-xs">Tags (comma-separated)</Label>
                <Input
                  id="create-tags"
                  value={formData.tags.join(', ')}
                  onChange={(e) => {
                    const tags = e.target.value.split(',').map(t => t.trim()).filter(t => t);
                    setFormData({ ...formData, tags });
                  }}
                  placeholder="e.g., seasonal, promo, featured"
                  className="text-sm"
                />
              </div>

              <div>
                <Label htmlFor="create-notes" className="text-xs">Internal Notes</Label>
                <Textarea
                  id="create-notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add internal notes for this ad..."
                  rows={3}
                  className="text-sm"
                />
              </div>
            </div>

            <Separator className="my-4" />

            <div className="flex items-center space-x-2">
              <Checkbox
                id="create-isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked as boolean })}
              />
              <Label htmlFor="create-isActive" className="cursor-pointer">
                Active (Display this ad immediately)
              </Label>
            </div>
            </div>

            <div className="space-y-4">
              <AdPreview
                title={formData.title}
                description={formData.description}
                imageUrl={formData.imageUrl}
                linkUrl={formData.linkUrl}
                type={formData.type}
                page={formData.page}
                location={formData.location}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateAd} disabled={createAdMutation.isPending}>
              {createAdMutation.isPending ? "Creating..." : "Create Ad"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="w-[95vw] max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Advertisement</DialogTitle>
            <DialogDescription>
              Update advertisement details
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
            <div>
              <Label htmlFor="edit-title">Title *</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter ad title"
              />
            </div>

            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter ad description (optional)"
                rows={3}
              />
            </div>

            <div>
              <Label>Ad Image *</Label>
              <ImageUpload
                value={formData.imageUrl}
                onChange={(url) => setFormData({ ...formData, imageUrl: url })}
                accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                maxSize={10}
                uploadEndpoint="/api/admin/upload-ad-image"
              />
            </div>

            <div>
              <Label htmlFor="edit-linkUrl">Link URL *</Label>
              <Input
                id="edit-linkUrl"
                value={formData.linkUrl}
                onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
                placeholder="https://example.com/landing-page"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger id="edit-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="banner">Banner</SelectItem>
                    <SelectItem value="sidebar">Sidebar</SelectItem>
                    <SelectItem value="popup">Popup</SelectItem>
                    <SelectItem value="inline">Inline</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit-displayOrder">Display Order</Label>
                <Input
                  id="edit-displayOrder"
                  type="number"
                  value={formData.displayOrder}
                  onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-page">Page *</Label>
                <Select
                  value={formData.page}
                  onValueChange={(value) => {
                    const availableLocations = PAGE_LOCATION_MAP[value] || [];
                    const newLocation = availableLocations[0]?.value || 'top_banner';
                    setFormData({ ...formData, page: value, location: newLocation });
                  }}
                >
                  <SelectTrigger id="edit-page">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_OPTIONS.map(page => (
                      <SelectItem key={page.value} value={page.value}>
                        {page.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit-location">Location *</Label>
                <Select
                  value={formData.location}
                  onValueChange={(value) => setFormData({ ...formData, location: value })}
                >
                  <SelectTrigger id="edit-location">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(PAGE_LOCATION_MAP[formData.page] || []).map(location => (
                      <SelectItem key={location.value} value={location.value}>
                        {location.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-startDate">Start Date (Optional)</Label>
                <Input
                  id="edit-startDate"
                  type="datetime-local"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="edit-endDate">End Date (Optional)</Label>
                <Input
                  id="edit-endDate"
                  type="datetime-local"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>

            <Separator className="my-4" />

            {/* Advanced Targeting Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Target className="w-4 h-4" />
                Advanced Targeting
              </h3>
              <p className="text-xs text-muted-foreground">Leave empty to target all users</p>

              <div>
                <Label className="text-xs">Target Countries</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {['US', 'UK', 'CA', 'AU', 'DE', 'FR', 'JP', 'ES', 'IT', 'BR'].map((country) => (
                    <div key={country} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-country-${country}`}
                        checked={formData.targetCountries.includes(country)}
                        onCheckedChange={(checked) => {
                          setFormData({
                            ...formData,
                            targetCountries: checked
                              ? [...formData.targetCountries, country]
                              : formData.targetCountries.filter(c => c !== country)
                          });
                        }}
                      />
                      <Label htmlFor={`edit-country-${country}`} className="text-xs cursor-pointer">
                        {country}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs">Target Device Types</Label>
                <div className="flex gap-4 mt-2">
                  {['mobile', 'tablet', 'desktop'].map((device) => (
                    <div key={device} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-device-${device}`}
                        checked={formData.targetDeviceTypes.includes(device)}
                        onCheckedChange={(checked) => {
                          setFormData({
                            ...formData,
                            targetDeviceTypes: checked
                              ? [...formData.targetDeviceTypes, device]
                              : formData.targetDeviceTypes.filter(d => d !== device)
                          });
                        }}
                      />
                      <Label htmlFor={`edit-device-${device}`} className="text-xs cursor-pointer capitalize">
                        {device}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs">Target User Roles</Label>
                <div className="flex gap-4 mt-2">
                  {['user', 'premium', 'staff', 'admin'].map((role) => (
                    <div key={role} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-role-${role}`}
                        checked={formData.targetUserRoles.includes(role)}
                        onCheckedChange={(checked) => {
                          setFormData({
                            ...formData,
                            targetUserRoles: checked
                              ? [...formData.targetUserRoles, role]
                              : formData.targetUserRoles.filter(r => r !== role)
                          });
                        }}
                      />
                      <Label htmlFor={`edit-role-${role}`} className="text-xs cursor-pointer capitalize">
                        {role}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs">Target Languages</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {[
                    { code: 'en', name: 'English' },
                    { code: 'es', name: 'Spanish' },
                    { code: 'fr', name: 'French' },
                    { code: 'de', name: 'German' },
                    { code: 'ja', name: 'Japanese' },
                    { code: 'zh', name: 'Chinese' },
                  ].map((lang) => (
                    <div key={lang.code} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-lang-${lang.code}`}
                        checked={formData.targetLanguages.includes(lang.code)}
                        onCheckedChange={(checked) => {
                          setFormData({
                            ...formData,
                            targetLanguages: checked
                              ? [...formData.targetLanguages, lang.code]
                              : formData.targetLanguages.filter(l => l !== lang.code)
                          });
                        }}
                      />
                      <Label htmlFor={`edit-lang-${lang.code}`} className="text-xs cursor-pointer">
                        {lang.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Performance & Budget Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Performance & Budget
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-budget" className="text-xs">Total Budget ($)</Label>
                  <Input
                    id="edit-budget"
                    value={formData.budget}
                    onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                    placeholder="e.g., 1000.00"
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-dailyBudget" className="text-xs">Daily Budget ($)</Label>
                  <Input
                    id="edit-dailyBudget"
                    value={formData.dailyBudget}
                    onChange={(e) => setFormData({ ...formData, dailyBudget: e.target.value })}
                    placeholder="e.g., 50.00"
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-costPerClick" className="text-xs">Cost Per Click ($)</Label>
                  <Input
                    id="edit-costPerClick"
                    value={formData.costPerClick}
                    onChange={(e) => setFormData({ ...formData, costPerClick: e.target.value })}
                    placeholder="e.g., 0.50"
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-costPerImpression" className="text-xs">Cost Per Impression ($)</Label>
                  <Input
                    id="edit-costPerImpression"
                    value={formData.costPerImpression}
                    onChange={(e) => setFormData({ ...formData, costPerImpression: e.target.value })}
                    placeholder="e.g., 0.01"
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-conversionGoal" className="text-xs">Conversion Goal</Label>
                  <Select
                    value={formData.conversionGoal}
                    onValueChange={(value) => setFormData({ ...formData, conversionGoal: value })}
                  >
                    <SelectTrigger id="edit-conversionGoal" className="text-sm">
                      <SelectValue placeholder="Select goal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="click">Click</SelectItem>
                      <SelectItem value="signup">Sign Up</SelectItem>
                      <SelectItem value="purchase">Purchase</SelectItem>
                      <SelectItem value="download">Download</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-frequencyCap" className="text-xs">Frequency Cap (per user/day)</Label>
                  <Input
                    id="edit-frequencyCap"
                    type="number"
                    value={formData.frequencyCap || ""}
                    onChange={(e) => setFormData({ ...formData, frequencyCap: parseInt(e.target.value) || 0 })}
                    placeholder="e.g., 3"
                    className="text-sm"
                  />
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Metadata Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Metadata
              </h3>

              <div>
                <Label htmlFor="edit-tags" className="text-xs">Tags (comma-separated)</Label>
                <Input
                  id="edit-tags"
                  value={formData.tags.join(', ')}
                  onChange={(e) => {
                    const tags = e.target.value.split(',').map(t => t.trim()).filter(t => t);
                    setFormData({ ...formData, tags });
                  }}
                  placeholder="e.g., seasonal, promo, featured"
                  className="text-sm"
                />
              </div>

              <div>
                <Label htmlFor="edit-notes" className="text-xs">Internal Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add internal notes for this ad..."
                  rows={3}
                  className="text-sm"
                />
              </div>
            </div>

            <Separator className="my-4" />

            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked as boolean })}
              />
              <Label htmlFor="edit-isActive" className="cursor-pointer">
                Active (Display this ad)
              </Label>
            </div>
            </div>

            <div className="space-y-4">
              <AdPreview
                title={formData.title}
                description={formData.description}
                imageUrl={formData.imageUrl}
                linkUrl={formData.linkUrl}
                type={formData.type}
                page={formData.page}
                location={formData.location}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditAd} disabled={updateAdMutation.isPending}>
              {updateAdMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteAdId !== null} onOpenChange={(open) => !open && setDeleteAdId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this advertisement. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteAdMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Multiple Ads?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedAdIds.size} advertisement(s). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMutation.mutate(Array.from(selectedAdIds))}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : `Delete ${selectedAdIds.size} Ad(s)`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="w-[95vw] max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Advertisements</DialogTitle>
            <DialogDescription>
              Upload a CSV or JSON file to bulk import advertisements
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="import-file">Select File</Label>
              <Input
                id="import-file"
                type="file"
                accept=".csv,.json"
                onChange={handleImportFileChange}
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-2">
                Accepted formats: CSV, JSON
              </p>
            </div>

            {importFile && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium">Selected file: {importFile.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Size: {(importFile.size / 1024).toFixed(2)} KB
                </p>
              </div>
            )}

            {importErrors.length > 0 && (
              <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <h4 className="font-semibold text-destructive mb-2">Validation Errors</h4>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {importErrors.map((error, index) => (
                    <p key={index} className="text-sm text-destructive">
                      Row {error.row}: {error.field} - {error.message}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h4 className="font-semibold text-sm mb-2">CSV Format Example:</h4>
              <pre className="text-xs overflow-x-auto p-2 bg-background rounded">
{`title,description,imageUrl,linkUrl,type,placement,isActive,displayOrder
"Sample Ad","Description","/uploads/ad.jpg","https://example.com","banner","homepage","true",1`}
              </pre>
              <p className="text-xs text-muted-foreground mt-2">
                For array fields (targetCountries, tags, etc.), use pipe-delimited values: US|UK|CA
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowImportDialog(false);
                setImportFile(null);
                setImportErrors([]);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
