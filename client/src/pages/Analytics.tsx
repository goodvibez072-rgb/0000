import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, TrendingUp, TrendingDown, Users, BookOpen, 
  BarChart3, Activity, Calendar, Star, Crown, Shield,
  Clock, Download, RefreshCw
} from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';
import { Line, Pie, Bar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  ChartTooltip,
  Legend
);

// Fetch analytics data
async function fetchAnalyticsData() {
  const response = await fetch("/api/admin/analytics", {
    headers: {
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch analytics data");
  }

  return response.json();
}

const CHART_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d88884', '#84d8c7'];

interface AnalyticsData {
  overview: {
    totalUsers: number;
    totalSeries: number;
    newUsersLast30Days: number;
    newUsersLast7Days: number;
    newSeriesLast30Days: number;
    newSeriesLast7Days: number;
    userGrowthRate: number;
    seriesGrowthRate: number;
  };
  userDistribution: {
    byRole: Record<string, number>;
  };
  seriesDistribution: {
    byStatus: Record<string, number>;
    byType: Record<string, number>;
  };
  genrePopularity: Array<{
    genre: string;
    count: number;
  }>;
  dailyActivity: Array<{
    date: string;
    users: number;
    views: number;
  }>;
}

export default function Analytics() {
  const { isAdmin, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [isExporting, setIsExporting] = useState(false);

  // Fetch analytics data
  const { data: analyticsData, isLoading, error, refetch, isRefetching } = useQuery<AnalyticsData>({
    queryKey: ["admin-analytics"],
    queryFn: fetchAnalyticsData,
    enabled: isAdmin && isAuthenticated,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  // Show auth gate if not admin
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
              You need admin privileges to access analytics dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate("/")}
              className="w-full"
            >
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleExportData = async () => {
    if (!analyticsData) return;
    
    setIsExporting(true);
    try {
      const exportData = {
        ...analyticsData,
        exportedAt: new Date().toISOString(),
        exportedBy: "Admin Analytics Dashboard"
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export Complete",
        description: "Analytics data has been exported successfully.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export analytics data.",
        variant: "error",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Refreshing Data",
      description: "Analytics data is being refreshed...",
    });
  };

  // Prepare chart data
  const roleChartData = analyticsData?.userDistribution?.byRole ? 
    Object.entries(analyticsData.userDistribution.byRole).map(([role, count]) => ({
      role: role.charAt(0).toUpperCase() + role.slice(1),
      count,
    })) : [];

  const statusChartData = analyticsData?.seriesDistribution?.byStatus ? 
    Object.entries(analyticsData.seriesDistribution.byStatus).map(([status, count]) => ({
      status: status.charAt(0).toUpperCase() + status.slice(1),
      count,
    })) : [];

  const genreChartData = analyticsData?.genrePopularity ? 
    analyticsData.genrePopularity.slice(0, 10).map(({ genre, count }) => ({
      genre,
      count,
    })) : [];

  const getRoleBadge = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"><Crown className="w-3 h-3 mr-1" />Admin</Badge>;
      case 'staff':
        return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"><Shield className="w-3 h-3 mr-1" />Staff</Badge>;
      case 'premium':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"><Star className="w-3 h-3 mr-1" />Premium</Badge>;
      default:
        return <Badge variant="secondary">User</Badge>;
    }
  };

  const getGrowthIcon = (rate: number) => {
    return rate >= 0 ? 
      <TrendingUp className="w-4 h-4 text-green-600" /> : 
      <TrendingDown className="w-4 h-4 text-red-600" />;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <Activity className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
            <p className="text-lg text-muted-foreground">Loading analytics data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <p className="text-lg text-destructive mb-4">Failed to load analytics data</p>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95 p-2 sm:p-4">
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/admin")}
          className="w-full sm:w-fit text-muted-foreground hover:text-primary mb-4 min-h-11 justify-start"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Admin
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary via-accent to-purple-400 bg-clip-text text-transparent">
                  Analytics Dashboard
                </h1>
                <p className="text-muted-foreground mt-2">
                  Comprehensive insights and statistics for your AmourScans platform
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                onClick={handleRefresh}
                disabled={isRefetching}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button 
                variant="outline" 
                onClick={handleExportData}
                disabled={isExporting}
              >
                <Download className="w-4 h-4 mr-2" />
                Export Data
              </Button>
            </div>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-card/80 backdrop-blur-md border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold">{analyticsData?.overview?.totalUsers || 0}</p>
                  <div className="flex items-center mt-1">
                    {getGrowthIcon(analyticsData?.overview?.userGrowthRate || 0)}
                    <span className="text-sm text-muted-foreground ml-1">
                      {Math.abs(analyticsData?.overview?.userGrowthRate || 0).toFixed(1)}% growth
                    </span>
                  </div>
                </div>
                <Users className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-md border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Series</p>
                  <p className="text-2xl font-bold">{analyticsData?.overview?.totalSeries || 0}</p>
                  <div className="flex items-center mt-1">
                    {getGrowthIcon(analyticsData?.overview?.seriesGrowthRate || 0)}
                    <span className="text-sm text-muted-foreground ml-1">
                      {Math.abs(analyticsData?.overview?.seriesGrowthRate || 0).toFixed(1)}% growth
                    </span>
                  </div>
                </div>
                <BookOpen className="w-8 h-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-md border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">New Users (30d)</p>
                  <p className="text-2xl font-bold">{analyticsData?.overview?.newUsersLast30Days || 0}</p>
                  <p className="text-sm text-muted-foreground">
                    {analyticsData?.overview?.newUsersLast7Days || 0} in last 7 days
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-md border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">New Series (30d)</p>
                  <p className="text-2xl font-bold">{analyticsData?.overview?.newSeriesLast30Days || 0}</p>
                  <p className="text-sm text-muted-foreground">
                    {analyticsData?.overview?.newSeriesLast7Days || 0} in last 7 days
                  </p>
                </div>
                <BarChart3 className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Daily Activity Chart */}
          <Card className="bg-card/80 backdrop-blur-md border-border/50">
            <CardHeader>
              <CardTitle>Daily Activity (Last 30 Days)</CardTitle>
              <CardDescription>User activity and page views over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <Line
                  data={{
                    labels: (analyticsData?.dailyActivity || []).map(d => 
                      new Date(d.date).toLocaleDateString()
                    ),
                    datasets: [
                      {
                        label: 'Active Users',
                        data: (analyticsData?.dailyActivity || []).map(d => d.users),
                        borderColor: '#8884d8',
                        backgroundColor: 'rgba(136, 132, 216, 0.1)',
                        tension: 0.4,
                      },
                      {
                        label: 'Page Views',
                        data: (analyticsData?.dailyActivity || []).map(d => d.views),
                        borderColor: '#82ca9d',
                        backgroundColor: 'rgba(130, 202, 157, 0.1)',
                        tension: 0.4,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'top' as const,
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                      },
                    },
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* User Distribution by Role */}
          <Card className="bg-card/80 backdrop-blur-md border-border/50">
            <CardHeader>
              <CardTitle>User Distribution by Role</CardTitle>
              <CardDescription>Breakdown of users by their assigned roles</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <Pie
                  data={{
                    labels: roleChartData.map(d => d.role),
                    datasets: [
                      {
                        data: roleChartData.map(d => d.count),
                        backgroundColor: CHART_COLORS,
                        borderWidth: 1,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'right' as const,
                      },
                      tooltip: {
                        callbacks: {
                          label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(0);
                            return `${label}: ${value} (${percentage}%)`;
                          }
                        }
                      }
                    },
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Series Distribution by Status */}
          <Card className="bg-card/80 backdrop-blur-md border-border/50">
            <CardHeader>
              <CardTitle>Series by Status</CardTitle>
              <CardDescription>Distribution of series by publication status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <Bar
                  data={{
                    labels: statusChartData.map(d => d.status),
                    datasets: [
                      {
                        label: 'Series Count',
                        data: statusChartData.map(d => d.count),
                        backgroundColor: '#8884d8',
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: false,
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                      },
                    },
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Popular Genres */}
          <Card className="bg-card/80 backdrop-blur-md border-border/50">
            <CardHeader>
              <CardTitle>Popular Genres</CardTitle>
              <CardDescription>Top 10 most popular genres across all series</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                {genreChartData.length > 0 ? (
                  <Bar
                    data={{
                      labels: genreChartData.map(d => d.genre),
                      datasets: [
                        {
                          label: 'Series Count',
                          data: genreChartData.map(d => d.count),
                          backgroundColor: '#82ca9d',
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      indexAxis: 'y' as const,
                      plugins: {
                        legend: {
                          display: false,
                        },
                      },
                      scales: {
                        x: {
                          beginAtZero: true,
                        },
                      },
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No genre data available</p>
                      <p className="text-sm">Add series with genres to see popularity</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary Section */}
        <div className="grid grid-cols-1 gap-6">
          <Card className="bg-card/80 backdrop-blur-md border-border/50">
            <CardHeader>
              <CardTitle>Analytics Summary</CardTitle>
              <CardDescription>Key insights from your AmourScans platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    <span className="font-medium">User Growth</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-600 mt-2">
                    {Math.abs(analyticsData?.overview?.userGrowthRate || 0).toFixed(1)}%
                  </p>
                  <p className="text-sm text-muted-foreground">30-day growth rate</p>
                </div>
                
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <BookOpen className="w-5 h-5 text-green-600" />
                    <span className="font-medium">Content Growth</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600 mt-2">
                    {Math.abs(analyticsData?.overview?.seriesGrowthRate || 0).toFixed(1)}%
                  </p>
                  <p className="text-sm text-muted-foreground">30-day growth rate</p>
                </div>
                
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Star className="w-5 h-5 text-purple-600" />
                    <span className="font-medium">Popular Genres</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-600 mt-2">
                    {genreChartData.length}
                  </p>
                  <p className="text-sm text-muted-foreground">Active genres</p>
                </div>
                
                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Activity className="w-5 h-5 text-orange-600" />
                    <span className="font-medium">User Roles</span>
                  </div>
                  <p className="text-2xl font-bold text-orange-600 mt-2">
                    {roleChartData.length}
                  </p>
                  <p className="text-sm text-muted-foreground">Different roles</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}