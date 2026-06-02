import { useParams, Link } from "wouter";
import { useState } from "react";
import { useMangaDetail } from "@/hooks/useMangaDetail";
import { useChapters } from "@/hooks/useChapters";
import { useReadingProgress } from "@/hooks/useReadingProgress";
import { useFollowStatus, useFollowSeries, useUnfollowSeries, useFollowerCount } from "@/hooks/useFollow";
import { useLibraryStatus, useAddToLibrary, useRemoveFromLibrary } from "@/hooks/useLibrary";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import CommentSection from "@/components/CommentSection";
import MangaDetailSkeleton from "@/components/ui/MangaDetailSkeleton";
import { SEO, StructuredData } from "@/components/SEO";
import { InlineAd } from "@/components/AdDisplay";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Heart, 
  Bell, 
  BellOff,
  Share2, 
  BookOpen, 
  Star, 
  Users, 
  Calendar,
  ArrowLeft,
  Search,
  ChevronDown,
  Play,
  Clock,
  Sparkles,
  MessageSquare
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function MangaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const { manga, isLoading, error, isError } = useMangaDetail(id!);
  const { chapters, isLoading: chaptersLoading, isError: chaptersError } = useChapters(id!);
  const { progress } = useReadingProgress(id);
  const { isFollowing, notificationsEnabled, isLoading: followLoading } = useFollowStatus(id);
  const { inLibrary, isLoading: libraryLoading } = useLibraryStatus(id);
  const { followerCount } = useFollowerCount(id);
  const { followSeries, isFollowing: isFollowingAction } = useFollowSeries();
  const { unfollowSeries, isUnfollowing } = useUnfollowSeries();
  const { addToLibrary, isAdding } = useAddToLibrary();
  const { removeFromLibrary, isRemoving } = useRemoveFromLibrary();
  
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [sortAscending, setSortAscending] = useState(false);
  const [showAllChapters, setShowAllChapters] = useState(false);
  const [activeTab, setActiveTab] = useState("chapters");

  if (isLoading) {
    return <MangaDetailSkeleton />;
  }

  if (isError || !manga) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] text-white">
        <div className="grid gap-6 w-full max-w-7xl mx-auto p-6">
          <div className="border border-[#4b4bc3]/40 bg-[#707ff5]/8 rounded-xl p-6 text-center">
            <h1 className="text-2xl font-semibold text-teal-400 mb-4">Series Not Available</h1>
            <p className="text-[#a195f9] mb-6">
              This series is currently unavailable or may have been removed.
            </p>
            <Link href="/">
              <Button className="bg-[#707ff5] hover:bg-[#4b4bc3]">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Return Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const genresArray = manga.genres ? (Array.isArray(manga.genres) ? manga.genres : JSON.parse(manga.genres)) : [];
  const genresKeywords = genresArray.join(', ');

  const sortedChapters = chapters ? [...chapters].sort((a, b) => {
    const numA = parseFloat(a.chapterNumber);
    const numB = parseFloat(b.chapterNumber);
    return sortAscending ? numA - numB : numB - numA;
  }) : [];

  const displayChapters = showAllChapters ? sortedChapters : sortedChapters.slice(0, 10);

  const isChapterNew = (chapterDate: string | null | undefined) => {
    if (!chapterDate) return false;
    const daysSincePublished = (new Date().getTime() - new Date(chapterDate).getTime()) / (1000 * 60 * 60 * 24);
    return daysSincePublished <= 7;
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'ongoing': return 'bg-green-500/20 text-green-400 border-green-500/40';
      case 'completed': return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
      case 'hiatus': return 'bg-orange-500/20 text-orange-400 border-orange-500/40';
      default: return 'bg-[#a195f9]/20 text-[#a195f9] border-[#a195f9]/40';
    }
  };

  const getGenreColor = (genre: string) => {
    const colors = {
      'action': 'bg-red-500/20 text-red-400 border-red-500/40',
      'romance': 'bg-pink-500/20 text-pink-400 border-pink-500/40',
      'comedy': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
      'drama': 'bg-purple-500/20 text-purple-400 border-purple-500/40',
      'fantasy': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40',
      'horror': 'bg-gray-700/20 text-gray-400 border-gray-700/40',
      'mystery': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
      'sci-fi': 'bg-blue-500/20 text-blue-400 border-blue-500/40',
    };
    return colors[genre.toLowerCase() as keyof typeof colors] || 'bg-[#707ff5]/20 text-[#707ff5] border-[#707ff5]/40';
  };

  const handleToggleFollow = async () => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please log in to follow series",
        variant: "error",
      });
      return;
    }
    try {
      if (isFollowing) {
        await unfollowSeries(id!);
        toast({
          title: "Unfollowed",
          description: "You've unfollowed this series",
        });
      } else {
        await followSeries({ seriesId: id!, notificationsEnabled: true });
        toast({
          title: "Following",
          description: "You'll be notified of new chapters",
          variant: "success",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update follow status",
        variant: "error",
      });
    }
  };

  const handleToggleLibrary = async () => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please log in to add series to your library",
        variant: "error",
      });
      return;
    }
    try {
      if (inLibrary) {
        await removeFromLibrary(id!);
        toast({
          title: "Removed from library",
          description: "Series removed from your library",
        });
      } else {
        await addToLibrary(id!, 'reading');
        toast({
          title: "Added to library",
          description: "Series added to your library",
          variant: "success",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update library",
        variant: "error",
      });
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: manga.title,
          text: `Check out ${manga.title}!`,
          url: window.location.href,
        });
      } catch (err) {
        // Share cancelled or failed - silent failure is acceptable for share
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const continueChapter = progress && progress.chapterId 
    ? chapters.find(ch => ch.id === progress.chapterId)
    : null;

  const firstChapter = sortedChapters.length > 0 
    ? sortedChapters[sortedChapters.length - 1] 
    : null;

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white pb-24">
      <SEO
        title={manga.title}
        description={manga.description || `Read ${manga.title} - ${manga.type} ${manga.status} with ${chapters?.length || 0} chapters`}
        keywords={`${manga.title}, ${manga.type}, ${manga.status}, ${genresKeywords}, read ${manga.title} online, ${manga.title} chapters`}
        image={manga.coverImageUrl}
        type="book"
        author={manga.author || 'Unknown'}
        publishedTime={manga.createdAt}
        modifiedTime={manga.updatedAt}
      />
      
      <StructuredData
        type="Series"
        data={{
          name: manga.title,
          description: manga.description || `Read ${manga.title} online`,
          image: manga.coverImageUrl,
          author: {
            "@type": "Person",
            name: manga.author || "Unknown"
          },
          genre: genresArray,
          inLanguage: "en",
          datePublished: manga.createdAt,
          dateModified: manga.updatedAt,
          aggregateRating: manga.rating ? {
            "@type": "AggregateRating",
            ratingValue: manga.rating,
            bestRating: "5",
            worstRating: "1"
          } : undefined,
          numberOfEpisodes: chapters?.length || 0,
          publisher: {
            "@type": "Organization",
            name: "AmourScans Platform"
          },
          workExample: {
            "@type": "Book",
            bookFormat: "GraphicNovel",
            inLanguage: "en"
          }
        }}
      />

      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0d1117]/80 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex gap-4 items-center">
              <Link href="/">
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/10">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <Link href="/" className="hidden sm:block text-xl font-semibold">
                AmourScans
              </Link>
            </div>
            <Link href="/" className="sm:hidden text-lg font-semibold">
              AmourScans
            </Link>
            <Link href="/browse">
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/10">
                <Search className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div 
        className="absolute top-0 left-0 w-full h-[600px] opacity-20 blur-3xl -z-10"
        style={{
          background: manga.coverImageUrl 
            ? `linear-gradient(to bottom, transparent, #0a0e1a), url(${manga.coverImageUrl})`
            : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center top'
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid lg:grid-cols-[auto,1fr] gap-6 lg:gap-8 mb-6">
          <div className="flex justify-center lg:justify-start">
            <div 
              className="relative group w-48 sm:w-64 aspect-[0.7] rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl hover:border-[#707ff5]/50 transition-all duration-300"
            >
              <img 
                src={manga.coverImageUrl} 
                alt={manga.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              {continueChapter && progress && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4">
                  <div className="text-xs text-white/80 mb-1">Continue Reading</div>
                  <div className="w-full bg-white/20 rounded-full h-1.5 mb-2">
                    <div 
                      className="bg-[#707ff5] h-1.5 rounded-full transition-all" 
                      style={{ width: `${(progress.lastReadPage / (continueChapter.totalPages || 1)) * 100}%` }}
                    />
                  </div>
                  <div className="text-sm font-medium">Ch. {continueChapter.chapterNumber}</div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-3 leading-tight">
                {manga.title}
              </h1>
              
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge className={`${getStatusColor(manga.status)} border px-3 py-1 rounded-full capitalize`}>
                  {manga.status}
                </Badge>
                <Badge variant="outline" className="border-white/20 px-3 py-1 rounded-full capitalize">
                  {manga.type}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {genresArray.map((genre: string, index: number) => (
                  <Badge 
                    key={index}
                    className={`${getGenreColor(genre)} border px-3 py-1 rounded-full capitalize text-xs`}
                  >
                    {genre}
                  </Badge>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
                {manga.rating && (
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-yellow-400 mb-1">
                      <Star className="w-4 h-4 fill-current" />
                      <span className="font-bold text-lg">{parseFloat(manga.rating).toFixed(1)}</span>
                    </div>
                    <div className="text-xs text-white/60">Rating</div>
                  </div>
                )}

                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-[#a195f9] mb-1">
                    <Users className="w-4 h-4" />
                    <span className="font-bold text-lg">{followerCount}</span>
                  </div>
                  <div className="text-xs text-white/60">Followers</div>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-[#707ff5] mb-1">
                    <BookOpen className="w-4 h-4" />
                    <span className="font-bold text-lg">{chapters?.length || 0}</span>
                  </div>
                  <div className="text-xs text-white/60">Chapters</div>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-green-400 mb-1">
                    <Calendar className="w-4 h-4" />
                    <span className="font-bold text-sm">
                      {manga.updatedAt ? formatDistanceToNow(new Date(manga.updatedAt), { addSuffix: false }) : 'N/A'}
                    </span>
                  </div>
                  <div className="text-xs text-white/60">Last Update</div>
                </div>
              </div>

              {manga.author && (
                <div className="text-sm text-white/80">
                  <span className="text-white/60">Author:</span> {manga.author}
                </div>
              )}
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-white/5 border border-white/10 p-1 rounded-xl mb-6 grid grid-cols-3">
            <TabsTrigger 
              value="chapters" 
              className="data-[state=active]:bg-[#707ff5] data-[state=active]:text-white rounded-lg transition-all"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Chapters
            </TabsTrigger>
            <TabsTrigger 
              value="details"
              className="data-[state=active]:bg-[#707ff5] data-[state=active]:text-white rounded-lg transition-all"
            >
              Details
            </TabsTrigger>
            <TabsTrigger 
              value="comments"
              className="data-[state=active]:bg-[#707ff5] data-[state=active]:text-white rounded-lg transition-all"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Comments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chapters" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">All Chapters</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortAscending(!sortAscending)}
                className="border-white/20 hover:bg-white/10"
              >
                {sortAscending ? 'Oldest First' : 'Newest First'}
                <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${sortAscending ? 'rotate-180' : ''}`} />
              </Button>
            </div>

            {chaptersLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : chaptersError ? (
              <div className="text-center py-12 text-white/60">
                Failed to load chapters
              </div>
            ) : displayChapters.length === 0 ? (
              <div className="text-center py-12 text-white/60">
                No chapters available yet
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {displayChapters.map((chapter, index) => {
                    const isRead = progress?.chapterId === chapter.id;
                    const chapterProgress = isRead && progress ? (progress.lastReadPage / (chapter.totalPages || 1)) * 100 : 0;
                    
                    return (
                      <Link key={chapter.id} href={`/manga/${id}/chapter/${chapter.chapterNumber}`}>
                        <div 
                          className="group relative bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#707ff5]/50 rounded-xl p-4 transition-all duration-200 cursor-pointer animate-in fade-in slide-in-from-bottom-2"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <div className="flex items-center gap-4">
                            {chapter.coverImageUrl ? (
                              <div className="relative w-12 h-16 sm:w-14 sm:h-20 rounded-lg overflow-hidden flex-shrink-0 border border-white/10">
                                <img
                                  src={chapter.coverImageUrl}
                                  alt={`Chapter ${chapter.chapterNumber}`}
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                  loading="lazy"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    const parent = target.parentElement;
                                    if (parent) {
                                      parent.className = 'flex items-center justify-center w-12 h-16 sm:w-14 sm:h-20 bg-[#707ff5]/20 rounded-lg flex-shrink-0';
                                      parent.innerHTML = '<svg class="w-5 h-5 sm:w-6 sm:h-6 text-[#707ff5]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>';
                                    }
                                  }}
                                />
                              </div>
                            ) : (
                              <div className="hidden sm:flex items-center justify-center w-14 h-20 bg-[#707ff5]/20 rounded-lg flex-shrink-0">
                                <BookOpen className="w-6 h-6 text-[#707ff5]" />
                              </div>
                            )}
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-base group-hover:text-[#707ff5] transition-colors">
                                  Chapter {chapter.chapterNumber}
                                </h3>
                                {isChapterNew(chapter.createdAt) && (
                                  <Badge className="bg-gradient-to-r from-pink-500 to-purple-500 text-white border-0 px-2 py-0 text-xs">
                                    <Sparkles className="w-3 h-3 mr-1" />
                                    NEW
                                  </Badge>
                                )}
                              </div>
                              
                              {chapter.title && (
                                <p className="text-sm text-white/70 mb-1 truncate">{chapter.title}</p>
                              )}
                              
                              <div className="flex items-center gap-3 text-xs text-white/50">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {chapter.createdAt 
                                    ? formatDistanceToNow(new Date(chapter.createdAt), { addSuffix: true })
                                    : 'Unknown'}
                                </span>
                                {chapter.totalPages && (
                                  <span>{chapter.totalPages} pages</span>
                                )}
                              </div>

                              {isRead && chapterProgress > 0 && (
                                <div className="mt-2">
                                  <div className="w-full bg-white/10 rounded-full h-1">
                                    <div 
                                      className="bg-[#707ff5] h-1 rounded-full transition-all"
                                      style={{ width: `${chapterProgress}%` }}
                                    />
                                  </div>
                                  <div className="text-xs text-white/50 mt-1">
                                    {Math.round(chapterProgress)}% completed
                                  </div>
                                </div>
                              )}
                            </div>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-full bg-[#707ff5]/20 hover:bg-[#707ff5]/30 text-white flex-shrink-0"
                            >
                              <Play className="w-4 h-4 fill-current" />
                            </Button>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {sortedChapters.length > 10 && (
                  <Button
                    variant="outline"
                    className="w-full border-white/20 hover:bg-white/10"
                    onClick={() => setShowAllChapters(!showAllChapters)}
                  >
                    {showAllChapters ? 'Show Less' : `Show All ${sortedChapters.length} Chapters`}
                  </Button>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="details" className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Description</h3>
              <div className={`${isDescriptionExpanded ? '' : 'line-clamp-6'} text-white/80 whitespace-pre-wrap`}>
                {manga.description || 'No description available.'}
              </div>
              {manga.description && manga.description.length > 200 && (
                <Button
                  variant="ghost"
                  className="text-[#707ff5] hover:text-[#4b4bc3] mt-2 p-0"
                  onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                >
                  {isDescriptionExpanded ? 'Show Less' : 'Read More'}
                </Button>
              )}
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Series Information</h3>
              <dl className="grid sm:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-white/60 mb-1">Status</dt>
                  <dd className="capitalize">{manga.status}</dd>
                </div>
                <div>
                  <dt className="text-sm text-white/60 mb-1">Type</dt>
                  <dd className="capitalize">{manga.type}</dd>
                </div>
                {manga.author && (
                  <div>
                    <dt className="text-sm text-white/60 mb-1">Author</dt>
                    <dd>{manga.author}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm text-white/60 mb-1">Chapters</dt>
                  <dd>{chapters?.length || 0}</dd>
                </div>
                <div>
                  <dt className="text-sm text-white/60 mb-1">Published</dt>
                  <dd>
                    {manga.createdAt 
                      ? new Date(manga.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                      : 'Unknown'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-white/60 mb-1">Last Updated</dt>
                  <dd>
                    {manga.updatedAt 
                      ? new Date(manga.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                      : 'Unknown'}
                  </dd>
                </div>
              </dl>
            </div>

            {genresArray.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">Genres</h3>
                <div className="flex flex-wrap gap-2">
                  {genresArray.map((genre: string, index: number) => (
                    <Badge 
                      key={index}
                      className={`${getGenreColor(genre)} border px-4 py-2 rounded-full capitalize`}
                    >
                      {genre}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="comments">
            <CommentSection seriesId={id} />
          </TabsContent>
        </Tabs>

        <InlineAd page="manga_detail" location="in_content_1" />
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-[#0d1117] via-[#0d1117]/95 to-transparent pt-4 pb-safe">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-2 sm:gap-3 items-center">
            {continueChapter ? (
              <Link href={`/manga/${id}/chapter/${continueChapter.chapterNumber}`} className="flex-1">
                <Button className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-semibold h-12 sm:h-14 rounded-xl shadow-lg shadow-teal-500/25 transition-all hover:shadow-teal-500/40">
                  <Play className="w-5 h-5 mr-2 fill-current" />
                  Continue Ch. {continueChapter.chapterNumber}
                </Button>
              </Link>
            ) : firstChapter ? (
              <Link href={`/manga/${id}/chapter/${firstChapter.chapterNumber}`} className="flex-1">
                <Button className="w-full bg-gradient-to-r from-[#707ff5] to-[#4b4bc3] hover:from-[#4b4bc3] hover:to-[#1e1e76] text-white font-semibold h-12 sm:h-14 rounded-xl shadow-lg shadow-[#707ff5]/25 transition-all hover:shadow-[#707ff5]/40">
                  <BookOpen className="w-5 h-5 mr-2" />
                  Start Reading
                </Button>
              </Link>
            ) : (
              <Button disabled className="flex-1 h-12 sm:h-14 rounded-xl">
                No Chapters Available
              </Button>
            )}

            {user && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleToggleLibrary}
                  disabled={isAdding || isRemoving}
                  className={`h-12 w-12 sm:h-14 sm:w-14 rounded-xl border-2 transition-all ${
                    inLibrary 
                      ? 'bg-pink-500 border-pink-500 text-white hover:bg-pink-600 hover:border-pink-600' 
                      : 'border-white/20 hover:bg-white/10 hover:border-pink-500/50'
                  }`}
                >
                  <Heart className={`w-5 h-5 ${inLibrary ? 'fill-current' : ''}`} />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleToggleFollow}
                  disabled={isFollowingAction || isUnfollowing}
                  className={`h-12 w-12 sm:h-14 sm:w-14 rounded-xl border-2 transition-all ${
                    isFollowing 
                      ? 'bg-[#707ff5] border-[#707ff5] text-white hover:bg-[#4b4bc3] hover:border-[#4b4bc3]' 
                      : 'border-white/20 hover:bg-white/10 hover:border-[#707ff5]/50'
                  }`}
                >
                  {isFollowing ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleShare}
                  className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl border-2 border-white/20 hover:bg-white/10 hover:border-white/30"
                >
                  <Share2 className="w-5 h-5" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
