import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  FileArchive, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Loader2,
  X
} from "lucide-react";

interface UploadProgress {
  id: string;
  status: 'initializing' | 'uploading' | 'processing' | 'extracting' | 'finalizing' | 'complete' | 'error';
  progress: number;
  message: string;
  currentFile?: string;
  totalFiles?: number;
  processedFiles?: number;
  startTime: number;
  speed?: number; // MB/s
  estimatedTimeRemaining?: number; // seconds
  error?: string;
  details?: {
    uploadedBytes?: number;
    totalBytes?: number;
    filesExtracted?: number;
    zipAnalysisComplete?: boolean;
  };
}

interface UploadProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uploadId: string | null;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export function UploadProgressDialog({
  open,
  onOpenChange,
  uploadId,
  onComplete,
  onError
}: UploadProgressDialogProps) {
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Format file size for display
  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }, []);

  // Format time remaining
  const formatTimeRemaining = useCallback((seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  }, []);

  // Poll for progress updates
  const pollProgress = useCallback(async () => {
    if (!uploadId || !open) return;

    try {
      const response = await fetch(`/api/admin/upload-progress/${uploadId}`, {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProgress(data);
        
        // Handle completion states
        if (data.status === 'complete') {
          setIsPolling(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setTimeout(() => {
            onComplete?.();
            onOpenChange(false);
          }, 2000); // Show success for 2 seconds
        } else if (data.status === 'error') {
          setIsPolling(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          onError?.(data.error || 'Upload failed');
        }
      } else if (response.status === 404) {
        // Upload not found - might have completed or expired
        setIsPolling(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        onError?.('Upload session expired');
      }
    } catch (error) {
      // Don't stop polling on network errors
    }
  }, [uploadId, open, onComplete, onError, onOpenChange]);

  // Start polling when upload starts
  useEffect(() => {
    // Clear any existing interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      setIsPolling(false);
    }

    if (uploadId && open) {
      setIsPolling(true);
      setProgress(null);
      
      // Poll immediately, then every 500ms
      pollProgress();
      intervalRef.current = setInterval(pollProgress, 500);
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setIsPolling(false);
      };
    }
  }, [uploadId, open]); // Removed isPolling from dependencies to prevent re-runs

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  // Cancel upload functionality
  const handleCancel = async () => {
    if (!uploadId) return;
    
    try {
      const response = await fetch(`/api/admin/upload-cancel/${uploadId}`, {
        method: 'DELETE',
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      if (response.ok) {
        setIsPolling(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        onOpenChange(false);
      } else {
        const result = await response.json();
        
        // Still close dialog even if cancel request fails
        setIsPolling(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        onOpenChange(false);
        
        // Optionally show an error message
        onError?.(result.message || 'Failed to cancel upload');
      }
    } catch (error) {
      // Still close dialog and stop polling on network errors
      setIsPolling(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      onOpenChange(false);
      onError?.('Network error while cancelling upload');
    }
  };

  // Get status icon
  const getStatusIcon = () => {
    if (!progress) return <Loader2 className="h-4 w-4 animate-spin" />;
    
    switch (progress.status) {
      case 'initializing':
      case 'uploading':
        return <Upload className="h-4 w-4" />;
      case 'processing':
      case 'extracting':
        return <FileArchive className="h-4 w-4" />;
      case 'finalizing':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'complete':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Loader2 className="h-4 w-4 animate-spin" />;
    }
  };

  // Get status color
  const getStatusColor = () => {
    if (!progress) return 'bg-blue-100 text-blue-800';
    
    switch (progress.status) {
      case 'complete':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getStatusIcon()}
            Upload Progress
          </DialogTitle>
          <DialogDescription>
            {progress?.message || 'Preparing your chapter upload...'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <Badge className={getStatusColor()}>
              {progress?.status ? progress.status.charAt(0).toUpperCase() + progress.status.slice(1) : 'Initializing'}
            </Badge>
            {progress && progress.status !== 'complete' && progress.status !== 'error' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                className="h-auto p-1"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">
                {progress?.progress || 0}%
              </span>
              {progress?.totalFiles && (
                <span className="text-xs text-muted-foreground">
                  {progress.processedFiles || 0} / {progress.totalFiles} files
                </span>
              )}
            </div>
            <Progress value={progress?.progress || 0} className="w-full" />
          </div>

          {/* Status Message */}
          <p className="text-sm text-muted-foreground">
            {progress?.message || 'Initializing upload...'}
          </p>

          {/* Current File (if available) */}
          {progress?.currentFile && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Processing:</span> {progress.currentFile}
            </div>
          )}

          {/* Speed and Time Estimates */}
          {progress && (progress.speed || progress.estimatedTimeRemaining) && (
            <div className="flex gap-4 text-xs text-muted-foreground">
              {progress.speed && (
                <div className="flex items-center gap-1">
                  <Upload className="h-3 w-3" />
                  <span>{progress.speed.toFixed(1)} MB/s</span>
                </div>
              )}
              {progress.estimatedTimeRemaining && progress.estimatedTimeRemaining > 0 && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatTimeRemaining(progress.estimatedTimeRemaining)} remaining</span>
                </div>
              )}
            </div>
          )}

          {/* Upload Details */}
          {progress?.details && (
            <div className="text-xs text-muted-foreground space-y-1">
              {progress.details.uploadedBytes && progress.details.totalBytes && (
                <div>
                  {formatFileSize(progress.details.uploadedBytes)} / {formatFileSize(progress.details.totalBytes)}
                </div>
              )}
              {progress.details.filesExtracted && (
                <div>{progress.details.filesExtracted} images extracted</div>
              )}
            </div>
          )}

          {/* Error Message */}
          {progress?.error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 p-2 rounded">
              {progress.error}
            </div>
          )}

          {/* Success Message */}
          {progress?.status === 'complete' && (
            <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50 p-2 rounded flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Chapter uploaded successfully!
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}