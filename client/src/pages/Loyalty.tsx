import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Trophy, Star, Crown, Gift, TrendingUp, ArrowLeft } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { SEO } from "@/components/SEO";

interface LoyaltyTier {
  id: string;
  name: string;
  minPoints: number;
  maxPoints: number | null;
  coinBonusPercentage: number;
  discountPercentage: number;
  perks: string;
  badgeColor: string;
  displayOrder: number;
}

interface UserLoyalty {
  points: number;
  tierId: string | null;
  lifetimePoints: number;
  tier: LoyaltyTier | null;
}

export default function Loyalty() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [loyaltyStatus, setLoyaltyStatus] = useState<UserLoyalty | null>(null);
  const [allTiers, setAllTiers] = useState<LoyaltyTier[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLoyaltyData = useCallback(async () => {
    try {
      const [statusRes, tiersRes] = await Promise.all([
        fetch("/api/loyalty/my-status", { credentials: "include" }),
        fetch("/api/loyalty/tiers", { credentials: "include" }),
      ]);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setLoyaltyStatus(statusData);
      }

      if (tiersRes.ok) {
        const tiersData = await tiersRes.json();
        setAllTiers(tiersData);
      }
    } catch (error) {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/login?returnTo=/loyalty");
    } else if (isAuthenticated) {
      fetchLoyaltyData();
    }
  }, [authLoading, isAuthenticated, navigate, fetchLoyaltyData]);

  const parsePerks = (perks: string): string[] => {
    try {
      return JSON.parse(perks);
    } catch {
      return [];
    }
  };

  const getTierIcon = (tierName: string) => {
    if (tierName.toLowerCase().includes("bronze")) return <Star className="w-8 h-8" />;
    if (tierName.toLowerCase().includes("silver")) return <Trophy className="w-8 h-8" />;
    if (tierName.toLowerCase().includes("gold")) return <Crown className="w-8 h-8" />;
    if (tierName.toLowerCase().includes("platinum") || tierName.toLowerCase().includes("diamond")) 
      return <Crown className="w-8 h-8" />;
    return <Gift className="w-8 h-8" />;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900">
        <Navigation />
        <div className="max-w-6xl mx-auto px-4 py-20">
          <Skeleton className="h-12 w-96 mb-6 bg-gray-800" />
          <Skeleton className="h-64 mb-6 bg-gray-800" />
          <Skeleton className="h-96 bg-gray-800" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate("/login?returnTo=/loyalty");
    return null;
  }

  const currentTier = loyaltyStatus?.tier;
  const nextTier = allTiers.find((t) => t.minPoints > (loyaltyStatus?.points || 0));
  const pointsToNextTier = nextTier ? nextTier.minPoints - (loyaltyStatus?.points || 0) : 0;
  const progressPercent = nextTier
    ? ((loyaltyStatus?.points || 0) / nextTier.minPoints) * 100
    : 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900">
      <SEO 
        title="Loyalty Program - Earn Points & Unlock Exclusive Rewards"
        description="Join the AmourScans Loyalty Program to earn points with every purchase. Unlock exclusive rewards, coin bonuses, discounts, and special perks as you level up through tiers."
        keywords="loyalty program, earn points, manga rewards, loyalty tiers, exclusive perks, coin bonuses"
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
        
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full mb-6">
            <Trophy className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold text-primary">Loyalty Program</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold text-white mb-4">
            Your Loyalty Status
          </h1>
          <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto">
            Earn points with every purchase and unlock exclusive rewards
          </p>
        </div>

        <Card
          className="bg-gradient-to-br from-gray-900 to-gray-800 border-2 mb-8"
          style={{ borderColor: currentTier?.badgeColor || "#6b7280" }}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="p-4 rounded-xl"
                  style={{ backgroundColor: `${currentTier?.badgeColor || "#6b7280"}20` }}
                >
                  <div style={{ color: currentTier?.badgeColor || "#9ca3af" }}>
                    {currentTier ? getTierIcon(currentTier.name) : <Star className="w-8 h-8" />}
                  </div>
                </div>
                <div>
                  <CardTitle className="text-3xl text-white">
                    {currentTier?.name || "No Tier"}
                  </CardTitle>
                  <p className="text-gray-400 mt-1">
                    {loyaltyStatus?.points.toLocaleString() || 0} Points
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">Lifetime Points</p>
                <p className="text-2xl font-bold text-white">
                  {loyaltyStatus?.lifetimePoints.toLocaleString() || 0}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {nextTier && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Progress to {nextTier.name}</span>
                  <span className="text-white font-semibold">
                    {pointsToNextTier.toLocaleString()} points needed
                  </span>
                </div>
                <Progress value={progressPercent} className="h-3" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-700">
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-500">
                  +{currentTier?.coinBonusPercentage || 0}%
                </div>
                <p className="text-sm text-gray-400">Coin Bonus</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">
                  {currentTier?.discountPercentage || 0}%
                </div>
                <p className="text-sm text-gray-400">Discount</p>
              </div>
            </div>

            {currentTier && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                <p className="text-sm font-semibold text-primary mb-2">Your Perks:</p>
                <div className="space-y-1">
                  {parsePerks(currentTier.perks).map((perk, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm text-gray-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {perk}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-6">All Tiers</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {allTiers.map((tier) => {
              const isCurrentTier = tier.id === currentTier?.id;
              const isLocked = (loyaltyStatus?.points || 0) < tier.minPoints;

              return (
                <Card
                  key={tier.id}
                  className={`relative overflow-hidden transition-all ${
                    isCurrentTier
                      ? "border-2 scale-105"
                      : isLocked
                      ? "bg-gray-900/30 border-gray-800 opacity-60"
                      : "bg-gray-900/50 border-gray-800"
                  }`}
                  style={isCurrentTier ? { borderColor: tier.badgeColor } : {}}
                >
                  {isCurrentTier && (
                    <Badge
                      className="absolute top-4 right-4 text-white border-0"
                      style={{ backgroundColor: tier.badgeColor }}
                    >
                      Current
                    </Badge>
                  )}

                  <CardContent className="p-6">
                    <div
                      className="inline-flex p-3 rounded-xl mb-4"
                      style={{ backgroundColor: `${tier.badgeColor}20` }}
                    >
                      <div style={{ color: tier.badgeColor }}>
                        {getTierIcon(tier.name)}
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-white mb-2">{tier.name}</h3>
                    <p className="text-sm text-gray-400 mb-4">
                      {tier.minPoints.toLocaleString()}
                      {tier.maxPoints ? ` - ${tier.maxPoints.toLocaleString()}` : "+"} points
                    </p>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Coin Bonus</span>
                        <span className="text-amber-500 font-semibold">
                          +{tier.coinBonusPercentage}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Discount</span>
                        <span className="text-green-500 font-semibold">
                          {tier.discountPercentage}%
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/30">
          <CardContent className="p-6 text-center">
            <TrendingUp className="w-12 h-12 mx-auto mb-4 text-primary" />
            <h3 className="text-xl font-bold text-white mb-2">Earn Loyalty Points</h3>
            <p className="text-gray-400 mb-4">
              Earn points with every coin purchase and subscription
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Badge variant="outline" className="border-primary/30 text-primary">
                1 point per $1 spent
              </Badge>
              <Badge variant="outline" className="border-primary/30 text-primary">
                Bonus multipliers on special events
              </Badge>
              <Badge variant="outline" className="border-primary/30 text-primary">
                Double points on subscriptions
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Footer />
    </div>
  );
}
