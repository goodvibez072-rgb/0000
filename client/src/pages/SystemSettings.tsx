import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { 
  Settings, ArrowLeft, Plus, Edit, Trash2, Save, X,
  Globe, Users, BookOpen, Cog, Eye, EyeOff, Loader2, BarChart3,
  RefreshCw, Trash, Database, AlertCircle, Lock
} from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdIntensityControl } from "@/components/admin/AdIntensityControl";
import { ShopControl } from "@/components/admin/ShopControl";
import { OAuthProvidersControl } from "@/components/admin/OAuthProvidersControl";
import { fetchWithCsrf } from "@/lib/csrf";

interface Setting {
  id: string;
  category: "site" | "users" | "content" | "system";
  key: string;
  value: string;
  type: "string" | "number" | "boolean" | "json";
  description?: string;
  isPublic: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface CreateSettingData {
  category: string;
  key: string;
  value: any;
  type: string;
  description?: string;
  isPublic: boolean;
}

// API functions
async function fetchAllSettings(): Promise<Setting[]> {
  const response = await fetch("/api/admin/settings", {
    headers: {
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch settings");
  }

  return response.json();
}

async function fetchSettingsByCategory(category: string): Promise<Setting[]> {
  const response = await fetch(`/api/admin/settings/${category}`, {
    headers: {
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${category} settings`);
  }

  return response.json();
}

async function createOrUpdateSetting(category: string, key: string, data: CreateSettingData): Promise<Setting> {
  const response = await fetchWithCsrf(`/api/admin/settings/${category}/${key}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Failed to save setting" }));
    throw new Error(error.message || "Failed to save setting");
  }

  return response.json();
}

async function updateSettingById(id: string, data: Partial<CreateSettingData>): Promise<Setting> {
  const response = await fetchWithCsrf(`/api/admin/settings/by-id/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Failed to update setting" }));
    throw new Error(error.message || "Failed to update setting");
  }

  return response.json();
}

async function deleteSetting(id: string): Promise<void> {
  const response = await fetchWithCsrf(`/api/admin/settings/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Failed to delete setting" }));
    throw new Error(error.message || "Failed to delete setting");
  }
}

export default function SystemSettings() {
  const { isAdmin, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  
  // State for dialogs and forms
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [settingToEdit, setSettingToEdit] = useState<Setting | null>(null);
  const [settingToDelete, setSettingToDelete] = useState<Setting | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("site");
  const [showOnlyPublic, setShowOnlyPublic] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);

  // Form state
  const [formData, setFormData] = useState<CreateSettingData>({
    category: "site",
    key: "",
    value: "",
    type: "string",
    description: "",
    isPublic: false,
  });


  // Fetch all settings
  const { data: allSettings, isLoading, error } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: fetchAllSettings,
    enabled: isAdmin && isAuthenticated,
  });

  // Mutations
  const createSettingMutation = useMutation({
    mutationFn: ({ category, key, data }: { category: string; key: string; data: CreateSettingData }) =>
      createOrUpdateSetting(category, key, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      toast({
        title: "Success",
        description: "Setting saved successfully",
      });
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save setting",
        variant: "error",
      });
    },
  });

  const updateSettingMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateSettingData> }) =>
      updateSettingById(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      toast({
        title: "Success",
        description: "Setting updated successfully",
      });
      setIsEditDialogOpen(false);
      setSettingToEdit(null);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update setting",
        variant: "error",
      });
    },
  });

  const deleteSettingMutation = useMutation({
    mutationFn: deleteSetting,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      toast({
        title: "Success",
        description: "Setting deleted successfully",
      });
      setSettingToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete setting",
        variant: "error",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      category: "site",
      key: "",
      value: "",
      type: "string",
      description: "",
      isPublic: false,
    });
  };

  const handleEditSetting = (setting: Setting) => {
    setSettingToEdit(setting);
    setFormData({
      category: setting.category,
      key: setting.key,
      value: setting.value,
      type: setting.type,
      description: setting.description || "",
      isPublic: setting.isPublic,
    });
    setIsEditDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Process value based on type
    let processedValue = formData.value;
    try {
      switch (formData.type) {
        case "number":
          processedValue = Number(formData.value);
          if (isNaN(processedValue)) {
            toast({
              title: "Invalid Value",
              description: "Please enter a valid number",
              variant: "error",
            });
            return;
          }
          break;
        case "boolean":
          processedValue = formData.value === "true" || formData.value === true;
          break;
        case "json":
          if (typeof formData.value === "string") {
            JSON.parse(formData.value); // Validate JSON
          }
          break;
      }
    } catch (error) {
      toast({
        title: "Invalid Value",
        description: "Please enter a valid value for the selected type",
        variant: "error",
      });
      return;
    }

    const data = {
      ...formData,
      value: processedValue,
    };

    if (settingToEdit) {
      updateSettingMutation.mutate({ id: settingToEdit.id, data });
    } else {
      createSettingMutation.mutate({ 
        category: data.category, 
        key: data.key, 
        data 
      });
    }
  };

  const formatValue = (value: string, type: string) => {
    switch (type) {
      case "boolean":
        return value === "true" ? "✓ True" : "✗ False";
      case "json":
        try {
          return JSON.stringify(JSON.parse(value), null, 2);
        } catch {
          return value;
        }
      default:
        return value.length > 50 ? `${value.substring(0, 50)}...` : value;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "site": return <Globe className="h-4 w-4" />;
      case "users": return <Users className="h-4 w-4" />;
      case "content": return <BookOpen className="h-4 w-4" />;
      case "system": return <Cog className="h-4 w-4" />;
      default: return <Settings className="h-4 w-4" />;
    }
  };

  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      // Clear React Query cache
      queryClient.clear();
      
      // Clear localStorage cache (preserve user preferences)
      const prefsToKeep = [
        'manga-reading-mode',
        'manga-fit-width',
        'manga-dark-mode',
        'manga-reading-direction',
        'manga-autoscroll-speed'
      ];
      
      const preservedPrefs: Record<string, string | null> = {};
      prefsToKeep.forEach(key => {
        preservedPrefs[key] = localStorage.getItem(key);
      });
      
      localStorage.clear();
      
      // Restore preserved preferences
      Object.entries(preservedPrefs).forEach(([key, value]) => {
        if (value !== null) {
          localStorage.setItem(key, value);
        }
      });
      
      toast({
        title: "Cache Cleared",
        description: "Application cache has been cleared successfully. The page will reload to apply changes.",
      });
      
      // Reload page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear cache. Please try again.",
        variant: "error",
      });
      setIsClearingCache(false);
    }
  };

  const getFilteredSettings = (category: string) => {
    if (!allSettings) return [];
    const categorySettings = allSettings.filter(setting => setting.category === category);
    if (showOnlyPublic) {
      return categorySettings.filter(setting => setting.isPublic);
    }
    return categorySettings;
  };

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-card/80 backdrop-blur-md border-border/50">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Settings className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Admin Access Required</CardTitle>
            <CardDescription className="mt-2">
              You need admin privileges to access system settings
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

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              Error loading settings: {error.message}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <Button
        variant="ghost"
        onClick={() => navigate("/admin")}
        className="w-fit text-muted-foreground hover:text-primary mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>
      
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6 text-blue-600" />
          <h1 className="text-3xl font-bold">System Settings</h1>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Setting
              </Button>
            </DialogTrigger>
          </Dialog>
          
          <div className="flex items-center gap-2">
            <Switch
              id="show-public"
              checked={showOnlyPublic}
              onCheckedChange={setShowOnlyPublic}
            />
            <Label htmlFor="show-public" className="text-sm">
              Show only public settings
            </Label>
          </div>
        </div>
      </div>

      {/* Settings by Category */}
      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="site" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Site
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="content" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Content
          </TabsTrigger>
          <TabsTrigger value="oauth" className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            OAuth
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-2">
            <Cog className="h-4 w-4" />
            System
          </TabsTrigger>
        </TabsList>

        {/* OAuth Tab */}
        <TabsContent value="oauth" className="space-y-4">
          <OAuthProvidersControl />
        </TabsContent>

        {["site", "users", "content", "system"].map((category) => (
          <TabsContent key={category} value={category} className="space-y-4">
            {/* System Management Tools - Only show in System tab */}
            {category === "system" && (
              <>
                {/* Cache Control Card */}
                <Card className="border-blue-200 dark:border-blue-800">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <CardTitle>Cache Management</CardTitle>
                      </div>
                    </div>
                    <CardDescription>
                      Clear application cache to improve performance and resolve issues
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-col gap-4">
                      <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-4 border border-blue-200 dark:border-blue-800">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                              What gets cleared:
                            </h4>
                            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                              <li>• React Query cache (API responses)</li>
                              <li>• Temporary session data</li>
                              <li>• Reading progress (preserved)</li>
                              <li>• User preferences (preserved)</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                          onClick={handleClearCache}
                          disabled={isClearingCache}
                          variant="outline"
                          className="border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
                        >
                          {isClearingCache ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Clearing Cache...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Clear Application Cache
                            </>
                          )}
                        </Button>
                        
                        <Button
                          onClick={() => {
                            toast({
                              title: "Browser Cache",
                              description: "Press Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac) to clear browser cache and hard refresh.",
                            });
                          }}
                          variant="ghost"
                          className="text-muted-foreground"
                        >
                          <BarChart3 className="h-4 w-4 mr-2" />
                          Browser Cache Instructions
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Ad Intensity Control */}
                <AdIntensityControl />
                
                {/* Shop Control */}
                <ShopControl />
              </>
            )}
            
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(category)}
                    <CardTitle className="capitalize">{category} Settings</CardTitle>
                  </div>
                  <Badge variant="secondary">
                    {getFilteredSettings(category).length} setting{getFilteredSettings(category).length !== 1 ? 's' : ''}
                  </Badge>
                </div>
                <CardDescription>
                  Manage {category} configuration settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                {getFilteredSettings(category).length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No {showOnlyPublic ? 'public ' : ''}{category} settings found
                  </div>
                ) : (
                  <div className="space-y-3">
                    {getFilteredSettings(category).map((setting) => (
                      <Card key={setting.id} className="border">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="text-xs">
                                  {setting.type}
                                </Badge>
                                <Badge variant={setting.isPublic ? "default" : "secondary"} className="text-xs">
                                  {setting.isPublic ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                                  {setting.isPublic ? "Public" : "Private"}
                                </Badge>
                              </div>
                              
                              <h4 className="font-semibold text-sm mb-1">{setting.key}</h4>
                              
                              {setting.description && (
                                <p className="text-xs text-gray-600 mb-2">{setting.description}</p>
                              )}
                              
                              <div className="bg-gray-50 p-2 rounded text-sm font-mono">
                                {formatValue(setting.value, setting.type)}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 ml-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditSetting(setting)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSettingToDelete(setting)}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsAddDialogOpen(false);
          setIsEditDialogOpen(false);
          setSettingToEdit(null);
          resetForm();
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {settingToEdit ? "Edit Setting" : "Add New Setting"}
            </DialogTitle>
            <DialogDescription>
              {settingToEdit ? "Update the setting configuration" : "Create a new system setting"}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Category</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value) => setFormData({...formData, category: value})}
                  disabled={!!settingToEdit}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="site">Site</SelectItem>
                    <SelectItem value="users">Users</SelectItem>
                    <SelectItem value="content">Content</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="type">Type</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(value) => setFormData({...formData, type: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="string">String</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="boolean">Boolean</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="key">Key</Label>
              <Input
                id="key"
                value={formData.key}
                onChange={(e) => setFormData({...formData, key: e.target.value})}
                placeholder="e.g., site_name, max_upload_size"
                disabled={!!settingToEdit}
                required
              />
            </div>

            <div>
              <Label htmlFor="value">Value</Label>
              {formData.type === "json" ? (
                <Textarea
                  id="value"
                  value={formData.value}
                  onChange={(e) => setFormData({...formData, value: e.target.value})}
                  placeholder='{"key": "value"}'
                  rows={4}
                  required
                />
              ) : formData.type === "boolean" ? (
                <Select 
                  value={String(formData.value)} 
                  onValueChange={(value) => setFormData({...formData, value: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select boolean value" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">True</SelectItem>
                    <SelectItem value="false">False</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="value"
                  type={formData.type === "number" ? "number" : "text"}
                  value={formData.value}
                  onChange={(e) => setFormData({...formData, value: e.target.value})}
                  placeholder="Enter value"
                  required
                />
              )}
            </div>

            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Brief description of this setting"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isPublic"
                checked={formData.isPublic}
                onCheckedChange={(checked) => setFormData({...formData, isPublic: checked})}
              />
              <Label htmlFor="isPublic">Public setting (visible to non-admins)</Label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setIsAddDialogOpen(false);
                  setIsEditDialogOpen(false);
                  setSettingToEdit(null);
                  resetForm();
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createSettingMutation.isPending || updateSettingMutation.isPending}
              >
                {createSettingMutation.isPending || updateSettingMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {settingToEdit ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!settingToDelete} onOpenChange={() => setSettingToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Setting</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the setting "{settingToDelete?.key}"? 
              This action cannot be undone and may affect system functionality.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (settingToDelete) {
                  deleteSettingMutation.mutate(settingToDelete.id);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteSettingMutation.isPending}
            >
              {deleteSettingMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}