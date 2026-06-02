import { useState } from "react";
import { useLocation } from "wouter";
import { Plus, Edit, Trash2, Coins, Package, DollarSign, TrendingUp, ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrencyPackages } from "@/hooks/useCurrency";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

interface CurrencyPackage {
  id: string;
  name: string;
  currencyAmount: number;
  priceUSD: string;
  bonusPercentage: number;
  isActive: string;
  displayOrder: number;
}

export default function CurrencyManagement() {
  const [, navigate] = useLocation();
  const { isAdmin, isAuthenticated } = useAuth();
  const { data: packages, isLoading } = useCurrencyPackages(false);
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<CurrencyPackage | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    currencyAmount: "",
    priceUSD: "",
    bonusPercentage: "0",
    isActive: "true",
    displayOrder: "0",
  });

  const handleCreate = async () => {
    try {
      await apiRequest("POST", "/api/currency/packages", {
        ...formData,
        currencyAmount: parseInt(formData.currencyAmount),
        bonusPercentage: parseInt(formData.bonusPercentage),
        displayOrder: parseInt(formData.displayOrder),
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/currency/packages"] });
      setShowCreateDialog(false);
      setFormData({
        name: "",
        currencyAmount: "",
        priceUSD: "",
        bonusPercentage: "0",
        isActive: "true",
        displayOrder: "0",
      });
      
      toast({
        title: "Package Created",
        description: "Currency package has been created successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create package",
        variant: "error",
      });
    }
  };

  const handleEdit = async () => {
    if (!selectedPackage) return;
    
    try {
      await apiRequest("PATCH", `/api/currency/packages/${selectedPackage.id}`, {
        ...formData,
        currencyAmount: parseInt(formData.currencyAmount),
        bonusPercentage: parseInt(formData.bonusPercentage),
        displayOrder: parseInt(formData.displayOrder),
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/currency/packages"] });
      setShowEditDialog(false);
      setSelectedPackage(null);
      
      toast({
        title: "Package Updated",
        description: "Currency package has been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update package",
        variant: "error",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this package?")) return;
    
    try {
      await apiRequest("DELETE", `/api/currency/packages/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/currency/packages"] });
      
      toast({
        title: "Package Deleted",
        description: "Currency package has been deleted successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete package",
        variant: "error",
      });
    }
  };

  const openEditDialog = (pkg: CurrencyPackage) => {
    setSelectedPackage(pkg);
    setFormData({
      name: pkg.name,
      currencyAmount: pkg.currencyAmount.toString(),
      priceUSD: pkg.priceUSD,
      bonusPercentage: pkg.bonusPercentage.toString(),
      isActive: pkg.isActive,
      displayOrder: pkg.displayOrder.toString(),
    });
    setShowEditDialog(true);
  };

  const calculateTotalCoins = (base: number, bonus: number) => {
    return base + Math.floor((base * bonus) / 100);
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
              You need admin privileges to access currency management
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
    <div className="space-y-6">
      <Button
        variant="ghost"
        onClick={() => navigate("/admin")}
        className="w-fit text-muted-foreground hover:text-primary mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>
      
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Currency Packages</h2>
          <p className="text-muted-foreground">Manage shop packages for currency purchases</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Package
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Packages</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{packages?.length || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Packages</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {packages?.filter(p => p.isActive === 'true').length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Currency Packages</CardTitle>
          <CardDescription>Configure packages available in the shop</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Loading...</div>
          ) : packages && packages.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Coins</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Bonus</TableHead>
                  <TableHead>Total Coins</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packages.map((pkg) => (
                  <TableRow key={pkg.id}>
                    <TableCell className="font-medium">{pkg.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Coins className="w-4 h-4 text-primary" />
                        {pkg.currencyAmount}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4 text-green-500" />
                        {pkg.priceUSD}
                      </div>
                    </TableCell>
                    <TableCell>
                      {pkg.bonusPercentage > 0 ? (
                        <Badge variant="secondary">+{pkg.bonusPercentage}%</Badge>
                      ) : (
                        <span className="text-muted-foreground">No bonus</span>
                      )}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {calculateTotalCoins(pkg.currencyAmount, pkg.bonusPercentage)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={pkg.isActive === 'true' ? 'default' : 'secondary'}>
                        {pkg.isActive === 'true' ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>{pkg.displayOrder}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(pkg)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(pkg.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No currency packages found. Create one to get started.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Currency Package</DialogTitle>
            <DialogDescription>Add a new package to the shop</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Package Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Starter Pack"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="currencyAmount">Base Coins</Label>
                <Input
                  id="currencyAmount"
                  type="number"
                  value={formData.currencyAmount}
                  onChange={(e) => setFormData({ ...formData, currencyAmount: e.target.value })}
                  placeholder="100"
                />
              </div>
              <div>
                <Label htmlFor="bonusPercentage">Bonus %</Label>
                <Input
                  id="bonusPercentage"
                  type="number"
                  value={formData.bonusPercentage}
                  onChange={(e) => setFormData({ ...formData, bonusPercentage: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="priceUSD">Price (USD)</Label>
                <Input
                  id="priceUSD"
                  value={formData.priceUSD}
                  onChange={(e) => setFormData({ ...formData, priceUSD: e.target.value })}
                  placeholder="4.99"
                />
              </div>
              <div>
                <Label htmlFor="displayOrder">Display Order</Label>
                <Input
                  id="displayOrder"
                  type="number"
                  value={formData.displayOrder}
                  onChange={(e) => setFormData({ ...formData, displayOrder: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="isActive">Status</Label>
              <Select
                value={formData.isActive}
                onValueChange={(value) => setFormData({ ...formData, isActive: value })}
              >
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
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>Create Package</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Currency Package</DialogTitle>
            <DialogDescription>Update package details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Package Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-currencyAmount">Base Coins</Label>
                <Input
                  id="edit-currencyAmount"
                  type="number"
                  value={formData.currencyAmount}
                  onChange={(e) => setFormData({ ...formData, currencyAmount: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-bonusPercentage">Bonus %</Label>
                <Input
                  id="edit-bonusPercentage"
                  type="number"
                  value={formData.bonusPercentage}
                  onChange={(e) => setFormData({ ...formData, bonusPercentage: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-priceUSD">Price (USD)</Label>
                <Input
                  id="edit-priceUSD"
                  value={formData.priceUSD}
                  onChange={(e) => setFormData({ ...formData, priceUSD: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-displayOrder">Display Order</Label>
                <Input
                  id="edit-displayOrder"
                  type="number"
                  value={formData.displayOrder}
                  onChange={(e) => setFormData({ ...formData, displayOrder: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-isActive">Status</Label>
              <Select
                value={formData.isActive}
                onValueChange={(value) => setFormData({ ...formData, isActive: value })}
              >
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
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit}>Update Package</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
