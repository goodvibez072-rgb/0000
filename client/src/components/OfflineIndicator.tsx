import { useState, useEffect } from "react";
import { Wifi, WifiOff, Cloud, CloudOff, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipTrigger 
} from "@/components/ui/tooltip";

interface OfflineIndicatorProps {
  position?: 'fixed' | 'inline';
  showDetails?: boolean;
  className?: string;
}

interface NetworkStatus {
  isOnline: boolean;
  lastSync: string | null;
  cacheStatus: {
    staticCached: number;
    apiCached: number;
    imagesCached: number;
  } | null;
}

export default function OfflineIndicator({ 
  position = 'fixed', 
  showDetails = false,
  className = '' 
}: OfflineIndicatorProps) {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    lastSync: null,
    cacheStatus: null
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Update network status
    const updateNetworkStatus = (isOnline: boolean) => {
      setNetworkStatus(prev => ({
        ...prev,
        isOnline,
        lastSync: isOnline ? new Date().toISOString() : prev.lastSync
      }));
    };

    // Listen for online/offline events
    const handleOnline = () => updateNetworkStatus(true);
    const handleOffline = () => updateNetworkStatus(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for custom network status events from service worker
    const handleNetworkStatus = (event: any) => {
      const { isOnline } = event.detail;
      updateNetworkStatus(isOnline);
    };

    window.addEventListener('networkstatus', handleNetworkStatus);

    // Get initial cache status
    getCacheStatus();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('networkstatus', handleNetworkStatus);
    };
  }, []);

  const getCacheStatus = async () => {
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const messageChannel = new MessageChannel();
        
        messageChannel.port1.onmessage = (event) => {
          if (event.data.type === 'CACHE_STATUS') {
            setNetworkStatus(prev => ({
              ...prev,
              cacheStatus: {
                staticCached: event.data.payload.staticCache || 0,
                apiCached: event.data.payload.apiCache || 0,
                imagesCached: event.data.payload.imageCache || 0
              }
            }));
          }
        };

        navigator.serviceWorker.controller.postMessage(
          { type: 'GET_CACHE_STATUS' },
          [messageChannel.port2]
        );
      }
    } catch (error) {
      // Error handled silently
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      // Try to refresh the page to get latest content
      if (networkStatus.isOnline) {
        window.location.reload();
      } else {
        // Update cache status in offline mode
        await getCacheStatus();
      }
    } catch (error) {
      // Error handled silently
    } finally {
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  };

  const formatLastSync = (lastSync: string | null) => {
    if (!lastSync) return 'Never';
    
    const syncTime = new Date(lastSync);
    const now = new Date();
    const diffMs = now.getTime() - syncTime.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins === 0) return 'Just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    
    return syncTime.toLocaleDateString();
  };

  // Fixed position indicator (default)
  if (position === 'fixed') {
    return (
      <div 
        className={`fixed bottom-4 right-4 z-50 ${className}`}
        data-testid="offline-indicator-fixed"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={networkStatus.isOnline ? "outline" : "destructive"}
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`
                transition-all duration-300 shadow-lg backdrop-blur-sm
                ${networkStatus.isOnline 
                  ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20' 
                  : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                }
              `}
            >
              {isRefreshing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : networkStatus.isOnline ? (
                <Wifi className="w-4 h-4" />
              ) : (
                <WifiOff className="w-4 h-4" />
              )}
              <span className="ml-2 text-xs">
                {networkStatus.isOnline ? 'Online' : 'Offline'}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {networkStatus.isOnline ? (
                  <>
                    <Cloud className="w-4 h-4 text-green-400" />
                    <span className="text-green-400 font-medium">Connected</span>
                  </>
                ) : (
                  <>
                    <CloudOff className="w-4 h-4 text-red-400" />
                    <span className="text-red-400 font-medium">Offline</span>
                  </>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Last sync: {formatLastSync(networkStatus.lastSync)}
              </div>
              {networkStatus.cacheStatus && (
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>Cached: {networkStatus.cacheStatus.staticCached} static files</div>
                  <div>API cache: {networkStatus.cacheStatus.apiCached} responses</div>
                  <div>Images: {networkStatus.cacheStatus.imagesCached} cached</div>
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                {networkStatus.isOnline ? 'Click to refresh' : 'Click to check cache'}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  // Inline indicator for detailed view
  if (showDetails) {
    return (
      <Card className={`w-full max-w-md ${className}`} data-testid="offline-indicator-detailed">
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* Connection Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {networkStatus.isOnline ? (
                  <Wifi className="w-5 h-5 text-green-400" />
                ) : (
                  <WifiOff className="w-5 h-5 text-red-400" />
                )}
                <div>
                  <div className="font-medium">
                    {networkStatus.isOnline ? 'Online' : 'Offline Mode'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Last sync: {formatLastSync(networkStatus.lastSync)}
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                data-testid="refresh-button"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {/* Cache Status */}
            {networkStatus.cacheStatus && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Cache Status</div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <div className="text-lg font-bold text-primary">
                      {networkStatus.cacheStatus.staticCached}
                    </div>
                    <div className="text-xs text-muted-foreground">Static</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-primary">
                      {networkStatus.cacheStatus.apiCached}
                    </div>
                    <div className="text-xs text-muted-foreground">API</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-primary">
                      {networkStatus.cacheStatus.imagesCached}
                    </div>
                    <div className="text-xs text-muted-foreground">Images</div>
                  </div>
                </div>
              </div>
            )}

            {/* Offline Notice */}
            {!networkStatus.isOnline && (
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-yellow-200">
                  <div className="font-medium mb-1">Using cached content</div>
                  <div className="text-yellow-200/80">
                    Some features may be limited while offline. Content will sync when connection is restored.
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Simple inline badge
  return (
    <Badge 
      variant={networkStatus.isOnline ? "default" : "destructive"}
      className={`
        ${networkStatus.isOnline 
          ? 'bg-green-500/10 text-green-400 border-green-500/30' 
          : 'bg-red-500/10 text-red-400 border-red-500/30'
        } ${className}
      `}
      data-testid="offline-indicator-badge"
    >
      {networkStatus.isOnline ? (
        <Wifi className="w-3 h-3 mr-1" />
      ) : (
        <WifiOff className="w-3 h-3 mr-1" />
      )}
      {networkStatus.isOnline ? 'Online' : 'Offline'}
    </Badge>
  );
}

// Hook for using network status in other components
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    const handleNetworkStatus = (event: any) => {
      setIsOnline(event.detail.isOnline);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('networkstatus', handleNetworkStatus);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('networkstatus', handleNetworkStatus);
    };
  }, []);

  return { isOnline };
}