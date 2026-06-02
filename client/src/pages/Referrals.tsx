import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Users, Copy, Gift, TrendingUp, Check, ArrowLeft } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { SEO } from "@/components/SEO";

interface ReferralCode {
  code: string;
  uses: number;
  maxUses: number | null;
  coinRewardReferrer: number;
  coinRewardReferred: number;
}

interface Referral {
  id: string;
  referredUsername: string;
  status: string;
  rewardAmount: number;
  createdAt: string;
}

export default function Referrals() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [referralCode, setReferralCode] = useState<ReferralCode | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [applyCode, setApplyCode] = useState("");

  const fetchReferralData = useCallback(async () => {
    try {
      const [codeRes, referralsRes] = await Promise.all([
        fetch("/api/referrals/my-code", { credentials: "include" }),
        fetch("/api/referrals/my-referrals", { credentials: "include" }),
      ]);

      if (codeRes.ok) {
        const codeData = await codeRes.json();
        setReferralCode(codeData);
      }

      if (referralsRes.ok) {
        const referralsData = await referralsRes.json();
        setReferrals(referralsData);
      }
    } catch (error) {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/login?returnTo=/referrals");
    } else if (isAuthenticated) {
      fetchReferralData();
    }
  }, [authLoading, isAuthenticated, navigate, fetchReferralData]);

  const copyToClipboard = () => {
    if (referralCode) {
      const referralLink = `${window.location.origin}/signup?ref=${referralCode.code}`;
      navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Referral link copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleApplyCode = async () => {
    if (!applyCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter a referral code",
        variant: "error",
      });
      return;
    }

    try {
      const response = await fetch("/api/referrals/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "include",
        body: JSON.stringify({ code: applyCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to apply code");
      }

      toast({
        title: "Success!",
        description: `You received ${data.coinsEarned} coins!`,
      });
      setApplyCode("");
      fetchReferralData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "error",
      });
    }
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
    navigate("/login?returnTo=/referrals");
    return null;
  }

  const totalEarned = referrals.reduce((sum, ref) => sum + ref.rewardAmount, 0);
  const referralLink = referralCode ? `${window.location.origin}/signup?ref=${referralCode.code}` : "";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900">
      <SEO 
        title="Referral Program - Invite Friends & Earn Bonus Coins"
        description="Invite friends to AmourScans and earn bonus coins for every successful referral. Both you and your friends get rewards when they join!"
        keywords="referral program, invite friends, earn coins, referral rewards, bonus coins, refer and earn"
      />
      <Navigation />
      
      <div className="max-w-6xl mx-auto px-4 py-16">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="w-fit text-muted-foreground hover:text-primary mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full mb-6">
            <Users className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold text-primary">Referral Program</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold text-white mb-4">
            Invite Friends, Earn Coins
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Share your referral link and both you and your friends get bonus coins!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-6 text-center">
              <Users className="w-12 h-12 mx-auto mb-3 text-primary" />
              <div className="text-3xl font-bold text-white mb-1">{referrals.length}</div>
              <p className="text-sm text-gray-400">Friends Referred</p>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-6 text-center">
              <Gift className="w-12 h-12 mx-auto mb-3 text-amber-500" />
              <div className="text-3xl font-bold text-white mb-1">{totalEarned.toLocaleString()}</div>
              <p className="text-sm text-gray-400">Coins Earned</p>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-6 text-center">
              <TrendingUp className="w-12 h-12 mx-auto mb-3 text-green-500" />
              <div className="text-3xl font-bold text-white mb-1">
                {referralCode?.coinRewardReferrer || 0}
              </div>
              <p className="text-sm text-gray-400">Coins Per Referral</p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-gradient-to-br from-primary/20 to-accent/20 border-primary/40 mb-8">
          <CardHeader>
            <CardTitle className="text-white text-2xl">Your Referral Link</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Input
                value={referralLink}
                readOnly
                className="bg-gray-900 border-gray-700 text-white font-mono text-sm"
              />
              <Button
                onClick={copyToClipboard}
                className="bg-primary hover:bg-primary/90 shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>
            </div>

            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <p className="text-sm text-gray-300">
                <strong className="text-primary">Reward:</strong> You get{" "}
                <span className="text-white font-semibold">{referralCode?.coinRewardReferrer || 0} coins</span>{" "}
                and your friend gets{" "}
                <span className="text-white font-semibold">{referralCode?.coinRewardReferred || 0} coins</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900/50 border-gray-800 mb-8">
          <CardHeader>
            <CardTitle className="text-white">Have a Referral Code?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Input
                placeholder="Enter referral code"
                value={applyCode}
                onChange={(e) => setApplyCode(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white"
              />
              <Button
                onClick={handleApplyCode}
                className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
              >
                Apply Code
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Your Referrals</CardTitle>
          </CardHeader>
          <CardContent>
            {referrals.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                <p className="text-gray-400">No referrals yet. Start inviting friends!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {referrals.map((ref) => (
                  <div
                    key={ref.id}
                    className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg"
                  >
                    <div>
                      <p className="text-white font-medium">{ref.referredUsername}</p>
                      <p className="text-sm text-gray-400">
                        {new Date(ref.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge
                        className={
                          ref.status === "completed"
                            ? "bg-green-500/20 text-green-500 border-green-500/30"
                            : "bg-yellow-500/20 text-yellow-500 border-yellow-500/30"
                        }
                      >
                        {ref.status}
                      </Badge>
                      <p className="text-sm text-gray-400 mt-1">
                        +{ref.rewardAmount} coins
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Footer />
    </div>
  );
}
