import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Zap, Clock, Percent, ShoppingCart, Coins, ArrowLeft } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SEO } from "@/components/SEO";

interface FlashSale {
  id: string;
  packageId: string;
  packageName: string;
  originalPrice: string;
  salePrice: string;
  currencyAmount: number;
  bonusPercentage: number;
  discountPercent: number;
  startTime: string;
  endTime: string;
  maxPurchases: number;
  currentPurchases: number;
  isActive: string;
}

function CountdownTimer({ endTime }: { endTime: string }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const calculateTimeLeft = () => {
      const end = new Date(endTime).getTime();
      const now = new Date().getTime();
      const distance = end - now;

      if (distance < 0) {
        setTimeLeft("EXPIRED");
        return;
      }

      const hours = Math.floor(distance / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [endTime]);

  return (
    <div className="flex items-center gap-2 text-white">
      <Clock className="w-5 h-5 text-red-500 animate-pulse" />
      <span className="font-mono font-bold text-lg">{timeLeft}</span>
    </div>
  );
}

export default function FlashSales() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const { data: flashSales, isLoading } = useQuery<FlashSale[]>({
    queryKey: ["/api/flash-sales/active"],
    queryFn: async () => {
      const response = await fetch("/api/flash-sales/active", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch flash sales");
      return response.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const handlePurchase = async (saleId: string) => {
    if (!isAuthenticated) {
      navigate("/login?returnTo=/flash-sales");
      return;
    }

    try {
      const response = await fetch("/api/flash-sales/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "include",
        body: JSON.stringify({ saleId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to purchase");
      }

      toast({
        title: "Purchase Successful!",
        description: `${data.coinsReceived} coins added to your account`,
      });
    } catch (error: any) {
      toast({
        title: "Purchase Failed",
        description: error.message,
        variant: "error",
      });
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900">
        <Navigation />
        <div className="max-w-6xl mx-auto px-4 py-20">
          <Skeleton className="h-12 w-96 mx-auto mb-12 bg-gray-800" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-64 bg-gray-800" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900">
      <SEO 
        title="Flash Sales - Limited Time Manga Deals & Discounts"
        description="Grab exclusive limited-time manga deals before they're gone. Get massive discounts on coins and premium content with our flash sales, special offers, and deals."
        keywords="flash sales, manga deals, limited offers, discount coins, manga sales, special deals"
      />
      <Navigation />
      
      <div className="max-w-6xl mx-auto px-4 py-16">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="w-fit text-muted-foreground hover:text-primary mb-4 min-h-11"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-full mb-6 animate-pulse">
            <Zap className="w-5 h-5 text-red-500" />
            <span className="text-sm font-semibold text-red-500">LIMITED TIME ONLY</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold text-white mb-4">
            ⚡ Flash Sales
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Grab exclusive deals before they're gone! Limited quantity and time offers
          </p>
        </div>

        {!flashSales || flashSales.length === 0 ? (
          <Card className="bg-gray-900/50 border-gray-800 text-center p-16">
            <Zap className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <h3 className="text-2xl font-bold text-white mb-2">No Active Flash Sales</h3>
            <p className="text-gray-400 mb-6">Check back soon for amazing deals!</p>
            <Button
              onClick={() => navigate("/shop")}
              variant="outline"
              className="border-primary/40 hover:bg-primary/10 min-h-11"
            >
              Browse Regular Shop
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {flashSales.map((sale) => {
              const stockRemaining = sale.maxPurchases - sale.currentPurchases;
              const stockPercent = (stockRemaining / sale.maxPurchases) * 100;
              const totalCoins = sale.currencyAmount + Math.floor((sale.currencyAmount * sale.bonusPercentage) / 100);

              return (
                <Card
                  key={sale.id}
                  className="relative overflow-hidden bg-gradient-to-br from-red-500/10 to-orange-500/10 border-red-500/30 hover:border-red-500/50 transition-all duration-300"
                >
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl">
                    {sale.discountPercent}% OFF
                  </div>

                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-2xl font-bold text-white mb-1">{sale.packageName}</h3>
                        <div className="flex items-center gap-2">
                          <Coins className="w-5 h-5 text-orange-500" />
                          <span className="text-xl font-semibold text-white">{totalCoins.toLocaleString()} Coins</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-black/30 rounded-lg p-4 border border-gray-700">
                      <CountdownTimer endTime={sale.endTime} />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Stock Remaining</span>
                        <span className="text-white font-semibold">{stockRemaining}/{sale.maxPurchases}</span>
                      </div>
                      <Progress
                        value={stockPercent}
                        className={cn(
                          "h-2",
                          stockPercent < 20 ? "bg-red-900" : "bg-gray-700"
                        )}
                      />
                      {stockPercent < 20 && (
                        <p className="text-xs text-red-400 font-semibold animate-pulse">Almost sold out!</p>
                      )}
                    </div>

                    <div className="flex items-end gap-3">
                      <div>
                        <p className="text-xs text-gray-400">Was</p>
                        <p className="text-gray-500 line-through text-lg">${sale.originalPrice}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Now</p>
                        <p className="text-3xl font-bold text-white">${sale.salePrice}</p>
                      </div>
                    </div>

                    {sale.bonusPercentage > 0 && (
                      <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-center gap-2">
                        <Percent className="w-4 h-4 text-primary" />
                        <span className="text-sm text-primary font-semibold">
                          +{sale.bonusPercentage}% Bonus Coins Included!
                        </span>
                      </div>
                    )}

                    <Button
                      onClick={() => handlePurchase(sale.id)}
                      disabled={stockRemaining <= 0}
                      className="w-full bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white shadow-lg shadow-red-500/25 min-h-11"
                      size="lg"
                    >
                      <ShoppingCart className="w-5 h-5 mr-2" />
                      {stockRemaining <= 0 ? "Sold Out" : "Grab This Deal"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      
      <Footer />
    </div>
  );
}
