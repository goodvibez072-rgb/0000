import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, Users, BookOpen, BarChart3, Settings, 
  TrendingUp, Activity, Database, FileText, 
  AlertCircle, CheckCircle, Clock, Loader2, Monitor, DollarSign,
  Package, Tag, UserPlus, Receipt, RefreshCw, Search
} from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

// Fetch site statistics
async function fetchSiteStats() {
  const response = await fetch("/api/admin/stats", {
    headers: {
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch site statistics");
  }

  return response.json();
}

// Fetch recent series for preview
async function fetchRecentSeries() {
  const response = await fetch("/api/admin/recent-series", {
    headers: {
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch recent series");
  }

  return response.json();
}

export default function Admin() {
  const { isAdmin, isAuthenticated, user, isOwner, isStaff } = useAuth();
  const [, navigate] = useLocation();
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  // Fetch real site statistics
  const { data: siteStats, isLoading, error } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: fetchSiteStats,
    enabled: isAdmin && isAuthenticated,
  });

  // Fetch recent series for preview
  const { data: recentSeries, isLoading: isLoadingSeries, error: seriesError } = useQuery({
    queryKey: ["admin-recent-series"],
    queryFn: fetchRecentSeries,
    enabled: isAdmin && isAuthenticated,
  });

  // Show login required message if not authenticated/admin
  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-card/80 backdrop-blur-md border-border/50">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Admin Access Required</CardTitle>
            <CardDescription className="mt-2">
              {!isAuthenticated 
                ? "Please log in with an administrator account to access the admin panel."
                : "Your account does not have administrator privileges."
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {!isAuthenticated ? (
              <>
                <Button 
                  onClick={() => navigate("/login")}
                  className="w-full"
                >
                  Go to Login
                </Button>
                <Button 
                  onClick={() => navigate("/")}
                  variant="outline"
                  className="w-full"
                >
                  Return to Home
                </Button>
              </>
            ) : (
              <Button 
                onClick={() => navigate("/")}
                className="w-full"
              >
                Return to Home
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Default values for stats while loading or if error
  const defaultStats = {
    totalUsers: 0,
    totalSeries: 0,
    activeReaders: 0,
    dailyViews: 0
  };

  const displayStats = siteStats || defaultStats;

  // Handler functions for quick actions
  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const response = await fetch("/api/admin/report", {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      if (response.ok) {
        const reportData = await response.json();
        
        // Create a downloadable report
        const blob = new Blob([JSON.stringify(reportData, null, 2)], {
          type: 'application/json'
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `admin-report-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: "Report Generated",
          description: "Admin report has been downloaded successfully.",
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.message || "Failed to generate report",
          variant: "error",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate report",
        variant: "error",
      });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleBackupDatabase = async () => {
    setIsBackingUp(true);
    try {
      const csrfResponse = await fetch("/api/csrf-token", { credentials: "include" });
      const { csrfToken } = await csrfResponse.json();
      
      const response = await fetch("/api/admin/backup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          name: `admin-panel-backup-${new Date().toISOString().split('T')[0]}`
        }),
      });

      if (response.ok) {
        const backupData = await response.json();
        toast({
          title: "Backup Created",
          description: `Database backup created: ${backupData.filename}`,
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.message || "Failed to create backup",
          variant: "error",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create backup",
        variant: "error",
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleViewAnalytics = async () => {
    setIsLoadingAnalytics(true);
    try {
      const response = await fetch("/api/admin/analytics", {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      if (response.ok) {
        const analyticsData = await response.json();
        
        // Create a formatted analytics view
        const analyticsText = `
AmourScans Analytics Report
Generated: ${new Date().toLocaleString()}

Overview:
- Total Users: ${analyticsData.overview.totalUsers}
- Total Series: ${analyticsData.overview.totalSeries}
- New Users (30 days): ${analyticsData.overview.newUsersLast30Days}
- New Users (7 days): ${analyticsData.overview.newUsersLast7Days}
- User Growth Rate: ${analyticsData.overview.userGrowthRate}%
- Series Growth Rate: ${analyticsData.overview.seriesGrowthRate}%

User Distribution by Role:
${Object.entries(analyticsData.userDistribution.byRole)
  .map(([role, count]) => `- ${role}: ${count}`)
  .join('\n')}

Series Distribution by Status:
${Object.entries(analyticsData.seriesDistribution.byStatus)
  .map(([status, count]) => `- ${status}: ${count}`)
  .join('\n')}

Series Distribution by Type:
${Object.entries(analyticsData.seriesDistribution.byType)
  .map(([type, count]) => `- ${type}: ${count}`)
  .join('\n')}
        `;

        // Create a downloadable analytics report
        const blob = new Blob([analyticsText], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-report-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: "Analytics Downloaded",
          description: "Analytics report has been downloaded successfully.",
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.message || "Failed to load analytics",
          variant: "error",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load analytics",
        variant: "error",
      });
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "user": return <Users className="w-4 h-4" />;
      case "series": return <BookOpen className="w-4 h-4" />;
      case "system": return <Database className="w-4 h-4" />;
      case "alert": return <AlertCircle className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      case "warning": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "error": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95 p-2 sm:p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 sm:justify-between mb-6 sm:mb-8">
          <div className="flex items-center space-x-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
                ← Back to AmourScans
              </Button>
            </Link>
            <div className="flex items-center space-x-2">
              <Shield className="w-8 h-8 text-primary" />
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-accent to-purple-400 bg-clip-text text-transparent">
                Admin Panel
              </h1>
              {isOwner && (
                <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
                  Owner
                </Badge>
              )}
              {!isOwner && isAdmin && (
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  Administrator
                </Badge>
              )}
              {!isOwner && !isAdmin && isStaff && (
                <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 border-blue-500/30">
                  Staff
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-card/80 backdrop-blur-md border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Loading...</span>
                    </div>
                  ) : (
                    <p className="text-2xl font-bold">{displayStats.totalUsers.toLocaleString()}</p>
                  )}
                </div>
                <Users className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-md border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Series</p>
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Loading...</span>
                    </div>
                  ) : (
                    <p className="text-2xl font-bold">{displayStats.totalSeries.toLocaleString()}</p>
                  )}
                </div>
                <BookOpen className="w-8 h-8 text-accent" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-md border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Readers</p>
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Loading...</span>
                    </div>
                  ) : (
                    <div>
                      <p className="text-2xl font-bold">{displayStats.activeReaders.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Coming soon</p>
                    </div>
                  )}
                </div>
                <Activity className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-md border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Daily Views</p>
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Loading...</span>
                    </div>
                  ) : (
                    <div>
                      <p className="text-2xl font-bold">{displayStats.dailyViews.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Coming soon</p>
                    </div>
                  )}
                </div>
                <BarChart3 className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-red-800 dark:text-red-200">
                Failed to load statistics. Please refresh the page or try again later.
              </p>
            </div>
          </div>
        )}

        {/* Recent Series Preview */}
        <div className="mb-8">
          <Card className="bg-card/80 backdrop-blur-md border-border/50">
            <CardHeader>
              <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 sm:justify-between">
                <div className="flex items-center space-x-2">
                  <BookOpen className="w-5 h-5" />
                  <span>Recent Series</span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate("/admin/series")}
                >
                  View All
                </Button>
              </CardTitle>
              <CardDescription>
                Recently added series in your catalog
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSeries ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="ml-2">Loading series...</span>
                </div>
              ) : seriesError ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                  <p>Failed to load recent series</p>
                </div>
              ) : !recentSeries || recentSeries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="w-8 h-8 mx-auto mb-2" />
                  <p>No series available</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => navigate("/admin/series")}
                  >
                    Add Your First Series
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  {recentSeries.map((series: any) => (
                    <div key={series.id} className="group">
                      <div className="aspect-[3/4] relative mb-2 bg-muted rounded-lg overflow-hidden">
                        {series.coverImageUrl ? (
                          <img
                            src={series.coverImageUrl}
                            alt={series.title}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-muted">
                            <BookOpen className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-semibold text-sm leading-tight line-clamp-2">
                          {series.title}
                        </h3>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {series.genres ? (Array.isArray(series.genres) ? series.genres.slice(0, 2).join(', ') : series.genres.split(',').slice(0, 2).join(', ')) : 'No genres'}
                        </p>
                        <div className="flex items-center space-x-1">
                          <Badge variant="secondary" className="text-xs">
                            {series.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Admin Actions */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-card/80 backdrop-blur-md border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="w-5 h-5" />
                  <span>Administration</span>
                </CardTitle>
                <CardDescription>
                  Manage users, content, and system settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button 
                    variant="outline" 
                    className="h-auto p-6 flex flex-col items-start space-y-2"
                    onClick={() => navigate("/admin/users")}
                  >
                    <div className="flex items-center space-x-2">
                      <Users className="w-5 h-5 text-primary" />
                      <span className="font-semibold">User Management</span>
                    </div>
                    <p className="text-sm text-muted-foreground text-left">
                      View, edit, and manage user accounts
                    </p>
                  </Button>

                  {isOwner && (
                    <Button 
                      variant="outline" 
                      className="h-auto p-6 flex flex-col items-start space-y-2 border-primary/30"
                      onClick={() => navigate("/admin/role-authority")}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center space-x-2">
                          <Shield className="w-5 h-5 text-primary" />
                          <span className="font-semibold">Role Authority</span>
                        </div>
                        <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30 text-xs">
                          Owner
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground text-left">
                        Manage roles and permissions
                      </p>
                    </Button>
                  )}

                  <Button 
                    variant="outline" 
                    className="h-auto p-6 flex flex-col items-start space-y-2"
                    onClick={() => navigate("/admin/series")}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center space-x-2">
                        <BookOpen className="w-5 h-5 text-accent" />
                        <span className="font-semibold">Content Management</span>
                      </div>
                      {isStaff && !isAdmin && (
                        <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500 text-xs">
                          Read-only
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground text-left">
                      {isStaff && !isAdmin ? "View manga series (Staff)" : "Add, edit, and organize manga series"}
                    </p>
                  </Button>

                  <Button 
                    variant="outline" 
                    className="h-auto p-6 flex flex-col items-start space-y-2"
                    onClick={() => navigate("/admin/analytics")}
                  >
                    <div className="flex items-center space-x-2">
                      <BarChart3 className="w-5 h-5 text-purple-500" />
                      <span className="font-semibold">Analytics</span>
                    </div>
                    <p className="text-sm text-muted-foreground text-left">
                      View site statistics and reports
                    </p>
                  </Button>

                  <Button 
                    variant="outline" 
                    className="h-auto p-6 flex flex-col items-start space-y-2"
                    onClick={() => navigate("/admin/seo")}
                  >
                    <div className="flex items-center space-x-2">
                      <Search className="w-5 h-5 text-green-500" />
                      <span className="font-semibold">SEO Management</span>
                    </div>
                    <p className="text-sm text-muted-foreground text-left">
                      Manage meta tags, optimize search rankings
                    </p>
                  </Button>

                  <Button 
                    variant="outline" 
                    className="h-auto p-6 flex flex-col items-start space-y-2"
                    onClick={() => navigate("/admin/ads")}
                  >
                    <div className="flex items-center space-x-2">
                      <Monitor className="w-5 h-5 text-orange-500" />
                      <span className="font-semibold">Ad Management</span>
                    </div>
                    <p className="text-sm text-muted-foreground text-left">
                      Create and manage site advertisements
                    </p>
                  </Button>

                  <Button 
                    variant="outline" 
                    className="h-auto p-6 flex flex-col items-start space-y-2"
                    onClick={() => navigate("/admin/monetization")}
                  >
                    <div className="flex items-center space-x-2">
                      <DollarSign className="w-5 h-5 text-amber-500" />
                      <span className="font-semibold">Monetization Dashboard</span>
                    </div>
                    <p className="text-sm text-muted-foreground text-left">
                      Manage revenue, subscriptions, and currency
                    </p>
                  </Button>

                </div>
              </CardContent>
            </Card>

            {/* System Status */}
            <Card className="bg-card/80 backdrop-blur-md border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Database className="w-5 h-5" />
                  <span>System Status</span>
                </CardTitle>
                <CardDescription>
                  Current system health and performance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-5 h-5 text-orange-600" />
                      <span className="font-medium">Database</span>
                    </div>
                    <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300">
                      Healthy
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-5 h-5 text-orange-600" />
                      <span className="font-medium">Server</span>
                    </div>
                    <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300">
                      Online
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* System Information */}
          <div className="space-y-6">
            <Card className="bg-card/80 backdrop-blur-md border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="w-5 h-5" />
                  <span>System Information</span>
                </CardTitle>
                <CardDescription>
                  Live data from your AmourScans instance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Database className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium">Database Status</span>
                  </div>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                    Connected
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-medium">User Accounts</span>
                  </div>
                  <span className="text-sm font-bold">{displayStats.totalUsers}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <BookOpen className="w-4 h-4 text-orange-600" />
                    <span className="text-sm font-medium">Series Catalog</span>
                  </div>
                  <span className="text-sm font-bold">{displayStats.totalSeries}</span>
                </div>

                {error && (
                  <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      <span className="text-sm font-medium">API Status</span>
                    </div>
                    <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                      Error
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="bg-card/80 backdrop-blur-md border-border/50">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={handleGenerateReport}
                  disabled={isGeneratingReport}
                >
                  {isGeneratingReport ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4 mr-2" />
                  )}
                  Generate Report
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={handleBackupDatabase}
                  disabled={isBackingUp}
                >
                  {isBackingUp ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Database className="w-4 h-4 mr-2" />
                  )}
                  Backup Database
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={handleViewAnalytics}
                  disabled={isLoadingAnalytics}
                >
                  {isLoadingAnalytics ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <TrendingUp className="w-4 h-4 mr-2" />
                  )}
                  View Analytics
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}