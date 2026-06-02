import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Lock, LockOpen, Search, DollarSign, Coins, CheckSquare, Square, ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

export default function ChapterAccessManagement() {
  const [, navigate] = useLocation();
  const { isAdmin, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [searchSeriesId, setSearchSeriesId] = useState("");
  const [seriesList, setSeriesList] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<any>(null);
  const [showAccessDialog, setShowAccessDialog] = useState(false);
  const [accessType, setAccessType] = useState("free");
  const [unlockCost, setUnlockCost] = useState("0");
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkAccessType, setBulkAccessType] = useState("free");
  const [bulkUnlockCost, setBulkUnlockCost] = useState("0");
  const [loadingSeries, setLoadingSeries] = useState(false);

  // Load all series on component mount
  const loadSeriesList = useCallback(async () => {
    setLoadingSeries(true);
    try {
      const response = await fetch('/api/series', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setSeriesList(data);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to load series:', error);
      }
    } finally {
      setLoadingSeries(false);
    }
  }, []);

  // Load series list on mount
  useEffect(() => {
    loadSeriesList();
  }, [loadSeriesList]);

  const handleSearchSeries = async () => {
    if (!searchSeriesId.trim()) {
      toast({
        title: "Error",
        description: "Please select a series",
        variant: "error",
      });
      return;
    }

    try {
      const response = await fetch(`/api/series/${searchSeriesId}/chapters`, {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Series not found");
      }
      
      const data = await response.json();
      setChapters(data);
      
      toast({
        title: "Series Loaded",
        description: `Found ${data.length} chapters`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load series",
        variant: "error",
      });
    }
  };

  const openAccessDialog = async (chapter: any) => {
    setSelectedChapter(chapter);
    
    // Fetch current access control for this chapter
    try {
      const response = await fetch(`/api/chapters/${chapter.id}/access`, {
        credentials: "include",
      });
      
      if (response.ok) {
        const data = await response.json();
        setAccessType(data.accessType || "free");
        setUnlockCost((data.unlockCost || 0).toString());
      } else {
        setAccessType("free");
        setUnlockCost("0");
      }
    } catch (error) {
      setAccessType("free");
      setUnlockCost("0");
    }
    
    setShowAccessDialog(true);
  };

  const handleSetAccess = async () => {
    if (!selectedChapter) return;

    const cost = accessType === "free" ? 0 : parseInt(unlockCost);
    
    if (accessType !== "free" && (!cost || cost < 0)) {
      toast({
        title: "Error",
        description: "Please enter a valid unlock cost for non-free chapters",
        variant: "error",
      });
      return;
    }

    try {
      await apiRequest("POST", `/api/admin/chapters/${selectedChapter.id}/access`, {
        accessType,
        unlockCost: cost,
      });
      
      // Refresh chapters
      handleSearchSeries();
      setShowAccessDialog(false);
      
      toast({
        title: "Access Updated",
        description: `Chapter access set to ${accessType}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update access",
        variant: "error",
      });
    }
  };

  const toggleChapterSelection = (chapterId: string) => {
    setSelectedChapterIds(prev => 
      prev.includes(chapterId) 
        ? prev.filter(id => id !== chapterId)
        : [...prev, chapterId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedChapterIds.length === chapters.length) {
      setSelectedChapterIds([]);
    } else {
      setSelectedChapterIds(chapters.map(c => c.id));
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedChapterIds.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one chapter",
        variant: "error",
      });
      return;
    }

    const cost = bulkAccessType === "free" ? 0 : parseInt(bulkUnlockCost);
    
    if (bulkAccessType !== "free" && (!cost || cost < 0)) {
      toast({
        title: "Error",
        description: "Please enter a valid unlock cost for non-free chapters",
        variant: "error",
      });
      return;
    }

    try {
      const response: any = await apiRequest("POST", `/api/admin/chapters/bulk-access`, {
        chapterIds: selectedChapterIds,
        accessType: bulkAccessType,
        unlockCost: cost,
      });
      
      handleSearchSeries();
      setShowBulkDialog(false);
      setSelectedChapterIds([]);
      setBulkAccessType("free");
      setBulkUnlockCost("0");
      
      // Show appropriate toast based on results
      if (response.failureCount > 0) {
        const failures = response.results.filter((r: any) => !r.success);
        const displayFailures = failures.slice(0, 3);
        const hasMore = failures.length > 3;
        
        toast({
          title: "Partial Success",
          description: (
            <div className="space-y-2">
              <p>{response.message}</p>
              <div className="text-xs mt-2 space-y-1">
                <p className="font-semibold">Failed chapters:</p>
                {displayFailures.map((f: any, i: number) => {
                  const chapter = chapters.find(c => c.id === f.chapterId);
                  return (
                    <p key={i}>• Chapter {chapter?.chapterNumber || f.chapterId}: {f.error}</p>
                  );
                })}
                {hasMore && (
                  <p className="text-muted-foreground">...and {failures.length - 3} more</p>
                )}
              </div>
            </div>
          ),
          variant: "default",
        });
      } else {
        toast({
          title: "Bulk Update Complete",
          description: response.message,
        });
      }
    } catch (error: any) {
      // Parse error response
      const errorMessage = error.message || "Failed to update chapters";
      const isValidationError = errorMessage.includes("Invalid input");
      
      toast({
        title: isValidationError ? "Validation Error" : "Update Failed",
        description: errorMessage,
        variant: "error",
      });
    }
  };

  const getAccessBadge = (type: string) => {
    switch (type) {
      case "free":
        return <Badge variant="secondary"><LockOpen className="w-3 h-3 mr-1" /> Free</Badge>;
      case "premium":
        return <Badge className="bg-primary"><DollarSign className="w-3 h-3 mr-1" /> Premium</Badge>;
      case "locked":
        return <Badge variant="destructive"><Lock className="w-3 h-3 mr-1" /> Locked</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-card/80 backdrop-blur-md border-border/50">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="w-8 h-8 text-primary animate-pulse" />
            </div>
            <CardTitle className="text-2xl">Loading...</CardTitle>
            <CardDescription className="mt-2">
              Verifying your permissions
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

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
              You need admin privileges to access chapter access management
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
      
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Chapter Access Control</h2>
        <p className="text-muted-foreground">Manage chapter pricing and access types (free, premium, locked)</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Series</CardTitle>
          <CardDescription>Choose a series to manage chapter access and pricing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Select value={searchSeriesId} onValueChange={setSearchSeriesId} disabled={loadingSeries}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingSeries ? "Loading series..." : "Select a series..."} />
                </SelectTrigger>
                <SelectContent>
                  {seriesList.length === 0 && !loadingSeries && (
                    <SelectItem value="none" disabled>No series available</SelectItem>
                  )}
                  {seriesList.map((series) => (
                    <SelectItem key={series.id} value={series.id}>
                      {series.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSearchSeries} disabled={!searchSeriesId || loadingSeries}>
              <Search className="w-4 h-4 mr-2" />
              Load Chapters
            </Button>
          </div>
        </CardContent>
      </Card>

      {chapters.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Chapters ({chapters.length})</CardTitle>
                <CardDescription>Select chapters for bulk actions or click to edit individually</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                >
                  {selectedChapterIds.length === chapters.length ? (
                    <>
                      <Square className="w-4 h-4 mr-2" />
                      Deselect All
                    </>
                  ) : (
                    <>
                      <CheckSquare className="w-4 h-4 mr-2" />
                      Select All
                    </>
                  )}
                </Button>
                {selectedChapterIds.length > 0 && (
                  <Button
                    onClick={() => setShowBulkDialog(true)}
                  >
                    Bulk Update ({selectedChapterIds.length})
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {chapters.map((chapter) => (
                <div
                  key={chapter.id}
                  className="flex items-center gap-3 p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedChapterIds.includes(chapter.id)}
                    onCheckedChange={() => toggleChapterSelection(chapter.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div
                    className="flex-1 flex items-center justify-between cursor-pointer"
                    onClick={() => openAccessDialog(chapter)}
                  >
                    <div className="flex-1">
                      <div className="font-medium">
                        Chapter {chapter.chapterNumber}: {chapter.title || "Untitled"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {chapter.pages?.length || 0} pages
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {chapter.accessType && getAccessBadge(chapter.accessType)}
                      {chapter.unlockCost > 0 && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Coins className="w-4 h-4" />
                          {chapter.unlockCost}
                        </div>
                      )}
                      <Badge variant={chapter.isPublished === "true" ? "default" : "secondary"}>
                        {chapter.isPublished === "true" ? "Published" : "Draft"}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Access Control Dialog */}
      <Dialog open={showAccessDialog} onOpenChange={setShowAccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Chapter Access</DialogTitle>
            <DialogDescription>
              {selectedChapter && `Chapter ${selectedChapter.chapterNumber}: ${selectedChapter.title || "Untitled"}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="accessType">Access Type</Label>
              <Select value={accessType} onValueChange={setAccessType}>
                <SelectTrigger id="accessType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">
                    <div className="flex items-center gap-2">
                      <LockOpen className="w-4 h-4" />
                      Free - Available to all users
                    </div>
                  </SelectItem>
                  <SelectItem value="premium">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Premium - Requires coins to unlock
                    </div>
                  </SelectItem>
                  <SelectItem value="locked">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      Locked - Restricted access
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {accessType !== "free" && (
              <div>
                <Label htmlFor="unlockCost">Unlock Cost (Coins)</Label>
                <Input
                  id="unlockCost"
                  type="number"
                  placeholder="Enter cost in coins"
                  value={unlockCost}
                  onChange={(e) => setUnlockCost(e.target.value)}
                  min="0"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Users will need to spend this many coins to unlock this chapter
                </p>
              </div>
            )}

            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Access Types Explained:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li><strong>Free:</strong> Available to all users</li>
                <li><strong>Premium:</strong> Requires coins, one-time unlock</li>
                <li><strong>Locked:</strong> Restricted, requires special access</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAccessDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSetAccess}>Update Access</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Update Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Update Access</DialogTitle>
            <DialogDescription>
              Update access type for {selectedChapterIds.length} selected chapters
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="bulkAccessType">Access Type</Label>
              <Select value={bulkAccessType} onValueChange={setBulkAccessType}>
                <SelectTrigger id="bulkAccessType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">
                    <div className="flex items-center gap-2">
                      <LockOpen className="w-4 h-4" />
                      Free - Available to all users
                    </div>
                  </SelectItem>
                  <SelectItem value="premium">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Premium - Requires coins to unlock
                    </div>
                  </SelectItem>
                  <SelectItem value="locked">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      Locked - Restricted access
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {bulkAccessType !== "free" && (
              <div>
                <Label htmlFor="bulkUnlockCost">Unlock Cost (Coins)</Label>
                <Input
                  id="bulkUnlockCost"
                  type="number"
                  placeholder="Enter cost in coins"
                  value={bulkUnlockCost}
                  onChange={(e) => setBulkUnlockCost(e.target.value)}
                  min="0"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  All selected chapters will use this unlock cost
                </p>
              </div>
            )}

            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm font-medium">Selected Chapters: {selectedChapterIds.length}</p>
              <p className="text-sm text-muted-foreground mt-1">
                This will update the access type and unlock cost for all selected chapters
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkUpdate}>Update All</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
