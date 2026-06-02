import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import VerifyEmail from "@/pages/VerifyEmail";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import ScrollToTop from "@/components/ScrollToTop";
import MangaDetailPage from "@/pages/MangaDetailPage";
import ChapterReader from "@/pages/ChapterReader";
import Browse from "@/pages/Browse";
import FeaturedPage from "@/pages/FeaturedPage";
import PinnedPage from "@/pages/PinnedPage";
import PopularPage from "@/pages/PopularPage";
import LatestUpdatesPage from "@/pages/LatestUpdatesPage";
import TrendingPage from "@/pages/TrendingPage";
import { useRealtimeQuerySync } from "@/hooks/useRealtimeQuerySync";
import { useAuth } from "@/hooks/useAuth";

// PERFORMANCE: Lazy load less frequently accessed pages
const Settings = lazy(() => import("@/pages/Settings"));
const Library = lazy(() => import("@/pages/Library"));
const History = lazy(() => import("@/pages/History"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const DMCA = lazy(() => import("@/pages/DMCA"));
const Terms = lazy(() => import("@/pages/Terms"));
const Shop = lazy(() => import("@/pages/Shop"));
const ReadingLists = lazy(() => import("@/pages/ReadingLists"));

const Admin = lazy(() => import("@/pages/Admin"));
const UserManagement = lazy(() => import("@/pages/UserManagement"));
const SeriesManagement = lazy(() => import("@/pages/SeriesManagement"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const SystemSettings = lazy(() => import("@/pages/SystemSettings"));
const AdminCurrency = lazy(() => import("@/pages/CurrencyManagement"));
const ChapterAccessManagement = lazy(() => import("@/pages/ChapterAccessManagement"));
const UserCurrencyManagement = lazy(() => import("@/pages/UserCurrencyManagement"));
const AdminAds = lazy(() => import("@/pages/AdminAds"));
const Subscriptions = lazy(() => import("@/pages/Subscriptions"));
const SubscriptionManage = lazy(() => import("@/pages/SubscriptionManage"));
const FlashSales = lazy(() => import("@/pages/FlashSales"));
const BattlePass = lazy(() => import("@/pages/BattlePass"));
const AdminMonetization = lazy(() => import("@/pages/AdminMonetization"));
const DailyRewards = lazy(() => import("@/pages/DailyRewards"));
const Achievements = lazy(() => import("@/pages/Achievements"));
const Referrals = lazy(() => import("@/pages/Referrals"));
const Loyalty = lazy(() => import("@/pages/Loyalty"));
const Wallet = lazy(() => import("@/pages/Wallet"));
const AdminFlashSales = lazy(() => import("@/pages/AdminFlashSales"));
const AdminSubscriptions = lazy(() => import("@/pages/AdminSubscriptions"));
const RoleAuthority = lazy(() => import("@/pages/RoleAuthority"));
const SecurityDashboard = lazy(() => import("@/pages/SecurityDashboard"));
const AdminSEO = lazy(() => import("@/pages/AdminSEO"));

const AdminLoadingFallback = () => (
  <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95 flex items-center justify-center">
    <div className="text-center">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
      <p className="mt-4 text-sm text-muted-foreground">Loading admin panel...</p>
    </div>
  </div>
);

function Router() {
  return (
    <ErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/browse" component={Browse} />
        <Route path="/featured" component={FeaturedPage} />
        <Route path="/pinned" component={PinnedPage} />
        <Route path="/popular" component={PopularPage} />
        <Route path="/latest-updates" component={LatestUpdatesPage} />
        <Route path="/trending" component={TrendingPage} />
        <Route path="/manga/:seriesId/chapter/:chapterNumber" component={ChapterReader} />
        <Route path="/manga/:id" component={MangaDetailPage} />
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/verify-email" component={VerifyEmail} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        
        {/* PERFORMANCE: Lazy-loaded user pages with Suspense */}
        <Route path="/library">
          <Suspense fallback={<AdminLoadingFallback />}>
            <Library />
          </Suspense>
        </Route>
        <Route path="/history">
          <Suspense fallback={<AdminLoadingFallback />}>
            <History />
          </Suspense>
        </Route>
        <Route path="/reading-lists">
          <Suspense fallback={<AdminLoadingFallback />}>
            <ReadingLists />
          </Suspense>
        </Route>
        <Route path="/settings">
          <Suspense fallback={<AdminLoadingFallback />}>
            <Settings />
          </Suspense>
        </Route>
        <Route path="/shop">
          <Suspense fallback={<AdminLoadingFallback />}>
            <Shop />
          </Suspense>
        </Route>
        <Route path="/privacy">
          <Suspense fallback={<AdminLoadingFallback />}>
            <Privacy />
          </Suspense>
        </Route>
        <Route path="/dmca">
          <Suspense fallback={<AdminLoadingFallback />}>
            <DMCA />
          </Suspense>
        </Route>
        <Route path="/terms">
          <Suspense fallback={<AdminLoadingFallback />}>
            <Terms />
          </Suspense>
        </Route>
        <Route path="/admin">
          <ErrorBoundary>
            <Suspense fallback={<AdminLoadingFallback />}>
              <Admin />
            </Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/admin/users">
          <ErrorBoundary>
            <Suspense fallback={<AdminLoadingFallback />}>
              <UserManagement />
            </Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/admin/series">
          <ErrorBoundary>
            <Suspense fallback={<AdminLoadingFallback />}>
              <SeriesManagement />
            </Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/admin/content">
          <ErrorBoundary>
            <Suspense fallback={<AdminLoadingFallback />}>
              <SeriesManagement />
            </Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/admin/analytics">
          <ErrorBoundary>
            <Suspense fallback={<AdminLoadingFallback />}>
              <Analytics />
            </Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/admin/system-settings">
          <ErrorBoundary>
            <Suspense fallback={<AdminLoadingFallback />}>
              <SystemSettings />
            </Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/admin/currency">
          <ErrorBoundary>
            <Suspense fallback={<AdminLoadingFallback />}>
              <AdminCurrency />
            </Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/admin/chapter-access">
          <ErrorBoundary>
            <Suspense fallback={<AdminLoadingFallback />}>
              <ChapterAccessManagement />
            </Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/admin/user-currency">
          <ErrorBoundary>
            <Suspense fallback={<AdminLoadingFallback />}>
              <UserCurrencyManagement />
            </Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/admin/ads">
          <ErrorBoundary>
            <Suspense fallback={<AdminLoadingFallback />}>
              <AdminAds />
            </Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/admin/monetization">
          <ErrorBoundary>
            <Suspense fallback={<AdminLoadingFallback />}>
              <AdminMonetization />
            </Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/admin/flash-sales">
          <ErrorBoundary>
            <Suspense fallback={<AdminLoadingFallback />}>
              <AdminFlashSales />
            </Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/admin/subscriptions">
          <ErrorBoundary>
            <Suspense fallback={<AdminLoadingFallback />}>
              <AdminSubscriptions />
            </Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/admin/role-authority">
          <ErrorBoundary>
            <Suspense fallback={<AdminLoadingFallback />}>
              <RoleAuthority />
            </Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/admin/security">
          <ErrorBoundary>
            <Suspense fallback={<AdminLoadingFallback />}>
              <SecurityDashboard />
            </Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/admin/seo">
          <ErrorBoundary>
            <Suspense fallback={<AdminLoadingFallback />}>
              <AdminSEO />
            </Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/subscriptions">
          <ErrorBoundary>
            <Suspense fallback={<AdminLoadingFallback />}>
              <Subscriptions />
            </Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/subscriptions/manage">
          <ErrorBoundary>
            <Suspense fallback={<AdminLoadingFallback />}>
              <SubscriptionManage />
            </Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/flash-sales">
          <ErrorBoundary>
            <Suspense fallback={<AdminLoadingFallback />}>
              <FlashSales />
            </Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/battle-pass">
          <ErrorBoundary>
            <Suspense fallback={<AdminLoadingFallback />}>
              <BattlePass />
            </Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/daily-rewards">
          <ErrorBoundary>
            <Suspense fallback={<AdminLoadingFallback />}>
              <DailyRewards />
            </Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/achievements">
          <ErrorBoundary>
            <Suspense fallback={<AdminLoadingFallback />}>
              <Achievements />
            </Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/referrals">
          <ErrorBoundary>
            <Suspense fallback={<AdminLoadingFallback />}>
              <Referrals />
            </Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/loyalty">
          <ErrorBoundary>
            <Suspense fallback={<AdminLoadingFallback />}>
              <Loyalty />
            </Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/wallet">
          <ErrorBoundary>
            <Suspense fallback={<AdminLoadingFallback />}>
              <Wallet />
            </Suspense>
          </ErrorBoundary>
        </Route>
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}

function RealtimeSyncProvider() {
  const { isAuthenticated } = useAuth();
  useRealtimeQuerySync(isAuthenticated);
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange={false}
      >
        <TooltipProvider>
          <RealtimeSyncProvider />
          <Toaster />
          <Router />
          <ScrollToTop />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
