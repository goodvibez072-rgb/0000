import { useState } from "react";
import { useLocation } from "wouter";
import { Crown, Check, Sparkles, Zap, Star, Shield, Gift, TrendingUp, ArrowLeft } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SEO } from "@/components/SEO";

interface SubscriptionPackage {
  id: string;
  name: string;
  description: string | null;
  priceUSD: string;
  billingCycle: string;
  features: string;
  coinBonus: number;
  discountPercentage: number;
  isAdFree: string;
  earlyAccess: string;
  exclusiveContent: string;
  displayOrder: number;
}

interface UserSubscription {
  id: string;
  packageId: string;
  status: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: string;
}

export default function Subscriptions() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const { data: packages, isLoading: packagesLoading } = useQuery<SubscriptionPackage[]>({
    queryKey: ["/api/subscriptions/packages"],
    queryFn: async () => {
      const response = await fetch("/api/subscriptions/packages", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch packages");
      return response.json();
    },
  });

  const { data: currentSubscription } = useQuery<UserSubscription | null>({
    queryKey: ["/api/subscriptions/current"],
    queryFn: async () => {
      const response = await fetch("/api/subscriptions/current", {
        credentials: "include",
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("Failed to fetch subscription");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const handleSubscribe = async (packageId: string) => {
    if (!isAuthenticated) {
      navigate("/login?returnTo=/subscriptions");
      return;
    }

    try {
      const response = await fetch("/api/subscriptions/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "include",
        body: JSON.stringify({ packageId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create subscription");
      }

      if (data.clientSecret) {
        navigate(`/subscriptions/checkout?session=${data.clientSecret}`);
      } else {
        toast({
          title: "Success",
          description: "Subscription created successfully!",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create subscription",
        variant: "error",
      });
    }
  };

  const parseFeatures = (features: string): string[] => {
    try {
      return JSON.parse(features);
    } catch {
      return [];
    }
  };

  const getTierIcon = (tierName: string) => {
    if (tierName.toLowerCase().includes("basic")) return <Shield className="w-6 h-6" />;
    if (tierName.toLowerCase().includes("premium")) return <Star className="w-6 h-6" />;
    if (tierName.toLowerCase().includes("vip") || tierName.toLowerCase().includes("elite")) return <Crown className="w-6 h-6" />;
    return <Sparkles className="w-6 h-6" />;
  };

  const getTierColor = (tierName: string) => {
    if (tierName.toLowerCase().includes("basic")) return "from-blue-500 to-cyan-500";
    if (tierName.toLowerCase().includes("premium")) return "from-purple-500 to-pink-500";
    if (tierName.toLowerCase().includes("vip") || tierName.toLowerCase().includes("elite")) return "from-amber-500 to-orange-500";
    return "from-gray-500 to-gray-600";
  };

  if (authLoading || packagesLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 py-20">
          <Skeleton className="h-12 w-96 mx-auto mb-4 bg-gray-800" />
          <Skeleton className="h-6 w-64 mx-auto mb-12 bg-gray-800" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[600px] bg-gray-800" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900">
      <SEO 
        title="VIP Subscriptions - Unlock Premium Manga Access Today"
        description="Unlock premium manga access with VIP subscriptions on AmourScans. Enjoy ad-free reading, exclusive content, early chapter access, and monthly bonus coins for members."
        keywords="VIP subscription, premium manga, ad-free manga, exclusive content, early access, manga membership"
      />
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 py-16">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="min-h-11 w-fit text-muted-foreground hover:text-primary mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full mb-6">
            <Crown className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold text-primary">VIP Membership</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold text-white mb-4">
            Choose Your Plan
          </h1>
          <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto">
            Unlock premium features, get exclusive content, and enjoy an ad-free experience
          </p>
        </div>

        {currentSubscription && (
          <div className="mb-8">
            <Card className="bg-gradient-to-r from-primary/20 to-accent/20 border-primary/40 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/20 rounded-lg">
                    <Check className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Active Subscription</p>
                    <p className="text-sm text-gray-400">
                      Status: {currentSubscription.status} • Renews: {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => navigate("/subscriptions/manage")}
                  className="min-h-11 border-primary/40 hover:bg-primary/10"
                >
                  Manage
                </Button>
              </div>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          {packages?.map((pkg, index) => {
            const features = parseFeatures(pkg.features);
            const isPopular = index === 1;
            const isCurrentPlan = currentSubscription?.packageId === pkg.id;
            const tierColor = getTierColor(pkg.name);

            return (
              <Card
                key={pkg.id}
                className={cn(
                  "relative overflow-hidden transition-all duration-300 hover:scale-105",
                  isPopular 
                    ? "bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-primary shadow-2xl shadow-primary/20" 
                    : "bg-gray-900/50 border border-gray-800 hover:border-gray-700",
                  isCurrentPlan && "ring-2 ring-primary"
                )}
              >
                {isPopular && (
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-primary to-accent text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                    MOST POPULAR
                  </div>
                )}

                <div className="p-8">
                  <div className={cn("inline-flex p-3 rounded-xl bg-gradient-to-br mb-4", tierColor)}>
                    {getTierIcon(pkg.name)}
                  </div>

                  <h3 className="text-2xl font-bold text-white mb-2">{pkg.name}</h3>
                  <p className="text-gray-400 text-sm mb-6">{pkg.description}</p>

                  <div className="flex items-baseline gap-2 mb-6">
                    <span className="text-5xl font-bold text-white">${pkg.priceUSD}</span>
                    <span className="text-gray-400">/{pkg.billingCycle}</span>
                  </div>

                  {pkg.coinBonus > 0 && (
                    <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-lg p-3 mb-6">
                      <Gift className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-white text-sm font-semibold">{pkg.coinBonus} Bonus Coins</p>
                        <p className="text-xs text-gray-400">Every month</p>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={() => handleSubscribe(pkg.id)}
                    disabled={isCurrentPlan}
                    className={cn(
                      "w-full mb-6",
                      isPopular
                        ? "bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
                        : "bg-gray-800 hover:bg-gray-700"
                    )}
                    size="lg"
                  >
                    {isCurrentPlan ? "Current Plan" : "Subscribe Now"}
                  </Button>

                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-gray-300 mb-3">Features:</p>
                    {features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-300">{feature}</span>
                      </div>
                    ))}
                    
                    {pkg.isAdFree === "true" && (
                      <div className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-300">Ad-free experience</span>
                      </div>
                    )}
                    
                    {pkg.earlyAccess === "true" && (
                      <div className="flex items-start gap-2">
                        <Zap className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-300">Early chapter access</span>
                      </div>
                    )}
                    
                    {pkg.exclusiveContent === "true" && (
                      <div className="flex items-start gap-2">
                        <Star className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-300">Exclusive content</span>
                      </div>
                    )}
                    
                    {pkg.discountPercentage > 0 && (
                      <div className="flex items-start gap-2">
                        <TrendingUp className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-300">{pkg.discountPercentage}% off coin purchases</span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="text-center text-gray-400 text-sm">
          <p>All subscriptions can be cancelled anytime • Secure payment via Stripe</p>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
