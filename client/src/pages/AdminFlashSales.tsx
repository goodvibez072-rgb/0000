import { useState } from "react";
import { useLocation } from "wouter";
import { Zap, Plus, Edit, Trash2, ArrowLeft, Clock, Percent, ShoppingBag, Shield } from "lucide-react";
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

interface FlashSale {
  id: string;
  name: string;
  description: string | null;
  type: string;
  targetId: string | null;
  discountPercentage: number;
  originalPrice: string;
  salePrice: string;
  startTime: string;
  endTime: string;
  maxPurchases: number | null;
  currentPurchases: number;
  isActive: string;
  createdAt: string;
}

interface CurrencyPackage {
  id: string;
  name: string;
  currencyAmount: number;
  priceUSD: string;
}

export default function AdminFlashSales() {
  const { isAdmin, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingSale, setEditingSale] = useState<FlashSale | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    targetId: "",
    discountPercentage: "20",
    startTime: "",
    endTime: "",
    maxPurchases: "",
  });

  const { data: flashSales, isLoading: loadingSales } = useQuery<FlashSale[]>({
    queryKey: ["/api/admin/flash-sales"],
    queryFn: async () => {
      const response = await fetch("/api/admin/flash-sales", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch flash sales");
      return response.json();
    },
    enabled: isAdmin && isAuthenticated,
  });

  const { data: packages } = useQuery<CurrencyPackage[]>({
    queryKey: ["/api/currency/packages"],
    queryFn: async () => {
      const response = await fetch("/api/currency/packages", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch packages");
      return response.json();
    },
    enabled: isAdmin && isAuthenticated,
  });

  const createSaleMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetchWithCsrf("/api/admin/flash-sales/create", {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create flash sale");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/flash-sales"] });
      toast({
        title: "Success",
        description: "Flash sale created successfully",
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

  const updateSaleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await fetchWithCsrf(`/api/admin/flash-sales/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update flash sale");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/flash-sales"] });
      toast({
        title: "Success",
        description: "Flash sale updated successfully",
      });
      setShowEditDialog(false);
      setEditingSale(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "error",
      });
    },
  });

  const deleteSaleMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchWithCsrf(`/api/admin/flash-sales/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete flash sale");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/flash-sales"] });
      toast({
        title: "Success",
        description: "Flash sale deleted successfully",
      });
    },
    onError: (error: Error) => {
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
      targetId: "",
      discountPercentage: "20",
      startTime: "",
      endTime: "",
      maxPurchases: "",
    });
  };

  const handleCreate = () => {
    if (!formData.targetId || !formData.startTime || !formData.endTime) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "error",
      });
      return;
    }

    const selectedPackage = packages?.find((p) => p.id === formData.targetId);
    if (!selectedPackage) return;

    const originalPrice = parseFloat(selectedPackage.priceUSD);
    const discount = parseFloat(formData.discountPercentage) / 100;
    const salePrice = (originalPrice * (1 - discount)).toFixed(2);

    createSaleMutation.mutate({
      name: formData.name || `${selectedPackage.name} Flash Sale`,
      description: formData.description || null,
      type: "coin_package",
      targetId: formData.targetId,
      discountPercentage: parseInt(formData.discountPercentage),
      originalPrice: selectedPackage.priceUSD,
      salePrice: salePrice,
      startTime: new Date(formData.startTime).toISOString(),
      endTime: new Date(formData.endTime).toISOString(),
      maxPurchases: formData.maxPurchases ? parseInt(formData.maxPurchases) : null,
    });
  };

  const handleEdit = (sale: FlashSale) => {
    setEditingSale(sale);
    setFormData({
      name: sale.name,
      description: sale.description || "",
      targetId: sale.targetId || "",
      discountPercentage: sale.discountPercentage.toString(),
      startTime: new Date(sale.startTime).toISOString().slice(0, 16),
      endTime: new Date(sale.endTime).toISOString().slice(0, 16),
      maxPurchases: sale.maxPurchases?.toString() || "",
    });
    setShowEditDialog(true);
  };

  const handleUpdate = () => {
    if (!editingSale) return;

    const selectedPackage = packages?.find((p) => p.id === formData.targetId);
    if (!selectedPackage) return;

    const originalPrice = parseFloat(selectedPackage.priceUSD);
    const discount = parseFloat(formData.discountPercentage) / 100;
    const salePrice = (originalPrice * (1 - discount)).toFixed(2);

    updateSaleMutation.mutate({
      id: editingSale.id,
      data: {
        name: formData.name,
        description: formData.description || null,
        discountPercentage: parseInt(formData.discountPercentage),
        salePrice: salePrice,
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
        maxPurchases: formData.maxPurchases ? parseInt(formData.maxPurchases) : null,
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
              You need admin privileges to access flash sales management
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

  if (loadingSales) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900 p-8">
        <div className="max-w-7xl mx-auto">
          <Skeleton className="h-12 w-96 mb-8 bg-gray-800" />
          <div className="grid gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 bg-gray-800" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900 p-2 sm:p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/admin/monetization")}
            className="text-gray-400 hover:text-white mb-4 min-h-11 w-full sm:w-auto justify-start"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Monetization
          </Button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2">Flash Sales Management</h1>
              <p className="text-gray-400">Create and manage limited-time offers</p>
            </div>
            <Button
              onClick={() => {
                resetForm();
                setShowCreateDialog(true);
              }}
              className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Flash Sale
            </Button>
          </div>
        </div>

        <div className="grid gap-6">
          {!flashSales || flashSales.length === 0 ? (
            <Card className="bg-gray-900/50 border-gray-800 text-center p-16">
              <Zap className="w-16 h-16 mx-auto mb-4 text-gray-600" />
              <h3 className="text-2xl font-bold text-white mb-2">No Flash Sales</h3>
              <p className="text-gray-400 mb-6">Create your first flash sale to boost revenue</p>
              <Button
                onClick={() => setShowCreateDialog(true)}
                className="bg-primary"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Flash Sale
              </Button>
            </Card>
          ) : (
            flashSales.map((sale) => {
              const isActive = sale.isActive === "true";
              const hasStarted = new Date(sale.startTime) <= new Date();
              const hasEnded = new Date(sale.endTime) <= new Date();
              const stockPercent = sale.maxPurchases
                ? ((sale.maxPurchases - sale.currentPurchases) / sale.maxPurchases) * 100
                : 100;

              return (
                <Card
                  key={sale.id}
                  className={`bg-gray-900/50 border-gray-800 ${
                    isActive && hasStarted && !hasEnded ? "border-red-500/30" : ""
                  }`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-xl font-bold text-white">{sale.name}</h3>
                          {isActive && hasStarted && !hasEnded && (
                            <Badge className="bg-red-500/20 text-red-500 border-red-500/30 animate-pulse">
                              LIVE
                            </Badge>
                          )}
                          {hasEnded && (
                            <Badge className="bg-gray-500/20 text-gray-500 border-gray-500/30">
                              ENDED
                            </Badge>
                          )}
                          {!hasStarted && (
                            <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">
                              SCHEDULED
                            </Badge>
                          )}
                        </div>

                        {sale.description && (
                          <p className="text-gray-400 mb-4">{sale.description}</p>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm text-gray-400">Discount</p>
                            <div className="flex items-center gap-1">
                              <Percent className="w-4 h-4 text-red-500" />
                              <p className="text-lg font-bold text-white">
                                {sale.discountPercentage}%
                              </p>
                            </div>
                          </div>

                          <div>
                            <p className="text-sm text-gray-400">Price</p>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 line-through">
                                ${sale.originalPrice}
                              </span>
                              <span className="text-lg font-bold text-green-500">
                                ${sale.salePrice}
                              </span>
                            </div>
                          </div>

                          <div>
                            <p className="text-sm text-gray-400">Period</p>
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4 text-primary" />
                              <p className="text-sm text-white">
                                {new Date(sale.startTime).toLocaleDateString()} -{" "}
                                {new Date(sale.endTime).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div>
                            <p className="text-sm text-gray-400">Stock</p>
                            <div className="flex items-center gap-1">
                              <ShoppingBag className="w-4 h-4 text-amber-500" />
                              <p className="text-sm text-white">
                                {sale.maxPurchases
                                  ? `${sale.maxPurchases - sale.currentPurchases}/${sale.maxPurchases}`
                                  : "Unlimited"}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(sale)}
                          className="border-gray-700 text-gray-300"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this flash sale?")) {
                              deleteSaleMutation.mutate(sale.id);
                            }
                          }}
                          className="border-gray-700 text-red-500 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white w-[95vw] max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Flash Sale</DialogTitle>
            <DialogDescription className="text-gray-400">
              Set up a limited-time offer for a currency package
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Sale Name (optional)</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Weekend Special"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>

            <div>
              <Label>Description (optional)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the sale"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>

            <div>
              <Label>Select Package *</Label>
              <Select value={formData.targetId} onValueChange={(value) => setFormData({ ...formData, targetId: value })}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Choose a currency package" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {packages?.map((pkg) => (
                    <SelectItem key={pkg.id} value={pkg.id} className="text-white">
                      {pkg.name} - {pkg.currencyAmount} coins (${pkg.priceUSD})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Discount Percentage *</Label>
              <Input
                type="number"
                value={formData.discountPercentage}
                onChange={(e) => setFormData({ ...formData, discountPercentage: e.target.value })}
                placeholder="20"
                min="1"
                max="90"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Time *</Label>
                <Input
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label>End Time *</Label>
                <Input
                  type="datetime-local"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>

            <div>
              <Label>Max Purchases (optional)</Label>
              <Input
                type="number"
                value={formData.maxPurchases}
                onChange={(e) => setFormData({ ...formData, maxPurchases: e.target.value })}
                placeholder="Leave empty for unlimited"
                min="1"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>

            {formData.targetId && formData.discountPercentage && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                <p className="text-sm text-gray-300">
                  Sale Price: $
                  {(
                    parseFloat(packages?.find((p) => p.id === formData.targetId)?.priceUSD || "0") *
                    (1 - parseFloat(formData.discountPercentage) / 100)
                  ).toFixed(2)}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="border-gray-700">
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createSaleMutation.isPending}
              className="bg-gradient-to-r from-red-500 to-orange-500"
            >
              {createSaleMutation.isPending ? "Creating..." : "Create Flash Sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white w-[95vw] max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Flash Sale</DialogTitle>
            <DialogDescription className="text-gray-400">
              Update flash sale details
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Sale Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>

            <div>
              <Label>Discount Percentage</Label>
              <Input
                type="number"
                value={formData.discountPercentage}
                onChange={(e) => setFormData({ ...formData, discountPercentage: e.target.value })}
                min="1"
                max="90"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Time</Label>
                <Input
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label>End Time</Label>
                <Input
                  type="datetime-local"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>

            <div>
              <Label>Max Purchases</Label>
              <Input
                type="number"
                value={formData.maxPurchases}
                onChange={(e) => setFormData({ ...formData, maxPurchases: e.target.value })}
                placeholder="Leave empty for unlimited"
                min="1"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} className="border-gray-700">
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateSaleMutation.isPending}
              className="bg-primary"
            >
              {updateSaleMutation.isPending ? "Updating..." : "Update Flash Sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
