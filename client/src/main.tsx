import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Service Worker Registration with TypeScript types
interface ServiceWorkerRegistration {
  installing?: ServiceWorker;
  waiting?: ServiceWorker;
  active?: ServiceWorker;
  scope: string;
  update(): Promise<void>;
  unregister(): Promise<boolean>;
  addEventListener(type: string, listener: EventListener): void;
}

interface ServiceWorkerContainer {
  register(scriptURL: string, options?: RegistrationOptions): Promise<ServiceWorkerRegistration>;
  ready: Promise<ServiceWorkerRegistration>;
  controller: ServiceWorker | null;
  addEventListener(type: string, listener: EventListener): void;
}

interface RegistrationOptions {
  scope?: string;
  updateViaCache?: 'imports' | 'all' | 'none';
}

// PWA Service Worker Registration
const registerServiceWorker = async (): Promise<void> => {
  // Only register service worker in production mode
  if (!import.meta.env.PROD) {
    return;
  }

  if ('serviceWorker' in navigator && 'PushManager' in window) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      });

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              
              // Notify user about update
              if (window.confirm('New version available! Refresh to update?')) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
              }
            }
          });
        }
      });

      // Listen for controlling service worker change
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });

      // Check for updates every hour
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000);
      
      // Store registration globally for debugging
      (window as any).swRegistration = registration;
      
    } catch (error) {
      // Service worker registration failed
    }
  } else {
    // Service workers not supported
  }
};

// PWA Installation Prompt
const setupPWAInstallPrompt = (): void => {
  let deferredPrompt: any = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Store for later use
    (window as any).deferredPrompt = deferredPrompt;
    
    // Show custom install button or banner
    const installBanner = document.createElement('div');
    installBanner.id = 'pwa-install-banner';
    installBanner.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
      z-index: 1000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      animation: slideUp 0.3s ease-out;
    `;
    installBanner.innerHTML = `
      📱 Install AmourScans App
      <span style="margin-left: 8px; opacity: 0.8;">×</span>
    `;
    
    installBanner.addEventListener('click', async (event) => {
      const target = event.target as HTMLElement;
      if (target.textContent === '×') {
        installBanner.remove();
        return;
      }
      
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        installBanner.remove();
      }
    });
    
    document.body.appendChild(installBanner);
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
      if (installBanner.parentNode) {
        installBanner.remove();
      }
    }, 10000);
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    
    // Remove install banner if exists
    const banner = document.getElementById('pwa-install-banner');
    if (banner) {
      banner.remove();
    }
  });
};

// Online/Offline Status Monitoring
const setupOfflineMonitoring = (): void => {
  const updateOnlineStatus = () => {
    const isOnline = navigator.onLine;
    
    // Dispatch custom event for components to listen
    window.dispatchEvent(new CustomEvent('networkstatus', {
      detail: { isOnline }
    }));
    
    // Update document class for CSS styling
    document.documentElement.classList.toggle('offline', !isOnline);
    
    // Show toast notification
    if (!isOnline) {
      showOfflineToast();
    }
  };

  const showOfflineToast = () => {
    const existingToast = document.getElementById('offline-toast');
    if (existingToast) return;
    
    const toast = document.createElement('div');
    toast.id = 'offline-toast';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #dc2626;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
      z-index: 1001;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      animation: slideInRight 0.3s ease-out;
    `;
    toast.innerHTML = '📡 You\'re offline - using cached content';
    
    document.body.appendChild(toast);
    
    // Auto-remove when back online
    const removeToast = () => {
      if (navigator.onLine && toast.parentNode) {
        toast.remove();
        window.removeEventListener('online', removeToast);
      }
    };
    
    window.addEventListener('online', removeToast);
  };

  // Set initial status
  updateOnlineStatus();
  
  // Listen for online/offline events
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
};

// Initialize PWA features
const initializePWA = async (): Promise<void> => {
  await registerServiceWorker();
  setupPWAInstallPrompt();
  setupOfflineMonitoring();
  
  // Add CSS for animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideUp {
      from { transform: translateX(-50%) translateY(100%); opacity: 0; }
      to { transform: translateX(-50%) translateY(0); opacity: 1; }
    }
    
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    
    .offline body::before {
      content: '📡 Offline Mode';
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #dc2626;
      color: white;
      text-align: center;
      padding: 4px;
      font-size: 12px;
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .offline body {
      padding-top: 24px;
    }
  `;
  document.head.appendChild(style);
};

// Initialize app and PWA
const initializeApp = async (): Promise<void> => {
  try {
    // Render React app immediately - don't wait for PWA
    const rootElement = document.getElementById("root");
    if (rootElement) {
      createRoot(rootElement).render(<App />);
      if (import.meta.env.DEV) console.log('[PWA] AmourScans app initialized successfully');
    } else {
      throw new Error('Root element not found');
    }
    
    // Initialize PWA features in background (non-blocking)
    initializePWA().catch((error) => {
      console.error('[PWA] PWA initialization failed:', error);
    });
  } catch (error) {
    console.error('[PWA] App initialization failed:', error);
    
    // Fallback: try rendering app anyway
    const rootElement = document.getElementById("root");
    if (rootElement) {
      createRoot(rootElement).render(<App />);
    }
  }
};

// Start the application
initializeApp();
