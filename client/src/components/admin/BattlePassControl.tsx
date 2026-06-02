import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Trophy, Loader2, ShieldOff, CheckCircle2, AlertCircle, Lock, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { fetchWithCsrf } from "@/lib/csrf";

interface BattlePassMode {
  value: string;
  label: string;
  description: string;
  icon: typeof CheckCircle2;
  color: string;
}

const battlePassModes: BattlePassMode[] = [
  {
    value: "enabled",
    label: "Enabled",
    description: "Battle Pass is fully operational",
    icon: CheckCircle2,
    color: "text-green-600 dark:text-green-400",
  },
  {
    value: "maintenance",
    label: "Maintenance",
    description: "Battle Pass is under maintenance - show maintenance message",
    icon: Wrench,
    color: "text-orange-600 dark:text-orange-400",
  },
  {
    value: "coming_soon",
    label: "Coming Soon",
    description: "Battle Pass feature not yet available - show coming soon message",
    icon: Lock,
    color: "text-blue-600 dark:text-blue-400",
  },
  {
    value: "disabled",
    label: "Disabled",
    description: "Battle Pass is completely disabled and hidden",
    icon: ShieldOff,
    color: "text-red-600 dark:text-red-400",
  },
];

export function BattlePassControl() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch current battle pass settings
  const { data: battlePassEnabled, isLoading: isLoadingEnabled } = useQuery({
    queryKey: ["admin-settings", "system", "battle_pass_enabled"],
    queryFn: async () => {
      const res = await fetch("/api/admin/settings/system/battle_pass_enabled");
      if (!res.ok) return true; // Default to enabled if not set
      const data = await res.json();
      return data.value === "true" || data.value === true;
    }
  });

  const { data: battlePassMode, isLoading: isLoadingMode } = useQuery({
    queryKey: ["admin-settings", "system", "battle_pass_mode"],
    queryFn: async () => {
      const res = await fetch("/api/admin/settings/system/battle_pass_mode");
      if (!res.ok) return "enabled"; // Default to enabled if not set
      const data = await res.json();
      return data.value || "enabled";
    }
  });

  const [isEnabled, setIsEnabled] = useState<boolean>(battlePassEnabled ?? true);
  const [selectedMode, setSelectedMode] = useState<string>(battlePassMode || "enabled");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (battlePassEnabled !== undefined) setIsEnabled(battlePassEnabled);
  }, [battlePassEnabled]);

  useEffect(() => {
    if (battlePassMode !== undefined) setSelectedMode(battlePassMode);
  }, [battlePassMode]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save enabled status
      const enabledResponse = await fetchWithCsrf("/api/admin/settings/system/battle_pass_enabled", {
        method: "PUT",
        body: JSON.stringify({
          category: "system",
          key: "battle_pass_enabled",
          value: isEnabled.toString(),
          type: "boolean",
          description: "Controls whether the Battle Pass feature is enabled",
          isPublic: true
        })
      });

      if (!enabledResponse.ok) {
        throw new Error("Failed to save battle pass enabled status");
      }

      // Save mode
      const modeResponse = await fetchWithCsrf("/api/admin/settings/system/battle_pass_mode", {
        method: "PUT",
        body: JSON.stringify({
          category: "system",
          key: "battle_pass_mode",
          value: selectedMode,
          type: "string",
          description: "Battle Pass display mode (enabled, maintenance, coming_soon, disabled)",
          isPublic: true
        })
      });

      if (!modeResponse.ok) {
        throw new Error("Failed to save battle pass mode");
      }

      // Invalidate all relevant queries
      await queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/settings/public/battle-pass-status"] });

      toast({
        title: "Battle Pass Settings Saved",
        description: `Battle Pass is now ${isEnabled ? `enabled (${selectedMode})` : "disabled"}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save battle pass settings",
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = 
    isEnabled !== battlePassEnabled || 
    selectedMode !== battlePassMode;

  const isLoading = isLoadingEnabled || isLoadingMode;

  const currentModeData = battlePassModes.find(m => m.value === selectedMode);
  const ModeIcon = currentModeData?.icon || CheckCircle2;

  return (
    <Card className="border-2 border-purple-500/20 shadow-lg">
      <CardHeader className="space-y-1 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
            <Trophy className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <CardTitle className="text-2xl">Battle Pass Control</CardTitle>
            <CardDescription className="text-base mt-1">
              Configure Battle Pass feature availability and display mode
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          </div>
        ) : (
          <>
            {/* Master Battle Pass Toggle */}
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
                    <Label htmlFor="battle-pass-toggle" className="text-lg font-bold cursor-pointer">
                      Battle Pass Feature Status
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1 max-w-md">
                      {isEnabled 
                        ? "🟢 Enabled - Battle Pass feature is accessible to users" 
                        : "🔴 Disabled - Battle Pass feature is completely hidden"}
                    </p>
                  </div>
                </div>
                <Switch
                  id="battle-pass-toggle"
                  checked={isEnabled}
                  onCheckedChange={setIsEnabled}
                  className="data-[state=checked]:bg-green-500"
                />
              </div>
            </div>

            {/* Display Mode Section */}
            <div className={cn(
              "p-4 rounded-lg border-2 transition-colors",
              !isEnabled 
                ? "border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/50" 
                : "border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30"
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
                  {battlePassModes.map((mode) => {
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

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                className={cn(
                  "flex-1 h-12 text-base font-semibold",
                  hasChanges && "bg-purple-600 hover:bg-purple-700"
                )}
                size="lg"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
              
              {hasChanges && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEnabled(battlePassEnabled ?? true);
                    setSelectedMode(battlePassMode || "enabled");
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
