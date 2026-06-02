import { useState } from "react";
import { useLocation } from "wouter";
import { Crown, AlertCircle, Check, X, CreditCard, Calendar, TrendingUp, ArrowLeft } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface UserSubscription {
  id: string;
  packageId: string;
  packageName: string;
  priceUSD: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: string;
  features: string;
}

export default function SubscriptionManage() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const { data: subscription, isLoading } = useQuery<UserSubscription | null>({
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

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/subscriptions/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to cancel subscription");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/current"] });
      toast({
        title: "Subscription Cancelled",
        description: "Your subscription will remain active until the end of the billing period.",
      });
      setShowCancelDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "error",
      });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/subscriptions/reactivate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to reactivate subscription");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/current"] });
      toast({
        title: "Subscription Reactivated",
        description: "Your subscription will continue automatically.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "error",
      });
    },
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 py-20">
          <Skeleton className="h-12 w-96 mx-auto mb-12 bg-gray-800" />
          <Skeleton className="h-96 bg-gray-800" />
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 py-20">
          <Card className="bg-gray-900/50 border-gray-800 text-center p-12">
            <Crown className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <h2 className="text-2xl font-bold text-white mb-2">No Active Subscription</h2>
            <p className="text-gray-400 mb-6">Subscribe to a plan to unlock premium features</p>
            <Button
              onClick={() => navigate("/subscriptions")}
              className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
            >
              View Plans
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const parseFeatures = (features: string): string[] => {
    try {
      return JSON.parse(features);
    } catch {
      return [];
    }
  };

  const features = parseFeatures(subscription.features);
  const isActive = subscription.status === "active";
  const willCancel = subscription.cancelAtPeriodEnd === "true";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900">
      <Navigation />
      
      <div className="max-w-4xl mx-auto px-4 py-16">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="w-fit text-muted-foreground hover:text-primary mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Manage Subscription</h1>
          <p className="text-gray-400">View and manage your subscription details</p>
        </div>

        <div className="space-y-6">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Crown className="w-5 h-5 text-primary" />
                    {subscription.packageName}
                  </CardTitle>
                  <CardDescription>
                    ${subscription.priceUSD}/month
                  </CardDescription>
                </div>
                <Badge
                  variant={isActive ? "default" : "secondary"}
                  className={isActive ? "bg-green-500/20 text-green-500 border-green-500/30" : ""}
                >
                  {subscription.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Current Period</p>
                    <p className="text-white font-medium">
                      {new Date(subscription.currentPeriodStart).toLocaleDateString()} - {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <CreditCard className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Next Billing</p>
                    <p className="text-white font-medium">
                      {willCancel ? "N/A (Cancelled)" : new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              {willCancel && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-amber-500 font-medium">Subscription Ending</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Your subscription will end on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}. 
                      Reactivate to continue enjoying premium benefits.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Features Included</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {features.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-300">{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Subscription Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={() => navigate("/subscriptions")}
                variant="outline"
                className="w-full justify-start border-gray-700 hover:bg-gray-800"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Upgrade Plan
              </Button>

              {willCancel ? (
                <Button
                  onClick={() => reactivateMutation.mutate()}
                  disabled={reactivateMutation.isPending}
                  variant="outline"
                  className="w-full justify-start border-green-500/30 text-green-500 hover:bg-green-500/10"
                >
                  <Check className="w-4 h-4 mr-2" />
                  {reactivateMutation.isPending ? "Reactivating..." : "Reactivate Subscription"}
                </Button>
              ) : (
                <Button
                  onClick={() => setShowCancelDialog(true)}
                  variant="outline"
                  className="w-full justify-start border-red-500/30 text-red-500 hover:bg-red-500/10"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel Subscription
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent className="bg-gray-900 border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Cancel Subscription?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Your subscription will remain active until the end of the current billing period on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}. 
              You can reactivate anytime before then.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700">
              Keep Subscription
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              className="bg-red-500 hover:bg-red-600"
            >
              {cancelMutation.isPending ? "Cancelling..." : "Cancel Subscription"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <Footer />
    </div>
  );
}
