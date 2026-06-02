import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useChapters } from "@/hooks/useChapters";
import { useMemo, useEffect } from "react";

interface ChapterData {
  id: string;
  seriesId: string;
  chapterNumber: string;
  title?: string;
  pages: string[];
  totalPages: number;
  isPublished: string;
  uploadedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ChapterReaderData {
  currentChapter: ChapterData | null;
  pages: string[];
  nextChapter: ChapterData | null;
  previousChapter: ChapterData | null;
  chapterIndex: number;
  totalChapters: number;
}

export function useChapterReader(seriesId: string, chapterNumber: string) {
  const queryClient = useQueryClient();
  
  // First, get all chapters for the series
  const { chapters, isLoading: chaptersLoading, error: chaptersError, isError: chaptersIsError } = useChapters(seriesId);

  // Memoize the chapter reader data to avoid unnecessary recalculations
  const chapterReaderData = useMemo((): ChapterReaderData => {
    if (!chapters.length) {
      return {
        currentChapter: null,
        pages: [],
        nextChapter: null,
        previousChapter: null,
        chapterIndex: -1,
        totalChapters: 0,
      };
    }

    // Sort chapters by chapter number (ascending)
    const sortedChapters = [...chapters].sort((a, b) => {
      const aNum = parseFloat(a.chapterNumber) || 0;
      const bNum = parseFloat(b.chapterNumber) || 0;
      return aNum - bNum;
    });

    // Find current chapter - first try exact string match, then fall back to numeric comparison
    let currentChapterIndex = sortedChapters.findIndex(
      (chapter) => chapter.chapterNumber === chapterNumber
    );
    
    // If exact match fails, try numeric comparison to handle formatting differences (e.g., '1' vs '1.0')
    if (currentChapterIndex === -1) {
      const targetNumber = parseFloat(chapterNumber);
      if (!isNaN(targetNumber)) {
        currentChapterIndex = sortedChapters.findIndex(
          (chapter) => parseFloat(chapter.chapterNumber) === targetNumber
        );
      }
    }

    const currentChapter = currentChapterIndex >= 0 ? sortedChapters[currentChapterIndex] : null;

    // Pages are already an array from the server
    let pages: string[] = [];
    if (currentChapter?.pages && Array.isArray(currentChapter.pages)) {
      pages = currentChapter.pages;
    }

    // Get next and previous chapters
    const nextChapter = currentChapterIndex >= 0 && currentChapterIndex < sortedChapters.length - 1
      ? sortedChapters[currentChapterIndex + 1]
      : null;

    const previousChapter = currentChapterIndex > 0
      ? sortedChapters[currentChapterIndex - 1]
      : null;

    return {
      currentChapter,
      pages,
      nextChapter,
      previousChapter,
      chapterIndex: currentChapterIndex,
      totalChapters: sortedChapters.length,
    };
  }, [chapters, chapterNumber]);

  // Preload next chapter for faster navigation
  useEffect(() => {
    const nextChapterId = chapterReaderData.nextChapter?.id;
    
    if (nextChapterId && typeof window !== 'undefined') {
      // Fetch the next chapter's data in the background
      const queryKey = [`/api/chapters/${nextChapterId}`];
      
      queryClient.fetchQuery({
        queryKey,
        queryFn: getQueryFn({ on401: "throw" }),
        staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
      }).then((chapterData: any) => {
        // After fetching chapter data, preload first few images
        if (chapterData?.pages && Array.isArray(chapterData.pages)) {
          chapterData.pages.slice(0, 3).forEach((pageUrl: string) => {
            try {
              const img = new Image();
              img.src = pageUrl;
            } catch (error) {
              // Failed to preload image (non-critical)
            }
          });
        }
      }).catch(() => {
        // Failed to fetch next chapter (non-critical)
      });
    }
  }, [chapterReaderData.nextChapter?.id, queryClient]);

  return {
    ...chapterReaderData,
    isLoading: chaptersLoading,
    error: chaptersError,
    isError: chaptersIsError,
  };
}

// Additional hook to get a chapter by ID if needed
export function useChapterById(chapterId: string) {
  const { data: chapter, isLoading, error, isError } = useQuery<ChapterData>({
    queryKey: [`/api/chapters/${chapterId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    retry: false,
    enabled: !!chapterId,
  });

  // Pages are already an array from the server
  const pages = useMemo(() => {
    if (!chapter?.pages || !Array.isArray(chapter.pages)) return [];
    return chapter.pages;
  }, [chapter?.pages]);

  return {
    chapter,
    pages,
    isLoading,
    error,
    isError,
  };
}