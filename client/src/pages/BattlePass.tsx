import { useState } from "react";
import { useLocation } from "wouter";
import { Trophy, Star, Lock, Check, Coins, Crown, Gift, Zap, ArrowLeft, Loader2 } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SEO } from "@/components/SEO";

interface BattlePassProgress {
  level: number;
  xp: number;
  xpForNextLevel: number;
  isPremium: boolean;
  seasonId: string;
  seasonName: string;
  seasonEnd: string;
}

interface BattlePassReward {
  level: number;
  freeReward: { type: string; amount: number; name: string };
  premiumReward: { type: string; amount: number; name: string };
  claimed: boolean;
}

export default function BattlePass() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  // Fetch battle pass settings
  const { data: battlePassSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ["/api/settings/public/battle-pass-status"],
    queryFn: async () => {
      const [enabledRes, modeRes] = await Promise.all([
        fetch("/api/admin/settings/system/battle_pass_enabled"),
        fetch("/api/admin/settings/system/battle_pass_mode")
      ]);
      
      const enabled = enabledRes.ok ? (await enabledRes.json()).value === "true" : true;
      const mode = modeRes.ok ? (await modeRes.json()).value : "enabled";
      
      return { enabled, mode };
    }
  });

  const { data: progress, isLoading: progressLoading } = useQuery<BattlePassProgress>({
    queryKey: ["/api/battle-pass/my-progress"],
    queryFn: async () => {
      const response = await fetch("/api/battle-pass/my-progress", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch progress");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const { data: rewards, isLoading: rewardsLoading } = useQuery<BattlePassReward[]>({
    queryKey: ["/api/battle-pass/rewards"],
    queryFn: async () => {
      const response = await fetch("/api/battle-pass/rewards", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch rewards");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const handleUpgrade = async () => {
    if (!isAuthenticated) {
      navigate("/login?returnTo=/battle-pass");
      return;
    }

    try {
      const response = await fetch("/api/battle-pass/upgrade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to upgrade");
      }

      toast({
        title: "Battle Pass Upgraded!",
        description: "You now have access to all premium rewards",
      });
    } catch (error: any) {
      toast({
        title: "Upgrade Failed",
        description: error.message,
        variant: "error",
      });
    }
  };

  const handleClaimReward = async (level: number) => {
    try {
      const response = await fetch("/api/battle-pass/claim-reward", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "include",
        body: JSON.stringify({ tier: level }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to claim reward");
      }

      toast({
        title: "Reward Claimed!",
        description: "Check your inventory",
      });
    } catch (error: any) {
      toast({
        title: "Claim Failed",
        description: error.message,
        variant: "error",
      });
    }
  };

  const getRewardIcon = (type: string) => {
    switch (type) {
      case "coins": return <Coins className="w-5 h-5 text-amber-500" />;
      case "premium_chapter": return <Star className="w-5 h-5 text-purple-500" />;
      case "cosmetic": return <Crown className="w-5 h-5 text-pink-500" />;
      default: return <Gift className="w-5 h-5 text-blue-500" />;
    }
  };

  // Check battle pass status and show appropriate message
  if (settingsLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-background to-primary/5">
        <Navigation />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  // Battle Pass disabled or not in enabled mode
  if (!battlePassSettings?.enabled || (battlePassSettings?.mode && battlePassSettings.mode !== "enabled")) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-background to-primary/5">
        <SEO 
          title="Battle Pass - AmourScans"
          description="AmourScans Battle Pass"
          keywords="manga battle pass, premium"
        />
        <Navigation />
        
        <main className="flex-1 container mx-auto px-4 py-8 mt-16">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="w-fit text-muted-foreground hover:text-primary mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="max-w-2xl mx-auto mt-20">
            <Card className="border-2 bg-card/80 backdrop-blur-md">
              <CardContent className="p-12 text-center space-y-6">
                {battlePassSettings?.mode === "maintenance" ? (
                  <>
                    <div className="mx-auto w-20 h-20 rounded-full bg-orange-500/10 flex items-center justify-center mb-4">
                      <Zap className="w-10 h-10 text-orange-600 dark:text-orange-400" />
                    </div>
                    <h1 className="text-3xl font-bold">Battle Pass Under Maintenance</h1>
                    <p className="text-muted-foreground text-lg">
                      We're currently performing maintenance on the Battle Pass to bring you an even better experience.
                      Please check back soon!
                    </p>
                  </>
                ) : battlePassSettings?.mode === "coming_soon" ? (
                  <>
                    <div className="mx-auto w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
                      <Trophy className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h1 className="text-3xl font-bold">Battle Pass Coming Soon!</h1>
                    <p className="text-muted-foreground text-lg">
                      The Battle Pass feature is on the way! Get ready for exclusive rewards, challenges, and special perks.
                      Stay tuned!
                    </p>
                  </>
                ) : (
                  <>
                    <div className="mx-auto w-20 h-20 rounded-full bg-gray-500/10 flex items-center justify-center mb-4">
                      <Lock className="w-10 h-10 text-gray-600 dark:text-gray-400" />
                    </div>
                    <h1 className="text-3xl font-bold">Battle Pass Unavailable</h1>
                    <p className="text-muted-foreground text-lg">
                      The Battle Pass is currently unavailable. Please try again later.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900">
        <Navigation />
        <div className="max-w-6xl mx-auto px-4 py-20">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="w-fit text-muted-foreground hover:text-primary mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Card className="bg-gray-900/50 border-gray-800 text-center p-16">
            <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <h2 className="text-2xl font-bold text-white mb-2">Login Required</h2>
            <p className="text-gray-400 mb-6">Sign in to access the Battle Pass</p>
            <Button
              onClick={() => navigate("/login?returnTo=/battle-pass")}
              className="bg-gradient-to-r from-primary to-accent"
            >
              Login
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (authLoading || progressLoading || rewardsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900">
        <Navigation />
        <div className="max-w-6xl mx-auto px-4 py-20">
          <Skeleton className="h-64 bg-gray-800 mb-6" />
          <Skeleton className="h-96 bg-gray-800" />
        </div>
      </div>
    );
  }

  const levelProgress = progress ? (progress.xp / progress.xpForNextLevel) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900">
      <SEO 
        title="AmourScans Battle Pass - Earn Rewards While Reading"
        description="Unlock exclusive rewards and bonuses with the AmourScans Battle Pass. Earn coins, premium chapters, cosmetics, and special perks as you level up through reading."
        keywords="battle pass, manga rewards, level up, earn coins, premium rewards, manga progression"
      />
      <Navigation />
      
      <div className="max-w-6xl mx-auto px-4 py-16">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="min-h-11 w-fit text-muted-foreground hover:text-primary mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Battle Pass</h1>
              <p className="text-gray-400">{progress?.seasonName || "Current Season"}</p>
            </div>
            {!progress?.isPremium && (
              <Button
                onClick={handleUpgrade}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg"
                size="lg"
              >
                <Crown className="w-5 h-5 mr-2" />
                Upgrade to Premium
              </Button>
            )}
          </div>

          {progress?.isPremium && (
            <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 mb-4">
              <Crown className="w-4 h-4 mr-1" />
              Premium Pass Active
            </Badge>
          )}
        </div>

        <Card className="bg-gray-900/50 border-gray-800 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <span>Level {progress?.level || 1}</span>
              <span className="text-sm font-normal text-gray-400">
                Season ends: {progress?.seasonEnd ? new Date(progress.seasonEnd).toLocaleDateString() : "TBD"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">XP Progress</span>
                <span className="text-white font-semibold">
                  {progress?.xp || 0} / {progress?.xpForNextLevel || 100}
                </span>
              </div>
              <Progress value={levelProgress} className="h-3 bg-gray-800" />
            </div>

            <div className="grid grid-cols-3 gap-4 text-center pt-4 border-t border-gray-800">
              <div>
                <p className="text-2xl font-bold text-white">{progress?.level || 1}</p>
                <p className="text-sm text-gray-400">Current Level</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">{rewards?.filter(r => r.claimed).length || 0}</p>
                <p className="text-sm text-gray-400">Rewards Claimed</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-500">{rewards?.length || 0}</p>
                <p className="text-sm text-gray-400">Total Rewards</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-white mb-4">Rewards</h2>
          
          {rewards?.map((reward) => {
            const isUnlocked = progress && progress.level >= reward.level;
            const canClaim = isUnlocked && !reward.claimed;

            return (
              <Card
                key={reward.level}
                className={cn(
                  "bg-gray-900/50 border-gray-800 transition-all duration-300",
                  isUnlocked && "border-primary/30"
                )}
              >
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                    <div className="md:col-span-2 text-center">
                      <div className={cn(
                        "inline-flex items-center justify-center w-16 h-16 rounded-full border-2",
                        isUnlocked ? "border-primary bg-primary/10" : "border-gray-700 bg-gray-800"
                      )}>
                        <span className="text-2xl font-bold text-white">{reward.level}</span>
                      </div>
                    </div>

                    <div className="md:col-span-4">
                      <p className="text-xs text-gray-500 uppercase mb-2">Free Reward</p>
                      <div className="flex items-center gap-3">
                        {getRewardIcon(reward.freeReward.type)}
                        <div>
                          <p className="text-white font-medium">{reward.freeReward.name}</p>
                          <p className="text-sm text-gray-400">x{reward.freeReward.amount}</p>
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-4">
                      <p className="text-xs text-amber-500 uppercase mb-2 flex items-center gap-1">
                        <Crown className="w-3 h-3" />
                        Premium Reward
                      </p>
                      <div className={cn(
                        "flex items-center gap-3",
                        !progress?.isPremium && "opacity-40"
                      )}>
                        {progress?.isPremium ? (
                          <>
                            {getRewardIcon(reward.premiumReward.type)}
                            <div>
                              <p className="text-white font-medium">{reward.premiumReward.name}</p>
                              <p className="text-sm text-gray-400">x{reward.premiumReward.amount}</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <Lock className="w-5 h-5 text-gray-600" />
                            <p className="text-gray-500">Premium Required</p>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="md:col-span-2 text-right">
                      {reward.claimed ? (
                        <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                          <Check className="w-4 h-4 mr-1" />
                          Claimed
                        </Badge>
                      ) : canClaim ? (
                        <Button
                          onClick={() => handleClaimReward(reward.level)}
                          size="sm"
                          className="bg-primary hover:bg-primary/90"
                        >
                          <Gift className="w-4 h-4 mr-1" />
                          Claim
                        </Button>
                      ) : isUnlocked ? (
                        <Badge variant="secondary">Ready</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-gray-800 text-gray-500">
                          <Lock className="w-3 h-3 mr-1" />
                          Locked
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/30 mt-8">
          <CardContent className="p-6 text-center">
            <Zap className="w-12 h-12 mx-auto mb-4 text-primary" />
            <h3 className="text-xl font-bold text-white mb-2">Earn XP to Level Up!</h3>
            <p className="text-gray-400 mb-4">
              Read chapters, complete achievements, and engage with the community to earn XP
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Badge variant="outline" className="border-primary/30 text-primary">
                +50 XP per chapter read
              </Badge>
              <Badge variant="outline" className="border-primary/30 text-primary">
                +100 XP per achievement
              </Badge>
              <Badge variant="outline" className="border-primary/30 text-primary">
                +25 XP per comment
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Footer />
    </div>
  );
}
