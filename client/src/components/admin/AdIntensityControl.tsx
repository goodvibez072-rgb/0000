import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAdIntensity } from "@/hooks/useAdIntensity";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, Loader2, ShieldOff, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface IntensityLevel {
  level: number;
  label: string;
  description: string;
  color: string;
}

const intensityLevels: IntensityLevel[] = [
  {
    level: 1,
    label: "Minimal",
    description: "2 ads per page - Conservative start",
    color: "text-green-600 dark:text-green-400",
  },
  {
    level: 2,
    label: "Low",
    description: "2-4 ads per page - Light monetization",
    color: "text-blue-600 dark:text-blue-400",
  },
  {
    level: 3,
    label: "Standard",
    description: "3-6 ads per page - Balanced revenue",
    color: "text-purple-600 dark:text-purple-400",
  },
  {
    level: 4,
    label: "High",
    description: "4-8 ads per page - Strong monetization",
    color: "text-orange-600 dark:text-orange-400",
  },
  {
    level: 5,
    label: "Maximum",
    description: "8-15 ads per page - Maximum revenue",
    color: "text-red-600 dark:text-red-400",
  },
];

export function AdIntensityControl() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { level: currentLevel, enabled: currentEnabled, isLoading: isLoadingCurrent } = useAdIntensity();
  const [selectedLevel, setSelectedLevel] = useState<number>(currentLevel);
  const [isAdFree, setIsAdFree] = useState<boolean>(!currentEnabled);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSelectedLevel(currentLevel);
    setIsAdFree(!currentEnabled);
  }, [currentLevel, currentEnabled]);

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      const adsEnabled = !isAdFree;
      
      // Fetch CSRF token first
      const csrfResponse = await fetch("/api/csrf-token", {
        credentials: "include",
      });
      
      if (!csrfResponse.ok) {
        throw new Error("Failed to get CSRF token");
      }
      
      const { csrfToken } = await csrfResponse.json();
      
      const levelResponse = await fetch("/api/admin/settings/system/ad_intensity_level", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        credentials: "include",
        body: JSON.stringify({
          category: "system",
          key: "ad_intensity_level",
          value: selectedLevel.toString(),
          type: "number",
          description: `Ad intensity level (1-5): ${intensityLevels.find(l => l.level === selectedLevel)?.label}`,
          isPublic: true,
        }),
      });

      if (!levelResponse.ok) {
        throw new Error("Failed to update ad intensity level");
      }

      const enabledResponse = await fetch("/api/admin/settings/system/ads_enabled", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        credentials: "include",
        body: JSON.stringify({
          category: "system",
          key: "ads_enabled",
          value: adsEnabled.toString(),
          type: "boolean",
          description: "Global toggle to enable/disable all advertisements",
          isPublic: true,
        }),
      });

      if (!enabledResponse.ok) {
        throw new Error("Failed to update ads enabled status");
      }

      // Invalidate all ad-related queries to force immediate refresh
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ad-intensity"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-settings"] }),
        queryClient.invalidateQueries({ queryKey: ["ads"] }), // Invalidate all ad queries
        queryClient.refetchQueries({ queryKey: ["ad-intensity"] }), // Force immediate refetch
      ]);

      toast({
        title: "✅ Settings Saved",
        description: isAdFree 
          ? "Ad-Free Mode Activated - All ads are now disabled" 
          : `Ads enabled at Level ${selectedLevel} (${intensityLevels.find(l => l.level === selectedLevel)?.label})`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update ad settings",
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = selectedLevel !== currentLevel || isAdFree !== !currentEnabled;
  const currentLevelData = intensityLevels.find(l => l.level === selectedLevel);

  return (
    <Card className="border-2 border-purple-500/20 shadow-lg">
      <CardHeader className="space-y-1 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
            <BarChart3 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <CardTitle className="text-2xl">Ad Management Control</CardTitle>
            <CardDescription className="text-base mt-1">
              Configure site-wide advertisement settings
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-8">
        {isLoadingCurrent ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          </div>
        ) : (
          <>
            {/* Master Ad-Free Toggle */}
            <div className={cn(
              "relative overflow-hidden rounded-xl border-2 p-6 transition-all duration-300",
              isAdFree 
                ? "border-green-500/50 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30" 
                : "border-purple-500/30 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20"
            )}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "p-3 rounded-full transition-colors",
                    isAdFree ? "bg-green-500/20" : "bg-purple-500/20"
                  )}>
                    {isAdFree ? (
                      <ShieldOff className="h-6 w-6 text-green-600 dark:text-green-400" />
                    ) : (
                      <CheckCircle2 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="ad-free-toggle" className="text-lg font-bold cursor-pointer">
                      Ad-Free Mode
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1 max-w-md">
                      {isAdFree 
                        ? "🟢 Active - All website ads are completely disabled" 
                        : "Disabled - Ads are currently showing on the website"}
                    </p>
                  </div>
                </div>
                <Switch
                  id="ad-free-toggle"
                  checked={isAdFree}
                  onCheckedChange={setIsAdFree}
                  className="data-[state=checked]:bg-green-600 scale-125 sm:scale-150"
                />
              </div>
            </div>

            {/* Ad Intensity Slider */}
            <div className={cn(
              "space-y-6 rounded-xl border-2 p-6 transition-all duration-300",
              isAdFree 
                ? "border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/20 opacity-50" 
                : "border-purple-500/30 bg-white dark:bg-gray-950"
            )}>
              <div className="flex items-start gap-3">
                <AlertCircle className={cn(
                  "h-5 w-5 mt-0.5",
                  isAdFree ? "text-gray-400" : "text-purple-500"
                )} />
                <div className="flex-1">
                  <Label 
                    htmlFor="intensity-slider" 
                    className={cn(
                      "text-base font-semibold",
                      isAdFree && "text-gray-400"
                    )}
                  >
                    Ad Frequency / Intensity Level
                  </Label>
                  <p className={cn(
                    "text-sm mt-1",
                    isAdFree ? "text-gray-400" : "text-muted-foreground"
                  )}>
                    {isAdFree ? "Disabled in Ad-Free Mode" : "Adjust how many ads appear on each page"}
                  </p>
                </div>
              </div>

              {/* Current Level Display */}
              <div className={cn(
                "p-4 rounded-lg border-2 transition-colors",
                isAdFree 
                  ? "border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/50" 
                  : "border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30"
              )}>
                <div className="text-sm font-medium text-muted-foreground mb-1">
                  Current Setting
                </div>
                <div className={cn(
                  "text-3xl font-bold",
                  isAdFree ? "text-gray-400" : currentLevelData?.color
                )}>
                  Level {selectedLevel} - {currentLevelData?.label}
                </div>
                <div className={cn(
                  "text-sm mt-1",
                  isAdFree ? "text-gray-400" : "text-muted-foreground"
                )}>
                  {currentLevelData?.description}
                </div>
              </div>

              {/* Slider Control */}
              <div className="space-y-4">
                <Slider
                  id="intensity-slider"
                  min={1}
                  max={5}
                  step={1}
                  value={[selectedLevel]}
                  onValueChange={(value) => setSelectedLevel(value[0])}
                  disabled={isAdFree}
                  className={cn(
                    "touch-auto",
                    isAdFree && "opacity-50 cursor-not-allowed"
                  )}
                />
                
                {/* Level Markers */}
                <div className="flex justify-between px-1">
                  {intensityLevels.map((level) => (
                    <button
                      key={level.level}
                      type="button"
                      onClick={() => !isAdFree && setSelectedLevel(level.level)}
                      disabled={isAdFree}
                      className={cn(
                        "flex flex-col items-center gap-1 transition-all",
                        isAdFree ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:scale-110"
                      )}
                    >
                      <div className={cn(
                        "w-2 h-2 rounded-full transition-all",
                        selectedLevel === level.level && !isAdFree
                          ? "w-3 h-3 bg-purple-600 dark:bg-purple-400 ring-4 ring-purple-200 dark:ring-purple-800"
                          : "bg-gray-300 dark:bg-gray-600"
                      )} />
                      <span className={cn(
                        "text-xs font-medium mt-1",
                        selectedLevel === level.level && !isAdFree
                          ? level.color
                          : "text-gray-400"
                      )}>
                        {level.level}
                      </span>
                    </button>
                  ))}
                </div>
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
                    setSelectedLevel(currentLevel);
                    setIsAdFree(!currentEnabled);
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
