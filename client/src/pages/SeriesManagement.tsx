import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { 
  BookOpen, ArrowLeft, Search, Edit, Trash2, Plus,
  Star, Calendar, Image, Tag, Users, X, Save, Upload, Link2,
  CheckSquare, Square, Eye, EyeOff, FileImage, Lightbulb, AlertCircle
} from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { PageReorderDialog } from "@/components/PageReorderDialog";
import { UploadProgressDialog } from "@/components/UploadProgressDialog";
import { apiRequest } from "@/lib/queryClient";

interface SeriesData {
  id: string;
  title: string;
  description?: string;
  author?: string;
  artist?: string;
  status: string;
  type: string;
  genres?: string[];
  coverImageUrl?: string;
  rating?: number;
  publishedYear?: number;
  isAdult: string;
  isFeatured?: string;
  isTrending?: string;
  isPopularToday?: string;
  isLatestUpdate?: string;
  isPinned?: string;
  createdAt?: string;
  updatedAt?: string;
}

const statusOptions = [
  { value: "ongoing", label: "Ongoing", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300" },
  { value: "completed", label: "Completed", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300" },
  { value: "hiatus", label: "Hiatus", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300" },
];

const typeOptions = [
  { value: "manga", label: "Manga" },
  { value: "manhwa", label: "Manhwa" },
  { value: "manhua", label: "Manhua" },
  { value: "webtoon", label: "Webtoon" },
];

const genreOptions = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mystery", "Romance", 
  "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller", "Historical", 
  "Psychological", "School", "Martial Arts", "Mecha", "Military", "Music"
];

export default function SeriesManagement() {
  const { isAdmin, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [series, setSeries] = useState<SeriesData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingSeries, setEditingSeries] = useState<SeriesData | null>(null);
  const [deleteSeriesId, setDeleteSeriesId] = useState<string | null>(null);
  const [deleteChapterId, setDeleteChapterId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadMethod, setUploadMethod] = useState<'url' | 'file'>('url');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chapterUploadRef = useRef<HTMLInputElement>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [uploadingChapter, setUploadingChapter] = useState(false);
  const [chapterUploadProgress, setChapterUploadProgress] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isValidating, setIsValidating] = useState(false);
  const [uploadRequestId, setUploadRequestId] = useState<string>('');
  // New progress dialog states
  const [showUploadProgress, setShowUploadProgress] = useState(false);
  const [currentUploadId, setCurrentUploadId] = useState<string | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewChapter, setPreviewChapter] = useState<any>(null);
  const [previewPages, setPreviewPages] = useState<string[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [chapterNumber, setChapterNumber] = useState<string>('');
  const [chapterTitle, setChapterTitle] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set());
  const [editingChapter, setEditingChapter] = useState<any>(null);
  const [showEditChapterDialog, setShowEditChapterDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<string>>(new Set());
  const [uploadConfig, setUploadConfig] = useState<{
    maxZipSizeMB: number;
    maxZipSizeBytes: number;
    maxArchiveFiles: number;
    maxFileSize: number;
    allowedExtensions: string[];
  } | null>(null);
  
  // Chapter cover image editing states
  const [editingChapterCover, setEditingChapterCover] = useState<any>(null);
  const [uploadingChapterCover, setUploadingChapterCover] = useState(false);
  const [chapterCoverPreview, setChapterCoverPreview] = useState<string | null>(null);
  const chapterCoverInputRef = useRef<HTMLInputElement>(null);
  
  // Page reordering state
  const [showPageReorderDialog, setShowPageReorderDialog] = useState(false);
  const [pendingChapterData, setPendingChapterData] = useState<{
    chapter: any;
    pages: string[];
    naturalSortConfidence: number;
    requiresManualReorder: boolean;
  } | null>(null);
  const [formData, setFormData] = useState<Partial<SeriesData>>({
    title: "",
    description: "",
    author: "",
    artist: "",
    status: "ongoing",
    type: "manga",
    genres: [],
    coverImageUrl: "",
    rating: undefined,
    publishedYear: undefined,
    isAdult: "false",
    isFeatured: "false",
    isTrending: "false",
    isPopularToday: "false",
    isLatestUpdate: "false",
    isPinned: "false",
  });

  // Safe parsing helpers
  const safeParseInt = (value: string | undefined): number | undefined => {
    if (!value || value.trim() === '') return undefined;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? undefined : parsed;
  };

  const safeParseFloat = (value: string | undefined): number | undefined => {
    if (!value || value.trim() === '') return undefined;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? undefined : parsed;
  };

  const fetchSeries = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/series");
      if (response.ok) {
        const data = await response.json();
        setSeries(data);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch series data",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Fetch upload configuration from API
  const fetchUploadConfig = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/upload-config", {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      if (response.ok) {
        const config = await response.json();
        setUploadConfig(config);
      } else {
        // Fallback to default values if API fails
        setUploadConfig({
          maxZipSizeMB: 200, // Default fallback
          maxZipSizeBytes: 200 * 1024 * 1024,
          maxArchiveFiles: 200,
          maxFileSize: 10 * 1024 * 1024,
          allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif']
        });
      }
    } catch (error) {
      // Fallback to default values if API fails
      setUploadConfig({
        maxZipSizeMB: 200, // Default fallback
        maxZipSizeBytes: 200 * 1024 * 1024,
        maxArchiveFiles: 200,
        maxFileSize: 10 * 1024 * 1024,
        allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif']
      });
    }
  }, []);

  // Check admin access and fetch initial data
  useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      navigate("/login");
      return;
    }
    fetchSeries();
    fetchUploadConfig();
  }, [isAuthenticated, isAdmin, navigate, fetchSeries, fetchUploadConfig]);

  // Reset selection when changing series
  useEffect(() => {
    setSelectedChapters(new Set());
    setImageLoadErrors(new Set()); // Also reset image error state
  }, [editingSeries?.id]);

  const fetchChapters = async (seriesId: string) => {
    try {
      const response = await fetch(`/api/admin/chapters?seriesId=${seriesId}`);
      if (response.ok) {
        const data = await response.json();
        
        // Transform chapter data to convert storage paths to proper URLs
        const transformedChapters = data.map((chapter: any) => {
          const transformedChapter = { ...chapter };
          
          // Transform cover image URL if it's a storage path
          if (chapter.coverImageUrl && !chapter.coverImageUrl.startsWith('http') && !chapter.coverImageUrl.startsWith('/api/')) {
            const imageName = chapter.coverImageUrl.startsWith('chapters/') 
              ? chapter.coverImageUrl.substring('chapters/'.length) 
              : chapter.coverImageUrl;
            transformedChapter.coverImageUrl = `/api/chapters/image/${imageName}`;
          }
          
          return transformedChapter;
        });
        
        setChapters(transformedChapters);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch chapters",
        variant: "error",
      });
    }
  };

  const updateFormField = (field: keyof SeriesData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      author: "",
      artist: "",
      status: "ongoing",
      type: "manga",
      genres: [],
      coverImageUrl: "",
      rating: undefined,
      publishedYear: undefined,
      isAdult: "false",
      isFeatured: "false",
      isTrending: "false",
      isPopularToday: "false",
      isLatestUpdate: "false",
    });
    setEditingSeries(null);
    setImagePreview(null);
    setUploadMethod('url');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle drag and drop events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const zipFile = files.find(file => file.name.toLowerCase().endsWith('.zip'));
    
    if (zipFile) {
      processFileUpload(zipFile);
    } else {
      toast({
        title: "Error",
        description: "Please drop a ZIP file containing chapter images",
        variant: "error",
      });
    }
  };

  // Process file upload (shared between drag/drop and click upload)
  const processFileUpload = async (file: File) => {
    // Validate chapter number is provided and is numeric
    if (!chapterNumber.trim()) {
      toast({
        title: "Error",
        description: "Please enter a chapter number first",
        variant: "error",
      });
      return;
    }
    
    // Validate chapter number is numeric (allow decimals like 1.5)
    const chapterNum = parseFloat(chapterNumber.trim());
    if (isNaN(chapterNum) || chapterNum <= 0) {
      toast({
        title: "Error",
        description: "Chapter number must be a valid positive number (e.g., 1, 1.5, 2)",
        variant: "error",
      });
      return;
    }

    // Validate file type (ZIP files only)
    if (!file.name.toLowerCase().endsWith('.zip')) {
      toast({
        title: "Error",
        description: "Please upload a ZIP file containing chapter images",
        variant: "error",
      });
      return;
    }

    // Validate file size using configurable limit
    if (!uploadConfig) {
      toast({
        title: "Error",
        description: "Upload configuration not loaded. Please try again.",
        variant: "error",
      });
      return;
    }
    
    if (file.size > uploadConfig.maxZipSizeBytes) {
      toast({
        title: "Error", 
        description: `Chapter ZIP file must be less than ${uploadConfig.maxZipSizeMB}MB`,
        variant: "error",
      });
      return;
    }

    // Check if we have a series to upload to
    if (!editingSeries?.id) {
      toast({
        title: "Error",
        description: "Please save the series first before uploading chapters",
        variant: "error",
      });
      return;
    }

    try {
      setUploadingChapter(true);
      setIsValidating(true);
      setChapterUploadProgress('Validating file and preparing upload...');
      setUploadProgress(0);
      setUploadRequestId('');

      // Fetch CSRF token
      const csrfResponse = await fetch('/api/csrf-token', {
        credentials: 'include',
      });
      const { csrfToken } = await csrfResponse.json();

      const formData = new FormData();
      formData.append('zip', file);
      formData.append('seriesId', editingSeries.id);
      formData.append('chapterNumber', chapterNumber.trim());
      if (chapterTitle.trim()) {
        formData.append('title', chapterTitle.trim());
      }

      // Use XMLHttpRequest for upload progress tracking
      const response = await new Promise<Response>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        // Track upload progress - switches from validation to upload
        xhr.upload.onloadstart = () => {
          setIsValidating(false);
          setChapterUploadProgress('Uploading file to server...');
        };
        
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentage = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percentage);
            setChapterUploadProgress(`Uploading... ${percentage}%`);
          }
        };
        
        xhr.onload = () => {
          setIsValidating(false);
          resolve(new Response(xhr.responseText, {
            status: xhr.status,
            statusText: xhr.statusText,
            headers: xhr.getAllResponseHeaders()
              .split('\r\n')
              .reduce((headers: Record<string, string>, line) => {
                const [key, value] = line.split(': ');
                if (key && value) headers[key] = value;
                return headers;
              }, {})
          }));
        };
        
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.ontimeout = () => reject(new Error('Upload timeout'));
        
        xhr.open('POST', '/api/admin/upload-chapter');
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        xhr.setRequestHeader('x-csrf-token', csrfToken);
        xhr.send(formData);
      });

      const result = await response.json();

      // Handle async upload workflow (202 Accepted)
      if (response.status === 202) {
        // Store upload ID and start progress tracking immediately
        if (result.uploadId) {
          setUploadRequestId(result.uploadId);
          setCurrentUploadId(result.uploadId);
          setShowUploadProgress(true);
          
          toast({
            title: "Upload Started",
            description: `Chapter ${chapterNumber} upload started. Processing in background...`,
          });
          
          // Clear form immediately since upload is now processing async
          if (chapterUploadRef.current) {
            chapterUploadRef.current.value = '';
          }
          setChapterNumber('');
          setChapterTitle('');
        } else {
          throw new Error('No upload ID returned from server');
        }
      } else if (response.ok) {
        // This should not happen with new async implementation
        toast({
          title: "Error",
          description: "Unexpected server response format. Please try again.",
          variant: "error",
        });
      } else {
        // Validation errors and other failures (4xx, 5xx)
        const errorMessage = result.message || "Failed to upload chapter";
        const requestIdText = result.requestId || result.uploadId ? 
          ` (ID: ${result.requestId || result.uploadId})` : '';
        
        toast({
          title: "Upload Failed",
          description: `${errorMessage}${requestIdText}`,
          variant: "error",
        });
      }
    } catch (error) {
      const requestIdText = uploadRequestId ? ` (Request ID: ${uploadRequestId})` : '';
      
      toast({
        title: "Upload Error",
        description: `Network error or server unavailable. Please check your connection and try again.${requestIdText}`,
        variant: "error",
      });
    } finally {
      setUploadingChapter(false);
      setIsValidating(false);
      setChapterUploadProgress('');
      setUploadProgress(0);
      setUploadRequestId('');
    }
  };

  // Handle chapter upload from file input
  const handleChapterUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    processFileUpload(file);
  };

  // Handle page reorder confirmation
  const handlePageReorderConfirm = async (reorderedPages: string[]) => {
    if (!pendingChapterData) return;
    
    try {
      // Update chapter with new page order
      const response = await apiRequest('PUT', `/api/admin/chapters/${pendingChapterData.chapter.id}`, {
        pages: reorderedPages,
        requiresManualReorder: 'false',
        naturalSortConfidence: '1.0',
      });

      toast({
        title: "Success",
        description: `Chapter ${pendingChapterData.chapter.chapterNumber} page order updated successfully!`,
      });
      
      // Refresh chapters list
      if (editingSeries?.id) {
        await fetchChapters(editingSeries.id);
      }
    } catch (error: any) {
      toast({
        title: "Error", 
        description: error?.message || "Failed to update page order. Please try again.",
        variant: "error",
      });
    } finally {
      // Clear pending data and close dialog
      setPendingChapterData(null);
      setShowPageReorderDialog(false);
      
      // Refresh chapters list even on error to ensure UI is in sync
      if (editingSeries?.id) {
        await fetchChapters(editingSeries.id);
      }
    }
  };

  // Handle upload completion
  const handleUploadComplete = async () => {
    setShowUploadProgress(false);
    setCurrentUploadId(null);
    setUploadingChapter(false);
    setChapterUploadProgress('');
    
    // Refresh chapters list
    if (editingSeries?.id) {
      await fetchChapters(editingSeries.id);
    }
    
    // Clear the file input and form fields
    if (chapterUploadRef.current) {
      chapterUploadRef.current.value = '';
    }
    setChapterNumber('');
    setChapterTitle('');
    
    toast({
      title: "Upload Complete",
      description: "Chapter has been uploaded successfully!",
    });
  };

  // Handle upload error
  const handleUploadError = (error: string) => {
    setShowUploadProgress(false);
    setCurrentUploadId(null);
    setUploadingChapter(false);
    setChapterUploadProgress('');
    
    toast({
      title: "Upload Failed",
      description: error,
      variant: "error",
    });
  };

  // Handle page reorder dialog close
  const handlePageReorderClose = async () => {
    // If user cancels, still refresh chapters list to show the uploaded chapter
    if (pendingChapterData && editingSeries?.id) {
      await fetchChapters(editingSeries.id);
    }
    
    setPendingChapterData(null);
    setShowPageReorderDialog(false);
  };

  const handleDeleteChapter = async (chapterId: string) => {
    try {
      await apiRequest('DELETE', `/api/admin/chapters/${chapterId}`);

      toast({
        title: "Success",
        description: "Chapter deleted successfully",
      });
      
      // Refresh chapters list
      if (editingSeries?.id) {
        await fetchChapters(editingSeries.id);
      }
      
      // Clear selected chapters if this was one of them
      setSelectedChapters(prev => {
        const newSet = new Set(prev);
        newSet.delete(chapterId);
        return newSet;
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete chapter. Please try again.",
        variant: "error",
      });
    }
  };

  // New handler functions for enhanced chapter management
  const handleEditChapter = (chapter: any) => {
    setEditingChapter(chapter);
    setShowEditChapterDialog(true);
  };

  const handleUpdateChapter = async () => {
    if (!editingChapter) return;
    
    try {
      await apiRequest('PATCH', `/api/admin/chapters/${editingChapter.id}`, {
        title: editingChapter.title || '',
        isPublished: editingChapter.isPublished,
      });

      toast({
        title: "Success",
        description: "Chapter updated successfully",
      });
      
      // Refresh chapters list
      if (editingSeries?.id) {
        await fetchChapters(editingSeries.id);
      }
      setShowEditChapterDialog(false);
      setEditingChapter(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to update chapter. Please try again.",
        variant: "error",
      });
    }
  };

  const toggleChapterSelection = (chapterId: string) => {
    const newSelected = new Set(selectedChapters);
    if (newSelected.has(chapterId)) {
      newSelected.delete(chapterId);
    } else {
      newSelected.add(chapterId);
    }
    setSelectedChapters(newSelected);
  };

  const selectAllChapters = () => {
    if (selectedChapters.size === chapters.length) {
      setSelectedChapters(new Set());
    } else {
      setSelectedChapters(new Set(chapters.map(ch => ch.id)));
    }
  };

  const handleImageError = (chapterId: string) => {
    setImageLoadErrors(prev => new Set([...Array.from(prev), chapterId]));
  };

  // Chapter cover image functions
  const handleChapterCoverEdit = (chapter: any) => {
    setEditingChapterCover(chapter);
    setChapterCoverPreview(chapter.coverImageUrl);
  };

  const handleChapterCoverFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "Cover image must be less than 5MB",
          variant: "error",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setChapterCoverPreview(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleChapterCoverUpload = async () => {
    if (!editingChapterCover || !chapterCoverPreview) return;

    try {
      setUploadingChapterCover(true);
      
      // Fetch CSRF token
      const csrfResponse = await fetch('/api/csrf-token', {
        credentials: 'include',
      });
      const { csrfToken } = await csrfResponse.json();
      
      const formData = new FormData();
      
      if (chapterCoverInputRef.current?.files?.[0]) {
        formData.append('coverImage', chapterCoverInputRef.current.files[0]);
      } else if (chapterCoverPreview.startsWith('http')) {
        formData.append('coverImageUrl', chapterCoverPreview);
      }

      const response = await fetch(`/api/admin/chapters/${editingChapterCover.id}/cover`, {
        method: 'PATCH',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'x-csrf-token': csrfToken,
        },
        body: formData,
        credentials: 'include',
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Chapter cover updated successfully",
        });
        
        // Refresh chapters list
        if (editingSeries?.id) {
          await fetchChapters(editingSeries.id);
        }
        
        setEditingChapterCover(null);
        setChapterCoverPreview(null);
        if (chapterCoverInputRef.current) {
          chapterCoverInputRef.current.value = '';
        }
      } else {
        const result = await response.json();
        toast({
          title: "Error",
          description: result.message || "Failed to update chapter cover",
          variant: "error",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to update chapter cover. Please try again.",
        variant: "error",
      });
    } finally {
      setUploadingChapterCover(false);
    }
  };


  const handlePreviewChapter = async (chapter: any) => {
    try {
      setPreviewLoading(true);
      setPreviewChapter(chapter);
      setShowPreviewDialog(true);
      
      // Fetch chapter pages for preview
      const response = await fetch(`/api/admin/chapters/${chapter.id}`);
      if (response.ok) {
        const chapterData = await response.json();
        
        // Extract page URLs from the chapter data and convert to proper image URLs
        const pages = chapterData.pages || [];
        
        const pageUrls = pages.map((page: string) => {
          // If it's already a full URL, use it as is
          if (page.startsWith('http://') || page.startsWith('https://') || page.startsWith('/api/')) {
            return page;
          }
          // Convert storage path to image URL (remove 'chapters/' prefix if present)
          const imageName = page.startsWith('chapters/') ? page.substring('chapters/'.length) : page;
          const imageUrl = `/api/chapters/image/${imageName}`;
          return imageUrl;
        });
        
        setPreviewPages(pageUrls.slice(0, 5)); // Show first 5 pages in preview
      } else {
        throw new Error('Failed to fetch chapter data');
      }
    } catch (error) {
      toast({
        title: "Preview Error",
        description: "Failed to load chapter preview. Please try again.",
        variant: "error",
      });
      setShowPreviewDialog(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleBulkPublish = async (publish: boolean) => {
    if (selectedChapters.size === 0) return;
    
    try {
      const promises = Array.from(selectedChapters).map(chapterId => 
        apiRequest('PATCH', `/api/admin/chapters/${chapterId}`, {
          isPublished: publish,
        })
      );

      await Promise.all(promises);
      
      toast({
        title: "Success",
        description: `${selectedChapters.size} chapters ${publish ? 'published' : 'unpublished'} successfully`,
      });
      
      // Refresh chapters list
      if (editingSeries?.id) {
        await fetchChapters(editingSeries.id);
      }
      setSelectedChapters(new Set());
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to update chapters. Please try again.",
        variant: "error",
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedChapters.size === 0) return;
    
    try {
      const promises = Array.from(selectedChapters).map(chapterId => 
        apiRequest('DELETE', `/api/admin/chapters/${chapterId}`)
      );

      await Promise.all(promises);
      
      toast({
        title: "Success",
        description: `${selectedChapters.size} chapters deleted successfully`,
      });
      
      // Refresh chapters list
      if (editingSeries?.id) {
        await fetchChapters(editingSeries.id);
      }
      setSelectedChapters(new Set());
      setShowBulkDeleteDialog(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete chapters. Please try again.",
        variant: "error",
      });
      setShowBulkDeleteDialog(false);
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid date';
    }
  };

  const handleGenreChange = (genre: string, checked: boolean | "indeterminate") => {
    setFormData(prev => {
      const currentGenres = prev.genres || [];
      // Handle indeterminate as false (unchecked)
      const isChecked = checked === true;
      
      if (isChecked) {
        // Add genre if not present
        return {
          ...prev,
          genres: currentGenres.includes(genre) ? currentGenres : [...currentGenres, genre]
        };
      } else {
        // Remove genre if present
        return {
          ...prev,
          genres: currentGenres.filter(g => g !== genre)
        };
      }
    });
  };

  const sanitizeFormData = (data: Partial<SeriesData>) => {
    const sanitized = { ...data };
    
    // Convert empty strings to undefined for optional fields (but preserve arrays and booleans)
    Object.keys(sanitized).forEach(key => {
      const value = (sanitized as any)[key];
      // Only convert empty strings, preserve arrays (including empty ones) and other types
      if (value === "" && !Array.isArray(value)) {
        (sanitized as any)[key] = undefined;
      }
    });

    // Ensure genres is always an array (preserve it if it exists)
    if (!sanitized.genres) {
      sanitized.genres = [];
    }

    // Ensure required boolean fields are strings - preserve existing values
    sanitized.isAdult = sanitized.isAdult !== undefined ? sanitized.isAdult : "false";
    sanitized.isFeatured = sanitized.isFeatured !== undefined ? sanitized.isFeatured : "false";
    sanitized.isTrending = sanitized.isTrending !== undefined ? sanitized.isTrending : "false";
    sanitized.isPopularToday = sanitized.isPopularToday !== undefined ? sanitized.isPopularToday : "false";
    sanitized.isLatestUpdate = sanitized.isLatestUpdate !== undefined ? sanitized.isLatestUpdate : "false";

    return sanitized;
  };

  const handleAddSeries = async () => {
    if (!formData.title?.trim()) {
      toast({
        title: "Error",
        description: "Title is required",
        variant: "error",
      });
      return;
    }

    try {
      // Sanitize form data before submission
      const sanitizedData = sanitizeFormData(formData);

      const response = await apiRequest("POST", "/api/admin/series", sanitizedData);
      const result = await response.json();

      toast({
        title: "Success",
        description: "Series added successfully",
      });
      await fetchSeries();
      setShowAddDialog(false);
      resetForm();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to add series. Please try again.",
        variant: "error",
      });
    }
  };

  const handleEditSeries = async (seriesItem: SeriesData) => {
    setEditingSeries(seriesItem);
    setFormData({
      title: seriesItem.title,
      description: seriesItem.description || "",
      author: seriesItem.author || "",
      artist: seriesItem.artist || "",
      status: seriesItem.status,
      type: seriesItem.type,
      genres: seriesItem.genres || [],
      coverImageUrl: seriesItem.coverImageUrl || "",
      rating: seriesItem.rating,
      publishedYear: seriesItem.publishedYear,
      isAdult: seriesItem.isAdult || "false",
      isFeatured: seriesItem.isFeatured || "false",
      isTrending: seriesItem.isTrending || "false",
      isPopularToday: seriesItem.isPopularToday || "false",
      isLatestUpdate: seriesItem.isLatestUpdate || "false",
    });
    
    // Set image preview if there's an existing cover
    if (seriesItem.coverImageUrl) {
      setImagePreview(seriesItem.coverImageUrl);
    }
    
    // Fetch chapters for this series
    await fetchChapters(seriesItem.id);
  };

  const handleUpdateSeries = async () => {
    if (!editingSeries?.id || !formData.title?.trim()) {
      toast({
        title: "Error",
        description: "Title is required",
        variant: "error",
      });
      return;
    }

    try {
      // Sanitize form data before submission
      const sanitizedData = sanitizeFormData(formData);

      const response = await apiRequest("PUT", `/api/admin/series/${editingSeries.id}`, sanitizedData);
      const result = await response.json();

      toast({
        title: "Success",
        description: "Series updated successfully",
      });
      await fetchSeries();
      setEditingSeries(null);
      resetForm();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to update series. Please try again.",
        variant: "error",
      });
    }
  };

  const handleDeleteSeries = async (seriesId: string) => {
    try {
      await apiRequest("DELETE", `/api/admin/series/${seriesId}`);

      toast({
        title: "Success",
        description: "Series deleted successfully",
      });
      await fetchSeries();
      setDeleteSeriesId(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete series. Please try again.",
        variant: "error",
      });
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      toast({
        title: "Error",
        description: "Please upload a valid image file (JPEG, PNG, or WebP)",
        variant: "error",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Image must be less than 5MB",
        variant: "error",
      });
      return;
    }

    try {
      setUploadingImage(true);

      // Fetch CSRF token
      const csrfResponse = await fetch('/api/csrf-token', {
        credentials: 'include',
      });
      const { csrfToken } = await csrfResponse.json();

      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/admin/upload-cover', {
        method: 'POST',
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          'x-csrf-token': csrfToken,
        },
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      const data = await response.json();
      const imageUrl = data.url;

      // Update form data with the uploaded image URL
      setFormData(prev => ({ ...prev, coverImageUrl: imageUrl }));
      setImagePreview(imageUrl);

      toast({
        title: "Success",
        description: "Image uploaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to upload image. Please try again.",
        variant: "error",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusOption = statusOptions.find(s => s.value === status);
    return (
      <Badge variant="secondary" className={statusOption?.color}>
        {statusOption?.label || status}
      </Badge>
    );
  };

  // Filter series based on search query
  const filteredSeries = series.filter(seriesItem => 
    seriesItem.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    seriesItem.author?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    seriesItem.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    seriesItem.genres?.some(genre => genre.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Don't render anything if not admin (during redirect)
  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  // Use useMemo to prevent form re-creation and focus issues
  const SeriesForm = useMemo(() => (
    <div className="grid gap-4 py-4 w-full min-w-0">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 min-w-0">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={formData.title || ""}
            onChange={(e) => updateFormField("title", e.target.value)}
            className="bg-background/50 w-full"
            autoComplete="off"
          />
        </div>
        <div className="space-y-2 min-w-0">
          <Label htmlFor="author">Author</Label>
          <Input
            id="author"
            value={formData.author || ""}
            onChange={(e) => updateFormField("author", e.target.value)}
            className="bg-background/50 w-full"
            autoComplete="off"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 min-w-0">
          <Label htmlFor="type">Type</Label>
          <Select value={formData.type} onValueChange={(value) => updateFormField("type", value)}>
            <SelectTrigger className="bg-background/50 w-full">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 min-w-0">
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status} onValueChange={(value) => updateFormField("status", value)}>
            <SelectTrigger className="bg-background/50 w-full">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map(status => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2 min-w-0">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description || ""}
          onChange={(e) => updateFormField("description", e.target.value)}
          className="bg-background/50 w-full resize-none"
          rows={3}
          autoComplete="off"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 min-w-0">
          <Label htmlFor="artist">Artist</Label>
          <Input
            id="artist"
            value={formData.artist || ""}
            onChange={(e) => updateFormField("artist", e.target.value)}
            className="bg-background/50 w-full"
          />
        </div>
        <div className="space-y-2 min-w-0">
          <Label htmlFor="publishedYear">Published Year</Label>
          <Input
            id="publishedYear"
            type="number"
            min="1900"
            max={new Date().getFullYear() + 5}
            value={formData.publishedYear != null ? formData.publishedYear.toString() : ""}
            onChange={(e) => updateFormField("publishedYear", safeParseInt(e.target.value))}
            className="bg-background/50 w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 min-w-0">
          <Label htmlFor="rating">Rating (0-10)</Label>
          <Input
            id="rating"
            type="number"
            min="0"
            max="10"
            step="0.1"
            value={formData.rating != null ? formData.rating.toString() : ""}
            onChange={(e) => updateFormField("rating", safeParseFloat(e.target.value))}
            className="bg-background/50 w-full"
          />
        </div>
        <div className="space-y-2 min-w-0">
          <Label htmlFor="coverUrl">Cover Image URL</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="coverUrl"
              value={formData.coverImageUrl || ""}
              onChange={(e) => updateFormField("coverImageUrl", e.target.value)}
              className="bg-background/50 w-full"
              placeholder="https://example.com/cover.jpg"
              disabled={uploadMethod === 'file'}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setUploadMethod(uploadMethod === 'url' ? 'file' : 'url')}
              className="whitespace-nowrap flex-shrink-0"
            >
              {uploadMethod === 'url' ? 'Upload File' : 'Use URL'}
            </Button>
          </div>
        </div>
      </div>

      {/* File Upload Section */}
      {uploadMethod === 'file' && (
        <div className="space-y-4 border-t pt-4">
          <div className="space-y-2">
            <Label>Cover Image Upload</Label>
            <div className="flex items-center space-x-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="bg-background/50 hover:bg-background/70"
              >
                {uploadingImage ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full mr-2" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Choose Image
                  </>
                )}
              </Button>
              
              {imagePreview && (
                <div className="flex items-center space-x-2">
                  <img src={imagePreview} alt="Preview" className="h-16 w-12 object-cover rounded border max-w-full" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      updateFormField("coverImageUrl", "");
                      setImagePreview(null);
                      setUploadMethod('url');
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Genres */}
      <div className="space-y-2">
        <Label>Genres</Label>
        <div 
          className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-32 overflow-y-scroll p-2 border rounded [&::-webkit-scrollbar]:hidden" 
          style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}
        >
          {genreOptions.map(genre => (
            <div key={genre} className="flex items-center justify-between space-x-2 min-w-0">
              <Label htmlFor={genre} className="text-sm truncate cursor-pointer">
                {genre}
              </Label>
              <Switch
                id={genre}
                checked={formData.genres?.includes(genre) || false}
                onCheckedChange={(checked) => handleGenreChange(genre, checked)}
                className="flex-shrink-0"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Content Flags */}
      <div className="space-y-2">
        <Label>Content Settings</Label>
        <div className="flex items-center justify-between space-x-2">
          <Label htmlFor="isAdult" className="text-sm font-medium cursor-pointer">
            Adult Content (18+)
          </Label>
          <Switch
            id="isAdult"
            checked={formData.isAdult === "true"}
            onCheckedChange={(checked) => {
              updateFormField("isAdult", checked === true ? "true" : "false");
            }}
          />
        </div>
      </div>

      {/* Homepage Sections */}
      <div className="space-y-4">
        <Label>Homepage Sections</Label>
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="flex items-center justify-between space-x-2 min-w-0">
            <Label htmlFor="isFeatured" className="text-sm font-medium truncate cursor-pointer">
              Featured
            </Label>
            <Switch
              id="isFeatured"
              checked={formData.isFeatured === "true"}
              onCheckedChange={(checked) => {
                updateFormField("isFeatured", checked === true ? "true" : "false");
              }}
              className="flex-shrink-0"
            />
          </div>
          <div className="flex items-center justify-between space-x-2 min-w-0">
            <Label htmlFor="isTrending" className="text-sm font-medium truncate cursor-pointer">
              Trending
            </Label>
            <Switch
              id="isTrending"
              checked={formData.isTrending === "true"}
              onCheckedChange={(checked) => {
                updateFormField("isTrending", checked === true ? "true" : "false");
              }}
              className="flex-shrink-0"
            />
          </div>
          <div className="flex items-center justify-between space-x-2 min-w-0">
            <Label htmlFor="isPopularToday" className="text-sm font-medium truncate cursor-pointer">
              Popular Today
            </Label>
            <Switch
              id="isPopularToday"
              checked={formData.isPopularToday === "true"}
              onCheckedChange={(checked) => {
                updateFormField("isPopularToday", checked === true ? "true" : "false");
              }}
              className="flex-shrink-0"
            />
          </div>
          <div className="flex items-center justify-between space-x-2 min-w-0">
            <Label htmlFor="isLatestUpdate" className="text-sm font-medium truncate cursor-pointer">
              Latest Updates
            </Label>
            <Switch
              id="isLatestUpdate"
              checked={formData.isLatestUpdate === "true"}
              onCheckedChange={(checked) => {
                updateFormField("isLatestUpdate", checked === true ? "true" : "false");
              }}
              className="flex-shrink-0"
            />
          </div>
          <div className="flex items-center justify-between space-x-2 min-w-0">
            <Label htmlFor="isPinned" className="text-sm font-medium truncate cursor-pointer">
              Pinned
            </Label>
            <Switch
              id="isPinned"
              checked={formData.isPinned === "true"}
              onCheckedChange={(checked) => {
                updateFormField("isPinned", checked === true ? "true" : "false");
              }}
              className="flex-shrink-0"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Select which homepage sections this series should appear in. You can select multiple sections.
        </p>
      </div>

      {/* Chapter Management - Only show when editing existing series */}
      {editingSeries && (
        <div className="space-y-4 border-t pt-6 mt-6">
          <div>
            <Label className="text-sm font-medium">Chapter Management</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Upload and manage chapters for this series. Upload chapters as ZIP files containing images.
            </p>
          </div>
          
          {/* Image Optimization Tips */}
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2 text-sm">
                  📸 Image Optimization Best Practices
                </h4>
                <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1.5">
                  <li>✓ <strong>Format:</strong> Use JPG/PNG. WebP support coming soon</li>
                  <li>✓ <strong>Resolution:</strong> 800-1200px width for web, 1600-2400px for high-quality</li>
                  <li>✓ <strong>File size:</strong> Keep images under 500KB each (compress before upload)</li>
                  <li>✓ <strong>Naming:</strong> Use sequential numbers (001.jpg, 002.jpg, etc.) for auto-sorting</li>
                  <li>✓ <strong>Compression:</strong> Use tools like TinyPNG or ImageOptim before uploading</li>
                  <li>✓ <strong>Max pages:</strong> Up to {uploadConfig?.maxArchiveFiles || 200} pages per chapter</li>
                  <li>✓ <strong>Zip size:</strong> Maximum {uploadConfig?.maxZipSizeMB || 100}MB per upload</li>
                </ul>
              </div>
            </div>
          </div>
          
          {/* Chapter Upload Form */}
          <div className="space-y-4">
            {/* Input Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 min-w-0">
                <Label htmlFor="chapterNumber" className="text-sm font-medium">
                  Chapter Number *
                </Label>
                <div className="relative">
                  <Input
                    id="chapterNumber"
                    type="text"
                    placeholder="e.g. 1, 1.5, 2"
                    value={chapterNumber}
                    onChange={(e) => setChapterNumber(e.target.value)}
                    className="bg-background/50 w-full pr-20"
                    disabled={uploadingChapter}
                  />
                  {chapters.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1 h-8 px-2 text-xs text-muted-foreground hover:text-foreground whitespace-nowrap"
                      onClick={() => {
                        const existingNumbers = chapters.map(c => parseFloat(c.chapterNumber) || 0);
                        const maxChapter = Math.max(...existingNumbers);
                        let nextChapter: number;
                        
                        // Handle decimal chapters (e.g., 1.5) by finding the next integer
                        if (maxChapter % 1 !== 0) {
                          nextChapter = Math.ceil(maxChapter);
                        } else {
                          nextChapter = maxChapter + 1;
                        }
                        
                        // Check for duplicates and warn user
                        const proposedNumber = nextChapter.toString();
                        if (existingNumbers.includes(nextChapter)) {
                          toast({
                            title: "Chapter Number Conflict",
                            description: `Chapter ${proposedNumber} already exists. Please use a different number.`,
                            variant: "error",
                          });
                        } else {
                          setChapterNumber(proposedNumber);
                          toast({
                            title: "Chapter Number Suggested",
                            description: `Set to Chapter ${proposedNumber}`,
                          });
                        }
                      }}
                      disabled={uploadingChapter}
                      title="Suggest next chapter number based on existing chapters"
                    >
                      {chapterNumber ? 'Auto' : `Next (${(() => {
                        const existingNumbers = chapters.map(c => parseFloat(c.chapterNumber) || 0);
                        const maxChapter = Math.max(...existingNumbers);
                        return maxChapter % 1 !== 0 ? Math.ceil(maxChapter) : maxChapter + 1;
                      })()})`}
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-2 min-w-0">
                <Label htmlFor="chapterTitle" className="text-sm font-medium">
                  Chapter Title (optional)
                </Label>
                <Input
                  id="chapterTitle"
                  type="text"
                  placeholder="e.g. The Beginning"
                  value={chapterTitle}
                  onChange={(e) => setChapterTitle(e.target.value)}
                  className="bg-background/50 w-full"
                  disabled={uploadingChapter}
                />
              </div>
            </div>

            {/* Drag and Drop Zone */}
            <div 
              className={`relative border-2 border-dashed rounded-lg transition-all duration-200 overflow-hidden ${
                isDragOver 
                  ? 'border-primary bg-primary/10 scale-[1.02]' 
                  : uploadingChapter 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50 hover:bg-background/30'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                ref={chapterUploadRef}
                type="file"
                accept=".zip"
                onChange={handleChapterUpload}
                className="hidden"
                disabled={uploadingChapter}
              />
              
              {/* Liquid Fill Effect During Upload */}
              {uploadingChapter && (
                <>
                  <div 
                    className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-primary/25 to-primary/15 transition-all duration-1000 ease-out"
                    style={{
                      height: isValidating ? '60%' : `${uploadProgress}%`,
                      animation: isValidating ? 'liquid-wave 3s ease-in-out infinite' : 'none'
                    }}
                  />
                  <div 
                    className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-primary/35 to-primary/25 transition-all duration-1000 ease-out"
                    style={{
                      height: isValidating ? '40%' : `${Math.max(0, uploadProgress - 15)}%`,
                      animation: isValidating ? 'liquid-wave 3s ease-in-out infinite 0.5s' : 'none'
                    }}
                  />
                  <style>{`
                    @keyframes liquid-wave {
                      0%, 100% { transform: translateY(0px); }
                      50% { transform: translateY(-8px); }
                    }
                  `}</style>
                </>
              )}
              
              <div className="relative z-10 p-8 text-center space-y-4">
                <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center transition-colors duration-200 ${
                  isDragOver 
                    ? 'bg-primary/20 text-primary' 
                    : uploadingChapter 
                      ? 'bg-muted text-muted-foreground' 
                      : 'bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary'
                }`}>
                  {uploadingChapter ? (
                    <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                  ) : (
                    <Upload className="w-6 h-6" />
                  )}
                </div>
                
                <div className="space-y-2">
                  <h3 className={`font-medium ${isDragOver ? 'text-primary' : uploadingChapter ? 'text-primary' : 'text-foreground'}`}>
                    {uploadingChapter 
                      ? 'Uploading Chapter...' 
                      : isDragOver 
                        ? 'Drop your ZIP file here' 
                        : 'Drag & Drop your ZIP file here'
                    }
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {uploadingChapter 
                      ? (isValidating ? 'Validating and processing...' : `${chapterUploadProgress} (${uploadProgress}%)`) 
                      : 'or click to browse and select a ZIP file'
                    }
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ZIP files should contain images named in order (001.jpg, 002.jpg, etc.) • Max {uploadConfig?.maxZipSizeMB || 200}MB
                  </p>
                </div>

                {!uploadingChapter && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => chapterUploadRef.current?.click()}
                    disabled={!chapterNumber.trim()}
                    className="bg-background/50 hover:bg-background/70"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Browse Files
                  </Button>
                )}
              </div>
            </div>
          </div>


          {/* Enhanced Chapters List */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <Label className="text-sm font-medium">
                Chapters ({chapters.length})
              </Label>
              
              {/* Bulk Actions */}
              {chapters.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectAllChapters}
                    className="text-xs"
                  >
                    {selectedChapters.size === chapters.length ? (
                      <>
                        <CheckSquare className="w-3 h-3 mr-1" />
                        <span className="hidden xs:inline">Deselect All</span>
                        <span className="xs:hidden">Deselect</span>
                      </>
                    ) : (
                      <>
                        <Square className="w-3 h-3 mr-1" />
                        <span className="hidden xs:inline">Select All</span>
                        <span className="xs:hidden">Select</span>
                      </>
                    )}
                  </Button>
                  
                  {selectedChapters.size > 0 && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkPublish(true)}
                        className="text-xs"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        <span className="hidden sm:inline">Publish ({selectedChapters.size})</span>
                        <span className="sm:hidden">Publish</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkPublish(false)}
                        className="text-xs"
                      >
                        <EyeOff className="w-3 h-3 mr-1" />
                        <span className="hidden sm:inline">Unpublish ({selectedChapters.size})</span>
                        <span className="sm:hidden">Unpublish</span>
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowBulkDeleteDialog(true)}
                        className="text-xs"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        <span className="hidden sm:inline">Delete ({selectedChapters.size})</span>
                        <span className="sm:hidden">Delete</span>
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
            
            {chapters.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-border/50 rounded-lg">
                <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No chapters uploaded yet. Upload a ZIP file to add chapters.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  ZIP files should contain images named in order (001.jpg, 002.jpg, etc.)
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {chapters
                  .sort((a, b) => parseFloat(a.chapterNumber) - parseFloat(b.chapterNumber))
                  .map((chapter, index) => (
                    <div
                      key={chapter.id}
                      className={`group flex items-start sm:items-center bg-card/40 hover:bg-card/60 rounded-xl border border-border/30 p-2.5 sm:p-3 transition-all duration-200 hover:border-border/50 ${
                        selectedChapters.has(chapter.id) ? 'ring-2 ring-primary/40 bg-primary/8' : ''
                      }`}
                    >
                      {/* Selection Checkbox */}
                      <div className="flex-shrink-0 mr-2 sm:mr-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 sm:h-8 sm:w-8 p-0 hover:bg-primary/10 rounded-lg"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleChapterSelection(chapter.id);
                          }}
                        >
                          {selectedChapters.has(chapter.id) ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : (
                            <Square className="w-4 h-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>

                      {/* Cover Thumbnail */}
                      <div className="flex-shrink-0 mr-3 sm:mr-4 relative">
                        <div className="w-10 h-14 sm:w-12 sm:h-16 bg-muted/40 rounded-lg overflow-hidden group-hover:bg-muted/60 transition-all duration-200 shadow-sm">
                          {chapter.coverImageUrl && !imageLoadErrors.has(chapter.id) ? (
                            <img
                              src={chapter.coverImageUrl}
                              alt={`Chapter ${chapter.chapterNumber} cover`}
                              className="w-full h-full object-cover max-w-full"
                              onError={() => handleImageError(chapter.id)}
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <FileImage className="w-5 h-5 text-muted-foreground/50" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Chapter Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-[11px] xs:text-sm sm:text-base leading-tight truncate">
                                Chapter {chapter.chapterNumber}
                              </h3>
                              <div className={`text-[9px] xs:text-xs sm:text-sm px-1.5 xs:px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                                chapter.isPublished === "true" 
                                  ? "bg-green-500 text-white"
                                  : "bg-gray-500 text-white"
                              }`}>
                                {chapter.isPublished === "true" ? "Published" : "Draft"}
                              </div>
                            </div>
                            <p className="text-[10px] xs:text-xs sm:text-sm text-muted-foreground truncate leading-tight" title={chapter.title}>
                              {chapter.title || 'No title'}
                            </p>
                            <div className="flex items-center gap-2 sm:gap-3 text-[10px] xs:text-xs sm:text-sm text-muted-foreground flex-wrap">
                              <div className="flex items-center gap-1">
                                <BookOpen className="w-3 h-3 flex-shrink-0" />
                                <span className="whitespace-nowrap">{chapter.totalPages} pages</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate max-w-[120px] sm:max-w-none sm:whitespace-nowrap">{formatDate(chapter.createdAt)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-1 sm:gap-1.5 flex-shrink-0">
                            {/* Mobile: Show only most important actions */}
                            <div className="flex gap-1 md:hidden">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditChapter(chapter)}
                                className="h-8 w-8 p-0 hover:bg-primary/10"
                                title="Edit chapter"
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                                onClick={() => setDeleteChapterId(chapter.id)}
                                title="Delete chapter"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                            
                            {/* Desktop: Show all actions */}
                            <div className="hidden md:flex gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePreviewChapter(chapter)}
                                className="h-9 w-9 lg:h-10 lg:w-10 p-0 hover:bg-primary/10"
                                title="Preview chapter pages"
                              >
                                <Eye className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditChapter(chapter)}
                                className="h-9 w-9 lg:h-10 lg:w-10 p-0 hover:bg-primary/10"
                                title="Edit chapter details"
                              >
                                <Edit className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleChapterCoverEdit(chapter);
                                }}
                                className="h-9 w-9 lg:h-10 lg:w-10 p-0 hover:bg-primary/10"
                                title="Change cover image"
                              >
                                <Image className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-9 w-9 lg:h-10 lg:w-10 p-0"
                                onClick={() => setDeleteChapterId(chapter.id)}
                                title="Delete chapter"
                              >
                                <Trash2 className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  ), [formData, editingSeries, chapters, uploadingChapter, chapterUploadProgress, uploadingImage, imagePreview, uploadMethod, chapterNumber, chapterTitle, isDragOver, selectedChapters]);

  // Edit Chapter Dialog
  const EditChapterDialog = (
    <Dialog open={showEditChapterDialog} onOpenChange={setShowEditChapterDialog}>
      <DialogContent className="w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Chapter {editingChapter?.chapterNumber}</DialogTitle>
          <DialogDescription>
            Update chapter metadata and publication status
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="editTitle">Chapter Title (optional)</Label>
            <Input
              id="editTitle"
              value={editingChapter?.title || ""}
              onChange={(e) => setEditingChapter((prev: any) => ({ ...prev, title: e.target.value }))}
              placeholder="Enter chapter title"
              className="bg-background/50"
            />
          </div>
          <div className="space-y-2">
            <Label>Publication Status</Label>
            <Select
              value={editingChapter?.isPublished || "true"}
              onValueChange={(value) => setEditingChapter((prev: any) => ({ ...prev, isPublished: value }))}
            >
              <SelectTrigger className="bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Published</SelectItem>
                <SelectItem value="false">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="pt-2 space-y-1 text-xs text-muted-foreground">
            <p>Pages: {editingChapter?.totalPages}</p>
            <p>Uploaded: {formatDate(editingChapter?.createdAt)}</p>
          </div>
        </div>
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => setShowEditChapterDialog(false)}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleUpdateChapter}>
            <Save className="w-4 h-4 mr-2" />
            Update Chapter
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  // Chapter Cover Edit Dialog
  const ChapterCoverEditDialog = (
    <Dialog open={!!editingChapterCover} onOpenChange={() => {
      setEditingChapterCover(null);
      setChapterCoverPreview(null);
      if (chapterCoverInputRef.current) {
        chapterCoverInputRef.current.value = '';
      }
    }}>
      <DialogContent className="w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Chapter Cover</DialogTitle>
          <DialogDescription>
            Update the cover image for Chapter {editingChapterCover?.chapterNumber}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* Current Cover Preview */}
          <div className="space-y-2">
            <Label>Cover Preview</Label>
            <div className="relative aspect-[3/4] max-w-48 mx-auto rounded-lg overflow-hidden bg-muted/50 border">
              {chapterCoverPreview ? (
                <img
                  src={chapterCoverPreview}
                  alt="Cover preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <FileImage className="w-12 h-12 text-muted-foreground/50" />
                </div>
              )}
            </div>
          </div>

          {/* Upload Options */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="chapterCoverFile">Upload New Cover</Label>
              <Input
                id="chapterCoverFile"
                type="file"
                ref={chapterCoverInputRef}
                accept="image/*"
                onChange={handleChapterCoverFileChange}
                className="bg-background/50"
              />
              <p className="text-xs text-muted-foreground">
                Supported formats: JPG, PNG, WebP. Max size: 5MB
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="chapterCoverUrl">Or Enter Image URL</Label>
              <Input
                id="chapterCoverUrl"
                type="url"
                placeholder="https://example.com/cover.jpg"
                value={chapterCoverPreview || ''}
                onChange={(e) => setChapterCoverPreview(e.target.value)}
                className="bg-background/50"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => {
            setEditingChapterCover(null);
            setChapterCoverPreview(null);
            if (chapterCoverInputRef.current) {
              chapterCoverInputRef.current.value = '';
            }
          }}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleChapterCoverUpload} disabled={uploadingChapterCover}>
            {uploadingChapterCover ? (
              <>
                <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Updating...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Update Cover
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95 p-2 sm:p-4">
      <div className="max-w-7xl mx-auto px-2 sm:px-0">
        <Button
          variant="ghost"
          onClick={() => navigate("/admin")}
          className="w-fit text-muted-foreground hover:text-primary mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:justify-between mb-6 sm:mb-8">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Admin Panel
              </Button>
            </Link>
            <div className="flex items-center space-x-2">
              <BookOpen className="w-8 h-8 text-primary" />
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary via-accent to-purple-400 bg-clip-text text-transparent">
                Content Management
              </h1>
            </div>
          </div>
          
          <Dialog open={showAddDialog} onOpenChange={(open) => {
            setShowAddDialog(open);
            if (!open) {
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90">
                <Plus className="w-4 h-4 mr-2" />
                Add Series
              </Button>
            </DialogTrigger>
            <DialogContent className="flex flex-col w-[95vw] sm:w-[70vw] max-w-none max-h-[90vh] sm:max-h-[85vh] overflow-hidden">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>Add New Series</DialogTitle>
                <DialogDescription>
                  Add a new manga/manhwa series to the collection.
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto overflow-x-hidden px-1 sm:px-2">
                {SeriesForm}
              </div>
              <div className="flex justify-end space-x-2 flex-shrink-0 pt-4 border-t">
                <Button variant="outline" onClick={() => {
                  setShowAddDialog(false);
                  resetForm();
                }}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleAddSeries}>
                  <Save className="w-4 h-4 mr-2" />
                  Add Series
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search and Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="lg:col-span-3">
            <Card className="bg-card/80 backdrop-blur-md border-border/50">
              <CardContent className="p-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search series by title, author, type, or genre..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-background/50"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Card className="bg-card/80 backdrop-blur-md border-border/50">
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-2xl font-bold">{series.length}</p>
                <p className="text-sm text-muted-foreground">Total Series</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Series List */}
        <Card className="bg-card/80 backdrop-blur-md border-border/50">
          <CardHeader>
            <CardTitle>All Series</CardTitle>
            <CardDescription>
              Manage manga and manhwa series in the collection
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading series...</p>
              </div>
            ) : filteredSeries.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  {searchQuery ? "No series found matching your search." : "No series found."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredSeries.map((seriesItem) => (
                  <div
                    key={seriesItem.id}
                    className="group relative bg-card/80 backdrop-blur-sm rounded-xl border border-border/40 overflow-hidden hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 hover:border-primary/30 hover:scale-[1.02]"
                  >
                    {/* Cover Image */}
                    <div className="relative aspect-[3/4] overflow-hidden bg-muted">
                      {seriesItem.coverImageUrl ? (
                        <img
                          src={seriesItem.coverImageUrl}
                          alt={seriesItem.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/60">
                          <Image className="w-8 h-8 text-muted-foreground/50" />
                        </div>
                      )}
                      
                      {/* Status Badge */}
                      <div className="absolute top-2 left-2">
                        {getStatusBadge(seriesItem.status)}
                      </div>
                      
                      {/* Adult Content Badge */}
                      {seriesItem.isAdult === "true" && (
                        <Badge variant="destructive" className="absolute top-2 right-2 text-xs">18+</Badge>
                      )}
                      
                      {/* Rating */}
                      {seriesItem.rating && (
                        <div className="absolute bottom-2 right-2 flex items-center space-x-1 bg-black/70 backdrop-blur-sm rounded-md px-2 py-1">
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-white text-xs font-medium">{seriesItem.rating}</span>
                        </div>
                      )}
                      
                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      
                      {/* Hover Actions */}
                      <div className="absolute inset-x-2 bottom-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 space-y-2">
                        <div className="flex space-x-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                size="sm" 
                                variant="secondary" 
                                className="flex-1 bg-background/90 hover:bg-background text-xs min-h-[44px] h-auto px-3 py-2"
                                onClick={() => handleEditSeries(seriesItem)}
                              >
                                <Edit className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="flex flex-col w-[95vw] sm:w-[70vw] max-w-none max-h-[90vh] sm:max-h-[85vh] overflow-hidden">
                              <DialogHeader className="flex-shrink-0">
                                <DialogTitle>Edit Series</DialogTitle>
                                <DialogDescription>
                                  Update series information and metadata.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="flex-1 overflow-y-auto overflow-x-hidden px-1 sm:px-2">
                                {SeriesForm}
                              </div>
                              <div className="flex justify-end space-x-2 flex-shrink-0 pt-4 border-t">
                                <Button variant="outline" onClick={() => {
                                  setEditingSeries(null);
                                  resetForm();
                                }}>
                                  <X className="w-4 h-4 mr-2" />
                                  Cancel
                                </Button>
                                <Button onClick={handleUpdateSeries}>
                                  <Save className="w-4 h-4 mr-2" />
                                  Save Changes
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                          
                          <Button
                            size="sm"
                            variant="destructive"
                            className="text-xs px-2"
                            onClick={() => setDeleteSeriesId(seriesItem.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    {/* Series Info - Compact */}
                    <div className="p-3 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm line-clamp-2 leading-tight" title={seriesItem.title}>
                            {seriesItem.title}
                          </h3>
                          {seriesItem.author && (
                            <p className="text-xs text-muted-foreground truncate mt-1">
                              by {seriesItem.author}
                            </p>
                          )}
                        </div>
                        
                        {/* Mobile Actions - Always visible */}
                        <div className="flex md:hidden items-center space-x-2 ml-2 flex-shrink-0">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-11 w-11 p-0 min-h-[44px]"
                                onClick={() => handleEditSeries(seriesItem)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="flex flex-col w-[95vw] sm:w-[70vw] max-w-none max-h-[90vh] sm:max-h-[85vh] overflow-hidden">
                              <DialogHeader className="flex-shrink-0">
                                <DialogTitle>Edit Series</DialogTitle>
                                <DialogDescription>
                                  Update series information and metadata.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="flex-1 overflow-y-auto overflow-x-hidden px-1 sm:px-2">
                                {SeriesForm}
                              </div>
                              <div className="flex justify-end space-x-2 flex-shrink-0 pt-4 border-t">
                                <Button variant="outline" onClick={() => {
                                  setEditingSeries(null);
                                  resetForm();
                                }}>
                                  <X className="w-4 h-4 mr-2" />
                                  Cancel
                                </Button>
                                <Button onClick={handleUpdateSeries}>
                                  <Save className="w-4 h-4 mr-2" />
                                  Save Changes
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-11 w-11 p-0 min-h-[44px] text-destructive hover:text-destructive"
                            onClick={() => setDeleteSeriesId(seriesItem.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">{seriesItem.type}</Badge>
                      </div>
                      
                      {Array.isArray(seriesItem.genres) && seriesItem.genres.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {seriesItem.genres.slice(0, 2).map(genre => (
                            <Badge key={genre} variant="secondary" className="text-xs px-1 py-0">
                              {genre}
                            </Badge>
                          ))}
                          {seriesItem.genres.length > 2 && (
                            <Badge variant="secondary" className="text-xs px-1 py-0">
                              +{seriesItem.genres.length - 2}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete Series Confirmation Dialog */}
        <AlertDialog open={!!deleteSeriesId} onOpenChange={() => setDeleteSeriesId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Series</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this series? This action cannot be undone and will permanently remove all series data, chapters, and images.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteSeriesId && handleDeleteSeries(deleteSeriesId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Series
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Chapter Confirmation Dialog */}
        <AlertDialog open={!!deleteChapterId} onOpenChange={() => setDeleteChapterId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Chapter</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this chapter? This action cannot be undone and will permanently remove all chapter data and images.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteChapterId) {
                    handleDeleteChapter(deleteChapterId);
                    setDeleteChapterId(null);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Chapter
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit Chapter Dialog */}
        {EditChapterDialog}

        {/* Chapter Cover Edit Dialog */}
        {ChapterCoverEditDialog}

        {/* Bulk Delete Confirmation Dialog */}
        <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {selectedChapters.size} Chapters</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedChapters.size} selected chapters? This action cannot be undone and will permanently remove all chapter data and images.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleBulkDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete {selectedChapters.size} Chapters
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Chapter Preview Dialog */}
        <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>
                Preview: Chapter {previewChapter?.chapterNumber}
                {previewChapter?.title && ` - ${previewChapter.title}`}
              </DialogTitle>
              <DialogDescription>
                Preview of the first few pages. {previewChapter?.totalPages || 0} total pages.
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto">
              {previewLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <span className="ml-3 text-muted-foreground">Loading preview...</span>
                </div>
              ) : previewPages.length > 0 ? (
                <div className="space-y-4">
                  {previewPages.map((pageUrl, index) => (
                    <div key={index} className="border rounded-lg overflow-hidden bg-muted/30">
                      <div className="p-2 bg-muted/50 text-sm font-medium">
                        Page {index + 1}
                      </div>
                      <div className="flex justify-center p-4">
                        <img
                          src={pageUrl}
                          alt={`Page ${index + 1}`}
                          className="max-w-full max-h-96 object-contain rounded border"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/placeholder-image.png';
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  
                  {previewChapter?.totalPages > 5 && (
                    <div className="text-center py-4 text-muted-foreground">
                      ... and {previewChapter.totalPages - 5} more pages
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No preview available for this chapter.
                </div>
              )}
            </div>
            
            <div className="flex justify-end space-x-2 flex-shrink-0 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
                <X className="w-4 h-4 mr-2" />
                Close
              </Button>
              {previewChapter && (
                <Button 
                  onClick={() => {
                    window.open(`/manga/${editingSeries?.id}/chapter/${previewChapter.chapterNumber}`, '_blank');
                  }}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Full Chapter
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Page Reorder Dialog */}
        {pendingChapterData && (
          <PageReorderDialog
            isOpen={showPageReorderDialog}
            onClose={handlePageReorderClose}
            onConfirm={handlePageReorderConfirm}
            initialPages={pendingChapterData.pages}
            chapterNumber={pendingChapterData.chapter.chapterNumber}
            chapterTitle={pendingChapterData.chapter.title}
            naturalSortConfidence={pendingChapterData.naturalSortConfidence}
            requiresManualReorder={pendingChapterData.requiresManualReorder}
          />
        )}

        {/* Upload Progress Dialog */}
        <UploadProgressDialog
          open={showUploadProgress}
          onOpenChange={setShowUploadProgress}
          uploadId={currentUploadId}
          onComplete={handleUploadComplete}
          onError={handleUploadError}
        />
      </div>
    </div>
  );
}