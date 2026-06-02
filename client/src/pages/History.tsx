import { useState } from "react";
import { useLocation } from "wouter";
import { History as HistoryIcon, BookOpen, Clock, Trash2, ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { useUserProgress, useDeleteProgress } from "@/hooks/useReadingProgress";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export default function History() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { progressList, isLoading } = useUserProgress(isAuthenticated);
  const { deleteProgress } = useDeleteProgress();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState<{ id: string; title: string } | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <HistoryIcon className="w-20 h-20 text-primary/50 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-foreground mb-4">Sign in to view your history</h1>
          <p className="text-muted-foreground mb-8">
            Create an account or sign in to track your reading history and continue where you left off.
          </p>
          <div className="flex gap-4 justify-center">
            <Button 
              onClick={() => navigate("/login")}
              className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 min-h-11"
            >
              Sign In
            </Button>
            <Button 
              onClick={() => navigate("/signup")}
              variant="outline"
              className="min-h-11"
            >
              Create Account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleDeleteProgress = (seriesId: string, seriesTitle: string) => {
    setSelectedSeries({ id: seriesId, title: seriesTitle });
    setShowDeleteDialog(true);
  };

  const confirmDeleteProgress = () => {
    if (selectedSeries) {
      deleteProgress(selectedSeries.id);
      toast({
        title: "History cleared",
        description: `Removed "${selectedSeries.title}" from your reading history.`,
      });
      setShowDeleteDialog(false);
      setSelectedSeries(null);
    }
  };

  const handleContinueReading = (seriesId: string, chapterId: string | null, chapterNumber: string) => {
    if (chapterId && chapterNumber) {
      navigate(`/manga/${seriesId}/chapter/${chapterNumber}`);
    } else {
      navigate(`/manga/${seriesId}`);
    }
  };

  const handleClearAllHistory = async () => {
    setIsClearing(true);
    try {
      // Delete all progress entries sequentially
      for (const progress of progressList) {
        await deleteProgress(progress.series.id);
      }
      toast({
        title: "History cleared",
        description: `Removed all ${progressList.length} series from your reading history.`,
      });
      setShowClearAllDialog(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear history. Please try again.",
        variant: "error",
      });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background w-full overflow-x-hidden">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="w-fit text-muted-foreground hover:text-primary mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center shadow-lg">
              <HistoryIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary via-accent to-purple-400 bg-clip-text text-transparent">
                Reading History
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {progressList.length} {progressList.length === 1 ? 'series' : 'series'} in progress
              </p>
            </div>
          </div>
          {!isLoading && progressList.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="min-h-11 gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setShowClearAllDialog(true)}
              aria-label="Clear all reading history"
            >
              <Trash2 className="w-4 h-4" />
              Clear All
            </Button>
          )}
        </div>

        {isLoading && (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
            <p className="text-muted-foreground">Loading your history...</p>
          </div>
        )}

        {!isLoading && progressList.length === 0 && (
          <Card className="bg-card/80 backdrop-blur-md border-border/50">
            <CardContent className="py-16 text-center">
              <HistoryIcon className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No reading history yet</h3>
              <p className="text-muted-foreground mb-6">
                Start reading manga to track your progress and continue where you left off!
              </p>
              <Button 
                onClick={() => navigate("/browse")}
                className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 min-h-11"
              >
                Browse Manga
              </Button>
            </CardContent>
          </Card>
        )}

        {!isLoading && progressList.length > 0 && (
          <div className="space-y-4">
            {progressList.map((progress) => (
              <Card 
                key={progress.id}
                className="group bg-card/80 backdrop-blur-md border-border/50 hover:border-primary/60 transition-all duration-300 hover:shadow-lg hover:shadow-primary/20"
              >
                <CardContent className="p-4 sm:p-6">
                  <div className="flex gap-4">
                    <div 
                      className="relative w-20 sm:w-32 h-28 sm:h-44 flex-shrink-0 overflow-hidden rounded-lg cursor-pointer"
                      onClick={() => navigate(`/manga/${progress.series.id}`)}
                    >
                      {progress.series.coverImageUrl ? (
                        <img
                          src={progress.series.coverImageUrl}
                          alt={progress.series.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-muted/80 to-muted/60 flex items-center justify-center">
                          <BookOpen className="w-8 h-8 text-muted-foreground/50" />
                        </div>
                      )}
                      {progress.series.status && (
                        <Badge className="absolute top-2 left-2 bg-primary/90 backdrop-blur-sm text-xs">
                          {progress.series.status}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2 mb-3">
                        <div 
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => navigate(`/manga/${progress.series.id}`)}
                        >
                          <h3 className="font-bold text-lg sm:text-xl text-foreground group-hover:text-primary transition-colors mb-1 line-clamp-2">
                            {progress.series.title}
                          </h3>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {(() => {
                              const genres = typeof progress.series.genres === 'string' 
                                ? JSON.parse(progress.series.genres) 
                                : progress.series.genres;
                              return Array.isArray(genres) && genres.slice(0, 3).map((genre: string) => (
                                <Badge key={genre} variant="outline" className="text-xs">
                                  {genre}
                                </Badge>
                              ));
                            })()}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive flex-shrink-0"
                          onClick={() => handleDeleteProgress(progress.series.id, progress.series.title)}
                          aria-label={`Remove ${progress.series.title} from reading history`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="space-y-2 mb-4">
                        {progress.chapterId && (
                          <div className="flex items-center gap-2 text-sm">
                            <Badge variant="secondary" className="bg-primary/20 text-primary">
                              Reading in progress
                            </Badge>
                            <span className="text-muted-foreground">
                              Page {progress.lastReadPage || 1}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Clock className="w-4 h-4 mr-2" />
                          Last read {progress.lastReadAt ? formatDistanceToNow(new Date(progress.lastReadAt), { addSuffix: true }) : 'Recently'}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 min-h-11"
                          onClick={() => handleContinueReading(
                            progress.series.id, 
                            progress.chapterId, 
                            ''
                          )}
                        >
                          <BookOpen className="w-4 h-4 mr-2" />
                          Continue Reading
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-11"
                          onClick={() => navigate(`/manga/${progress.series.id}`)}
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      
      {/* Clear All History Confirmation Dialog */}
      <AlertDialog open={showClearAllDialog} onOpenChange={setShowClearAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all reading history?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all {progressList.length} series from your reading history. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAllHistory}
              disabled={isClearing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isClearing ? "Clearing..." : "Clear All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Individual Entry Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from reading history?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove "{selectedSeries?.title}" from your reading history? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteProgress}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
