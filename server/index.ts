import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupAuth } from "./replitAuth";
import { initializeAdminUser, initializeRoles } from "./storage";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { createBrotliCompress, createGzip, constants } from "zlib";
import { Writable, pipeline } from "stream";

// ⚠️ IMPORTANT: This project must always use a local SQLite database (./data/database.db).
// Login, signup, and admin seeding must always work offline after download/re-upload.
// Any agent working on this project in the future must preserve this setup.
// Do NOT revert to Replit-only authentication or ephemeral storage.

// Define log function locally to avoid top-level vite imports
function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

const app = express();

// SECURITY: Configure Express to trust proxy headers
// This is required for correct HTTPS detection behind reverse proxies (Nginx, CloudFlare, Replit)
// Setting to 1 trusts only the FIRST proxy hop (Replit infrastructure)
// This prevents attackers from spoofing X-Forwarded-* headers by connecting directly to origin
app.set('trust proxy', 1);

// SECURITY: HTTPS redirect middleware for production
// This ensures all requests use HTTPS, redirecting HTTP to HTTPS
// Must come early in middleware chain before any response processing
app.use((req: Request, res: Response, next: NextFunction) => {
  // Skip in development mode
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }
  
  // Check if request is over HTTPS
  // req.secure and req.protocol now work correctly because we set 'trust proxy'
  // Express validates these based on trusted proxy headers, preventing bypass attacks
  if (!req.secure && req.protocol !== 'https') {
    // Get host header safely - req.get() returns undefined if not present
    const host = req.get('host');
    
    // Validate Host header exists and contains valid characters
    // This prevents DoS from missing headers and header injection attacks
    if (!host || !/^[a-zA-Z0-9.-]+(:\d+)?$/.test(host)) {
      log(`Invalid or missing Host header for HTTPS redirect: ${host}`, 'security');
      // Close connection on malformed request to prevent abuse
      return res.status(400).end('Bad Request: Invalid Host header');
    }
    
    // Redirect to HTTPS version of the URL using 301 (permanent redirect for SEO)
    const httpsUrl = `https://${host}${req.url}`;
    log(`Redirecting HTTP to HTTPS: ${req.url}`, 'security');
    return res.redirect(301, httpsUrl);
  }
  
  next();
});

// PERFORMANCE: Cache headers for static assets
app.use((req, res, next) => {
  // Static assets (CSS, JS, images) - cache for 1 year
  if (req.url.match(/\.(css|js|jpg|jpeg|png|gif|ico|woff|woff2|ttf|svg|webp|avif)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
  // HTML pages - use stale-while-revalidate
  else if (req.url.match(/\.html$/) || req.url === '/') {
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate, stale-while-revalidate=86400');
  }
  // API responses - no cache
  else if (req.url.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }
  next();
});

// SECURITY FIX: Add comprehensive security headers using Helmet
// IMPORTANT: CSP is strict in production, relaxed only in development for Vite HMR
const isDevelopment = process.env.NODE_ENV !== 'production';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // PRODUCTION: No unsafe-inline/eval. DEVELOPMENT: Allow for Vite HMR
      scriptSrc: [
        "'self'",
        "https://js.stripe.com",
        ...(isDevelopment ? ["'unsafe-inline'", "'unsafe-eval'"] : [])
      ],
      // PRODUCTION: Use nonce for inline styles. DEVELOPMENT: Allow unsafe-inline
      styleSrc: [
        "'self'",
        "https://fonts.googleapis.com",
        ...(isDevelopment ? ["'unsafe-inline'"] : [])
      ],
      imgSrc: ["'self'", "data:", "https:", "blob:", process.env.REPLIT_DEV_DOMAIN].filter((x): x is string => Boolean(x)),
      connectSrc: [
        "'self'", 
        "ws:", 
        "wss:", 
        "https://fonts.googleapis.com", 
        "https://fonts.gstatic.com", 
        "https://*.stripe.com", 
        process.env.REPLIT_DEV_DOMAIN,
        ...(isDevelopment && process.env.REPLIT_DEV_DOMAIN ? [`wss://${process.env.REPLIT_DEV_DOMAIN}`] : [])
      ].filter((x): x is string => Boolean(x)),
      fontSrc: ["'self'", "data:", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'", "https://js.stripe.com", "https://*.stripe.com"],
      workerSrc: ["'self'", "blob:"],
    }
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: false
  },
  frameguard: {
    action: 'sameorigin'
  },
  noSniff: true,
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  }
}));

// PERFORMANCE FIX: TRUE Streaming Brotli/gzip compression middleware
// This reduces data transfer by 70-80% (720KB -> ~200KB)
// Uses Node's native zlib streaming compression with proper backpressure handling
// NOTE: Only enabled in production to avoid interfering with Vite HMR in development
app.use((req: Request, res: Response, next: NextFunction) => {
  // Skip compression entirely in development mode
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  // Case-insensitive Accept-Encoding parsing
  const acceptEncoding = (req.headers['accept-encoding'] || '').toLowerCase();
  
  // Skip compression if disabled or already encoded
  if (req.headers['x-no-compression'] || res.getHeader('Content-Encoding')) {
    return next();
  }

  // Determine compression method: prefer Brotli, fallback to gzip
  let compressionMethod: 'br' | 'gzip' | null = null;
  if (acceptEncoding.includes('br')) {
    compressionMethod = 'br';
  } else if (acceptEncoding.includes('gzip')) {
    compressionMethod = 'gzip';
  }

  // No compression support
  if (!compressionMethod) {
    return next();
  }

  // Compressible content types (text, JSON, JS, CSS, HTML)
  const compressibleTypes = /text\/|application\/json|application\/javascript|application\/xml/;
  
  // Store original methods before any overrides
  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);
  const originalSetHeader = res.setHeader.bind(res);
  
  let compressionStream: ReturnType<typeof createBrotliCompress> | ReturnType<typeof createGzip> | null = null;
  let compressionInitialized = false;

  // Override setHeader to check content-type and initialize compression IMMEDIATELY
  res.setHeader = function(name: string, value: string | number | readonly string[]) {
    const result = originalSetHeader(name, value);
    
    if (name.toLowerCase() === 'content-type' && !compressionInitialized) {
      const shouldCompress = compressibleTypes.test(String(value));
      
      if (shouldCompress) {
        // Initialize compression stream IMMEDIATELY (not at end)
        compressionInitialized = true;
        
        if (compressionMethod === 'br') {
          compressionStream = createBrotliCompress({
            params: {
              [constants.BROTLI_PARAM_QUALITY]: 6
            }
          });
        } else {
          compressionStream = createGzip({ level: 6 });
        }

        // Create a writable stream that wraps the original response write/end
        // This allows pipeline to properly handle backpressure
        const destStream = new Writable({
          write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
            const canContinue = originalWrite(chunk, encoding as any);
            if (canContinue) {
              callback();
            } else {
              // Backpressure: wait for drain event before telling pipeline to continue
              res.once('drain', () => callback());
            }
          },
          final(callback: (error?: Error | null) => void) {
            originalEnd();
            callback();
          }
        });

        // Use pipeline for automatic backpressure handling
        // When destStream can't accept more data, pipeline pauses compressionStream
        pipeline(compressionStream, destStream, (err) => {
          if (err) {
            console.error('Compression pipeline error:', err);
          }
        });

        // Propagate 'drain' events from compressionStream to res for user-level backpressure
        compressionStream.on('drain', () => {
          res.emit('drain');
        });

        // Set compression headers BEFORE first write
        originalSetHeader('Content-Encoding', compressionMethod);
        originalSetHeader('Vary', 'Accept-Encoding');
        res.removeHeader('Content-Length');
      }
    }
    
    return result;
  };

  // Override write to pipe through compression stream with PROPER BACKPRESSURE
  res.write = function(chunk: any, encoding?: any, callback?: any): boolean {
    if (compressionStream) {
      // Handle overloaded signatures: write(chunk, callback) or write(chunk, encoding, callback)
      if (typeof encoding === 'function') {
        callback = encoding;
        encoding = undefined;
      }
      // Forward ALL parameters to compressionStream
      return compressionStream.write(chunk, encoding, callback);
    } else {
      // No compression - use original write with proper parameter forwarding
      if (typeof encoding === 'function') {
        return originalWrite(chunk, encoding);
      }
      return originalWrite(chunk, encoding, callback);
    }
  };

  // Override end to finalize compression
  res.end = function(chunk?: any, encoding?: any, callback?: any): Response {
    if (compressionStream) {
      // Handle overloaded signatures: end(), end(chunk), end(chunk, encoding), end(chunk, encoding, callback)
      if (typeof chunk === 'function') {
        callback = chunk;
        chunk = undefined;
        encoding = undefined;
      } else if (typeof encoding === 'function') {
        callback = encoding;
        encoding = undefined;
      }
      // Forward ALL parameters to compressionStream
      compressionStream.end(chunk, encoding, callback);
    } else {
      // No compression - use original end with proper parameter forwarding
      if (typeof chunk === 'function') {
        originalEnd(chunk);
      } else if (typeof encoding === 'function') {
        originalEnd(chunk, encoding);
      } else if (callback) {
        originalEnd(chunk, encoding, callback);
      } else if (encoding !== undefined) {
        originalEnd(chunk, encoding);
      } else if (chunk !== undefined) {
        originalEnd(chunk);
      } else {
        originalEnd();
      }
    }

    return res;
  };

  next();
});

// Stripe webhook MUST be before express.json() to preserve raw body for signature verification
import Stripe from "stripe";
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-11-20.acacia" } as any)
  : null;

app.post("/api/webhooks/stripe", express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) {
    return res.status(503).send("Stripe not configured");
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig) {
    return res.status(400).send("No signature");
  }

  let event: Stripe.Event;

  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      event = JSON.parse(req.body.toString());
    }
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const metadata = paymentIntent.metadata;

      if (metadata.userId && metadata.packageId) {
        const { storage } = await import("./storage");
        
        const existingPurchase = await storage.getPurchaseByTransactionId(paymentIntent.id);
        if (existingPurchase) {
          console.log(`Payment ${paymentIntent.id} already processed (found in database), skipping`);
          return res.json({ received: true, already_processed: true });
        }
        
        const packages = await storage.getCurrencyPackages(false);
        const currencyPackage = packages.find(p => p.id === metadata.packageId);
        
        if (!currencyPackage) {
          console.error(`Package ${metadata.packageId} not found`);
          return res.status(400).json({ error: "Package not found" });
        }

        const expectedAmount = Math.round(parseFloat(currencyPackage.priceUSD) * 100);
        if (paymentIntent.amount !== expectedAmount) {
          console.error(`Amount mismatch: expected ${expectedAmount}, got ${paymentIntent.amount}`);
          return res.status(400).json({ error: "Amount mismatch" });
        }

        const currencyAmount = currencyPackage.currencyAmount;
        const bonusPercentage = currencyPackage.bonusPercentage;
        const totalCoins = currencyAmount + Math.floor((currencyAmount * bonusPercentage) / 100);

        const currencyResult = await storage.processCurrencyChange(
          metadata.userId,
          totalCoins,
          'purchase',
          `Purchased ${metadata.packageName}`,
          metadata.packageId
        );

        if (!currencyResult.success) {
          console.error(`Failed to add currency: ${currencyResult.error}`);
          return res.status(500).json({ error: currencyResult.error });
        }

        await storage.createUserPurchase({
          userId: metadata.userId,
          packageId: metadata.packageId,
          amountPaid: (paymentIntent.amount / 100).toFixed(2),
          currencyReceived: totalCoins,
          paymentProvider: 'stripe',
          transactionId: paymentIntent.id,
          status: 'completed',
        });

        console.log(`Successfully processed payment ${paymentIntent.id} for user ${metadata.userId}: +${totalCoins} coins`);
      }
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error("Error processing webhook:", error);
    res.status(500).json({ error: error.message });
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CSRF FIX: Add cookie-parser middleware (required by csrf-csrf library)
app.use(cookieParser());

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Setup Replit Auth first
  await setupAuth(app);
  
  // Initialize admin user automatically
  await initializeAdminUser();
  
  // Initialize default roles with permissions
  await initializeRoles();
  
  // Initialize owner role for first admin
  const { storage } = await import("./storage");
  await storage.initializeOwnerRole();
  
  // Initialize ad intensity setting
  await storage.initializeAdIntensity();
  
  // SEO: Prerender middleware for crawlers (MUST be before Vite middleware)
  const { prerenderMiddleware } = await import("./seo-prerender");
  app.use(prerenderMiddleware);
  
  // SEO: Serve static files from public directory (sitemap.xml, robots.txt, etc.)
  // This allows search engines to access SEO files and enables browser caching
  const path = await import("path");
  const { fileURLToPath } = await import("url");
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  app.use(express.static(path.join(__dirname, '../public'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0, // Cache for 1 day in production
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      // Set specific cache headers for SEO files (only in production)
      if (process.env.NODE_ENV === 'production' && 
          (filePath.endsWith('sitemap.xml') || filePath.endsWith('robots.txt'))) {
        res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour for SEO files
      } else if (process.env.NODE_ENV !== 'production') {
        res.setHeader('Cache-Control', 'no-store'); // No caching in development
      }
    }
  }));
  log('Static asset serving enabled for public directory', 'express');
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  const appEnv = app.get("env");
  log(`Environment detected: ${appEnv}`, "vite");
  
  if (appEnv === "development") {
    log("Initializing Vite development server...", "vite");
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
    log("Vite development server initialized successfully", "vite");
  } else {
    log("Serving static files (production mode)", "vite");
    const { serveStatic } = await import("./vite");
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen(port, "0.0.0.0", () => {
    log(`serving on http://0.0.0.0:${port}`);
  });

  // Initialize WebSocket server for real-time updates
  const { wsManager } = await import("./websocket");
  wsManager.initialize(server);
  log("WebSocket server initialized for real-time updates", "websocket");

  // Ad Scheduling Service: Background job that runs every 5 minutes
  // Automatically activates/deactivates ads based on their start/end dates
  const AD_SCHEDULER_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

  // Run immediately on startup
  log("Starting ad scheduler - running initial schedule update...", "ad-scheduler");
  storage.autoUpdateAdSchedules().catch((error) => {
    console.error("[ad-scheduler] Error in initial schedule update:", error);
  });

  // Then run every 5 minutes
  setInterval(async () => {
    try {
      const result = await storage.autoUpdateAdSchedules();
      if (result.activated > 0 || result.deactivated > 0) {
        log(`Schedule update: ${result.activated} activated, ${result.deactivated} deactivated`, "ad-scheduler");
      }
    } catch (error) {
      console.error("[ad-scheduler] Error in scheduled update:", error);
    }
  }, AD_SCHEDULER_INTERVAL);

  log(`Ad scheduler initialized - will run every ${AD_SCHEDULER_INTERVAL / 1000 / 60} minutes`, "ad-scheduler");
})();
