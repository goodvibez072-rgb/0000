// AmourScans Service Worker for Complete Offline Functionality
const CACHE_NAME = 'amourscans-v2.0.0';
const STATIC_CACHE = 'amourscans-static-v2.0.0';
const API_CACHE = 'amourscans-api-v2.0.0';
const IMAGE_CACHE = 'amourscans-images-v2.0.0';

// Resources to cache on installation - minimal list for runtime caching strategy
// Note: Vite builds create hashed assets (/assets/main-[hash].js), so we rely on runtime caching
const STATIC_RESOURCES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/placeholder-manga.png',
  '/offline.html'
];

// API endpoints to cache with specific strategies
const API_ENDPOINTS = {
  // Cache for 1 hour
  SHORT_CACHE: [
    '/api/sections/popular-today',
    '/api/sections/trending',
    '/api/sections/latest-updates',
    '/api/auth/user'
  ],
  // Cache for 24 hours
  LONG_CACHE: [
    '/api/series',
    '/api/users'
  ],
  // Always try network first
  NETWORK_FIRST: [
    '/api/auth/login',
    '/api/auth/signup',
    '/api/auth/logout'
  ]
};

// Offline fallback responses
const OFFLINE_FALLBACKS = {
  '/api/auth/user': {
    message: 'Offline mode - user data unavailable',
    user: null
  },
  '/api/sections/popular-today': [],
  '/api/sections/trending': [],
  '/api/sections/latest-updates': [],
  '/api/series': [],
  '/api/users': []
};

// Install event - cache static resources
self.addEventListener('install', (event) => {
  console.log('[SW] Installing AmourScans Service Worker...');
  
  event.waitUntil(
    Promise.all([
      // Cache static resources
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('[SW] Caching static resources...');
        return cache.addAll(STATIC_RESOURCES);
      }),
      
      // Initialize API cache
      caches.open(API_CACHE).then((cache) => {
        console.log('[SW] Initializing API cache...');
        return cache.put('/api/offline-indicator', new Response(JSON.stringify({
          isOffline: false,
          lastSync: new Date().toISOString()
        })));
      }),
      
      // Initialize image cache
      caches.open(IMAGE_CACHE)
    ]).then(() => {
      console.log('[SW] Installation complete, skipping waiting...');
      return self.skipWaiting();
    }).catch((error) => {
      console.error('[SW] Installation failed:', error);
    })
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating AmourScans Service Worker...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && 
                cacheName !== API_CACHE && 
                cacheName !== IMAGE_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Take control of all clients
      self.clients.claim()
    ]).then(() => {
      console.log('[SW] Activation complete');
    })
  );
});

// Fetch event - handle all network requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Handle different types of requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
  } else if (url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|avif|bmp|tiff|tif)$/)) {
    event.respondWith(handleImageRequest(request));
  } else if (url.pathname.match(/\.(js|css|woff2|woff|ttf)$/)) {
    event.respondWith(handleStaticAssetRequest(request));
  } else {
    event.respondWith(handleNavigationRequest(request));
  }
});

// Handle API requests with different caching strategies
async function handleApiRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // Network first for authentication endpoints
  if (API_ENDPOINTS.NETWORK_FIRST.some(endpoint => pathname.startsWith(endpoint))) {
    return handleNetworkFirst(request, API_CACHE);
  }
  
  // Cache first for data endpoints
  if (API_ENDPOINTS.SHORT_CACHE.some(endpoint => pathname.startsWith(endpoint)) ||
      API_ENDPOINTS.LONG_CACHE.some(endpoint => pathname.startsWith(endpoint))) {
    return handleCacheFirst(request, API_CACHE);
  }
  
  // Default: try network, fallback to cache
  return handleNetworkFirst(request, API_CACHE);
}

// Handle image requests with network first strategy
async function handleImageRequest(request) {
  return handleNetworkFirst(request, IMAGE_CACHE);
}

// Handle static assets (JS, CSS, fonts) with cache first
async function handleStaticAssetRequest(request) {
  return handleCacheFirst(request, STATIC_CACHE);
}

// Handle navigation requests (HTML pages)
async function handleNavigationRequest(request) {
  try {
    // Try network first for navigation
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Fallback to cached version or offline page
    const cache = await caches.open(STATIC_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return cached index.html for SPA routes
    const indexResponse = await cache.match('/index.html');
    if (indexResponse) {
      return indexResponse;
    }
    
    // Ultimate fallback - offline page
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>AmourScans - Offline</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: linear-gradient(135deg, #1a1625 0%, #2d1b3d 100%);
              color: #e4e4e7;
              margin: 0;
              padding: 2rem;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              text-align: center;
            }
            .container {
              max-width: 400px;
              padding: 2rem;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 1rem;
              backdrop-filter: blur(10px);
            }
            h1 { color: #a855f7; margin-bottom: 1rem; }
            .retry-btn {
              background: #a855f7;
              color: white;
              border: none;
              padding: 0.75rem 1.5rem;
              border-radius: 0.5rem;
              cursor: pointer;
              margin-top: 1rem;
              font-size: 1rem;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>📚 AmourScans</h1>
            <p>You're currently offline, but don't worry! Your cached manga and data are still available.</p>
            <p>Reconnect to the internet to sync the latest updates.</p>
            <button class="retry-btn" onclick="window.location.reload()">Try Again</button>
          </div>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// Cache first strategy with network fallback
async function handleCacheFirst(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      // Return cached version immediately
      const response = cachedResponse.clone();
      
      // Update cache in background
      fetch(request).then(networkResponse => {
        if (networkResponse.ok) {
          cache.put(request, networkResponse);
        }
      }).catch(() => {
        // Network failed, but we have cache
      });
      
      return response;
    }
    
    // No cache, try network
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Both cache and network failed
    const url = new URL(request.url);
    
    // Return offline fallback for API endpoints
    if (url.pathname.startsWith('/api/') && OFFLINE_FALLBACKS[url.pathname]) {
      return new Response(JSON.stringify(OFFLINE_FALLBACKS[url.pathname]), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    throw error;
  }
}

// Network first strategy with cache fallback
async function handleNetworkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Both failed, return offline fallback for API
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/') && OFFLINE_FALLBACKS[url.pathname]) {
      return new Response(JSON.stringify(OFFLINE_FALLBACKS[url.pathname]), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    throw error;
  }
}

// Message handling for client communication
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_CACHE_STATUS':
      getCacheStatus().then(status => {
        event.ports[0].postMessage({ type: 'CACHE_STATUS', payload: status });
      });
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0].postMessage({ type: 'CACHE_CLEARED' });
      });
      break;
      
    case 'CACHE_MANGA_DATA':
      if (payload) {
        cacheMangaData(payload);
      }
      break;
  }
});

// Get cache status information
async function getCacheStatus() {
  const cacheNames = await caches.keys();
  const status = {
    caches: cacheNames.length,
    staticCache: await getCacheSize(STATIC_CACHE),
    apiCache: await getCacheSize(API_CACHE),
    imageCache: await getCacheSize(IMAGE_CACHE),
    lastUpdated: new Date().toISOString()
  };
  
  return status;
}

// Get cache size
async function getCacheSize(cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    return keys.length;
  } catch (error) {
    return 0;
  }
}

// Clear all caches
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
}

// Cache manga data for offline access
async function cacheMangaData(mangaData) {
  try {
    const cache = await caches.open(API_CACHE);
    
    // Cache individual manga series
    if (mangaData.series) {
      await cache.put(
        `/api/series/${mangaData.series.id}`,
        new Response(JSON.stringify(mangaData.series))
      );
    }
    
    // Cache user preferences
    if (mangaData.preferences) {
      await cache.put(
        '/api/user/preferences',
        new Response(JSON.stringify(mangaData.preferences))
      );
    }
    
    console.log('[SW] Cached manga data for offline access');
  } catch (error) {
    console.error('[SW] Failed to cache manga data:', error);
  }
}

// Periodic background sync for updated content
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(syncOfflineActions());
  }
});

// Sync offline actions when back online
async function syncOfflineActions() {
  try {
    // Get offline actions from cache
    const cache = await caches.open(API_CACHE);
    const offlineActionsResponse = await cache.match('/offline-actions');
    
    if (offlineActionsResponse) {
      const offlineActions = await offlineActionsResponse.json();
      
      // Process each offline action
      for (const action of offlineActions) {
        try {
          await fetch(action.url, {
            method: action.method,
            headers: action.headers,
            body: action.body
          });
          
          console.log('[SW] Synced offline action:', action.type);
        } catch (error) {
          console.error('[SW] Failed to sync action:', action.type, error);
        }
      }
      
      // Clear offline actions after sync
      await cache.delete('/offline-actions');
    }
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

console.log('[SW] AmourScans Service Worker loaded successfully');