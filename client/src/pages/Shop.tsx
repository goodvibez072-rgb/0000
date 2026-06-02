import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Coins, Crown, Trophy, Zap, Star, Lock, Sparkles, Clock, Check, X, ShoppingCart, ArrowLeft, Loader2, Wrench } from "lucide-react";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useCurrencyBalance, useCurrencyPackages } from "@/hooks/useCurrency";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SEO } from "@/components/SEO";
import { fetchWithCsrf } from "@/lib/csrf";

export default function Shop() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: balanceData } = useCurrencyBalance();
  const { toast } = useToast();
  const [purchaseDialog, setPurchaseDialog] = useState<{ open: boolean; type: string; item: any }>({
    open: false,
    type: '',
    item: null
  });

  // Fetch shop status and mode (public endpoint accessible to all users)
  const { data: shopSettings, isLoading: shopSettingsLoading } = useQuery({
    queryKey: ['/api/settings/public/shop-status'],
    queryFn: async () => {
      const res = await fetch('/api/settings/public/shop-status');
      
      if (!res.ok) {
        // Return defaults if fetch fails
        return { enabled: true, mode: "enabled" };
      }
      
      return res.json();
    },
    staleTime: 0,
    refetchInterval: 30000, // Refetch every 30 seconds to stay in sync
    refetchOnWindowFocus: true,
  });

  // Fetch VIP subscription packages
  const { data: vipPackages, isLoading: vipLoading } = useQuery({
    queryKey: ['/api/subscriptions/packages'],
    queryFn: async () => {
      const res = await fetch('/api/subscriptions/packages', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch VIP packages');
      return res.json();
    }
  });

  // Fetch user's current subscription
  const { data: currentSub } = useQuery({
    queryKey: ['/api/subscriptions/my-subscription'],
    queryFn: async () => {
      const res = await fetch('/api/subscriptions/my-subscription', { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isAuthenticated
  });

  // Fetch battle pass progress
  const { data: battlePassData, isLoading: battlePassLoading } = useQuery({
    queryKey: ['/api/battle-pass/progress'],
    queryFn: async () => {
      const res = await fetch('/api/battle-pass/progress', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch battle pass');
      return res.json();
    },
    enabled: isAuthenticated
  });

  // Fetch flash sales
  const { data: flashSales, isLoading: flashSalesLoading } = useQuery({
    queryKey: ['/api/flash-sales/active'],
    queryFn: async () => {
      const res = await fetch('/api/flash-sales/active', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch flash sales');
      return res.json();
    }
  });

  // Fetch coin packages
  const { data: coinPackages, isLoading: coinPackagesLoading } = useCurrencyPackages(true);

  // VIP Subscription purchase mutation
  const subscribeMutation = useMutation({
    mutationFn: async (packageId: string) => {
      const res = await fetchWithCsrf('/api/subscriptions/subscribe', {
        method: 'POST',
        body: JSON.stringify({ packageId })
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to subscribe');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success!",
        description: data.message || "Successfully subscribed to VIP!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions/my-subscription'] });
      queryClient.invalidateQueries({ queryKey: ['/api/currency/balance'] });
      setPurchaseDialog({ open: false, type: '', item: null });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "error",
      });
    }
  });

  // Battle Pass upgrade mutation
  const upgradeBattlePassMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchWithCsrf('/api/battle-pass/upgrade', {
        method: 'POST',
        body: JSON.stringify({})
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to upgrade');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success!",
        description: data.message || "Upgraded to Premium Battle Pass!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/battle-pass/progress'] });
      setPurchaseDialog({ open: false, type: '', item: null });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "error",
      });
    }
  });

  // Flash sale purchase mutation
  const purchaseFlashSaleMutation = useMutation({
    mutationFn: async (saleId: string) => {
      const res = await fetchWithCsrf('/api/flash-sales/purchase', {
        method: 'POST',
        body: JSON.stringify({ saleId })
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to purchase');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success!",
        description: `${data.message} - Received ${data.coinsReceived} coins!`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/currency/balance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/flash-sales/active'] });
      setPurchaseDialog({ open: false, type: '', item: null });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "error",
      });
    }
  });

  // Coin package purchase mutation
  const purchaseCoinPackageMutation = useMutation({
    mutationFn: async (packageId: string) => {
      const res = await fetchWithCsrf('/api/currency/purchase', {
        method: 'POST',
        body: JSON.stringify({ packageId })
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to purchase');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Purchase Successful!",
        description: `You received ${data.coinsReceived} coins!`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/currency/balance'] });
      setPurchaseDialog({ open: false, type: '', item: null });
    },
    onError: (error: Error) => {
      toast({
        title: "Purchase Failed",
        description: error.message,
        variant: "error",
      });
    }
  });

  const handlePurchase = (type: string, item: any) => {
    if (!isAuthenticated) {
      navigate("/login?returnTo=/shop");
      return;
    }
    setPurchaseDialog({ open: true, type, item });
  };

  const confirmPurchase = () => {
    if (purchaseDialog.type === 'vip') {
      subscribeMutation.mutate(purchaseDialog.item.id);
    } else if (purchaseDialog.type === 'battlepass') {
      upgradeBattlePassMutation.mutate();
    } else if (purchaseDialog.type === 'flashsale') {
      purchaseFlashSaleMutation.mutate(purchaseDialog.item.id);
    } else if (purchaseDialog.type === 'coins') {
      purchaseCoinPackageMutation.mutate(purchaseDialog.item.id);
    }
  };

  const calculateTimeRemaining = (endTime: string) => {
    const end = new Date(endTime).getTime();
    const now = Date.now();
    const diff = end - now;
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  // Check shop status and show appropriate message
  if (shopSettingsLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-background to-primary/5">
        <Navigation />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  // Shop disabled or not in enabled mode
  if (!shopSettings?.enabled || (shopSettings?.mode && shopSettings.mode !== "enabled")) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-background to-primary/5">
        <SEO 
          title="Shop - AmourScans"
          description="AmourScans Premium Shop"
          keywords="manga shop, premium"
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
                {shopSettings?.mode === "maintenance" ? (
                  <>
                    <div className="mx-auto w-20 h-20 rounded-full bg-orange-500/10 flex items-center justify-center mb-4">
                      <Wrench className="w-10 h-10 text-orange-600 dark:text-orange-400" />
                    </div>
                    <h1 className="text-3xl font-bold">Shop Under Maintenance</h1>
                    <p className="text-muted-foreground text-lg">
                      We're currently performing maintenance on our shop to bring you an even better experience.
                      Please check back soon!
                    </p>
                  </>
                ) : shopSettings?.mode === "coming_soon" ? (
                  <>
                    <div className="mx-auto w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
                      <Sparkles className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h1 className="text-3xl font-bold">Shop Coming Soon!</h1>
                    <p className="text-muted-foreground text-lg">
                      Our premium shop is on the way! Get ready for exclusive memberships, coins, and special offers.
                      Stay tuned!
                    </p>
                  </>
                ) : (
                  <>
                    <div className="mx-auto w-20 h-20 rounded-full bg-gray-500/10 flex items-center justify-center mb-4">
                      <Lock className="w-10 h-10 text-gray-600 dark:text-gray-400" />
                    </div>
                    <h1 className="text-3xl font-bold">Shop Unavailable</h1>
                    <p className="text-muted-foreground text-lg">
                      The shop is currently unavailable. Please try again later.
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

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-background to-primary/5">
      <SEO 
        title="AmourScans Premium Shop - Coins, VIP & Battle Passes"
        description="Purchase coins and VIP memberships for premium manga content. Get exclusive access, ad-free reading, special perks, and rewards with battle passes and flash sales."
        keywords="manga shop, buy coins, VIP membership, premium manga, battle pass, flash sales, manga store"
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
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent mb-4">
            Premium Shop
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Enhance your reading experience with exclusive memberships, battle passes, and limited-time offers
          </p>
          
          {isAuthenticated && balanceData && (
            <div className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-card/80 backdrop-blur-md border border-primary/20 rounded-full">
              <Coins className="w-5 h-5 text-primary" />
              <span className="font-bold text-lg">{balanceData.balance} Coins</span>
            </div>
          )}
        </div>

        <Tabs defaultValue="coins" className="w-full">
          <TabsList className="grid w-full max-w-5xl mx-auto grid-cols-4 mb-8">
            <TabsTrigger value="coins" className="flex items-center gap-2">
              <Coins className="w-4 h-4" />
              <span className="hidden sm:inline">Coin Packages</span>
              <span className="sm:hidden">Coins</span>
            </TabsTrigger>
            <TabsTrigger value="vip" className="flex items-center gap-2">
              <Crown className="w-4 h-4" />
              <span className="hidden sm:inline">VIP Memberships</span>
              <span className="sm:hidden">VIP</span>
            </TabsTrigger>
            <TabsTrigger value="battlepass" className="flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              <span className="hidden sm:inline">Battle Pass</span>
              <span className="sm:hidden">Pass</span>
            </TabsTrigger>
            <TabsTrigger value="flashsales" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              <span className="hidden sm:inline">Flash Sales</span>
              <span className="sm:hidden">Sales</span>
            </TabsTrigger>
          </TabsList>

          {/* Coin Packages Tab */}
          <TabsContent value="coins" className="space-y-6">
            {coinPackagesLoading ? (
              <div className="grid md:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-80" />)}
              </div>
            ) : coinPackages && coinPackages.length > 0 ? (
              <div className="grid md:grid-cols-3 gap-6">
                {coinPackages.map((pkg: any) => {
                  const totalCoins = pkg.currencyAmount + Math.floor((pkg.currencyAmount * pkg.bonusPercentage) / 100);
                  const bonusCoins = Math.floor((pkg.currencyAmount * pkg.bonusPercentage) / 100);
                  
                  return (
                    <Card key={pkg.id} className="relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-105 border-primary/20">
                      {pkg.bonusPercentage > 0 && (
                        <div className="absolute top-0 right-0 bg-accent text-accent-foreground px-3 py-1 text-xs font-bold">
                          +{pkg.bonusPercentage}% BONUS
                        </div>
                      )}
                      
                      <CardHeader className="text-center pb-4">
                        <div className="mx-auto mb-4 relative">
                          <Coins className="w-16 h-16 text-primary" />
                          {bonusCoins > 0 && (
                            <Sparkles className="w-6 h-6 text-accent absolute -top-1 -right-1" />
                          )}
                        </div>
                        <CardTitle className="text-2xl">{pkg.name}</CardTitle>
                        <CardDescription className="mt-2">
                          {pkg.currencyAmount.toLocaleString()} coins
                          {bonusCoins > 0 && (
                            <span className="text-accent font-semibold"> + {bonusCoins.toLocaleString()} bonus</span>
                          )}
                        </CardDescription>
                        <div className="mt-4">
                          <span className="text-4xl font-bold text-primary">${pkg.priceUSD}</span>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-3">
                        <div className="p-4 bg-primary/10 rounded-lg text-center">
                          <p className="text-sm text-muted-foreground mb-1">Total Coins</p>
                          <p className="text-3xl font-bold text-primary">{totalCoins.toLocaleString()}</p>
                        </div>
                        
                        <div className="space-y-2 pt-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Check className="w-4 h-4 text-primary" />
                            <span>Instant delivery</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Check className="w-4 h-4 text-primary" />
                            <span>Use on any content</span>
                          </div>
                          {bonusCoins > 0 && (
                            <div className="flex items-center gap-2 text-sm">
                              <Sparkles className="w-4 h-4 text-accent" />
                              <span className="font-semibold text-accent">Limited time bonus!</span>
                            </div>
                          )}
                        </div>
                      </CardContent>

                      <CardFooter>
                        <Button 
                          onClick={() => handlePurchase('coins', pkg)}
                          className="w-full"
                          size="lg"
                        >
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          Buy Now
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Coins className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg text-muted-foreground">No coin packages available at the moment</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* VIP Memberships Tab */}
          <TabsContent value="vip" className="space-y-6">
            {vipLoading ? (
              <div className="grid md:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-96" />)}
              </div>
            ) : (
              <div className="grid md:grid-cols-3 gap-6">
                {vipPackages?.filter((pkg: any) => pkg.isActive === 'true').map((pkg: any) => {
                  const features = pkg.features ? JSON.parse(pkg.features) : [];
                  const isSubscribed = currentSub && currentSub.packageId === pkg.id && currentSub.status === 'active';
                  
                  return (
                    <Card key={pkg.id} className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-105 ${
                      pkg.name.includes('Elite') ? 'border-2 border-primary' : ''
                    }`}>
                      {pkg.name.includes('Elite') && (
                        <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs font-bold">
                          BEST VALUE
                        </div>
                      )}
                      
                      <CardHeader className="text-center pb-4">
                        <Crown className={`w-12 h-12 mx-auto mb-4 ${
                          pkg.name.includes('Elite') ? 'text-primary' :
                          pkg.name.includes('Premium') ? 'text-accent' :
                          'text-muted-foreground'
                        }`} />
                        <CardTitle className="text-2xl">{pkg.name}</CardTitle>
                        <CardDescription>{pkg.description}</CardDescription>
                        <div className="mt-4">
                          <span className="text-4xl font-bold text-primary">${pkg.priceUSD}</span>
                          <span className="text-muted-foreground">/month</span>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-3">
                        {features.map((feature: string, idx: number) => (
                          <div key={idx} className="flex items-start gap-2">
                            <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                            <span className="text-sm">{feature}</span>
                          </div>
                        ))}
                        {pkg.coinBonus > 0 && (
                          <div className="flex items-start gap-2">
                            <Coins className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                            <span className="text-sm font-semibold">{pkg.coinBonus} bonus coins/month</span>
                          </div>
                        )}
                      </CardContent>

                      <CardFooter>
                        <Button 
                          onClick={() => handlePurchase('vip', pkg)}
                          disabled={isSubscribed}
                          className="w-full"
                          variant={pkg.name.includes('Elite') ? 'default' : 'outline'}
                        >
                          {isSubscribed ? (
                            <>
                              <Check className="w-4 h-4 mr-2" />
                              Current Plan
                            </>
                          ) : (
                            <>
                              <Crown className="w-4 h-4 mr-2" />
                              Subscribe
                            </>
                          )}
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Battle Pass Tab */}
          <TabsContent value="battlepass" className="space-y-6">
            {battlePassLoading ? (
              <Skeleton className="h-96" />
            ) : battlePassData?.progress && battlePassData?.season ? (
              <div className="space-y-6">
                <Card className="bg-gradient-to-r from-card/80 to-primary/5 backdrop-blur-md border-primary/20">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-3xl flex items-center gap-3">
                          <Trophy className="w-8 h-8 text-primary" />
                          {battlePassData.season.name}
                        </CardTitle>
                        <CardDescription className="mt-2">{battlePassData.season.description}</CardDescription>
                      </div>
                      <Badge variant={battlePassData.progress.isPremium === 'true' ? 'default' : 'outline'} className="text-lg px-4 py-2">
                        {battlePassData.progress.isPremium === 'true' ? (
                          <>
                            <Star className="w-4 h-4 mr-1" />
                            Premium
                          </>
                        ) : (
                          'Free'
                        )}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium">Current Tier: {battlePassData.progress.currentTier}</span>
                        <span className="text-sm text-muted-foreground">
                          {battlePassData.progress.experience} / {battlePassData.progress.nextTierExperience} XP
                        </span>
                      </div>
                      <Progress 
                        value={(battlePassData.progress.experience / battlePassData.progress.nextTierExperience) * 100} 
                        className="h-3"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-background/50 rounded-lg">
                      <div>
                        <p className="font-semibold">Season Ends</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(battlePassData.season.endDate).toLocaleDateString()}
                        </p>
                      </div>
                      <Clock className="w-6 h-6 text-muted-foreground" />
                    </div>

                    {battlePassData.progress.isPremium !== 'true' && (
                      <Card className="border-primary/50 bg-gradient-to-r from-primary/10 to-accent/10">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="font-bold text-lg mb-2">Upgrade to Premium</h3>
                              <p className="text-sm text-muted-foreground mb-4">
                                Unlock exclusive rewards, bonus XP, and premium tier items
                              </p>
                              <ul className="space-y-2">
                                <li className="flex items-center gap-2 text-sm">
                                  <Sparkles className="w-4 h-4 text-primary" />
                                  2x Coin Rewards
                                </li>
                                <li className="flex items-center gap-2 text-sm">
                                  <Star className="w-4 h-4 text-primary" />
                                  Exclusive Premium Tiers
                                </li>
                                <li className="flex items-center gap-2 text-sm">
                                  <Trophy className="w-4 h-4 text-primary" />
                                  Special Badges & Icons
                                </li>
                              </ul>
                            </div>
                            <Button 
                              onClick={() => handlePurchase('battlepass', null)}
                              className="flex-shrink-0"
                              size="lg"
                            >
                              <Sparkles className="w-4 h-4 mr-2" />
                              Upgrade - $9.99
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg text-muted-foreground">No active battle pass season</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Flash Sales Tab */}
          <TabsContent value="flashsales" className="space-y-6">
            {flashSalesLoading ? (
              <div className="grid md:grid-cols-2 gap-6">
                {[1, 2].map(i => <Skeleton key={i} className="h-64" />)}
              </div>
            ) : flashSales && flashSales.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-6">
                {flashSales.map((sale: any) => {
                  const timeRemaining = calculateTimeRemaining(sale.endTime);
                  const soldOut = sale.maxPurchases && sale.currentPurchases >= sale.maxPurchases;
                  
                  return (
                    <Card key={sale.id} className="relative overflow-hidden border-2 border-accent/50 hover:border-accent transition-colors">
                      <div className="absolute top-0 right-0 bg-accent text-accent-foreground px-4 py-1 text-sm font-bold flex items-center gap-1">
                        <Zap className="w-4 h-4" />
                        {sale.discountPercentage}% OFF
                      </div>

                      <CardHeader>
                        <CardTitle className="text-2xl pr-24">{sale.packageName}</CardTitle>
                        <CardDescription>{sale.currencyAmount.toLocaleString()} Coins</CardDescription>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground line-through">${sale.originalPrice}</p>
                            <p className="text-3xl font-bold text-accent">${sale.salePrice}</p>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                              <Clock className="w-4 h-4" />
                              {timeRemaining}
                            </div>
                            {sale.maxPurchases && (
                              <div className="text-sm text-muted-foreground">
                                {sale.currentPurchases || 0} / {sale.maxPurchases} sold
                              </div>
                            )}
                          </div>
                        </div>

                        <Button 
                          onClick={() => handlePurchase('flashsale', sale)}
                          disabled={soldOut || timeRemaining === 'Expired'}
                          className="w-full"
                          size="lg"
                        >
                          {soldOut ? (
                            'Sold Out'
                          ) : timeRemaining === 'Expired' ? (
                            'Expired'
                          ) : (
                            <>
                              <Zap className="w-4 h-4 mr-2" />
                              Buy Now
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Zap className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg text-muted-foreground">No active flash sales at the moment</p>
                  <p className="text-sm text-muted-foreground mt-2">Check back soon for limited-time offers!</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Purchase Confirmation Dialog */}
      <Dialog open={purchaseDialog.open} onOpenChange={(open) => setPurchaseDialog({ ...purchaseDialog, open })}>
        <DialogContent className="w-[95vw] max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm Purchase</DialogTitle>
            <DialogDescription>
              {purchaseDialog.type === 'vip' && purchaseDialog.item && (
                <div className="mt-4 space-y-2">
                  <p>Subscribe to <strong>{purchaseDialog.item.name}</strong> for <strong>${purchaseDialog.item.priceUSD}/month</strong>?</p>
                  <p className="text-sm text-muted-foreground">This is a simulated purchase. No real payment will be processed.</p>
                </div>
              )}
              {purchaseDialog.type === 'battlepass' && (
                <div className="mt-4 space-y-2">
                  <p>Upgrade to <strong>Premium Battle Pass</strong> for <strong>$9.99</strong>?</p>
                  <p className="text-sm text-muted-foreground">This is a simulated purchase. No real payment will be processed.</p>
                </div>
              )}
              {purchaseDialog.type === 'flashsale' && purchaseDialog.item && (
                <div className="mt-4 space-y-2">
                  <p>Purchase <strong>{purchaseDialog.item.name}</strong> for <strong>${purchaseDialog.item.salePrice}</strong>?</p>
                  <p className="text-sm text-muted-foreground">This is a simulated purchase. No real payment will be processed.</p>
                </div>
              )}
              {purchaseDialog.type === 'coins' && purchaseDialog.item && (
                <div className="mt-4 space-y-2">
                  <p>Purchase <strong>{purchaseDialog.item.name}</strong> for <strong>${purchaseDialog.item.priceUSD}</strong>?</p>
                  <div className="p-3 bg-primary/10 rounded-lg mt-3">
                    <p className="text-sm">You will receive:</p>
                    <p className="text-2xl font-bold text-primary">
                      {(purchaseDialog.item.currencyAmount + Math.floor((purchaseDialog.item.currencyAmount * purchaseDialog.item.bonusPercentage) / 100)).toLocaleString()} coins
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">This is a simulated purchase. No real payment will be processed.</p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setPurchaseDialog({ open: false, type: '', item: null })}
              className="flex-1 min-h-11"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmPurchase}
              disabled={subscribeMutation.isPending || upgradeBattlePassMutation.isPending || purchaseFlashSaleMutation.isPending || purchaseCoinPackageMutation.isPending}
              className="flex-1 min-h-11"
            >
              {(subscribeMutation.isPending || upgradeBattlePassMutation.isPending || purchaseFlashSaleMutation.isPending || purchaseCoinPackageMutation.isPending) ? (
                'Processing...'
              ) : (
                'Confirm Purchase'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
