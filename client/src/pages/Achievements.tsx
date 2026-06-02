import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Check, Lock, Coins, ArrowLeft } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { SEO } from "@/components/SEO";

interface Achievement {
  id: string;
  name: string;
  description: string;
  rewardType: string;
  rewardValue: string;
  category: string;
  earned: boolean;
  earnedAt?: string;
  progress?: number;
}

export default function Achievements() {
  const [, navigate] = useLocation();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAchievements = useCallback(async () => {
    try {
      const response = await fetch("/api/achievements/my-progress", {
        credentials: "include"
      });
      if (response.ok) {
        const data = await response.json();
        setAchievements(data);
      }
    } catch (error) {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAchievements();
  }, [fetchAchievements]);

  const categories = Array.from(new Set(achievements.map(a => a.category)));

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900">
        <Navigation />
        <div className="container mx-auto py-20">
          <div className="text-center text-white">Loading achievements...</div>
        </div>
      </div>
    );
  }

  const earnedCount = achievements.filter(a => a.earned).length;
  const totalCount = achievements.length;
  const completionPercent = totalCount > 0 ? (earnedCount / totalCount) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900">
      <SEO 
        title="Achievements - Unlock Rewards & Track Progress"
        description="Complete achievements on AmourScans to earn coins and unlock rewards. Track your progress across reading, engagement, and special challenges."
        keywords="achievements, unlock rewards, earn coins, manga achievements, progress tracking, challenges"
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
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-6 w-6" />
            Achievements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span className="font-bold">{earnedCount} / {totalCount}</span>
            </div>
            <Progress value={completionPercent} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {categories.map(category => {
        const categoryAchievements = achievements.filter(a => a.category === category);
        const categoryEarned = categoryAchievements.filter(a => a.earned).length;

        return (
          <div key={category} className="mb-6">
            <h3 className="text-lg font-semibold mb-3 capitalize">
              {category} ({categoryEarned}/{categoryAchievements.length})
            </h3>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              {categoryAchievements.map(achievement => (
                <Card key={achievement.id} className={achievement.earned ? "border-green-500" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`
                        p-2 rounded-lg
                        ${achievement.earned ? "bg-green-500 text-white" : "bg-muted"}
                      `}>
                        {achievement.earned ? (
                          <Check className="h-6 w-6" />
                        ) : (
                          <Lock className="h-6 w-6" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold mb-1">{achievement.name}</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          {achievement.description}
                        </p>
                        <div className="flex items-center gap-2 text-sm">
                          <Coins className="h-4 w-4 text-yellow-500" />
                          <span className="font-medium">{achievement.rewardValue} coins</span>
                          {achievement.earned && achievement.earnedAt && (
                            <span className="ml-auto text-xs text-green-600">
                              ✓ Earned
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
      </div>
      
      <Footer />
    </div>
  );
}
