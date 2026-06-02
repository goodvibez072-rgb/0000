import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, Loader2, ShieldOff, CheckCircle2, AlertCircle, Lock, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { fetchWithCsrf } from "@/lib/csrf";

interface ShopMode {
  value: string;
  label: string;
  description: string;
  icon: typeof CheckCircle2;
  color: string;
}

const shopModes: ShopMode[] = [
  {
    value: "enabled",
    label: "Enabled",
    description: "Shop is fully operational",
    icon: CheckCircle2,
    color: "text-green-600 dark:text-green-400",
  },
  {
    value: "maintenance",
    label: "Maintenance",
    description: "Shop is under maintenance - show maintenance message",
    icon: Wrench,
    color: "text-orange-600 dark:text-orange-400",
  },
  {
    value: "coming_soon",
    label: "Coming Soon",
    description: "Shop feature not yet available - show coming soon message",
    icon: Lock,
    color: "text-blue-600 dark:text-blue-400",
  },
  {
    value: "disabled",
    label: "Disabled",
    description: "Shop is completely disabled and hidden",
    icon: ShieldOff,
    color: "text-red-600 dark:text-red-400",
  },
];

export function ShopControl() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch current shop settings
  const { data: shopEnabled, isLoading: isLoadingEnabled } = useQuery({
    queryKey: ["admin-settings", "system", "shop_enabled"],
    queryFn: async () => {
      const res = await fetch("/api/admin/settings/system/shop_enabled");
      if (!res.ok) return true; // Default to enabled if not set
      const data = await res.json();
      return data.value === "true" || data.value === true;
    }
  });

  const { data: shopMode, isLoading: isLoadingMode } = useQuery({
    queryKey: ["admin-settings", "system", "shop_mode"],
    queryFn: async () => {
      const res = await fetch("/api/admin/settings/system/shop_mode");
      if (!res.ok) return "enabled"; // Default to enabled if not set
      const data = await res.json();
      return data.value || "enabled";
    }
  });

  const [isEnabled, setIsEnabled] = useState<boolean>(shopEnabled ?? true);
  const [selectedMode, setSelectedMode] = useState<string>(shopMode || "enabled");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (shopEnabled !== undefined) setIsEnabled(shopEnabled);
  }, [shopEnabled]);

  useEffect(() => {
    if (shopMode) setSelectedMode(shopMode);
  }, [shopMode]);

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      // Save enabled status
      const enabledResponse = await fetchWithCsrf("/api/admin/settings/system/shop_enabled", {
        method: "PUT",
        body: JSON.stringify({
          category: "system",
          key: "shop_enabled",
          value: isEnabled.toString(),
          type: "boolean",
          description: "Global toggle to enable/disable the shop feature",
          isPublic: true,
        }),
      });

      if (!enabledResponse.ok) {
        throw new Error("Failed to update shop enabled status");
      }

      // Save mode
      const modeResponse = await fetchWithCsrf("/api/admin/settings/system/shop_mode", {
        method: "PUT",
        body: JSON.stringify({
          category: "system",
          key: "shop_mode",
          value: selectedMode,
          type: "string",
          description: `Shop display mode: ${shopModes.find(m => m.value === selectedMode)?.label}`,
          isPublic: true,
        }),
      });

      if (!modeResponse.ok) {
        throw new Error("Failed to update shop mode");
      }

      // Invalidate queries to refresh
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-settings"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/settings/public/shop-status"] }),
        queryClient.refetchQueries({ queryKey: ["/api/settings/public/shop-status"] }),
      ]);

      const modeData = shopModes.find(m => m.value === selectedMode);
      toast({
        title: "✅ Settings Saved",
        description: `Shop mode: ${modeData?.label} - ${isEnabled ? "Enabled" : "Disabled"}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update shop settings",
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = isEnabled !== shopEnabled || selectedMode !== shopMode;
  const currentModeData = shopModes.find(m => m.value === selectedMode);
  const ModeIcon = currentModeData?.icon || CheckCircle2;

  const isLoading = isLoadingEnabled || isLoadingMode;

  return (
    <Card className="border-2 border-blue-500/20 shadow-lg">
      <CardHeader className="space-y-1 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20">
            <ShoppingCart className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <CardTitle className="text-2xl">Shop Control</CardTitle>
            <CardDescription className="text-base mt-1">
              Configure shop feature availability and display mode
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <>
            {/* Master Shop Toggle */}
            <div className={cn(
              "relative overflow-hidden rounded-xl border-2 p-6 transition-all duration-300",
              isEnabled 
                ? "border-green-500/50 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30" 
                : "border-red-500/30 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20"
            )}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "p-3 rounded-full transition-colors",
                    isEnabled ? "bg-green-500/20" : "bg-red-500/20"
                  )}>
                    {isEnabled ? (
                      <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                    ) : (
                      <ShieldOff className="h-6 w-6 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="shop-toggle" className="text-lg font-bold cursor-pointer">
                      Shop Feature Status
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1 max-w-md">
                      {isEnabled 
                        ? "🟢 Enabled - Shop feature is accessible to users" 
                        : "🔴 Disabled - Shop feature is completely hidden"}
                    </p>
                  </div>
                </div>
                <Switch
                  id="shop-toggle"
                  checked={isEnabled}
                  onCheckedChange={setIsEnabled}
                  className={cn(
                    "scale-125 sm:scale-150",
                    isEnabled ? "data-[state=checked]:bg-green-600" : "data-[state=unchecked]:bg-red-600"
                  )}
                />
              </div>
            </div>

            {/* Shop Mode Selector */}
            <div className={cn(
              "space-y-6 rounded-xl border-2 p-6 transition-all duration-300",
              !isEnabled 
                ? "border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/20 opacity-50" 
                : "border-blue-500/30 bg-white dark:bg-gray-950"
            )}>
              <div className="flex items-start gap-3">
                <AlertCircle className={cn(
                  "h-5 w-5 mt-0.5",
                  !isEnabled ? "text-gray-400" : "text-blue-500"
                )} />
                <div className="flex-1">
                  <Label 
                    htmlFor="mode-selector" 
                    className={cn(
                      "text-base font-semibold",
                      !isEnabled && "text-gray-400"
                    )}
                  >
                    Display Mode
                  </Label>
                  <p className={cn(
                    "text-sm mt-1",
                    !isEnabled ? "text-gray-400" : "text-muted-foreground"
                  )}>
                    {!isEnabled ? "Disabled - Shop is hidden" : "Choose how the shop appears to users"}
                  </p>
                </div>
              </div>

              {/* Current Mode Display */}
              <div className={cn(
                "p-4 rounded-lg border-2 transition-colors",
                !isEnabled 
                  ? "border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/50" 
                  : "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30"
              )}>
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  Current Mode
                </div>
                <div className="flex items-center gap-3">
                  <ModeIcon className={cn(
                    "h-8 w-8",
                    !isEnabled ? "text-gray-400" : currentModeData?.color
                  )} />
                  <div>
                    <div className={cn(
                      "text-2xl font-bold",
                      !isEnabled ? "text-gray-400" : currentModeData?.color
                    )}>
                      {currentModeData?.label}
                    </div>
                    <div className={cn(
                      "text-sm mt-1",
                      !isEnabled ? "text-gray-400" : "text-muted-foreground"
                    )}>
                      {currentModeData?.description}
                    </div>
                  </div>
                </div>
              </div>

              {/* Mode Selector */}
              <div className="space-y-3">
                <Label htmlFor="mode-selector" className="text-sm font-medium">
                  Select Display Mode
                </Label>
                <Select
                  value={selectedMode}
                  onValueChange={setSelectedMode}
                  disabled={!isEnabled}
                >
                  <SelectTrigger id="mode-selector" className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {shopModes.map((mode) => {
                      const Icon = mode.icon;
                      return (
                        <SelectItem key={mode.value} value={mode.value}>
                          <div className="flex items-center gap-3 py-1">
                            <Icon className={cn("h-5 w-5", mode.color)} />
                            <div>
                              <div className="font-semibold">{mode.label}</div>
                              <div className="text-xs text-muted-foreground">
                                {mode.description}
                              </div>
                            </div>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <Button
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                className="flex-1 h-12 text-base font-semibold"
                size="lg"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                    Save Changes
                  </>
                )}
              </Button>
              {hasChanges && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEnabled(shopEnabled ?? true);
                    setSelectedMode(shopMode || "enabled");
                  }}
                  disabled={isSaving}
                  className="h-12 text-base"
                  size="lg"
                >
                  Reset
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
