import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { TrendingUp, TrendingDown, MousePointerClick, Eye, Target, BarChart3, Loader2 } from "lucide-react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface AdAnalyticsDashboardProps {
  ads: any[];
}

interface AnalyticsOverview {
  totalImpressions: number;
  totalClicks: number;
  averageCTR: number;
}

interface PerformanceHistory {
  date: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

interface TopPerformer {
  id: string;
  title: string;
  type: string;
  placement: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

export function AdAnalyticsDashboard({ ads }: AdAnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState("7d");
  const [selectedAdId, setSelectedAdId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [overview, setOverview] = useState<AnalyticsOverview>({
    totalImpressions: 0,
    totalClicks: 0,
    averageCTR: 0,
  });
  const [performanceHistory, setPerformanceHistory] = useState<PerformanceHistory[]>([]);
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([]);

  const getDateRange = (range: string) => {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date();
    
    switch (range) {
      case "7d":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(startDate.getDate() - 30);
        break;
      case "90d":
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }
    
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate,
    };
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { startDate, endDate } = getDateRange(timeRange);
      const params = new URLSearchParams({ startDate, endDate });

      const [overviewRes, historyRes, topPerformersRes] = await Promise.all([
        fetch(`/api/ads/analytics/overview?${params}`),
        fetch(`/api/ads/analytics/performance-history?${params}`),
        fetch(`/api/ads/analytics/top-performers?${params}&limit=5`),
      ]);

      if (!overviewRes.ok || !historyRes.ok || !topPerformersRes.ok) {
        throw new Error("Failed to fetch analytics data");
      }

      const [overviewData, historyData, topPerformersData] = await Promise.all([
        overviewRes.json(),
        historyRes.json(),
        topPerformersRes.json(),
      ]);

      setOverview(overviewData);
      setPerformanceHistory(historyData);
      setTopPerformers(topPerformersData);
    } catch (err) {
      console.error("Error fetching analytics:", err);
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const labels = performanceHistory.map(h => formatDate(h.date));
  const impressionsData = performanceHistory.map(h => h.impressions);
  const clicksData = performanceHistory.map(h => h.clicks);
  const ctrData = performanceHistory.map(h => h.ctr);

  const ctrTrendData = {
    labels,
    datasets: [
      {
        label: 'CTR (%)',
        data: ctrData,
        borderColor: 'rgb(168, 85, 247)',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        fill: true,
        tension: 0.4,
      }
    ]
  };

  const performanceData = {
    labels,
    datasets: [
      {
        label: 'Impressions',
        data: impressionsData,
        borderColor: 'rgb(236, 72, 153)',
        backgroundColor: 'rgba(236, 72, 153, 0.5)',
        yAxisID: 'y',
      },
      {
        label: 'Clicks',
        data: clicksData,
        borderColor: 'rgb(168, 85, 247)',
        backgroundColor: 'rgba(168, 85, 247, 0.5)',
        yAxisID: 'y1',
      }
    ]
  };

  const adTypeData = {
    labels: ['Banner', 'Sidebar', 'Popup', 'Inline'],
    datasets: [
      {
        data: [
          ads.filter(ad => ad.type === 'banner').length,
          ads.filter(ad => ad.type === 'sidebar').length,
          ads.filter(ad => ad.type === 'popup').length,
          ads.filter(ad => ad.type === 'inline').length,
        ],
        backgroundColor: [
          'rgba(168, 85, 247, 0.8)',
          'rgba(236, 72, 153, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(244, 114, 182, 0.8)',
        ],
        borderColor: [
          'rgb(168, 85, 247)',
          'rgb(236, 72, 153)',
          'rgb(139, 92, 246)',
          'rgb(244, 114, 182)',
        ],
        borderWidth: 2,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: 'rgb(156, 163, 175)',
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        titleColor: 'rgb(243, 244, 246)',
        bodyColor: 'rgb(209, 213, 219)',
        borderColor: 'rgb(168, 85, 247)',
        borderWidth: 1,
      }
    },
    scales: {
      x: {
        ticks: {
          color: 'rgb(156, 163, 175)',
          font: {
            size: 11
          }
        },
        grid: {
          color: 'rgba(75, 85, 99, 0.2)',
        }
      },
      y: {
        ticks: {
          color: 'rgb(156, 163, 175)',
          font: {
            size: 11
          }
        },
        grid: {
          color: 'rgba(75, 85, 99, 0.2)',
        }
      }
    }
  };

  const dualAxisOptions = {
    ...chartOptions,
    scales: {
      ...chartOptions.scales,
      y1: {
        type: 'linear' as const,
        position: 'right' as const,
        ticks: {
          color: 'rgb(156, 163, 175)',
          font: {
            size: 11
          }
        },
        grid: {
          drawOnChartArea: false,
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-400 mb-2">Error loading analytics</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button 
            onClick={fetchAnalytics}
            className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-md text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-purple-900/20 to-purple-800/10 border-purple-500/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Impressions</CardTitle>
              <Eye className="w-4 h-4 text-purple-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{overview.totalImpressions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all ads</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-pink-900/20 to-pink-800/10 border-pink-500/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Clicks</CardTitle>
              <MousePointerClick className="w-4 h-4 text-pink-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{overview.totalClicks.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Engagement actions</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border-purple-500/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Average CTR</CardTitle>
              <Target className="w-4 h-4 text-purple-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{overview.averageCTR.toFixed(2)}%</div>
            <div className="flex items-center gap-1 mt-1">
              {overview.averageCTR > 2 ? (
                <TrendingUp className="w-3 h-3 text-green-400" />
              ) : (
                <TrendingDown className="w-3 h-3 text-red-400" />
              )}
              <p className="text-xs text-muted-foreground">Click-through rate</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="90d">Last 90 Days</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedAdId} onValueChange={setSelectedAdId}>
          <SelectTrigger className="w-full sm:w-[250px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Ads</SelectItem>
            {ads.map((ad) => (
              <SelectItem key={ad.id} value={ad.id}>
                {ad.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="ctr" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="ctr">CTR Trend</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
          <TabsTrigger value="top">Top Ads</TabsTrigger>
        </TabsList>

        <TabsContent value="ctr" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-400" />
                Click-Through Rate Trend
              </CardTitle>
              <CardDescription>Track CTR performance over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {performanceHistory.length > 0 ? (
                  <Line data={ctrTrendData} options={chartOptions} />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No performance data available for the selected range
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-pink-400" />
                Impressions vs Clicks
              </CardTitle>
              <CardDescription>Compare ad visibility and engagement</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {performanceHistory.length > 0 ? (
                  <Bar data={performanceData} options={dualAxisOptions} />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No performance data available for the selected range
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Ad Type Distribution</CardTitle>
              <CardDescription>Breakdown of ads by type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex items-center justify-center">
                {ads.length > 0 ? (
                  <Doughnut 
                    data={adTypeData} 
                    options={{
                      ...chartOptions,
                      scales: undefined,
                    }} 
                  />
                ) : (
                  <div className="text-muted-foreground">
                    No ads available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="top" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Ads</CardTitle>
              <CardDescription>Ranked by click-through rate</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topPerformers.map((ad, index) => (
                  <div key={ad.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="w-8 h-8 flex items-center justify-center">
                        {index + 1}
                      </Badge>
                      <div>
                        <p className="font-medium text-sm">{ad.title}</p>
                        <p className="text-xs text-muted-foreground">{ad.type} • {ad.placement}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-purple-400">{ad.ctr.toFixed(2)}%</p>
                      <p className="text-xs text-muted-foreground">{ad.clicks} / {ad.impressions}</p>
                    </div>
                  </div>
                ))}
                {topPerformers.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No ad performance data available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
