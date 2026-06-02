import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ImageUpload } from "@/components/ui/image-upload";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, TrendingUp, TrendingDown, Minus, Eye, MousePointerClick } from "lucide-react";

interface Advertisement {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  linkUrl: string;
  type: string;
  placement: string;
  isActive: string;
  variantGroup?: string;
  variantName?: string;
  displayOrder: number;
}

interface VariantFormData {
  variantName: string;
  title: string;
  imageUrl: string;
  linkUrl: string;
  type: string;
  placement: string;
  displayOrder: number;
}

interface VariantComparison {
  variantName: string;
  impressions: number;
  clicks: number;
  ctr: number;
  adId: string;
  title: string;
}

async function fetchAds(): Promise<Advertisement[]> {
  const response = await fetch("/api/admin/ads", {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch advertisements");
  }
  
  return response.json();
}

async function fetchVariantComparison(variantGroup: string): Promise<VariantComparison[]> {
  const response = await fetch(`/api/ads/analytics/variant-comparison/${variantGroup}`, {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch variant comparison");
  }
  
  return response.json();
}

async function fetchCsrfToken(): Promise<string> {
  const response = await fetch("/api/csrf-token", {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch CSRF token");
  }
  
  const data = await response.json();
  return data.csrfToken;
}

export function AdVariantManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [variantGroupName, setVariantGroupName] = useState("");
  const [variants, setVariants] = useState<VariantFormData[]>([
    {
      variantName: "A",
      title: "",
      imageUrl: "",
      linkUrl: "",
      type: "banner",
      placement: "homepage",
      displayOrder: 0,
    },
    {
      variantName: "B",
      title: "",
      imageUrl: "",
      linkUrl: "",
      type: "banner",
      placement: "homepage",
      displayOrder: 0,
    },
  ]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const { data: ads, isLoading } = useQuery({
    queryKey: ["admin-ads"],
    queryFn: fetchAds,
  });

  const variantGroups = ads
    ? Array.from(new Set(ads.filter(ad => ad.variantGroup).map(ad => ad.variantGroup)))
    : [];

  const createVariantGroupMutation = useMutation({
    mutationFn: async (data: { variantGroup: string; variants: VariantFormData[] }) => {
      const csrfToken = await fetchCsrfToken();
      
      const payload = {
        variantGroup: data.variantGroup,
        variants: data.variants.map(v => ({
          ...v,
          isActive: "true",
          displayOrder: Number(v.displayOrder) || 0,
        })),
      };
      
      const response = await fetch("/api/ads/variants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create variant group");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ads"] });
      toast({
        title: "Success",
        description: "Variant group created successfully",
      });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "error",
      });
    },
  });

  const addVariant = () => {
    const nextLetter = String.fromCharCode(65 + variants.length);
    setVariants([
      ...variants,
      {
        variantName: nextLetter,
        title: "",
        imageUrl: "",
        linkUrl: "",
        type: variants[0]?.type || "banner",
        placement: variants[0]?.placement || "homepage",
        displayOrder: variants[0]?.displayOrder || 0,
      },
    ]);
  };

  const removeVariant = (index: number) => {
    if (variants.length > 2) {
      setVariants(variants.filter((_, i) => i !== index));
    }
  };

  const updateVariant = (index: number, field: keyof VariantFormData, value: any) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], [field]: value };
    setVariants(updated);
  };

  const resetForm = () => {
    setVariantGroupName("");
    setVariants([
      {
        variantName: "A",
        title: "",
        imageUrl: "",
        linkUrl: "",
        type: "banner",
        placement: "homepage",
        displayOrder: 0,
      },
      {
        variantName: "B",
        title: "",
        imageUrl: "",
        linkUrl: "",
        type: "banner",
        placement: "homepage",
        displayOrder: 0,
      },
    ]);
  };

  const handleCreateVariantGroup = () => {
    if (!variantGroupName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a variant group name",
        variant: "error",
      });
      return;
    }

    const invalidVariant = variants.find(v => !v.title || !v.imageUrl || !v.linkUrl);
    if (invalidVariant) {
      toast({
        title: "Error",
        description: "All variants must have title, image, and link",
        variant: "error",
      });
      return;
    }

    createVariantGroupMutation.mutate({
      variantGroup: variantGroupName,
      variants,
    });
  };

  const toggleGroup = (group: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(group)) {
      newExpanded.delete(group);
    } else {
      newExpanded.add(group);
    }
    setExpandedGroups(newExpanded);
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card/80 backdrop-blur-md border-border/50">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl font-bold">A/B Testing</CardTitle>
              <CardDescription className="mt-2">
                Create and manage ad variant groups for A/B testing
              </CardDescription>
            </div>
            <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Create Variant Group
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading variant groups...</div>
          ) : variantGroups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No variant groups yet. Create your first A/B test!
            </div>
          ) : (
            <div className="space-y-4">
              {variantGroups.map((group) => (
                <VariantGroupCard
                  key={group}
                  variantGroup={group!}
                  ads={ads!}
                  expanded={expandedGroups.has(group!)}
                  onToggle={() => toggleGroup(group!)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create A/B Test Variant Group</DialogTitle>
            <DialogDescription>
              Create multiple ad variants to test which performs best
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="variantGroupName">Variant Group Name</Label>
              <Input
                id="variantGroupName"
                value={variantGroupName}
                onChange={(e) => setVariantGroupName(e.target.value)}
                placeholder="e.g., homepage-banner-test-1"
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Variants</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addVariant}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Variant
                </Button>
              </div>

              {variants.map((variant, index) => (
                <Card key={index} className="border-2">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Variant {variant.variantName}</CardTitle>
                      {variants.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeVariant(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Title</Label>
                        <Input
                          value={variant.title}
                          onChange={(e) => updateVariant(index, "title", e.target.value)}
                          placeholder="Ad title"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Link URL</Label>
                        <Input
                          value={variant.linkUrl}
                          onChange={(e) => updateVariant(index, "linkUrl", e.target.value)}
                          placeholder="https://..."
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Image</Label>
                      <ImageUpload
                        value={variant.imageUrl}
                        onChange={(url) => updateVariant(index, "imageUrl", url)}
                      />
                    </div>

                    {index === 0 && (
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Type</Label>
                          <Select
                            value={variant.type}
                            onValueChange={(value) => {
                              variants.forEach((_, i) => updateVariant(i, "type", value));
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="banner">Banner</SelectItem>
                              <SelectItem value="sidebar">Sidebar</SelectItem>
                              <SelectItem value="popup">Popup</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Placement</Label>
                          <Select
                            value={variant.placement}
                            onValueChange={(value) => {
                              variants.forEach((_, i) => updateVariant(i, "placement", value));
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="homepage">Homepage</SelectItem>
                              <SelectItem value="manga-page">Manga Page</SelectItem>
                              <SelectItem value="chapter-reader">Chapter Reader</SelectItem>
                              <SelectItem value="browse">Browse</SelectItem>
                              <SelectItem value="all">All Pages</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Display Order</Label>
                          <Input
                            type="number"
                            value={variant.displayOrder}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 0;
                              variants.forEach((_, i) => updateVariant(i, "displayOrder", value));
                            }}
                            min="0"
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateVariantGroup}
              disabled={createVariantGroupMutation.isPending}
            >
              {createVariantGroupMutation.isPending ? "Creating..." : "Create Variant Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VariantGroupCard({
  variantGroup,
  ads,
  expanded,
  onToggle,
}: {
  variantGroup: string;
  ads: Advertisement[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const { data: comparison, isLoading } = useQuery({
    queryKey: ["variant-comparison", variantGroup],
    queryFn: () => fetchVariantComparison(variantGroup),
    enabled: expanded,
  });

  const groupAds = ads.filter(ad => ad.variantGroup === variantGroup);
  const winner = comparison?.reduce((prev, current) => 
    (current.ctr > prev.ctr) ? current : prev
  , comparison[0]);

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">{variantGroup}</CardTitle>
            <Badge variant="outline">{groupAds.length} variants</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={onToggle}>
            {expanded ? "Hide Details" : "Show Details"}
          </Button>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">Loading comparison...</div>
          ) : !comparison || comparison.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No performance data yet
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {comparison.map((variant) => (
                <Card
                  key={variant.adId}
                  className={
                    winner?.variantName === variant.variantName
                      ? "border-green-500 border-2 bg-green-50 dark:bg-green-950/20"
                      : "border-border"
                  }
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Variant {variant.variantName}</CardTitle>
                      {winner?.variantName === variant.variantName && (
                        <Badge className="bg-green-600 hover:bg-green-700">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Winner
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs line-clamp-1">
                      {variant.title}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        Impressions
                      </span>
                      <span className="font-semibold">{variant.impressions.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <MousePointerClick className="w-3 h-3" />
                        Clicks
                      </span>
                      <span className="font-semibold">{variant.clicks.toLocaleString()}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">CTR</span>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold">{variant.ctr}%</span>
                        {winner?.variantName === variant.variantName ? (
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
