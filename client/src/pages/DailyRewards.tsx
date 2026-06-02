import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, Calendar, Coins, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";
import { fetchWithCsrf } from "@/lib/csrf";

interface DailyRewardStatus {
  canClaim: boolean;
  currentDay: number;
  claimedToday: boolean;
  nextReward?: number;
}

export default function DailyRewards() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<DailyRewardStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/rewards/daily-status", {
        credentials: "include"
      });
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const claimReward = async () => {
    try {
      const response = await fetchWithCsrf("/api/rewards/claim-daily", {
        method: "POST",
      });
      
      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Reward Claimed!",
          description: `You received ${data.coinsEarned} coins for Day ${data.day}!`
        });
        fetchStatus();
      } else {
        const error = await response.json();
        toast({
          variant: "error",
          title: "Error",
          description: error.message
        });
      }
    } catch (error) {
      toast({
        variant: "error",
        title: "Error",
        description: "Failed to claim reward"
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900">
        <Navigation />
        <div className="container mx-auto py-20">
          <div className="text-center text-white">Loading daily rewards...</div>
        </div>
      </div>
    );
  }

  const rewardCalendar = Array.from({ length: 14 }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900">
      <SEO 
        title="Daily Rewards - Login Rewards & Bonus Coins"
        description="Claim your daily login rewards on AmourScans! Get free coins every day, build your streak, and unlock bonus rewards for consecutive logins."
        keywords="daily rewards, login bonus, free coins, daily login, streak rewards, manga bonuses"
      />
      <Navigation />
      
      <div className="container mx-auto py-16 px-4">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="min-h-11 w-fit text-muted-foreground hover:text-primary mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-6 w-6" />
            Daily Login Rewards
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6 text-center">
            <div className="flex items-center justify-center gap-4 mb-4">
              <Calendar className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">Day {status?.currentDay || 1}</p>
                <p className="text-sm text-muted-foreground">
                  {status?.claimedToday ? "Come back tomorrow!" : "Ready to claim"}
                </p>
              </div>
            </div>

            {status?.canClaim && (
              <Button onClick={claimReward} className="min-h-11 gap-2">
                <Coins className="h-5 w-5" />
                Claim {status.nextReward} Coins
              </Button>
            )}

            {status?.claimedToday && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-600 rounded-lg">
                ✓ Today's reward claimed!
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
            {rewardCalendar.map((day) => {
              const isCurrent = day === status?.currentDay;
              const isPast = day < (status?.currentDay || 1);
              const isWeekBonus = day % 7 === 0;

              return (
                <div
                  key={day}
                  className={`
                    p-3 rounded-lg border-2 text-center transition-all
                    ${isCurrent ? "border-primary bg-primary/10 scale-105" : "border-border"}
                    ${isPast ? "bg-muted/50" : ""}
                    ${isWeekBonus ? "ring-2 ring-yellow-500" : ""}
                  `}
                >
                  <div className="text-xs text-muted-foreground mb-1">Day {day}</div>
                  <div className="font-bold flex items-center justify-center gap-1">
                    <Coins className="h-3 w-3" />
                    {isWeekBonus ? day * 10 + 30 : day * 5 + 5}
                  </div>
                  {isWeekBonus && <div className="text-xs text-yellow-600 mt-1">Bonus!</div>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      </div>
      
      <Footer />
    </div>
  );
}
