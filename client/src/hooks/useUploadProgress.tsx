import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import { logger } from '@/lib/logger';

export interface UploadProgressData {
  uploadId: string;
  status: 'processing' | 'complete' | 'failed';
  progress: number;
  message: string;
  details?: {
    currentFile?: string;
    totalFiles?: number;
    processedFiles?: number;
    speed?: number;
    estimatedTimeRemaining?: number;
    uploadedBytes?: number;
    totalBytes?: number;
    filesExtracted?: number;
    zipAnalysisComplete?: boolean;
  };
}

interface UseUploadProgressOptions {
  uploadId: string;
  onComplete?: (data: UploadProgressData) => void;
  onError?: (error: string) => void;
  onProgress?: (data: UploadProgressData) => void;
}

/**
 * Hook for subscribing to real-time upload progress via WebSocket
 * 
 * Replaces HTTP polling with WebSocket streaming for instant progress updates.
 * Automatically subscribes to progress events for a specific uploadId.
 * 
 * @param options Configuration including uploadId and callbacks
 * @returns Current upload progress data
 */
export function useUploadProgress(options: UseUploadProgressOptions) {
  const { uploadId, onComplete, onError, onProgress } = options;
  const [progress, setProgress] = useState<UploadProgressData | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  // Track if callbacks have been called to prevent duplicates
  const callbacksCalledRef = useRef({ complete: false, error: false });
  
  // Determine WebSocket URL
  const getWebSocketUrl = () => {
    if (typeof window === 'undefined') return '';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws`;
  };
  
  const { isConnected, subscribe } = useWebSocket(getWebSocketUrl(), {
    reconnect: true,
    reconnectInterval: 1000,
  });
  
  useEffect(() => {
    if (!isConnected || !uploadId) return;
    
    logger.log('UploadProgress', `Subscribing to upload:${uploadId}`);
    
    // Subscribe to all upload event types
    const unsubscribeProgress = subscribe('upload:progress', (payload: UploadProgressData) => {
      if (payload.uploadId === uploadId) {
        logger.log('UploadProgress', 'Progress update:', payload);
        setProgress(payload);
        onProgress?.(payload);
      }
    });
    
    const unsubscribeComplete = subscribe('upload:complete', (payload: UploadProgressData) => {
      if (payload.uploadId === uploadId && !callbacksCalledRef.current.complete) {
        logger.success('UploadProgress', 'Upload complete:', payload);
        setProgress(payload);
        setIsComplete(true);
        callbacksCalledRef.current.complete = true;
        onComplete?.(payload);
      }
    });
    
    const unsubscribeFailed = subscribe('upload:failed', (payload: UploadProgressData) => {
      if (payload.uploadId === uploadId && !callbacksCalledRef.current.error) {
        logger.log('UploadProgress', 'Upload failed:', payload);
        setProgress(payload);
        setHasError(true);
        callbacksCalledRef.current.error = true;
        onError?.(payload.message);
      }
    });
    
    // Cleanup subscriptions
    return () => {
      logger.log('UploadProgress', `Unsubscribing from upload:${uploadId}`);
      unsubscribeProgress();
      unsubscribeComplete();
      unsubscribeFailed();
    };
  }, [isConnected, uploadId, subscribe, onComplete, onError, onProgress]);
  
  // Fallback to HTTP polling if WebSocket is not connected (graceful degradation)
  useEffect(() => {
    if (isConnected || !uploadId || isComplete || hasError) return;
    
    logger.info('UploadProgress', `WebSocket not connected, using HTTP polling fallback for ${uploadId}`);
    
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/admin/upload-progress/${uploadId}`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          setProgress(data);
          onProgress?.(data);
          
          if (data.status === 'complete' && !callbacksCalledRef.current.complete) {
            setIsComplete(true);
            callbacksCalledRef.current.complete = true;
            onComplete?.(data);
            clearInterval(pollInterval);
          } else if (data.status === 'error' && !callbacksCalledRef.current.error) {
            setHasError(true);
            callbacksCalledRef.current.error = true;
            onError?.(data.message || 'Upload failed');
            clearInterval(pollInterval);
          }
        }
      } catch (error) {
        logger.debug('UploadProgress', 'HTTP polling error:', error);
      }
    }, 1000); // Poll every second as fallback
    
    return () => clearInterval(pollInterval);
  }, [isConnected, uploadId, isComplete, hasError, onComplete, onError, onProgress]);
  
  return {
    progress,
    isComplete,
    hasError,
    isConnected,
    // Convenience getters
    currentProgress: progress?.progress || 0,
    statusMessage: progress?.message || 'Waiting...',
    details: progress?.details
  };
}
