import { useState } from "react";
import { useLocation } from "wouter";
import { Trophy, Plus, Edit, Trash2, ArrowLeft, Calendar, Coins } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchWithCsrf } from "@/lib/csrf";

interface BattlePassSeason {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  premiumPrice: string;
  maxTier: number;
  createdAt: string;
}

export default function AdminBattlePass() {
  const { isAdmin, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showCreateSeasonDialog, setShowCreateSeasonDialog] = useState(false);
  const [showEditSeasonDialog, setShowEditSeasonDialog] = useState(false);
  const [editingSeason, setEditingSeason] = useState<BattlePassSeason | null>(null);

  const [seasonFormData, setSeasonFormData] = useState({
    name: "",
    startDate: "",
    endDate: "",
    premiumPrice: "9.99",
    maxTier: "50",
  });

  const { data: seasons, isLoading } = useQuery<BattlePassSeason[]>({
    queryKey: ["/api/admin/battle-pass/seasons"],
    queryFn: async () => {
      const response = await fetch("/api/admin/battle-pass/seasons", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch seasons");
      return response.json();
    },
    enabled: isAdmin && isAuthenticated,
  });

  const createSeasonMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetchWithCsrf("/api/admin/battle-pass/seasons", {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create season");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/battle-pass/seasons"] });
      toast({
        title: "Success",
        description: "Battle Pass season created successfully",
      });
      setShowCreateSeasonDialog(false);
      resetSeasonForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "error",
      });
    },
  });

  const updateSeasonMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await fetchWithCsrf(`/api/admin/battle-pass/seasons/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update season");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/battle-pass/seasons"] });
      toast({
        title: "Success",
        description: "Battle Pass season updated successfully",
      });
      setShowEditSeasonDialog(false);
      setEditingSeason(null);
      resetSeasonForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "error",
      });
    },
  });

  const deleteSeasonMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchWithCsrf(`/api/admin/battle-pass/seasons/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete season");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/battle-pass/seasons"] });
      toast({
        title: "Success",
        description: "Battle Pass season deleted successfully",
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

  const resetSeasonForm = () => {
    setSeasonFormData({
      name: "",
      startDate: "",
      endDate: "",
      premiumPrice: "9.99",
      maxTier: "50",
    });
  };

  const handleCreateSeason = () => {
    createSeasonMutation.mutate({
      ...seasonFormData,
      premiumPrice: seasonFormData.premiumPrice,
      maxTier: parseInt(seasonFormData.maxTier),
    });
  };

  const handleEditSeason = (season: BattlePassSeason) => {
    setEditingSeason(season);
    setSeasonFormData({
      name: season.name,
      startDate: season.startDate.split('T')[0],
      endDate: season.endDate.split('T')[0],
      premiumPrice: season.premiumPrice,
      maxTier: season.maxTier.toString(),
    });
    setShowEditSeasonDialog(true);
  };

  const handleUpdateSeason = () => {
    if (!editingSeason) return;
    updateSeasonMutation.mutate({
      id: editingSeason.id,
      data: {
        ...seasonFormData,
        premiumPrice: seasonFormData.premiumPrice,
        maxTier: parseInt(seasonFormData.maxTier),
      },
    });
  };

  if (!isAuthenticated || !isAdmin) {
    navigate("/");
    return null;
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
                <Trophy className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                Battle Pass Management
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Manage seasons, tiers, and rewards</p>
            </div>
          </div>
          <Button onClick={() => setShowCreateSeasonDialog(true)} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            Create Season
          </Button>
        </div>

        <Tabs defaultValue="seasons" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:grid-cols-2">
            <TabsTrigger value="seasons">Seasons</TabsTrigger>
            <TabsTrigger value="tiers">Tiers & Rewards</TabsTrigger>
          </TabsList>

          <TabsContent value="seasons" className="space-y-4">
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-48" />
                ))}
              </div>
            ) : seasons && seasons.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {seasons.map((season) => {
                  const isActive = new Date(season.startDate) <= new Date() && new Date() <= new Date(season.endDate);
                  return (
                    <Card key={season.id} className="bg-card/80 backdrop-blur-md border-border/50">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-xl">{season.name}</CardTitle>
                            <CardDescription className="mt-1">
                              {season.maxTier} tiers
                            </CardDescription>
                          </div>
                          <Badge variant={isActive ? "default" : "secondary"}>
                            {isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              {new Date(season.startDate).toLocaleDateString()} - {new Date(season.endDate).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Coins className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              Premium Price: ${season.premiumPrice}
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditSeason(season)}
                            className="flex-1"
                          >
                            <Edit className="w-3 h-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteSeasonMutation.mutate(season.id)}
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
                  <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No battle pass seasons found</p>
                  <Button onClick={() => setShowCreateSeasonDialog(true)} className="mt-4">
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Season
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="tiers" className="space-y-4">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Tier management coming soon</p>
                <p className="text-sm text-muted-foreground mt-2">Select a season to manage its tiers and rewards</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showCreateSeasonDialog} onOpenChange={setShowCreateSeasonDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Battle Pass Season</DialogTitle>
            <DialogDescription>Add a new battle pass season with tiers and rewards</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="season-name">Season Name *</Label>
              <Input
                id="season-name"
                value={seasonFormData.name}
                onChange={(e) => setSeasonFormData({ ...seasonFormData, name: e.target.value })}
                placeholder="Season 1: Spring Awakening"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date *</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={seasonFormData.startDate}
                  onChange={(e) => setSeasonFormData({ ...seasonFormData, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date *</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={seasonFormData.endDate}
                  onChange={(e) => setSeasonFormData({ ...seasonFormData, endDate: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="premium-price">Premium Price (USD) *</Label>
                <Input
                  id="premium-price"
                  type="number"
                  step="0.01"
                  value={seasonFormData.premiumPrice}
                  onChange={(e) => setSeasonFormData({ ...seasonFormData, premiumPrice: e.target.value })}
                  placeholder="9.99"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-tier">Max Tier *</Label>
                <Input
                  id="max-tier"
                  type="number"
                  value={seasonFormData.maxTier}
                  onChange={(e) => setSeasonFormData({ ...seasonFormData, maxTier: e.target.value })}
                  placeholder="50"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateSeasonDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSeason} disabled={createSeasonMutation.isPending}>
              {createSeasonMutation.isPending ? "Creating..." : "Create Season"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditSeasonDialog} onOpenChange={setShowEditSeasonDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Battle Pass Season</DialogTitle>
            <DialogDescription>Update season details</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-season-name">Season Name *</Label>
              <Input
                id="edit-season-name"
                value={seasonFormData.name}
                onChange={(e) => setSeasonFormData({ ...seasonFormData, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-start-date">Start Date *</Label>
                <Input
                  id="edit-start-date"
                  type="date"
                  value={seasonFormData.startDate}
                  onChange={(e) => setSeasonFormData({ ...seasonFormData, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-end-date">End Date *</Label>
                <Input
                  id="edit-end-date"
                  type="date"
                  value={seasonFormData.endDate}
                  onChange={(e) => setSeasonFormData({ ...seasonFormData, endDate: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-premium-price">Premium Price (USD) *</Label>
                <Input
                  id="edit-premium-price"
                  type="number"
                  step="0.01"
                  value={seasonFormData.premiumPrice}
                  onChange={(e) => setSeasonFormData({ ...seasonFormData, premiumPrice: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-max-tier">Max Tier *</Label>
                <Input
                  id="edit-max-tier"
                  type="number"
                  value={seasonFormData.maxTier}
                  onChange={(e) => setSeasonFormData({ ...seasonFormData, maxTier: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditSeasonDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateSeason} disabled={updateSeasonMutation.isPending}>
              {updateSeasonMutation.isPending ? "Updating..." : "Update Season"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
