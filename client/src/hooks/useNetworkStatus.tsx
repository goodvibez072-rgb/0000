import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook to detect network online/offline status
 * Shows toast notifications when network status changes
 * 
 * @returns {boolean} isOnline - Whether the network is currently online
 */
export function useNetworkStatus(showNotifications: boolean = true) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { toast } = useToast();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      
      if (showNotifications) {
        toast({
          title: 'Back online',
          description: 'Your internet connection has been restored.',
          variant: 'success',
        });
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      
      if (showNotifications) {
        toast({
          title: 'No internet connection',
          description: 'Some features may be unavailable. Trying to reconnect...',
          variant: 'error',
        });
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [showNotifications, toast]);

  return isOnline;
}
