import { useEffect } from "react";
import { useLocation } from "wouter";
import { Wallet as WalletIcon, Coins, TrendingUp, TrendingDown, ShoppingCart, Gift, DollarSign, History, ArrowLeft } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useCurrencyBalance, useCurrencyTransactions, useUserPurchases } from "@/hooks/useCurrency";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SEO } from "@/components/SEO";

export default function Wallet() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: balanceData, isLoading: balanceLoading } = useCurrencyBalance();
  const { data: transactions, isLoading: transactionsLoading } = useCurrencyTransactions(100);
  const { data: purchases, isLoading: purchasesLoading } = useUserPurchases();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/login?returnTo=/wallet");
    }
  }, [authLoading, isAuthenticated, navigate]);

  if (authLoading || balanceLoading) {
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
    return null;
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "purchase":
        return <ShoppingCart className="w-5 h-5 text-green-500" />;
      case "unlock_chapter":
        return <Coins className="w-5 h-5 text-orange-500" />;
      case "gift_received":
      case "gift_sent":
        return <Gift className="w-5 h-5 text-purple-500" />;
      case "admin_grant":
        return <DollarSign className="w-5 h-5 text-blue-500" />;
      case "referral_reward":
      case "referral_bonus":
        return <TrendingUp className="w-5 h-5 text-amber-500" />;
      default:
        return <History className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatTransactionType = (type: string): string => {
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const totalEarned = transactions
    ?.filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0) || 0;

  const totalSpent = Math.abs(
    transactions
      ?.filter((t) => t.amount < 0)
      .reduce((sum, t) => sum + t.amount, 0) || 0
  );

  const totalPurchased = purchases?.reduce((sum, p) => sum + parseFloat(p.amountPaid), 0) || 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900">
      <SEO 
        title="Wallet - Manage Your Coins & Transaction History"
        description="View your coin balance, transaction history, and purchase records on AmourScans. Track earnings, spending, and all wallet activity in one place."
        keywords="wallet, coin balance, transaction history, purchase history, manga wallet, track coins"
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
            <WalletIcon className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold text-primary">Your Wallet</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold text-white mb-4">
            Coin Balance & History
          </h1>
          <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto">
            Track your coins, transactions, and purchase history
          </p>
        </div>

        <Card className="bg-gradient-to-br from-primary/20 to-accent/20 border-primary/40 mb-8">
          <CardContent className="p-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Coins className="w-12 h-12 text-orange-500" />
              <div>
                <p className="text-gray-400 text-sm">Current Balance</p>
                <p className="text-6xl font-bold text-white">
                  {balanceData?.balance.toLocaleString() || 0}
                </p>
              </div>
            </div>
            <Button
              onClick={() => navigate("/shop")}
              className="mt-4 min-h-11 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
            >
              <ShoppingCart className="w-5 h-5 mr-2" />
              Buy More Coins
            </Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-6 text-center">
              <TrendingUp className="w-10 h-10 mx-auto mb-3 text-green-500" />
              <div className="text-3xl font-bold text-white mb-1">
                {totalEarned.toLocaleString()}
              </div>
              <p className="text-sm text-gray-400">Total Earned</p>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-6 text-center">
              <TrendingDown className="w-10 h-10 mx-auto mb-3 text-red-500" />
              <div className="text-3xl font-bold text-white mb-1">
                {totalSpent.toLocaleString()}
              </div>
              <p className="text-sm text-gray-400">Total Spent</p>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-6 text-center">
              <DollarSign className="w-10 h-10 mx-auto mb-3 text-amber-500" />
              <div className="text-3xl font-bold text-white mb-1">
                ${totalPurchased.toFixed(2)}
              </div>
              <p className="text-sm text-gray-400">Total Purchased</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="transactions" className="space-y-6">
          <TabsList className="bg-gray-900/50 border border-gray-800">
            <TabsTrigger value="transactions">Transaction History</TabsTrigger>
            <TabsTrigger value="purchases">Purchase History</TabsTrigger>
          </TabsList>

          <TabsContent value="transactions">
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Transaction History</CardTitle>
              </CardHeader>
              <CardContent>
                {transactionsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 bg-gray-800" />
                    ))}
                  </div>
                ) : !transactions || transactions.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                    <p className="text-gray-400">No transactions yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {getTransactionIcon(transaction.type)}
                          <div>
                            <p className="text-white font-medium">
                              {transaction.description}
                            </p>
                            <p className="text-sm text-gray-400">
                              {formatTransactionType(transaction.type)} •{" "}
                              {new Date(transaction.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-lg font-bold ${
                              transaction.amount > 0 ? "text-green-500" : "text-red-500"
                            }`}
                          >
                            {transaction.amount > 0 ? "+" : ""}
                            {transaction.amount.toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-400">coins</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="purchases">
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Purchase History</CardTitle>
              </CardHeader>
              <CardContent>
                {purchasesLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 bg-gray-800" />
                    ))}
                  </div>
                ) : !purchases || purchases.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                    <p className="text-gray-400">No purchases yet</p>
                    <Button
                      onClick={() => navigate("/shop")}
                      className="mt-4 min-h-11 bg-primary"
                    >
                      Visit Shop
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {purchases.map((purchase) => (
                      <div
                        key={purchase.id}
                        className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg"
                      >
                        <div>
                          <p className="text-white font-medium">
                            {purchase.currencyReceived.toLocaleString()} coins
                          </p>
                          <p className="text-sm text-gray-400">
                            {purchase.paymentProvider} •{" "}
                            {new Date(purchase.createdAt).toLocaleString()}
                          </p>
                          {purchase.transactionId && (
                            <p className="text-xs text-gray-500 mt-1 font-mono">
                              {purchase.transactionId.substring(0, 20)}...
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-white">
                            ${purchase.amountPaid}
                          </p>
                          <Badge
                            className={
                              purchase.status === "completed"
                                ? "bg-green-500/20 text-green-500 border-green-500/30"
                                : purchase.status === "pending"
                                ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/30"
                                : "bg-red-500/20 text-red-500 border-red-500/30"
                            }
                          >
                            {purchase.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
      <Footer />
    </div>
  );
}
