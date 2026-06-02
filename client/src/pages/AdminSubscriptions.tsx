import { useState } from "react";
import { useLocation } from "wouter";
import { Crown, Plus, Edit, Trash2, ArrowLeft, DollarSign, Star, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchWithCsrf } from "@/lib/csrf";

interface SubscriptionPackage {
  id: string;
  name: string;
  description: string | null;
  priceUSD: string;
  billingCycle: string;
  features: string;
  coinBonus: number;
  discountPercentage: number;
}

export default function AdminSubscriptions() {
  const { isAdmin, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingPackage, setEditingPackage] = useState<SubscriptionPackage | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    priceUSD: "",
    billingCycle: "monthly",
    features: "",
    coinBonus: "0",
    discountPercentage: "0",
  });

  const { data: packages, isLoading } = useQuery<SubscriptionPackage[]>({
    queryKey: ["/api/admin/subscriptions"],
    queryFn: async () => {
      const response = await fetch("/api/admin/subscriptions", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch packages");
      return response.json();
    },
    enabled: isAdmin && isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetchWithCsrf("/api/admin/subscriptions", {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create package");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
      toast({
        title: "Success",
        description: "Subscription package created successfully",
      });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "error",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await fetchWithCsrf(`/api/admin/subscriptions/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update package");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
      toast({
        title: "Success",
        description: "Subscription package updated successfully",
      });
      setShowEditDialog(false);
      setEditingPackage(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "error",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchWithCsrf(`/api/admin/subscriptions/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete package");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
      toast({
        title: "Success",
        description: "Subscription package deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "error",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      priceUSD: "",
      billingCycle: "monthly",
      features: "",
      coinBonus: "0",
      discountPercentage: "0",
    });
  };

  const handleCreate = () => {
    const features = formData.features.split('\n').filter(f => f.trim());
    createMutation.mutate({
      ...formData,
      priceUSD: formData.priceUSD,
      coinBonus: parseInt(formData.coinBonus),
      discountPercentage: parseInt(formData.discountPercentage),
      features,
    });
  };

  const handleEdit = (pkg: SubscriptionPackage) => {
    setEditingPackage(pkg);
    const features = typeof pkg.features === 'string' ? JSON.parse(pkg.features) : pkg.features;
    setFormData({
      name: pkg.name,
      description: pkg.description || "",
      priceUSD: pkg.priceUSD,
      billingCycle: pkg.billingCycle,
      features: Array.isArray(features) ? features.join('\n') : '',
      coinBonus: pkg.coinBonus.toString(),
      discountPercentage: pkg.discountPercentage.toString(),
    });
    setShowEditDialog(true);
  };

  const handleUpdate = () => {
    if (!editingPackage) return;
    const features = formData.features.split('\n').filter(f => f.trim());
    updateMutation.mutate({
      id: editingPackage.id,
      data: {
        ...formData,
        priceUSD: formData.priceUSD,
        coinBonus: parseInt(formData.coinBonus),
        discountPercentage: parseInt(formData.discountPercentage),
        features,
      },
    });
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
              You need admin privileges to access subscription management
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                <Crown className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                VIP Subscription Management
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Manage subscription tiers and pricing</p>
            </div>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            Create Package
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        ) : packages && packages.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {packages.map((pkg) => {
              const features = typeof pkg.features === 'string' ? JSON.parse(pkg.features) : pkg.features;
              return (
                <Card key={pkg.id} className="bg-card/80 backdrop-blur-md border-border/50">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-xl">{pkg.name}</CardTitle>
                        <CardDescription className="mt-1">{pkg.description}</CardDescription>
                      </div>
                      <Badge variant="secondary" className="ml-2">
                        {pkg.billingCycle}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold">${pkg.priceUSD}</span>
                      <span className="text-muted-foreground">/{pkg.billingCycle}</span>
                    </div>

                    {Array.isArray(features) && features.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Features:</p>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {features.slice(0, 3).map((feature, idx) => (
                            <li key={idx} className="flex items-center gap-2">
                              <Star className="w-3 h-3 text-primary" />
                              {feature}
                            </li>
                          ))}
                          {features.length > 3 && (
                            <li className="text-xs">+{features.length - 3} more...</li>
                          )}
                        </ul>
                      </div>
                    )}

                    <div className="flex gap-2 text-sm">
                      <Badge variant="outline">+{pkg.coinBonus} coins</Badge>
                      {pkg.discountPercentage > 0 && (
                        <Badge variant="outline">{pkg.discountPercentage}% off</Badge>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(pkg)}
                        className="flex-1"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteMutation.mutate(pkg.id)}
                        className="flex-1"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Crown className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No subscription packages found</p>
              <Button onClick={() => setShowCreateDialog(true)} className="mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Create First Package
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Subscription Package</DialogTitle>
            <DialogDescription>Add a new VIP subscription tier</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Package Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Premium"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priceUSD">Price (USD) *</Label>
                <Input
                  id="priceUSD"
                  type="number"
                  step="0.01"
                  value={formData.priceUSD}
                  onChange={(e) => setFormData({ ...formData, priceUSD: e.target.value })}
                  placeholder="9.99"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Best for regular readers"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="billingCycle">Billing Cycle</Label>
                <Select
                  value={formData.billingCycle}
                  onValueChange={(value) => setFormData({ ...formData, billingCycle: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="coinBonus">Coin Bonus</Label>
                <Input
                  id="coinBonus"
                  type="number"
                  value={formData.coinBonus}
                  onChange={(e) => setFormData({ ...formData, coinBonus: e.target.value })}
                  placeholder="100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="discountPercentage">Discount %</Label>
                <Input
                  id="discountPercentage"
                  type="number"
                  value={formData.discountPercentage}
                  onChange={(e) => setFormData({ ...formData, discountPercentage: e.target.value })}
                  placeholder="10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="features">Features (one per line)</Label>
              <Textarea
                id="features"
                value={formData.features}
                onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                placeholder="Ad-free reading&#10;Early access to new chapters&#10;Exclusive content"
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Package"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Subscription Package</DialogTitle>
            <DialogDescription>Update package details</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Package Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-priceUSD">Price (USD) *</Label>
                <Input
                  id="edit-priceUSD"
                  type="number"
                  step="0.01"
                  value={formData.priceUSD}
                  onChange={(e) => setFormData({ ...formData, priceUSD: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-billingCycle">Billing Cycle</Label>
                <Select
                  value={formData.billingCycle}
                  onValueChange={(value) => setFormData({ ...formData, billingCycle: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-coinBonus">Coin Bonus</Label>
                <Input
                  id="edit-coinBonus"
                  type="number"
                  value={formData.coinBonus}
                  onChange={(e) => setFormData({ ...formData, coinBonus: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-discountPercentage">Discount %</Label>
                <Input
                  id="edit-discountPercentage"
                  type="number"
                  value={formData.discountPercentage}
                  onChange={(e) => setFormData({ ...formData, discountPercentage: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-features">Features (one per line)</Label>
              <Textarea
                id="edit-features"
                value={formData.features}
                onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Updating..." : "Update Package"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
