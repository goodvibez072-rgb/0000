import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { fetchWithCsrf } from "@/lib/csrf";
import { 
  Search, 
  Save, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  Sparkles,
  BarChart3,
  Globe,
  Eye,
  EyeOff,
  ArrowLeft,
  Shield
} from "lucide-react";

interface Series {
  id: string;
  title: string;
  description: string;
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  robotsNoindex: string;
  seoKeywords: string | null;
  coverImageUrl: string | null;
  genres: string | null;
  author: string | null;
  type: string;
}

interface Chapter {
  id: string;
  seriesId: string;
  chapterNumber: string;
  title: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  robotsNoindex: string;
}

interface SEOHealth {
  content: {
    totalSeries: number;
    totalChapters: number;
    publishedChapters: number;
  };
  seoMetadata: {
    metaTitleCoverage: string;
    metaDescriptionCoverage: string;
    coverImageCoverage: string;
  };
  indexing: {
    indexableSeries: number;
    noindexSeries: number;
    indexableChapters: number;
    noindexChapters: number;
  };
  recommendations: string[];
}

export default function AdminSEO() {
  const [, navigate] = useLocation();
  const { isAdmin, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSeries, setSelectedSeries] = useState<Series | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch all series
  const { data: series = [], isLoading: loadingSeries } = useQuery<Series[]>({
    queryKey: ["/api/series"],
  });

  // Fetch SEO health
  const { data: seoHealth, refetch: refetchHealth } = useQuery<SEOHealth>({
    queryKey: ["/api/seo/health"],
  });

  // Fetch chapters for selected series
  const { data: chapters = [] } = useQuery<Chapter[]>({
    queryKey: [`/api/series/${selectedSeries?.id}/chapters`],
    enabled: !!selectedSeries?.id,
  });

  // Update series SEO metadata
  const updateSeriesSEO = useMutation({
    mutationFn: async (data: Partial<Series>) => {
      const response = await fetchWithCsrf(`/api/admin/series/${selectedSeries?.id}/seo`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "SEO metadata updated successfully", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["/api/series"] });
      queryClient.invalidateQueries({ queryKey: ["/api/seo/health"] });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to update SEO metadata", 
        description: error.message,
        variant: "error" 
      });
    },
  });

  // Update chapter SEO metadata
  const updateChapterSEO = useMutation({
    mutationFn: async (data: Partial<Chapter>) => {
      const response = await fetchWithCsrf(`/api/admin/chapters/${selectedChapter?.id}/seo`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Chapter SEO metadata updated successfully", variant: "success" });
      queryClient.invalidateQueries({ queryKey: [`/api/series/${selectedSeries?.id}/chapters`] });
      queryClient.invalidateQueries({ queryKey: ["/api/seo/health"] });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to update chapter SEO metadata", 
        description: error.message,
        variant: "error" 
      });
    },
  });

  // Auto-generate SEO metadata
  const generateMetadata = (item: Series | Chapter, type: 'series' | 'chapter') => {
    if (type === 'series') {
      const s = item as Series;
      const genres = s.genres ? (typeof s.genres === 'string' ? JSON.parse(s.genres) : s.genres) : [];
      return {
        metaTitle: `${s.title} - Read Online | AmourScans`,
        metaDescription: s.description 
          ? s.description.substring(0, 155) + (s.description.length > 155 ? '...' : '')
          : `Read ${s.title} ${s.type} online. ${genres.length > 0 ? 'Genres: ' + genres.slice(0, 3).join(', ') + '.' : ''}`,
        seoKeywords: `${s.title}, ${s.type}, ${genres.join(', ')}, read ${s.title} online, ${s.author || ''}`.trim(),
      };
    } else {
      const c = item as Chapter;
      const seriesTitle = series.find(s => s.id === c.seriesId)?.title || '';
      return {
        metaTitle: `${seriesTitle} Chapter ${c.chapterNumber}${c.title ? ': ' + c.title : ''} | AmourScans`,
        metaDescription: `Read ${seriesTitle} Chapter ${c.chapterNumber}${c.title ? ': ' + c.title : ''} online for free at AmourScans.`,
      };
    }
  };

  // Filtered series based on search
  const filteredSeries = series.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.author && s.author.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSaveSeriesSEO = (data: Partial<Series>) => {
    updateSeriesSEO.mutate(data);
  };

  const handleSaveChapterSEO = (data: Partial<Chapter>) => {
    updateChapterSEO.mutate(data);
  };

  const handleAutoGenerate = () => {
    if (activeTab === "series" && selectedSeries) {
      const generated = generateMetadata(selectedSeries, 'series');
      setSelectedSeries({
        ...selectedSeries,
        ...generated,
      });
      toast({ 
        title: "Metadata generated", 
        description: "Review and save the auto-generated SEO metadata"
      });
    } else if (activeTab === "chapters" && selectedChapter) {
      const generated = generateMetadata(selectedChapter, 'chapter');
      setSelectedChapter({
        ...selectedChapter,
        ...generated,
      });
      toast({ 
        title: "Metadata generated", 
        description: "Review and save the auto-generated SEO metadata"
      });
    }
  };

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
              You need admin privileges to access SEO management
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

  return (
    <div className="container mx-auto p-2 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col space-y-4">
        <Button
          variant="ghost"
          onClick={() => navigate("/admin")}
          className="w-fit text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Admin
        </Button>
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">SEO Management</h1>
            <p className="text-muted-foreground">Optimize meta titles, descriptions, and indexing for better search rankings</p>
          </div>
          <Button onClick={() => refetchHealth()} variant="outline" className="min-h-11 w-full sm:w-auto">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Health
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">
            <BarChart3 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="series">
            <Globe className="w-4 h-4 mr-2" />
            Series SEO
          </TabsTrigger>
          <TabsTrigger value="chapters">
            <Globe className="w-4 h-4 mr-2" />
            Chapter SEO
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {seoHealth && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Content Coverage</CardTitle>
                  <CardDescription>Total indexable content</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span>Total Series:</span>
                    <span className="font-bold">{seoHealth.content.totalSeries}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Chapters:</span>
                    <span className="font-bold">{seoHealth.content.totalChapters}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Published Chapters:</span>
                    <span className="font-bold">{seoHealth.content.publishedChapters}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>SEO Metadata Coverage</CardTitle>
                  <CardDescription>Custom meta tags completion</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span>Meta Titles:</span>
                    <span className={seoHealth.seoMetadata.metaTitleCoverage.includes("0.0%") ? "text-red-500 font-bold" : "text-green-500 font-bold"}>
                      {seoHealth.seoMetadata.metaTitleCoverage}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Meta Descriptions:</span>
                    <span className={seoHealth.seoMetadata.metaDescriptionCoverage.includes("0.0%") ? "text-red-500 font-bold" : "text-green-500 font-bold"}>
                      {seoHealth.seoMetadata.metaDescriptionCoverage}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cover Images:</span>
                    <span className="text-green-500 font-bold">{seoHealth.seoMetadata.coverImageCoverage}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Indexing Status</CardTitle>
                  <CardDescription>Search engine visibility</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span>Indexable Series:</span>
                    <span className="font-bold text-green-500">{seoHealth.indexing.indexableSeries}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>No-Index Series:</span>
                    <span className="font-bold text-yellow-500">{seoHealth.indexing.noindexSeries}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Indexable Chapters:</span>
                    <span className="font-bold text-green-500">{seoHealth.indexing.indexableChapters}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>No-Index Chapters:</span>
                    <span className="font-bold text-yellow-500">{seoHealth.indexing.noindexChapters}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recommendations</CardTitle>
                  <CardDescription>Actionable SEO improvements</CardDescription>
                </CardHeader>
                <CardContent>
                  {seoHealth.recommendations.length > 0 ? (
                    <ul className="space-y-2">
                      {seoHealth.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex items-center gap-2 text-green-500">
                      <CheckCircle className="w-4 h-4" />
                      <span>All SEO requirements met!</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Series SEO Tab */}
        <TabsContent value="series" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Series List */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Series List</CardTitle>
                <div className="relative mt-2">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search series..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </CardHeader>
              <CardContent className="max-h-[600px] overflow-y-auto">
                {loadingSeries ? (
                  <p>Loading...</p>
                ) : (
                  <div className="space-y-2">
                    {filteredSeries.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => setSelectedSeries(s)}
                        className={`p-3 rounded cursor-pointer transition-colors ${
                          selectedSeries?.id === s.id 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted hover:bg-muted/80'
                        }`}
                      >
                        <div className="font-medium truncate">{s.title}</div>
                        <div className="text-xs opacity-75 flex items-center gap-2 mt-1">
                          {s.metaTitle ? (
                            <CheckCircle className="w-3 h-3 text-green-500" />
                          ) : (
                            <AlertCircle className="w-3 h-3 text-yellow-500" />
                          )}
                          <span>{s.metaTitle ? 'SEO Configured' : 'Needs SEO'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Series SEO Editor */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>{selectedSeries ? selectedSeries.title : 'Select a Series'}</CardTitle>
                    <CardDescription>Edit SEO metadata for better search rankings</CardDescription>
                  </div>
                  {selectedSeries && (
                    <Button onClick={handleAutoGenerate} variant="outline" size="sm">
                      <Sparkles className="w-4 h-4 mr-2" />
                      Auto-Generate
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {selectedSeries ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="metaTitle">Meta Title</Label>
                      <Input
                        id="metaTitle"
                        value={selectedSeries.metaTitle || ''}
                        onChange={(e) => setSelectedSeries({ ...selectedSeries, metaTitle: e.target.value })}
                        placeholder={`${selectedSeries.title} - Read Online | AmourScans`}
                        maxLength={60}
                      />
                      <p className="text-xs text-muted-foreground">
                        {(selectedSeries.metaTitle || '').length}/60 characters (optimal: 50-60)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="metaDescription">Meta Description</Label>
                      <Textarea
                        id="metaDescription"
                        value={selectedSeries.metaDescription || ''}
                        onChange={(e) => setSelectedSeries({ ...selectedSeries, metaDescription: e.target.value })}
                        placeholder="Enter a compelling description for search results..."
                        rows={3}
                        maxLength={160}
                      />
                      <p className="text-xs text-muted-foreground">
                        {(selectedSeries.metaDescription || '').length}/160 characters (optimal: 150-160)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="seoKeywords">SEO Keywords</Label>
                      <Input
                        id="seoKeywords"
                        value={selectedSeries.seoKeywords || ''}
                        onChange={(e) => setSelectedSeries({ ...selectedSeries, seoKeywords: e.target.value })}
                        placeholder="keyword1, keyword2, keyword3"
                      />
                      <p className="text-xs text-muted-foreground">
                        Comma-separated keywords for search optimization
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="canonicalUrl">Canonical URL (Optional)</Label>
                      <Input
                        id="canonicalUrl"
                        value={selectedSeries.canonicalUrl || ''}
                        onChange={(e) => setSelectedSeries({ ...selectedSeries, canonicalUrl: e.target.value })}
                        placeholder="Leave empty for auto-generation"
                      />
                      <p className="text-xs text-muted-foreground">
                        Custom canonical URL (defaults to /manga/{selectedSeries.id})
                      </p>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <Label>Search Engine Indexing</Label>
                        <p className="text-xs text-muted-foreground">
                          {selectedSeries.robotsNoindex === 'true' ? 'Hidden from search engines' : 'Visible to search engines'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedSeries.robotsNoindex === 'true' ? (
                          <EyeOff className="w-4 h-4 text-yellow-500" />
                        ) : (
                          <Eye className="w-4 h-4 text-green-500" />
                        )}
                        <Switch
                          checked={selectedSeries.robotsNoindex !== 'true'}
                          onCheckedChange={(checked) => 
                            setSelectedSeries({ ...selectedSeries, robotsNoindex: checked ? 'false' : 'true' })
                          }
                        />
                      </div>
                    </div>

                    <Button 
                      onClick={() => handleSaveSeriesSEO({
                        metaTitle: selectedSeries.metaTitle,
                        metaDescription: selectedSeries.metaDescription,
                        seoKeywords: selectedSeries.seoKeywords,
                        canonicalUrl: selectedSeries.canonicalUrl,
                        robotsNoindex: selectedSeries.robotsNoindex,
                      })}
                      className="w-full"
                      disabled={updateSeriesSEO.isPending}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {updateSeriesSEO.isPending ? 'Saving...' : 'Save SEO Metadata'}
                    </Button>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-12">
                    Select a series from the list to edit its SEO metadata
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Chapters SEO Tab */}
        <TabsContent value="chapters" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Chapter List */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Chapters</CardTitle>
                <CardDescription>
                  {selectedSeries ? `${selectedSeries.title}` : 'Select a series first'}
                </CardDescription>
              </CardHeader>
              <CardContent className="max-h-[600px] overflow-y-auto">
                {!selectedSeries ? (
                  <p className="text-sm text-muted-foreground">Select a series from the Series SEO tab first</p>
                ) : chapters.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No chapters available</p>
                ) : (
                  <div className="space-y-2">
                    {chapters.map((ch) => (
                      <div
                        key={ch.id}
                        onClick={() => setSelectedChapter(ch)}
                        className={`p-3 rounded cursor-pointer transition-colors ${
                          selectedChapter?.id === ch.id 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted hover:bg-muted/80'
                        }`}
                      >
                        <div className="font-medium">Chapter {ch.chapterNumber}</div>
                        {ch.title && <div className="text-xs opacity-75">{ch.title}</div>}
                        <div className="text-xs opacity-75 flex items-center gap-2 mt-1">
                          {ch.metaTitle ? (
                            <CheckCircle className="w-3 h-3 text-green-500" />
                          ) : (
                            <AlertCircle className="w-3 h-3 text-yellow-500" />
                          )}
                          <span>{ch.metaTitle ? 'SEO Configured' : 'Needs SEO'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Chapter SEO Editor */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>
                      {selectedChapter ? `Chapter ${selectedChapter.chapterNumber}` : 'Select a Chapter'}
                    </CardTitle>
                    <CardDescription>Edit chapter SEO metadata</CardDescription>
                  </div>
                  {selectedChapter && (
                    <Button onClick={handleAutoGenerate} variant="outline" size="sm">
                      <Sparkles className="w-4 h-4 mr-2" />
                      Auto-Generate
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {selectedChapter ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="chapterMetaTitle">Meta Title</Label>
                      <Input
                        id="chapterMetaTitle"
                        value={selectedChapter.metaTitle || ''}
                        onChange={(e) => setSelectedChapter({ ...selectedChapter, metaTitle: e.target.value })}
                        placeholder={`Chapter ${selectedChapter.chapterNumber}${selectedChapter.title ? ': ' + selectedChapter.title : ''}`}
                        maxLength={60}
                      />
                      <p className="text-xs text-muted-foreground">
                        {(selectedChapter.metaTitle || '').length}/60 characters
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="chapterMetaDescription">Meta Description</Label>
                      <Textarea
                        id="chapterMetaDescription"
                        value={selectedChapter.metaDescription || ''}
                        onChange={(e) => setSelectedChapter({ ...selectedChapter, metaDescription: e.target.value })}
                        placeholder="Enter description for this chapter..."
                        rows={3}
                        maxLength={160}
                      />
                      <p className="text-xs text-muted-foreground">
                        {(selectedChapter.metaDescription || '').length}/160 characters
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="chapterCanonicalUrl">Canonical URL (Optional)</Label>
                      <Input
                        id="chapterCanonicalUrl"
                        value={selectedChapter.canonicalUrl || ''}
                        onChange={(e) => setSelectedChapter({ ...selectedChapter, canonicalUrl: e.target.value })}
                        placeholder="Leave empty for auto-generation"
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <Label>Search Engine Indexing</Label>
                        <p className="text-xs text-muted-foreground">
                          {selectedChapter.robotsNoindex === 'true' ? 'Hidden from search engines' : 'Visible to search engines'}
                        </p>
                      </div>
                      <Switch
                        checked={selectedChapter.robotsNoindex !== 'true'}
                        onCheckedChange={(checked) => 
                          setSelectedChapter({ ...selectedChapter, robotsNoindex: checked ? 'false' : 'true' })
                        }
                      />
                    </div>

                    <Button 
                      onClick={() => handleSaveChapterSEO({
                        metaTitle: selectedChapter.metaTitle,
                        metaDescription: selectedChapter.metaDescription,
                        canonicalUrl: selectedChapter.canonicalUrl,
                        robotsNoindex: selectedChapter.robotsNoindex,
                      })}
                      className="w-full"
                      disabled={updateChapterSEO.isPending}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {updateChapterSEO.isPending ? 'Saving...' : 'Save Chapter SEO'}
                    </Button>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-12">
                    Select a chapter from the list to edit its SEO metadata
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
