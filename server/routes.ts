import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, db } from "./storage";
import * as packageMgmt from "./storage/package-management";
import { insertUserSchema, loginUserSchema, signupUserSchema, type User, type SafeUser, insertSeriesSchema, updateSeriesSchema, type Series, updateUserRoleSchema, type Setting, type SettingResponse, insertSettingSchema, updateSettingSchema, settingValueSchema, insertChapterSchema, type Chapter, insertCommentSchema, updateCommentSchema, adminAddCurrencySchema, adminDeductCurrencySchema, insertCurrencyPackageSchema, updateCurrencyPackageSchema, updateChapterAccessControlSchema, insertAdvertisementSchema, updateAdvertisementSchema, type Advertisement, userSubscriptions, insertRoleSchema, updateRoleSchema, updateRolePermissionsSchema } from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { sendEmail, generateVerificationEmailHtml, generatePasswordResetEmailHtml } from "./utils/email";
import rateLimit from "express-rate-limit";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs, { createWriteStream } from "fs";
import fsp from "fs/promises";
import express from "express";
import yauzl from "yauzl";
import { naturalSortWithConfidence } from "./naturalSort";
import { isStaff, isPremium, isOwner, isAdmin as isAdminMiddleware, isStaffOrAbove, getOrCreateCsrfSecret, requirePermission } from "./replitAuth";
import { doubleCsrf } from "csrf-csrf";
import DOMPurify from "isomorphic-dompurify";
import seoRouter from "./routes/seo";
import Stripe from "stripe";
import { deleteImage } from "./storage/app-storage";
import { broadcast } from "./events";
import { auditLogger, AuditAction } from "./security/auditLogger";
import { optimizeImage } from "./utils/imageOptimizer";
import passport from "passport";
import { setupOAuth } from "./oauth";

// Initialize Stripe if keys are available (from blueprint:javascript_stripe integration)
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-09-30.clover" })
  : null;

// Upload Progress Tracking System
interface UploadProgress {
  id: string;
  status: 'initializing' | 'uploading' | 'processing' | 'extracting' | 'finalizing' | 'complete' | 'error';
  progress: number; // 0-100
  message: string;
  currentFile?: string;
  totalFiles?: number;
  processedFiles?: number;
  startTime: number;
  speed?: number; // MB/s
  estimatedTimeRemaining?: number; // seconds
  error?: string;
  cancelled?: boolean;
  details?: {
    uploadedBytes?: number;
    totalBytes?: number;
    filesExtracted?: number;
    zipAnalysisComplete?: boolean;
  };
}

// Extraction result interface
interface ExtractionResult {
  imageUrls: string[];
  coverImageUrl: string;
  stagingDir?: string;
  finalDir?: string;
  naturalSortConfidence: number;
  requiresManualReorder: boolean;
}

// In-memory progress store with enhanced cleanup
const uploadProgressStore = new Map<string, UploadProgress & { lastHeartbeat?: number; cancelled?: boolean }>();

// Enhanced auto-cleanup with TTL and stall detection
setInterval(() => {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000; // 1 hour TTL
  const tenMinutesAgo = now - 10 * 60 * 1000; // 10 minutes stall detection
  
  for (const [id, progress] of Array.from(uploadProgressStore.entries())) {
    // Remove entries older than 1 hour (TTL)
    if (progress.startTime < oneHourAgo) {
      console.log(`[${id}] Cleaning up expired upload (TTL: 1 hour)`);
      uploadProgressStore.delete(id);
      continue;
    }
    
    // Clean up completed/errored uploads after 5 minutes
    if ((progress.status === 'complete' || progress.status === 'error') && 
        progress.startTime < (now - 5 * 60 * 1000)) {
      console.log(`[${id}] Cleaning up completed/errored upload`);
      uploadProgressStore.delete(id);
      continue;
    }
    
    // Clean up stalled uploads (no heartbeat for 10 minutes)
    const lastActivity = progress.lastHeartbeat || progress.startTime;
    if (progress.status !== 'complete' && progress.status !== 'error' && 
        lastActivity < tenMinutesAgo) {
      console.log(`[${id}] Cleaning up stalled upload (no heartbeat for 10+ minutes)`);
      updateProgress(id, {
        status: 'error',
        progress: 0,
        message: 'Upload timed out due to inactivity',
        error: 'Upload session expired due to inactivity'
      });
    }
  }
}, 60000); // Check every minute

// Progress update helper with fixed speed/ETA calculation
const updateProgress = (
  id: string, 
  updates: Partial<UploadProgress>
): void => {
  const current = uploadProgressStore.get(id);
  if (current) {
    // First merge the updates to get the complete state
    const updated = { 
      ...current, 
      ...updates,
      lastHeartbeat: Date.now() // Update heartbeat on every progress update
    };
    
    // Fix: Calculate speed using merged state to ensure totalBytes is available
    const mergedDetails = { ...current.details, ...updates.details };
    if (mergedDetails.uploadedBytes && mergedDetails.totalBytes) {
      const timeElapsed = (Date.now() - updated.startTime) / 1000; // seconds
      const bytesUploaded = mergedDetails.uploadedBytes;
      
      if (timeElapsed > 0 && bytesUploaded > 0) {
        updated.speed = (bytesUploaded / (1024 * 1024)) / timeElapsed; // MB/s
        
        // Estimate time remaining
        const remainingBytes = mergedDetails.totalBytes - bytesUploaded;
        if (updated.speed > 0 && remainingBytes > 0) {
          updated.estimatedTimeRemaining = remainingBytes / (updated.speed * 1024 * 1024);
        }
      }
    }
    
    // Ensure details are properly merged
    updated.details = mergedDetails;
    
    uploadProgressStore.set(id, updated);
    
    // Broadcast progress update via WebSocket for real-time updates
    broadcast.uploadProgress({
      uploadId: id,
      status: updated.status === 'complete' ? 'complete' : 
              updated.status === 'error' ? 'failed' : 
              'processing',
      progress: updated.progress,
      message: updated.message,
      details: {
        currentFile: updated.currentFile,
        totalFiles: updated.totalFiles,
        processedFiles: updated.processedFiles,
        speed: updated.speed,
        estimatedTimeRemaining: updated.estimatedTimeRemaining,
        ...updated.details
      }
    });
  }
};

// Initialize progress tracking
const initializeProgress = (id: string): void => {
  const initialProgress = {
    id,
    status: 'initializing' as const,
    progress: 0,
    message: 'Initializing upload...',
    startTime: Date.now(),
    lastHeartbeat: Date.now(),
    cancelled: false
  };
  
  uploadProgressStore.set(id, initialProgress);
  
  // Broadcast initial state via WebSocket
  broadcast.uploadProgress({
    uploadId: id,
    status: 'processing',
    progress: 0,
    message: 'Initializing upload...'
  });
};

// Check if upload is cancelled
const isUploadCancelled = (id: string): boolean => {
  const progress = uploadProgressStore.get(id);
  return progress?.cancelled === true;
};

// Declare the function that will be defined inside registerRoutes
let processUploadInBackground: (uploadId: string, filePath: string, chapterDataTemplate: any, userId?: string) => Promise<void>;

// Extend session type to include user
declare module "express-session" {
  interface SessionData {
    userId?: string;
    user?: SafeUser;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Session secret is now handled by the authentication setup
  
  // Setup OAuth (Google & Discord)
  await setupOAuth(app);

  // Serve static files for uploaded images
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Health check endpoint for Fly.io and monitoring services
  // Returns 200 OK if the server is running and database is accessible
  app.get('/api/health', async (req, res) => {
    try {
      // Simple database connectivity check
      await db.execute(sql`SELECT 1`);
      res.status(200).json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        database: 'connected'
      });
    } catch (error) {
      console.error('[health] Health check failed:', error);
      res.status(503).json({ 
        status: 'error', 
        timestamp: new Date().toISOString(),
        database: 'disconnected'
      });
    }
  });

  // SECURITY: CORS origin whitelist validation
  // Replaces insecure "allow all" with explicit whitelist even in development
  
  // Safely parse production domains from environment
  const replitDomains = process.env.REPLIT_DOMAINS 
    ? process.env.REPLIT_DOMAINS.split(',').map(d => `https://${d.trim()}`)
    : [];
  
  const corsOriginWhitelist = [
    // Production domains
    ...replitDomains,
    // Development: localhost variations
    'http://localhost:5000',
    'http://localhost:5173',  // Vite dev server default
    'http://localhost:3000',
    'http://127.0.0.1:5000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    // Replit development domain
    process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null,
  ].filter((origin): origin is string => Boolean(origin));
  
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) {
        return callback(null, true);
      }
      
      // Production: enforce strict same-origin (disallow all CORS)
      if (process.env.NODE_ENV === 'production') {
        return callback(null, false);
      }
      
      // Development: check whitelist
      if (corsOriginWhitelist.includes(origin)) {
        return callback(null, true);
      }
      
      // Log rejected origins for debugging
      console.log(`[security] CORS rejected origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    optionsSuccessStatus: 200
  }));

  // Note: Response compression (Brotli/gzip) is configured in server/index.ts
  // It's production-only to avoid interfering with Vite HMR in development

  // Global API rate limiter - applies to all /api/* endpoints as a baseline
  // More specific limiters (auth, comment, upload) will override this for their routes
  const apiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 300, // 300 requests per 5 minutes (~1 req/sec sustained)
    message: { message: "Too many requests, please try again later" },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip successful requests for read-only endpoints to avoid penalizing normal browsing
    skip: (req) => {
      // Skip rate limiting for GET requests to catalog/listing endpoints
      // Note: req.path excludes /api prefix when middleware is mounted at /api
      const isReadOnlyEndpoint = req.method === 'GET' && (
        req.path.includes('/series') ||
        req.path.includes('/chapters') ||
        req.path.includes('/genres') ||
        req.path.includes('/settings')
      );
      return isReadOnlyEndpoint;
    }
  });

  // Apply global rate limiter to all API routes
  app.use("/api", apiLimiter);

  // Rate limiting for authentication endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: { message: "Too many authentication attempts, please try again later" },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true
  });

  // Rate limiter for comment endpoints
  const commentLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 comments per minute
    message: { message: "Too many comments, please slow down" },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Rate limiter for upload endpoints
  const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 uploads per hour
    message: { message: "Upload limit reached, please try again later" },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Rate limiter for action endpoints (library, follow, delete operations)
  const actionLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 actions per minute
    message: { message: "Too many requests, please slow down" },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // SECURITY: Stricter rate limiter for admin panel operations
  const adminLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 admin actions per minute (allows batch operations but prevents abuse)
    message: { message: "Too many admin requests, please slow down" },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Rate limit by user session (admin routes require authentication)
      return req.session?.userId || 'unauthenticated';
    }
  });
  
  // Apply admin-specific rate limiter to all admin routes (stricter than general API)
  app.use("/api/admin", adminLimiter);

  // CSRF protection using csrf-csrf (secure synchronizer token pattern)
  // Get persistent, cryptographically random CSRF secret
  const csrfSecret = getOrCreateCsrfSecret();
  
  const {
    generateCsrfToken,
    doubleCsrfProtection,
  } = doubleCsrf({
    getSecret: () => csrfSecret,
    getSessionIdentifier: (req) => "", // Stateless - no session binding for double-submit cookies
    cookieName: "psifi.x-csrf-token",
    cookieOptions: {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    },
    size: 64,
    ignoredMethods: ["GET", "HEAD", "OPTIONS"],
  });

  // HTML sanitization function for XSS prevention
  const sanitizeHtml = (html: string): string => {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [], // Strip all HTML tags
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
    });
  };

  // Background processing function for async uploads
  processUploadInBackground = async (
    uploadId: string, 
    filePath: string, 
    chapterDataTemplate: any,
    userId?: string
  ): Promise<void> => {
    try {
      console.log(`[${uploadId}] Starting background processing`);
      
      // Check if cancelled before starting
      if (isUploadCancelled(uploadId)) {
        console.log(`[${uploadId}] Upload cancelled before processing started`);
        return;
      }
      
      updateProgress(uploadId, {
        status: 'processing',
        progress: 30,
        message: 'Starting chapter extraction and processing...'
      });

      // Process the upload using the existing atomic upload function
      const result = await atomicChapterUpload(uploadId, filePath, chapterDataTemplate, userId);
      
      // Check if cancelled during processing
      if (isUploadCancelled(uploadId)) {
        console.log(`[${uploadId}] Upload cancelled during processing`);
        return;
      }
      
      const { chapter: newChapter, extractionResult } = result;
      const { imageUrls } = extractionResult;
      
      console.log(`[${uploadId}] Chapter upload completed successfully`);

      // Update progress: Upload complete
      updateProgress(uploadId, {
        status: 'complete',
        progress: 100,
        message: `Chapter uploaded successfully! ${imageUrls.length} pages processed.`,
        totalFiles: imageUrls.length,
        processedFiles: imageUrls.length
      });
      
    } catch (error) {
      console.error(`[${uploadId}] Error in background processing:`, error);
      
      // Update progress: Error occurred
      updateProgress(uploadId, {
        status: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Upload failed',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      // CRITICAL FIX: Always clean up uploaded ZIP file, regardless of success or failure
      try {
        await fsp.unlink(filePath);
        console.log(`[${uploadId}] Successfully cleaned up uploaded ZIP file: ${filePath}`);
      } catch (cleanupError) {
        // Log but don't throw - this is just cleanup
        console.warn(`[${uploadId}] Warning: Could not clean up uploaded ZIP file (${filePath}):`, cleanupError);
      }
    }
  };

  // Admin authorization middleware (recognizes both admin and owner roles)
  const adminAuth = async (req: any, res: any, next: any) => {
    try {
      let hasAdminAccess = false;
      
      // Check local session authentication
      if (req.session?.user) {
        // Get the user from database to check role and isAdmin flag
        const user = await storage.getUserByUsername(req.session.user.username);
        if (user) {
          // Check if user is banned
          if (user.isBanned === 'true') {
            // Check if ban has expired
            if (user.banExpiresAt) {
              const expiryDate = new Date(user.banExpiresAt);
              const now = new Date();
              if (now >= expiryDate) {
                // Ban has expired, unban the user
                await storage.unbanUser(user.id);
              } else {
                // Ban is still active
                return res.status(403).json({ 
                  message: 'Your account has been banned', 
                  banned: true,
                  banReason: user.banReason,
                  banExpiresAt: user.banExpiresAt
                });
              }
            } else {
              // Permanent ban
              return res.status(403).json({ 
                message: 'Your account has been permanently banned', 
                banned: true,
                banReason: user.banReason
              });
            }
          }
          
          // Owner and admin roles have admin access
          hasAdminAccess = user.isAdmin === 'true' || user.role === 'owner' || user.role === 'admin';
        }
      }
      
      if (!hasAdminAccess) {
        return res.status(403).json({ message: 'Forbidden: Admin access required' });
      }
      
      next();
    } catch (error) {
      console.error("Admin auth error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };

  // CSRF token endpoint
  app.get('/api/csrf-token', (req, res) => {
    const csrfToken = generateCsrfToken(req, res);
    res.json({ csrfToken });
  });

  // User endpoint for local session authentication
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      // Check local session authentication
      if (req.session?.user) {
        // Get full user data from database to get proper admin flag
        const user = await storage.getUserByUsername(req.session.user.username);
        if (user) {
          // Check if user is banned
          if (user.isBanned === 'true') {
            // Check if ban has expired
            if (user.banExpiresAt) {
              const expiryDate = new Date(user.banExpiresAt);
              const now = new Date();
              if (now >= expiryDate) {
                // Ban has expired, unban the user
                await storage.unbanUser(user.id);
              } else {
                // Ban is still active, return ban info
                return res.status(403).json({ 
                  message: 'Your account has been banned', 
                  banned: true,
                  banReason: user.banReason,
                  banExpiresAt: user.banExpiresAt
                });
              }
            } else {
              // Permanent ban
              return res.status(403).json({ 
                message: 'Your account has been permanently banned', 
                banned: true,
                banReason: user.banReason
              });
            }
          }
          
          const { password: _, ...safeUser } = user;
          const userWithAdminFlag = {
            ...safeUser,
            isAdmin: user.isAdmin === 'true' || user.role === 'owner' || user.role === 'admin',
            role: user.role || (user.isAdmin === 'true' ? 'admin' : 'user')
          };
          return res.json(userWithAdminFlag);
        }
      }
      
      // No authentication found
      return res.status(401).json({ message: "Not authenticated" });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Authentication routes with rate limiting and CSRF protection
  app.post("/api/auth/signup", authLimiter, doubleCsrfProtection, async (req, res) => {
    try {
      const result = signupUserSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid input", 
          errors: result.error.errors 
        });
      }

      const { username, password, email, profilePicture, country } = result.data;

      // Validate required fields for signup
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      // Check if user already exists (username or email)
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username is already in use. Please choose a different username." });
      }
      
      if (email) {
        const existingEmail = await storage.getUserByEmail(email);
        if (existingEmail) {
          return res.status(400).json({ message: "Email is already registered. Please use a different email or try logging in." });
        }
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user with all provided fields
      console.log("Creating user with data:", { username, email, profilePicture: profilePicture ? "DATA_PROVIDED" : null, country });
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        email: email || null,
        profilePicture: profilePicture || null,
        country: country || null
      });
      console.log("Created user:", { ...user, password: "HIDDEN" });

      // Log signup event
      await auditLogger.logFromRequest(req, {
        action: AuditAction.SIGNUP,
        adminId: user.id,
        targetType: "user",
        targetId: user.id,
        details: { username, email: email ? "provided" : "not_provided" },
        severity: "low"
      });

      // Send verification email if email was provided
      if (user.email) {
        try {
          const token = await storage.createEmailVerificationToken(user.id);
          const baseUrl = req.protocol + '://' + req.get('host');
          const verificationUrl = `${baseUrl}/verify-email?token=${token.token}`;

          const emailHtml = generateVerificationEmailHtml(user.username || 'User', verificationUrl);
          
          await sendEmail({
            to: user.email,
            subject: 'Verify Your Email - AmourScans',
            text: `Welcome to AmourScans! Please verify your email by clicking this link: ${verificationUrl}`,
            html: emailHtml
          });
          
          console.log(`Verification email sent to ${user.email}`);
        } catch (emailError) {
          console.error("Error sending verification email:", emailError);
          // Don't fail signup if email sending fails
        }
      }

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;

      res.status(201).json({ 
        message: "Account created successfully", 
        user: userWithoutPassword 
      });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/login", authLimiter, doubleCsrfProtection, async (req, res) => {
    try {
      const result = loginUserSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid input", 
          errors: result.error.errors 
        });
      }

      const { username, password } = result.data;

      // Validate required fields for legacy login
      if (!username || !password) {
        return res.status(400).json({ message: "Username or email and password are required" });
      }

      // Find user by username or email
      // Check if the input is an email (contains @)
      const isEmail = username.includes('@');
      let user;
      if (isEmail) {
        user = await storage.getUserByEmail(username);
      } else {
        user = await storage.getUserByUsername(username);
      }
      
      if (!user || !user.password) {
        // Log failed login attempt
        await auditLogger.logLoginFailure(username, "User not found", req);
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        // Log failed login attempt
        await auditLogger.logLoginFailure(username, "Invalid password", req);
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Regenerate session with retry logic to handle SSL/connection issues
      let sessionRegenerationAttempts = 0;
      const maxRetries = 3;
      let sessionRegeneratedSuccessfully = false;

      while (sessionRegenerationAttempts < maxRetries) {
        try {
          await new Promise<void>((resolve, reject) => {
            req.session.regenerate((err) => {
              if (err) {
                console.error(`Session regeneration attempt ${sessionRegenerationAttempts + 1} failed:`, err);
                reject(err);
              } else {
                resolve();
              }
            });
          });
          sessionRegeneratedSuccessfully = true;
          break; // Success, exit retry loop
        } catch (error) {
          sessionRegenerationAttempts++;
          if (sessionRegenerationAttempts >= maxRetries) {
            console.error(`SECURITY WARNING: Session regeneration failed after ${maxRetries} attempts`);
            // SECURITY FIX: Fail login instead of continuing without regeneration
            // to prevent session fixation attacks
            return res.status(500).json({ 
              message: "Login failed due to session error. Please try again.",
              error: "SESSION_REGENERATION_FAILED" 
            });
          }
          // Wait briefly before retry
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Set session with safe user data
      const { password: _, ...safeUser } = user;
      req.session.userId = user.id;
      req.session.user = safeUser;

      // Log successful login
      await auditLogger.logLoginSuccess(user.id, req);

      res.json({ 
        message: "Login successful", 
        user: {
          ...safeUser,
          isAdmin: user.isAdmin === 'true'
        }
      });
    } catch (error) {
      const errorObj = error as Error;
      console.error("Login error details:", {
        error: errorObj.message,
        stack: errorObj.stack,
        username: req.body?.username,
        timestamp: new Date().toISOString(),
        errorType: errorObj.constructor.name
      });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", doubleCsrfProtection, async (req: any, res) => {
    const userId = req.session?.userId;
    
    req.session.destroy((err: any) => {
      if (err) {
        console.error("Session destroy error:", err);
        return res.status(500).json({ message: "Could not log out" });
      }
      
      // Log logout event
      if (userId) {
        auditLogger.logLogout(userId, req).catch(console.error);
      }
      
      // Clear cookie with matching options
      res.clearCookie("auth.sid", {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "lax"
      });
      res.json({ message: "Logout successful" });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json({ user: req.session.user });
  });

  // Test mode endpoints for admins to test premium features
  app.post("/api/auth/test-mode/enable", doubleCsrfProtection, (req: any, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const user = req.session.user;
    if (user.role !== "admin" && user.role !== "owner" && user.role !== "staff") {
      return res.status(403).json({ message: "Only admins can enable test mode" });
    }
    
    req.session.testMode = true;
    res.json({ message: "Test mode enabled", testMode: true });
  });

  app.post("/api/auth/test-mode/disable", doubleCsrfProtection, (req: any, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    req.session.testMode = false;
    res.json({ message: "Test mode disabled", testMode: false });
  });

  app.get("/api/auth/test-mode", (req: any, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    res.json({ testMode: req.session.testMode || false });
  });

  // ===== OAUTH ROUTES (Google & Discord) =====
  
  // Middleware to check if OAuth provider is enabled
  const checkOAuthProviderEnabled = (provider: 'google' | 'discord') => {
    return async (req: any, res: any, next: any) => {
      try {
        const config = await storage.getOAuthProviderConfig(provider);
        
        if (!config.enabled || !config.clientId || !config.clientSecret) {
          return res.redirect('/login?error=oauth_disabled');
        }
        
        next();
      } catch (error) {
        console.error(`Error checking ${provider} OAuth status:`, error);
        return res.redirect('/login?error=oauth_error');
      }
    };
  };
  
  // Google OAuth
  app.get("/api/auth/google", checkOAuthProviderEnabled('google'), passport.authenticate("google", { scope: ["profile", "email"] }));

  app.get(
    "/api/auth/google/callback",
    checkOAuthProviderEnabled('google'),
    passport.authenticate("google", { failureRedirect: "/login?error=oauth_failed" }),
    async (req: any, res) => {
      try {
        if (req.user) {
          req.session.userId = req.user.id;
          req.session.user = req.user;
          
          await storage.updateUser(req.user.id, {
            lastLoginAt: new Date().toISOString(),
            loginCount: (req.user.loginCount || 0) + 1,
          });
          
          await auditLogger.logLoginSuccess(req.user.id, req);
          
          res.redirect("/?login=success");
        } else {
          res.redirect("/login?error=no_user");
        }
      } catch (error) {
        console.error("Google OAuth callback error:", error);
        res.redirect("/login?error=oauth_error");
      }
    }
  );

  // Discord OAuth
  app.get("/api/auth/discord", checkOAuthProviderEnabled('discord'), passport.authenticate("discord"));

  app.get(
    "/api/auth/discord/callback",
    checkOAuthProviderEnabled('discord'),
    passport.authenticate("discord", { failureRedirect: "/login?error=oauth_failed" }),
    async (req: any, res) => {
      try {
        if (req.user) {
          req.session.userId = req.user.id;
          req.session.user = req.user;
          
          await storage.updateUser(req.user.id, {
            lastLoginAt: new Date().toISOString(),
            loginCount: (req.user.loginCount || 0) + 1,
          });
          
          await auditLogger.logLoginSuccess(req.user.id, req);
          
          res.redirect("/?login=success");
        } else {
          res.redirect("/login?error=no_user");
        }
      } catch (error) {
        console.error("Discord OAuth callback error:", error);
        res.redirect("/login?error=oauth_error");
      }
    }
  );

  // ===== EMAIL VERIFICATION ENDPOINTS =====

  // Request email verification (resend verification email)
  app.post("/api/auth/request-verification", authLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.emailVerified === "true") {
        return res.status(400).json({ message: "Email already verified" });
      }

      if (!user.email) {
        return res.status(400).json({ message: "No email address associated with this account" });
      }

      const token = await storage.createEmailVerificationToken(user.id);
      const baseUrl = req.protocol + '://' + req.get('host');
      const verificationUrl = `${baseUrl}/verify-email?token=${token.token}`;

      const emailHtml = generateVerificationEmailHtml(user.username || 'User', verificationUrl);
      
      await sendEmail({
        to: user.email,
        subject: 'Verify Your Email - AmourScans',
        text: `Welcome to AmourScans! Please verify your email by clicking this link: ${verificationUrl}`,
        html: emailHtml
      });

      res.json({ message: "Verification email sent successfully" });
    } catch (error) {
      console.error("Error requesting email verification:", error);
      res.status(500).json({ message: "Failed to send verification email" });
    }
  });

  // Verify email with token
  app.post("/api/auth/verify-email", authLimiter, doubleCsrfProtection, async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ message: "Verification token is required" });
      }

      const verificationToken = await storage.getEmailVerificationToken(token);
      
      if (!verificationToken) {
        return res.status(400).json({ message: "Invalid or expired verification token" });
      }

      if (new Date(verificationToken.expiresAt) < new Date()) {
        await storage.deleteEmailVerificationToken(token);
        return res.status(400).json({ message: "Verification token has expired" });
      }

      await storage.markEmailAsVerified(verificationToken.userId);
      await storage.deleteEmailVerificationToken(token);

      res.json({ message: "Email verified successfully" });
    } catch (error) {
      console.error("Error verifying email:", error);
      res.status(500).json({ message: "Failed to verify email" });
    }
  });

  // ===== PASSWORD RESET ENDPOINTS =====

  // Request password reset (send reset email)
  app.post("/api/auth/forgot-password", authLimiter, doubleCsrfProtection, async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        await new Promise(resolve => setTimeout(resolve, 100));
        return res.json({ message: "If an account with that email exists, a password reset link has been sent" });
      }

      const token = await storage.createPasswordResetToken(user.id);
      const baseUrl = req.protocol + '://' + req.get('host');
      const resetUrl = `${baseUrl}/reset-password?token=${token.token}`;

      const emailHtml = generatePasswordResetEmailHtml(user.username || 'User', resetUrl);
      
      await sendEmail({
        to: user.email!,
        subject: 'Reset Your Password - AmourScans',
        text: `You requested a password reset. Click this link to reset your password: ${resetUrl}`,
        html: emailHtml
      });

      res.json({ message: "If an account with that email exists, a password reset link has been sent" });
    } catch (error) {
      console.error("Error requesting password reset:", error);
      res.status(500).json({ message: "Failed to process password reset request" });
    }
  });

  // Verify reset token (check if token is valid before showing reset form)
  app.post("/api/auth/verify-reset-token", authLimiter, doubleCsrfProtection, async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ message: "Reset token is required" });
      }

      const resetToken = await storage.getPasswordResetToken(token);
      
      if (!resetToken) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      if (resetToken.used === "true") {
        return res.status(400).json({ message: "Reset token has already been used" });
      }

      if (new Date(resetToken.expiresAt) < new Date()) {
        await storage.deletePasswordResetToken(token);
        return res.status(400).json({ message: "Reset token has expired" });
      }

      res.json({ message: "Token is valid" });
    } catch (error) {
      console.error("Error verifying reset token:", error);
      res.status(500).json({ message: "Failed to verify reset token" });
    }
  });

  // Reset password with token
  app.post("/api/auth/reset-password", authLimiter, doubleCsrfProtection, async (req, res) => {
    try {
      const { token, newPassword, confirmPassword } = req.body;

      if (!token || !newPassword || !confirmPassword) {
        return res.status(400).json({ message: "All fields are required" });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: "Passwords do not match" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      const resetToken = await storage.getPasswordResetToken(token);
      
      if (!resetToken) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      if (resetToken.used === "true") {
        return res.status(400).json({ message: "Reset token has already been used" });
      }

      if (new Date(resetToken.expiresAt) < new Date()) {
        await storage.deletePasswordResetToken(token);
        return res.status(400).json({ message: "Reset token has expired" });
      }

      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      await storage.resetUserPassword(resetToken.userId, hashedPassword);
      await storage.markPasswordResetTokenAsUsed(token);

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // ===== DMCA NOTICE SUBMISSION ENDPOINT =====
  
  // Zod schema for DMCA notice submission
  const dmcaNoticeSchema = z.object({
    fullName: z.string().min(1, "Full name is required").max(100),
    email: z.string().email("Valid email is required"),
    phone: z.string().min(1, "Phone number is required").max(30),
    copyrightWork: z.string().min(10, "Description of copyrighted work is required").max(2000),
    infringingUrl: z.string().url("Valid URL is required"),
    description: z.string().max(5000).optional(),
    signature: z.string().min(1, "Electronic signature is required").max(100),
    goodFaithDeclaration: z.boolean().refine(val => val === true, {
      message: "You must declare good faith belief under 17 U.S.C. §512(c)(3)(A)(v)"
    }),
    accuracyDeclaration: z.boolean().refine(val => val === true, {
      message: "You must declare accuracy under penalty of perjury per 17 U.S.C. §512(c)(3)(A)(vi)"
    }),
  });

  // Submit DMCA takedown notice (rate limited to prevent abuse)
  app.post("/api/dmca/submit", authLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      const result = dmcaNoticeSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid input", 
          errors: result.error.errors 
        });
      }

      const { fullName, email, phone, copyrightWork, infringingUrl, description, signature, goodFaithDeclaration, accuracyDeclaration } = result.data;

      // Get IP address for fraud prevention
      const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';

      // Create DMCA notice in database
      const notice = await storage.createDmcaNotice({
        fullName,
        email,
        phone,
        copyrightWork,
        infringingUrl,
        description: description || null,
        signature,
        ipAddress: typeof ipAddress === 'string' ? ipAddress : ipAddress[0],
        goodFaithDeclaration: goodFaithDeclaration ? 'true' : 'false',
        accuracyDeclaration: accuracyDeclaration ? 'true' : 'false',
        status: 'pending'
      });

      // Send notification email to admin team (requires email integration setup)
      // To enable: Configure SendGrid or SMTP in Replit Secrets
      // See server/utils/email.ts for setup instructions
      try {
        const { sendEmail } = await import("./utils/email");
        await sendEmail({
          to: process.env.DMCA_NOTIFICATION_EMAIL || 'admin@localhost',
          subject: `[AmourScans] New DMCA Takedown Notice #${notice.id}`,
          text: `A new DMCA takedown notice has been submitted.\n\nNotice ID: ${notice.id}\nSubmitter: ${fullName} (${email})\nInfringing URL: ${infringingUrl}\nCopyright Work: ${copyrightWork}\n\nPlease review at: ${process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}/admin` : 'http://localhost:5000/admin'}`,
          html: `<h2>New DMCA Takedown Notice</h2><p><strong>Notice ID:</strong> ${notice.id}</p><p><strong>Submitter:</strong> ${fullName} (${email})</p><p><strong>Phone:</strong> ${phone || 'Not provided'}</p><p><strong>Infringing URL:</strong> <a href="${infringingUrl}">${infringingUrl}</a></p><p><strong>Copyright Work:</strong> ${copyrightWork}</p><p><strong>Status:</strong> Pending Review</p><p><a href="${process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}/admin` : 'http://localhost:5000/admin'}" style="background-color: #7c3aed; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; margin-top: 10px;">Review in Admin Panel</a></p>`
        });
      } catch (emailError) {
        console.log("[DMCA] Email notification not sent (email service not configured):", emailError);
      }

      res.json({ 
        message: "Your DMCA takedown notice has been received. We will review it within 48-72 hours.",
        noticeId: notice.id 
      });
    } catch (error) {
      console.error("Error submitting DMCA notice:", error);
      res.status(500).json({ message: "Failed to submit DMCA notice" });
    }
  });

  // Get all DMCA notices (admin only)
  app.get("/api/admin/dmca", adminAuth, async (req, res) => {
    try {
      const notices = await storage.getAllDmcaNotices();
      res.json(notices);
    } catch (error) {
      console.error("Error fetching DMCA notices:", error);
      res.status(500).json({ message: "Failed to fetch DMCA notices" });
    }
  });

  // Update DMCA notice status (admin only)
  app.patch("/api/admin/dmca/:id", adminAuth, doubleCsrfProtection, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status, reviewNotes } = req.body;

      if (!['pending', 'under_review', 'completed', 'rejected'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const userId = req.session?.user?.id;
      const notice = await storage.updateDmcaNoticeStatus(id, status, reviewNotes, userId);

      if (!notice) {
        return res.status(404).json({ message: "DMCA notice not found" });
      }

      res.json({ message: "DMCA notice updated successfully", notice });
    } catch (error) {
      console.error("Error updating DMCA notice:", error);
      res.status(500).json({ message: "Failed to update DMCA notice" });
    }
  });

  // ===== USER PROFILE MANAGEMENT ENDPOINTS =====
  
  // Zod schema for user profile updates
  const updateProfileSchema = z.object({
    username: z.string().min(3).max(30).optional(),
    email: z.string().email().optional(),
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().min(1).max(50).optional(),
    country: z.string().max(50).optional(),
  });

  // Zod schema for password change
  const changePasswordSchema = z.object({
    oldPassword: z.string().min(1),
    newPassword: z.string().min(8).max(100),
  });

  // Configure multer for profile picture uploads
  const profilePictureDir = path.join(process.cwd(), "uploads", "profiles");
  
  const ensureProfilePictureDir = async () => {
    try {
      await fsp.access(profilePictureDir);
    } catch {
      await fsp.mkdir(profilePictureDir, { recursive: true });
    }
  };

  const profilePictureStorage = multer.diskStorage({
    destination: async (req, file, cb) => {
      await ensureProfilePictureDir();
      cb(null, profilePictureDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const extension = path.extname(file.originalname).toLowerCase();
      cb(null, `profile-${uniqueSuffix}${extension}`);
    }
  });

  const uploadProfilePicture = multer({
    storage: profilePictureStorage,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (allowedTypes.includes(file.mimetype.toLowerCase())) {
        cb(null, true);
      } else {
        cb(new Error('Only JPG, PNG, and WebP images are allowed!'));
      }
    }
  });

  // GET /api/user/profile - Fetch logged-in user's profile
  app.get("/api/user/profile", async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password: _, ...safeUser } = user;
      res.json({
        user: {
          username: safeUser.username,
          email: safeUser.email,
          firstName: safeUser.firstName,
          lastName: safeUser.lastName,
          country: safeUser.country,
          profilePicture: safeUser.profilePicture,
          createdAt: safeUser.createdAt
        }
      });
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // PUT /api/user/profile - Update logged-in user's profile
  app.put("/api/user/profile", doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const validationResult = updateProfileSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid input data",
          errors: validationResult.error.errors
        });
      }

      const updateData = validationResult.data;

      // Check if username is being changed and if it's already taken
      if (updateData.username && updateData.username !== req.session.user.username) {
        const existingUser = await storage.getUserByUsername(updateData.username);
        if (existingUser) {
          return res.status(409).json({ message: "Username already taken" });
        }
      }

      // Check if email is being changed and if it's already taken
      if (updateData.email && updateData.email !== req.session.user.email) {
        const existingEmailUser = await storage.getUserByEmail(updateData.email);
        if (existingEmailUser) {
          return res.status(409).json({ message: "Email already in use" });
        }
      }

      const currentUser = await storage.getUserByUsername(req.session.user.username);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const updatedUser = await storage.updateUser(currentUser.id, updateData);
      if (!updatedUser) {
        return res.status(404).json({ message: "User update failed" });
      }

      // Update session with new user data
      const { password: _, ...safeUser } = updatedUser;
      req.session.user = safeUser;

      res.json({
        message: "Profile updated successfully",
        user: {
          username: safeUser.username,
          email: safeUser.email,
          firstName: safeUser.firstName,
          lastName: safeUser.lastName,
          country: safeUser.country,
          profilePicture: safeUser.profilePicture,
          createdAt: safeUser.createdAt
        }
      });
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST /api/user/profile-picture - Upload profile picture
  app.post("/api/user/profile-picture", doubleCsrfProtection, uploadProfilePicture.single('profilePicture'), async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      const currentUser = await storage.getUserByUsername(req.session.user.username);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Optimize uploaded image (convert to WebP/AVIF + compress)
      try {
        const optimizationResult = await optimizeImage(
          req.file.path,
          profilePictureDir,
          { quality: 85, width: 400, height: 400, fit: 'cover', thumbnailWidth: 150 }
        );
        console.log(`[ProfilePicture] Optimized: ${optimizationResult.compressionRatio.toFixed(1)}% size reduction`);
        
        // Use WebP as primary format
        req.file.filename = path.basename(optimizationResult.webpPath);
        req.file.path = optimizationResult.webpPath;
      } catch (error) {
        console.error('[ProfilePicture] Optimization failed, using original:', error);
      }

      // Delete old profile picture if it exists (check both fields for backwards compatibility)
      const oldProfilePicture = currentUser.profilePicture || currentUser.profileImageUrl;
      if (oldProfilePicture && oldProfilePicture.startsWith('/uploads/profiles/')) {
        try {
          const oldFileName = path.basename(oldProfilePicture);
          const oldFilePath = path.join(profilePictureDir, oldFileName);
          await fsp.unlink(oldFilePath);
        } catch (deleteError) {
          console.warn("Could not delete old profile picture:", deleteError);
        }
      }

      const profilePictureUrl = `/uploads/profiles/${req.file.filename}`;
      
      // Update both profile picture fields for consistency
      const updatedUser = await storage.updateUser(currentUser.id, {
        profilePicture: profilePictureUrl,
        profileImageUrl: profilePictureUrl
      });

      if (!updatedUser) {
        return res.status(404).json({ message: "User update failed" });
      }

      // Update session with new user data
      const { password: _, ...safeUser } = updatedUser;
      req.session.user = safeUser;

      res.json({
        message: "Profile picture uploaded successfully",
        profilePicture: profilePictureUrl
      });
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // PUT /api/user/password - Change password
  app.put("/api/user/password", doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const validationResult = changePasswordSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid input data",
          errors: validationResult.error.errors
        });
      }

      const { oldPassword, newPassword } = validationResult.data;

      const currentUser = await storage.getUserByUsername(req.session.user.username);
      if (!currentUser || !currentUser.password) {
        return res.status(404).json({ message: "User not found or password not set" });
      }

      // Verify old password
      const isOldPasswordValid = await bcrypt.compare(oldPassword, currentUser.password);
      if (!isOldPasswordValid) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      // Hash new password
      const saltRounds = 12;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      const updatedUser = await storage.updateUser(currentUser.id, {
        password: hashedNewPassword
      });

      if (!updatedUser) {
        return res.status(404).json({ message: "Password update failed" });
      }

      res.json({
        message: "Password changed successfully"
      });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin-only endpoints for user management
  app.get("/api/admin/users", adminAuth, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Remove passwords from all users before returning, include role data
      const safeUsers = users.map(user => {
        const { password: _, ...safeUser } = user;
        return {
          ...safeUser,
          isAdmin: user.isAdmin === 'true',
          role: user.role || (user.isAdmin === 'true' ? 'admin' : 'user') // Include role with fallback
        };
      });
      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all users with currency and subscription details
  app.get("/api/admin/users-detailed", adminAuth, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      
      // Fetch balance and subscription for each user
      const detailedUsers = await Promise.all(users.map(async (user) => {
        const { password: _, ...safeUser } = user;
        const balance = await storage.getUserCurrencyBalance(user.id);
        const subscription = await storage.getUserActiveSubscription(user.id);
        
        let subscriptionPackage = null;
        if (subscription && subscription.packageId) {
          subscriptionPackage = await storage.getSubscriptionPackageById(subscription.packageId);
        }
        
        return {
          ...safeUser,
          isAdmin: user.isAdmin === 'true',
          role: user.role || (user.isAdmin === 'true' ? 'admin' : 'user'),
          currencyBalance: balance,
          subscription: subscription ? {
            packageId: subscription.packageId,
            packageName: subscriptionPackage?.name || 'Unknown',
            status: subscription.status,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd
          } : null
        };
      }));
      
      res.json(detailedUsers);
    } catch (error) {
      console.error("Error fetching detailed users:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Search for users by username (admin only)
  app.get("/api/admin/users/search", adminAuth, async (req, res) => {
    try {
      const searchQuery = req.query.q as string;
      
      if (!searchQuery || searchQuery.trim() === '') {
        return res.status(400).json({ message: "Search query is required" });
      }
      
      const allUsers = await storage.getAllUsers();
      const searchLower = searchQuery.toLowerCase();
      
      // Search users by username (case-insensitive partial match)
      const matchedUsers = allUsers.filter(user => 
        user.username && user.username.toLowerCase().includes(searchLower)
      );
      
      // Get detailed info for matched users
      const detailedUsers = await Promise.all(matchedUsers.map(async (user) => {
        const { password: _, ...safeUser } = user;
        const balance = await storage.getUserCurrencyBalance(user.id);
        const subscription = await storage.getUserActiveSubscription(user.id);
        
        let subscriptionPackage = null;
        if (subscription && subscription.packageId) {
          subscriptionPackage = await storage.getSubscriptionPackageById(subscription.packageId);
        }
        
        return {
          ...safeUser,
          isAdmin: user.isAdmin === 'true',
          role: user.role || (user.isAdmin === 'true' ? 'admin' : 'user'),
          currencyBalance: balance,
          subscription: subscription ? {
            packageId: subscription.packageId,
            packageName: subscriptionPackage?.name || 'Unknown',
            status: subscription.status,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd
          } : null
        };
      }));
      
      res.json(detailedUsers);
    } catch (error) {
      console.error("Error searching users:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Schema for validating user updates
  const updateUserSchema = z.object({
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().min(1).max(50).optional(),
    email: z.string().email().optional(),
    country: z.string().max(50).optional(),
    username: z.string().min(3).max(30).optional(),
    password: z.string().min(8).max(100).optional(),
  });

  app.put("/api/admin/users/:id", adminAuth, doubleCsrfProtection, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate input data
      const validationResult = updateUserSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid input data", 
          errors: validationResult.error.errors 
        });
      }
      
      const updateData = validationResult.data;
      
      // Check if user exists
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Prevent changing admin user's username to maintain admin access
      if (existingUser.isAdmin === 'true' && updateData.username && updateData.username !== existingUser.username) {
        return res.status(403).json({ message: "Cannot change admin user's username" });
      }
      
      // If password is being updated, hash it
      if (updateData.password && updateData.password.trim() !== '') {
        const saltRounds = 12;
        updateData.password = await bcrypt.hash(updateData.password, saltRounds);
      }
      
      const updatedUser = await storage.updateUser(id, updateData);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Broadcast user update event for real-time updates
      broadcast.user({
        userId: id,
        action: 'updated',
        data: updatedUser
      });
      
      // Remove password from response
      const { password: _, ...safeUser } = updatedUser;
      const userWithAdminFlag = {
        ...safeUser,
        isAdmin: updatedUser.isAdmin === 'true'
      };
      
      res.json({ 
        message: "User updated successfully", 
        user: userWithAdminFlag 
      });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/users/:id", adminAuth, doubleCsrfProtection, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get current user for authorization
      if (!req.session.user?.username) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const currentUser = await storage.getUserByUsername(req.session.user.username);
      if (!currentUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Get target user to check role
      const targetUser = await storage.getUser(id);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Critical security: Only owner can delete owner accounts
      if (targetUser.role === 'owner' && currentUser.role !== 'owner') {
        return res.status(403).json({ message: "Only the owner can delete owner accounts" });
      }
      
      // Prevent deletion of the last/only owner
      if (targetUser.role === 'owner') {
        const allOwners = await storage.getAllUsers();
        const ownerCount = allOwners.filter(u => u.role === 'owner').length;
        if (ownerCount <= 1) {
          return res.status(403).json({ message: "Cannot delete the last owner. Transfer ownership first." });
        }
      }
      
      // Prevent deletion of admin/owner accounts by non-owners (legacy protection)
      if ((targetUser.isAdmin === 'true' || targetUser.role === 'admin') && currentUser.role !== 'owner') {
        return res.status(403).json({ message: "Only the owner can delete admin accounts" });
      }
      
      const deleted = await storage.deleteUser(id);
      if (!deleted) {
        return res.status(404).json({ message: "User deletion failed" });
      }
      
      // Broadcast user deletion event for real-time updates
      broadcast.user({
        userId: id,
        action: 'deleted',
        data: { id }
      }, currentUser.id);
      
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Upload Progress Endpoint
  app.get("/api/admin/upload-progress/:uploadId", isStaff, async (req, res) => {
    try {
      const { uploadId } = req.params;
      
      const progress = uploadProgressStore.get(uploadId);
      if (!progress) {
        return res.status(404).json({ 
          message: "Upload not found",
          uploadId
        });
      }
      
      // Return comprehensive progress information
      res.json({
        id: progress.id,
        status: progress.status,
        progress: progress.progress,
        message: progress.message,
        currentFile: progress.currentFile,
        totalFiles: progress.totalFiles,
        processedFiles: progress.processedFiles,
        startTime: progress.startTime,
        speed: progress.speed,
        estimatedTimeRemaining: progress.estimatedTimeRemaining,
        error: progress.error,
        details: progress.details
      });
    } catch (error) {
      console.error("Error fetching upload progress:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Upload Cancel Endpoint
  app.delete("/api/admin/upload-cancel/:uploadId", isStaff, doubleCsrfProtection, async (req, res) => {
    try {
      const { uploadId } = req.params;
      
      const progress = uploadProgressStore.get(uploadId);
      if (!progress) {
        return res.status(404).json({ 
          message: "Upload not found",
          uploadId
        });
      }
      
      // Check if upload is already complete or errored
      if (progress.status === 'complete' || progress.status === 'error') {
        return res.status(400).json({ 
          message: "Upload cannot be cancelled - already finished",
          status: progress.status
        });
      }
      
      // Mark as cancelled
      updateProgress(uploadId, {
        status: 'error',
        progress: 0,
        message: 'Upload cancelled by user',
        error: 'Upload was cancelled by user',
        cancelled: true
      });
      
      console.log(`[${uploadId}] Upload cancelled by user request`);
      
      res.json({ 
        message: "Upload cancelled successfully",
        uploadId 
      });
    } catch (error) {
      console.error("Error cancelling upload:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin-only endpoints for series management
  app.get("/api/admin/series", adminAuth, async (req, res) => {
    try {
      const seriesList = await storage.getAllSeries();
      res.json(seriesList);
    } catch (error) {
      console.error("Error fetching series:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/series", isStaff, doubleCsrfProtection, async (req: any, res) => {
    try {
      // Series creation requires admin or owner role (not staff)
      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const hasAdminAccess = user.isAdmin === 'true' || ['admin', 'owner'].includes(user.role || '');
      if (!hasAdminAccess) {
        return res.status(403).json({ message: "Forbidden: Admin or Owner access required to create series" });
      }
      
      // Validate input data
      const validationResult = insertSeriesSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid input data", 
          errors: validationResult.error.errors 
        });
      }
      
      const seriesData = validationResult.data;
      // Convert rating to string for database storage (genres already handled by schema)
      const seriesDataForStorage = {
        ...seriesData,
        rating: seriesData.rating !== undefined ? String(seriesData.rating) : undefined
      };
      const newSeries = await storage.createSeries(seriesDataForStorage);
      
      // Broadcast series creation event
      broadcast.series({
        seriesId: newSeries.id,
        action: 'created',
        data: newSeries
      }, user.id);
      
      res.status(201).json({ 
        message: "Series created successfully", 
        series: newSeries 
      });
    } catch (error) {
      console.error("Error creating series:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/admin/series/:id", isStaff, doubleCsrfProtection, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate input data
      const validationResult = updateSeriesSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid input data", 
          errors: validationResult.error.errors 
        });
      }
      
      const updateData = validationResult.data;
      
      // Check if series exists
      const existingSeries = await storage.getSeries(id);
      if (!existingSeries) {
        return res.status(404).json({ message: "Series not found" });
      }
      
      // Convert rating to string for database storage (genres handled by storage layer)
      const updateDataForStorage: any = {
        ...updateData,
        rating: updateData.rating !== undefined ? String(updateData.rating) : undefined
      };
      
      const updatedSeries = await storage.updateSeries(id, updateDataForStorage);
      if (!updatedSeries) {
        return res.status(404).json({ message: "Series not found" });
      }
      
      // Broadcast series update event
      broadcast.series({
        seriesId: id,
        action: 'updated',
        data: updatedSeries
      }, (req as any).session?.user?.id);
      
      res.json({ 
        message: "Series updated successfully", 
        series: updatedSeries 
      });
    } catch (error) {
      console.error("Error updating series:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update series SEO metadata
  app.patch("/api/admin/series/:id/seo", isStaff, doubleCsrfProtection, async (req, res) => {
    try {
      const { id } = req.params;
      const { metaTitle, metaDescription, seoKeywords, canonicalUrl, robotsNoindex } = req.body;
      
      // Check if series exists
      const existingSeries = await storage.getSeries(id);
      if (!existingSeries) {
        return res.status(404).json({ message: "Series not found" });
      }
      
      // Update only SEO-related fields
      const updatedSeries = await storage.updateSeries(id, {
        metaTitle,
        metaDescription,
        seoKeywords,
        canonicalUrl,
        robotsNoindex
      });
      
      if (!updatedSeries) {
        return res.status(404).json({ message: "Series not found" });
      }
      
      // Broadcast SEO update event
      broadcast.series({
        seriesId: id,
        action: 'updated',
        data: updatedSeries
      }, (req as any).session?.user?.id);
      
      res.json({ 
        message: "SEO metadata updated successfully", 
        series: updatedSeries 
      });
    } catch (error) {
      console.error("Error updating series SEO:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update chapter SEO metadata
  app.patch("/api/admin/chapters/:id/seo", isStaff, doubleCsrfProtection, async (req, res) => {
    try {
      const { id } = req.params;
      const { metaTitle, metaDescription, canonicalUrl, robotsNoindex } = req.body;
      
      // Check if chapter exists
      const existingChapter = await storage.getChapter(id);
      if (!existingChapter) {
        return res.status(404).json({ message: "Chapter not found" });
      }
      
      // Update only SEO-related fields
      const updatedChapter = await storage.updateChapter(id, {
        metaTitle,
        metaDescription,
        canonicalUrl,
        robotsNoindex
      });
      
      if (!updatedChapter) {
        return res.status(404).json({ message: "Chapter not found" });
      }
      
      // Broadcast chapter SEO update event
      broadcast.chapter({
        chapterId: id,
        seriesId: existingChapter.seriesId,
        action: 'updated',
        data: updatedChapter
      }, (req as any).session?.user?.id);
      
      res.json({ 
        message: "Chapter SEO metadata updated successfully", 
        chapter: updatedChapter 
      });
    } catch (error) {
      console.error("Error updating chapter SEO:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/series/:id", adminAuth, doubleCsrfProtection, async (req: any, res) => {
    try {
      // Series deletion requires admin or owner role (not staff)
      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const hasAdminAccess = user.isAdmin === 'true' || ['admin', 'owner'].includes(user.role || '');
      if (!hasAdminAccess) {
        return res.status(403).json({ message: "Forbidden: Admin or Owner access required to delete series" });
      }
      
      const { id } = req.params;
      
      // Get series details before deletion for cleanup
      const seriesInfo = await storage.getSeries(id);
      if (!seriesInfo) {
        return res.status(404).json({ message: "Series not found" });
      }

      // Get all chapters for this series before deletion
      const seriesChapters = await storage.getChaptersBySeriesId(id);

      // Clean up all associated files before database deletion
      try {
        console.log(`[cleanup] Starting cleanup for series: ${seriesInfo.title} (${seriesChapters.length} chapters)`);
        
        // Extract actual directory name from chapter pages (handles title changes)
        let actualMangaName = null;
        if (seriesChapters.length > 0 && seriesChapters[0].pages && Array.isArray(seriesChapters[0].pages) && seriesChapters[0].pages.length > 0) {
          // Extract directory name from URL pattern: /api/chapters/image/{directoryName}/{chapterNumber}/{filename}
          const firstPageUrl = seriesChapters[0].pages[0];
          console.log(`[cleanup] Analyzing first page URL: ${firstPageUrl}`);
          const urlParts = firstPageUrl.split('/');
          console.log(`[cleanup] URL parts:`, urlParts);
          if (urlParts.length >= 5 && urlParts[1] === 'api' && urlParts[2] === 'chapters' && urlParts[3] === 'image') {
            actualMangaName = urlParts[4]; // Extract the directory name
            console.log(`[cleanup] Extracted actual directory name from chapter data: ${actualMangaName}`);
          } else {
            console.log(`[cleanup] URL parsing failed - invalid format or insufficient parts`);
          }
        } else {
          console.log(`[cleanup] No chapters or pages found for directory name extraction`);
        }
        
        // If we couldn't extract from chapter data, try to find the directory by scanning filesystem
        if (!actualMangaName) {
          console.log(`[cleanup] Attempting to find directory by scanning filesystem...`);
          try {
            const mangaBaseDir = path.join(process.cwd(), 'uploads', 'manga');
            const existingDirs = await fsp.readdir(mangaBaseDir, { withFileTypes: true });
            const candidateNames = [
              sanitizeMangaName(seriesInfo.title), // Current title
              // Add other possible variations if we knew previous titles
            ];
            
            console.log(`[cleanup] Candidate directory names:`, candidateNames);
            console.log(`[cleanup] Existing directories:`, existingDirs.map(d => d.name));
            
            // Find the first matching directory
            for (const candidate of candidateNames) {
              const matchingDir = existingDirs.find(dir => dir.isDirectory() && dir.name === candidate);
              if (matchingDir) {
                actualMangaName = candidate;
                console.log(`[cleanup] Found matching directory: ${actualMangaName}`);
                break;
              }
            }
          } catch (scanError) {
            console.warn(`[cleanup] Error scanning for directories:`, scanError);
          }
        }
        
        // Final fallback to sanitized current title
        if (!actualMangaName) {
          actualMangaName = sanitizeMangaName(seriesInfo.title);
          console.log(`[cleanup] Using final fallback directory name from current title: ${actualMangaName}`);
        }
        
        const seriesDir = path.join(process.cwd(), 'uploads', 'manga', actualMangaName);
        console.log(`[cleanup] Target series directory: ${seriesDir}`);

        // Clean up all chapter directories
        for (const chapter of seriesChapters) {
          try {
            const chapterDir = path.join(seriesDir, 'chapters', chapter.chapterNumber);
            await fsp.rm(chapterDir, { recursive: true, force: true });
            console.log(`[cleanup] Deleted chapter directory: ${chapterDir}`);
          } catch (chapterCleanupError) {
            console.warn(`[cleanup] Warning: Could not clean up chapter ${chapter.chapterNumber}:`, chapterCleanupError);
          }
        }

        // Clean up series cover image if it exists
        if (seriesInfo.coverImageUrl) {
          try {
            // Extract filename from URL (e.g., /uploads/covers/filename.jpg -> filename.jpg)
            const coverFileName = path.basename(seriesInfo.coverImageUrl);
            const coverImagePath = path.join(process.cwd(), 'uploads', 'covers', coverFileName);
            await fsp.rm(coverImagePath, { force: true });
            console.log(`[cleanup] Deleted cover image: ${coverImagePath}`);
          } catch (coverCleanupError) {
            console.warn(`[cleanup] Warning: Could not clean up cover image:`, coverCleanupError);
          }
        }

        // Clean up entire series directory (if it exists and is empty)
        try {
          await fsp.rm(seriesDir, { recursive: true, force: true });
          console.log(`[cleanup] Deleted series directory: ${seriesDir}`);
        } catch (seriesDirCleanupError) {
          console.warn(`[cleanup] Warning: Could not clean up series directory:`, seriesDirCleanupError);
        }

      } catch (cleanupError) {
        console.warn("[cleanup] Warning: Could not clean up series files:", cleanupError);
        // Don't fail the deletion if file cleanup fails - continue with database deletion
      }

      // Delete series from database
      const deleted = await storage.deleteSeries(id);
      if (!deleted) {
        return res.status(404).json({ message: "Series not found" });
      }
      
      // Broadcast series deletion event
      broadcast.series({
        seriesId: id,
        action: 'deleted',
        data: { id }
      }, user.id);
      
      res.json({ message: "Series deleted successfully" });
    } catch (error) {
      console.error("Error deleting series:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ===== SETTINGS MANAGEMENT API ENDPOINTS =====
  
  // GET /api/settings/public/shop-status - Get shop enabled status and mode (public endpoint)
  app.get("/api/settings/public/shop-status", async (req, res) => {
    try {
      const enabledSetting = await storage.getSetting('system', 'shop_enabled');
      const modeSetting = await storage.getSetting('system', 'shop_mode');
      
      const enabled = enabledSetting ? enabledSetting.value === 'true' : true;
      const mode = modeSetting ? modeSetting.value : 'enabled';
      
      res.json({ 
        enabled,
        mode
      });
    } catch (error) {
      console.error("Error fetching shop status:", error);
      // Return defaults on error
      res.json({ 
        enabled: true,
        mode: 'enabled'
      });
    }
  });
  
  // GET /api/settings/public/ad-intensity - Get ad intensity level and enabled status (public endpoint)
  app.get("/api/settings/public/ad-intensity", async (req, res) => {
    try {
      const levelSetting = await storage.getSetting('system', 'ad_intensity_level');
      const enabledSetting = await storage.getSetting('system', 'ads_enabled');
      
      const level = levelSetting ? parseInt(levelSetting.value) : 2;
      const enabled = enabledSetting ? enabledSetting.value === 'true' : true;
      
      const descriptions: { [key: number]: string } = {
        1: 'Light',
        2: 'Moderate',
        3: 'Heavy'
      };
      
      res.json({ 
        level, 
        description: descriptions[level] || 'Moderate',
        enabled
      });
    } catch (error) {
      console.error("Error fetching ad intensity:", error);
      // Return default on error to prevent ad system breakage
      res.json({ level: 2, description: 'Moderate', enabled: true });
    }
  });
  
  // Get all settings or filter by category (owner only)
  app.get("/api/admin/settings", isOwner, async (req, res) => {
    try {
      const { category } = req.query;
      
      let settings;
      if (category && typeof category === 'string') {
        settings = await storage.getSettingsByCategory(category);
      } else {
        settings = await storage.getAllSettings();
      }
      
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  // Get settings by category (owner only)
  app.get("/api/admin/settings/:category", isOwner, async (req, res) => {
    try {
      const { category } = req.params;
      const settings = await storage.getSettingsByCategory(category);
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings by category:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  // Get specific setting by category and key (owner only)
  app.get("/api/admin/settings/:category/:key", isOwner, async (req, res) => {
    try {
      const { category, key } = req.params;
      const setting = await storage.getSetting(category, key);
      
      if (!setting) {
        return res.status(404).json({ message: "Setting not found" });
      }
      
      res.json(setting);
    } catch (error) {
      console.error("Error fetching setting:", error);
      res.status(500).json({ message: "Failed to fetch setting" });
    }
  });

  // Update existing setting by ID (must come before parameterized route) (owner only)
  app.put("/api/admin/settings/by-id/:id", isOwner, doubleCsrfProtection, async (req, res) => {
    try {
      const { id } = req.params;
      const validation = updateSettingSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid setting data",
          errors: validation.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        });
      }

      const setting = await storage.updateSetting(id, validation.data);
      
      if (!setting) {
        return res.status(404).json({ message: "Setting not found" });
      }
      
      // Broadcast settings update event
      broadcast.settings({
        category: setting.category,
        key: setting.key,
        value: setting.value,
        action: 'updated'
      }, (req as any).session?.user?.id);
      
      res.json(setting);
    } catch (error) {
      console.error("Error updating setting:", error);
      res.status(500).json({ message: "Failed to update setting" });
    }
  });

  // Set/update setting by category and key (owner only)
  app.put("/api/admin/settings/:category/:key", isOwner, doubleCsrfProtection, async (req, res) => {
    try {
      const { category, key } = req.params;
      
      // First validate with schema
      const validation = settingValueSchema.safeParse({
        category,
        key,
        ...req.body
      });

      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid setting data",
          errors: validation.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        });
      }

      // Enhanced validation with type-conditional value validation
      let { value, type, description, isPublic } = validation.data;
      
      // Validate and convert value based on type
      let processedValue: string;
      try {
        switch (type) {
          case "number":
            const numValue = Number(value);
            if (isNaN(numValue)) {
              return res.status(400).json({ message: "Invalid number value" });
            }
            processedValue = String(numValue);
            break;
          case "boolean":
            if (typeof value === 'string') {
              if (value === 'true' || value === 'false') {
                processedValue = value;
              } else {
                return res.status(400).json({ message: "Boolean value must be 'true' or 'false'" });
              }
            } else if (typeof value === 'boolean') {
              processedValue = String(value);
            } else {
              return res.status(400).json({ message: "Invalid boolean value" });
            }
            break;
          case "json":
            if (typeof value === 'object') {
              processedValue = JSON.stringify(value);
            } else if (typeof value === 'string') {
              // Validate it's valid JSON
              JSON.parse(value);
              processedValue = value;
            } else {
              return res.status(400).json({ message: "Invalid JSON value" });
            }
            break;
          default: // string
            processedValue = String(value);
        }
      } catch (error) {
        return res.status(400).json({ message: "Invalid value for specified type" });
      }

      // Normalize isPublic to boolean
      const normalizedIsPublic = typeof isPublic === 'boolean' ? isPublic : isPublic === 'true';
      
      const setting = await storage.setSetting(
        category, 
        key, 
        processedValue,
        type, 
        description, 
        normalizedIsPublic
      );
      
      // Broadcast settings update event
      broadcast.settings({
        category,
        key,
        value: processedValue,
        action: 'updated'
      }, (req as any).session?.user?.id);
      
      // Special broadcast for ad intensity changes
      if (category === 'ads' && key === 'intensity-level') {
        const adsEnabled = await storage.getSetting('ads', 'enabled');
        broadcast.adIntensity(
          parseInt(processedValue),
          adsEnabled?.value === 'true',
          (req as any).session?.user?.id
        );
      }
      
      res.json(setting);
    } catch (error) {
      console.error("Error setting value:", error);
      res.status(500).json({ message: "Failed to set setting" });
    }
  });

  // Delete setting by ID (owner only)
  app.delete("/api/admin/settings/:id", isOwner, doubleCsrfProtection, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteSetting(id);
      
      if (!success) {
        return res.status(404).json({ message: "Setting not found" });
      }
      
      res.json({ message: "Setting deleted successfully" });
    } catch (error) {
      console.error("Error deleting setting:", error);
      res.status(500).json({ message: "Failed to delete setting" });
    }
  });

  // OAuth Provider Management Routes (Owner only)
  
  // Get all OAuth providers configuration (owner only)
  app.get("/api/admin/oauth/providers", isOwner, async (req, res) => {
    try {
      const googleConfig = await storage.getOAuthProviderConfig('google');
      const discordConfig = await storage.getOAuthProviderConfig('discord');
      
      res.json({
        google: {
          enabled: googleConfig.enabled,
          clientId: googleConfig.clientId,
          hasClientSecret: !!googleConfig.clientSecret
        },
        discord: {
          enabled: discordConfig.enabled,
          clientId: discordConfig.clientId,
          hasClientSecret: !!discordConfig.clientSecret
        }
      });
    } catch (error) {
      console.error("Error fetching OAuth providers:", error);
      res.status(500).json({ message: "Failed to fetch OAuth providers" });
    }
  });

  // Get specific OAuth provider configuration (owner only)
  app.get("/api/admin/oauth/providers/:provider", isOwner, async (req, res) => {
    try {
      const provider = req.params.provider as 'google' | 'discord';
      
      if (!['google', 'discord'].includes(provider)) {
        return res.status(400).json({ message: "Invalid provider. Must be 'google' or 'discord'" });
      }
      
      const config = await storage.getOAuthProviderConfig(provider);
      
      res.json({
        enabled: config.enabled,
        clientId: config.clientId,
        hasClientSecret: !!config.clientSecret
      });
    } catch (error) {
      console.error(`Error fetching ${req.params.provider} OAuth config:`, error);
      res.status(500).json({ message: "Failed to fetch OAuth provider configuration" });
    }
  });

  // Update OAuth provider configuration (owner only)
  app.put("/api/admin/oauth/providers/:provider", isOwner, doubleCsrfProtection, async (req, res) => {
    try {
      const provider = req.params.provider as 'google' | 'discord';
      
      if (!['google', 'discord'].includes(provider)) {
        return res.status(400).json({ message: "Invalid provider. Must be 'google' or 'discord'" });
      }
      
      const { enabled, clientId, clientSecret } = req.body;
      
      if (enabled !== undefined && typeof enabled !== 'boolean') {
        return res.status(400).json({ message: "enabled must be a boolean" });
      }
      
      if (clientId !== undefined && typeof clientId !== 'string') {
        return res.status(400).json({ message: "clientId must be a string" });
      }
      
      if (clientSecret !== undefined && typeof clientSecret !== 'string') {
        return res.status(400).json({ message: "clientSecret must be a string" });
      }
      
      await storage.setOAuthProviderConfig(provider, {
        enabled,
        clientId,
        clientSecret
      });
      
      const updatedConfig = await storage.getOAuthProviderConfig(provider);
      
      res.json({
        message: `${provider.charAt(0).toUpperCase() + provider.slice(1)} OAuth configuration updated successfully`,
        enabled: updatedConfig.enabled,
        clientId: updatedConfig.clientId,
        hasClientSecret: !!updatedConfig.clientSecret
      });
    } catch (error) {
      console.error(`Error updating ${req.params.provider} OAuth config:`, error);
      res.status(500).json({ message: "Failed to update OAuth provider configuration" });
    }
  });

  // Public endpoint to get enabled OAuth providers
  app.get("/api/auth/oauth/enabled", async (req, res) => {
    try {
      const enabledProviders = await storage.getEnabledOAuthProviders();
      res.json({ providers: enabledProviders });
    } catch (error) {
      console.error("Error fetching enabled OAuth providers:", error);
      res.status(500).json({ message: "Failed to fetch enabled OAuth providers" });
    }
  });

  // API endpoint to expose upload configuration to client-side
  app.get("/api/admin/upload-config", isStaff, async (req, res) => {
    try {
      res.json({
        maxZipSizeMB: ZIP_LIMITS.UPLOAD_MAX_ZIP_MB,
        maxZipSizeBytes: ZIP_LIMITS.UPLOAD_MAX_ZIP_SIZE,
        maxArchiveFiles: ZIP_LIMITS.MAX_ENTRIES,
        maxFileSize: ZIP_LIMITS.MAX_FILE_SIZE,
        allowedExtensions: ZIP_LIMITS.ALLOWED_EXTENSIONS
      });
    } catch (error) {
      console.error("Error getting upload config:", error);
      res.status(500).json({ message: "Failed to get upload configuration" });
    }
  });

  // Ensure covers directory exists
  const coversUploadDir = path.join(process.cwd(), 'uploads', 'covers');
  try {
    await fsp.access(coversUploadDir);
  } catch {
    await fsp.mkdir(coversUploadDir, { recursive: true });
  }

  // Configure multer for cover image uploads with disk storage
  const coverImageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, coversUploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const extension = path.extname(file.originalname).toLowerCase();
      cb(null, `cover-${uniqueSuffix}${extension}`);
    }
  });

  const upload = multer({
    storage: coverImageStorage,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      // Accept only specific image types, exclude SVG for security
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (allowedTypes.includes(file.mimetype.toLowerCase())) {
        cb(null, true);
      } else {
        cb(new Error('Only JPG, PNG, and WebP images are allowed!'));
      }
    }
  });

  // Image upload endpoint - uploads to local disk storage
  app.post("/api/admin/upload-cover", isStaff, doubleCsrfProtection, upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      // Optimize uploaded cover image (convert to WebP/AVIF + compress)
      try {
        const optimizationResult = await optimizeImage(
          req.file.path,
          coversUploadDir,
          { quality: 85, width: 800, fit: 'inside', thumbnailWidth: 400 }
        );
        console.log(`[CoverImage] Optimized: ${optimizationResult.compressionRatio.toFixed(1)}% size reduction`);
        
        // Use WebP as primary format
        req.file.filename = path.basename(optimizationResult.webpPath);
      } catch (error) {
        console.error('[CoverImage] Optimization failed, using original:', error);
      }

      // File already saved to disk by multer
      const imageUrl = `/api/covers/${req.file.filename}`;
      
      res.json({ 
        message: "Image uploaded successfully", 
        url: imageUrl,
        filename: req.file.filename
      });
    } catch (error) {
      console.error("Error uploading image:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ===== AD IMAGE UPLOADS =====
  
  // Ensure ads directory exists
  const adsUploadDir = path.join(process.cwd(), 'uploads', 'ads');
  try {
    await fsp.access(adsUploadDir);
  } catch {
    await fsp.mkdir(adsUploadDir, { recursive: true });
  }

  // Configure multer for ad image uploads with disk storage
  const adImageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, adsUploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const extension = path.extname(file.originalname).toLowerCase();
      cb(null, `ad-${uniqueSuffix}${extension}`);
    }
  });

  const adImageUpload = multer({
    storage: adImageStorage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit for ads (higher quality images)
    },
    fileFilter: (req, file, cb) => {
      // Accept only specific image types, exclude SVG for security
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      if (allowedTypes.includes(file.mimetype.toLowerCase())) {
        cb(null, true);
      } else {
        cb(new Error('Only JPG, PNG, WebP, and GIF images are allowed for ads!'));
      }
    }
  });

  // Ad image upload endpoint - supports multiple device sizes
  app.post("/api/admin/upload-ad-image", actionLimiter, isStaff, doubleCsrfProtection, adImageUpload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      // Get device type from request (optional)
      const deviceType = req.body.deviceType || 'all'; // mobile, tablet, desktop, all

      // Optimize uploaded ad image (convert to WebP/AVIF + compress)
      try {
        const optimizationResult = await optimizeImage(
          req.file.path,
          adsUploadDir,
          { quality: 85, generateThumbnail: false } // Ads don't need thumbnails
        );
        console.log(`[AdImage] Optimized: ${optimizationResult.compressionRatio.toFixed(1)}% size reduction`);
        
        // Use WebP as primary format
        req.file.filename = path.basename(optimizationResult.webpPath);
        req.file.size = optimizationResult.optimizedSize;
        req.file.mimetype = 'image/webp';
      } catch (error) {
        console.error('[AdImage] Optimization failed, using original:', error);
      }

      // File already saved to disk by multer
      const imageUrl = `/api/ads/image/${req.file.filename}`;
      
      res.json({ 
        message: "Ad image uploaded successfully", 
        url: imageUrl,
        filename: req.file.filename,
        deviceType: deviceType,
        size: req.file.size,
        mimetype: req.file.mimetype
      });
    } catch (error) {
      console.error("Error uploading ad image:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Serve ad images
  app.get('/api/ads/image/:filename', async (req, res) => {
    try {
      const { filename } = req.params;
      
      // Strict whitelist for filenames
      if (!/^ad-\d+-\d+\.(jpg|jpeg|png|webp|gif)$/i.test(filename)) {
        return res.status(400).json({ message: 'Invalid filename format or unsupported file type' });
      }
      
      // Get proper MIME type based on actual file extension
      const ext = path.extname(filename).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif'
      };
      
      const contentType = mimeTypes[ext];
      if (!contentType) {
        return res.status(400).json({ message: 'Unsupported file type' });
      }
      
      // Serve from local disk storage
      const adImagePath = path.join(process.cwd(), 'uploads', 'ads', filename);
      
      try {
        await fsp.access(adImagePath);
        
        // Set secure headers for image serving
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        
        // Send file from disk
        res.sendFile(adImagePath);
      } catch (fileError) {
        console.log(`[ad-404] Missing ad image in local storage: ${filename}`);
        return res.status(404).json({ message: 'Ad image not found' });
      }
      
    } catch (error) {
      console.error('Error serving ad image:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  });

  // Security limits for ZIP extraction - configurable via environment variables
  const getZipLimits = () => {
    const maxArchiveFiles = parseInt(process.env.MAX_ARCHIVE_FILES || '200', 10);
    const maxTotalBytes = parseInt(process.env.MAX_TOTAL_BYTES || (200 * 1024 * 1024).toString(), 10);
    const maxFileBytes = parseInt(process.env.MAX_FILE_BYTES || (10 * 1024 * 1024).toString(), 10);
    
    // UPLOAD_MAX_ZIP_MB for ZIP upload size limit (default 200MB)
    const uploadMaxZipMB = parseInt(process.env.UPLOAD_MAX_ZIP_MB || '200', 10);
    const uploadMaxZipBytes = uploadMaxZipMB * 1024 * 1024;
    
    // Validate environment variables
    if (isNaN(maxArchiveFiles) || maxArchiveFiles <= 0 || maxArchiveFiles > 1000) {
      throw new Error('MAX_ARCHIVE_FILES must be a positive integer between 1 and 1000');
    }
    if (isNaN(maxTotalBytes) || maxTotalBytes <= 0 || maxTotalBytes > 1024 * 1024 * 1024) {
      throw new Error('MAX_TOTAL_BYTES must be a positive integer up to 1GB');
    }
    if (isNaN(maxFileBytes) || maxFileBytes <= 0 || maxFileBytes > 100 * 1024 * 1024) {
      throw new Error('MAX_FILE_BYTES must be a positive integer up to 100MB');
    }
    if (isNaN(uploadMaxZipMB) || uploadMaxZipMB <= 0 || uploadMaxZipMB > 1024) {
      throw new Error('UPLOAD_MAX_ZIP_MB must be a positive integer up to 1024MB (1GB)');
    }
    
    return {
      MAX_ENTRIES: maxArchiveFiles,
      MAX_TOTAL_SIZE: maxTotalBytes,
      MAX_FILE_SIZE: maxFileBytes,
      UPLOAD_MAX_ZIP_SIZE: uploadMaxZipBytes,
      UPLOAD_MAX_ZIP_MB: uploadMaxZipMB,
      MAX_FILENAME_LENGTH: 100,   // Keep this static for now
      ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.bmp', '.tiff', '.tif']
    };
  };

  const ZIP_LIMITS = getZipLimits();

  // Helper function to sanitize manga names for file system usage
  const sanitizeMangaName = (title: string): string => {
    return title
      .replace(/[<>:"|?*\x00-\x1f]/g, '') // Remove invalid characters
      .replace(/[/\\]/g, '-') // Replace path separators
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .substring(0, 50); // Limit length
  };

  // Configure multer for chapter ZIP uploads
  const chaptersUploadDir = path.join(process.cwd(), "uploads", "chapters");
  
  // Pre-create upload directory (sync to avoid multer async issues)
  try {
    await fsp.access(chaptersUploadDir);
  } catch {
    await fsp.mkdir(chaptersUploadDir, { recursive: true });
  }

  const chapterZipStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      // Use synchronous callback - directory already created above
      cb(null, chaptersUploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, `chapter-${uniqueSuffix}.zip`);
    }
  });

  const uploadChapterZip = multer({
    storage: chapterZipStorage,
    limits: {
      fileSize: ZIP_LIMITS.UPLOAD_MAX_ZIP_SIZE, // Use configurable ZIP upload limit
      files: 1, // Only one file at a time
    },
    fileFilter: async (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
      try {
        // Input sanitization and validation
        const originalname = file.originalname || '';
        const mimetype = file.mimetype || '';
        
        // Validate filename length and characters
        if (!originalname || originalname.length === 0) {
          const error = new Error('Filename is required');
          (error as any).code = 'INVALID_FILENAME';
          return cb(error);
        }
        
        if (originalname.length > 255) {
          const error = new Error('Filename is too long (max 255 characters)');
          (error as any).code = 'INVALID_FILENAME';
          return cb(error);
        }
        
        // Check for dangerous filename characters
        if (/[<>:"|?*\x00-\x1f]/.test(originalname)) {
          const error = new Error('Filename contains invalid characters');
          (error as any).code = 'INVALID_FILENAME';
          return cb(error);
        }
        
        // Check file extension with enhanced validation
        const ext = path.extname(originalname).toLowerCase();
        const allowedExtensions = ['.zip', '.cbz'];
        if (!allowedExtensions.includes(ext)) {
          const error = new Error(`Only ZIP and CBZ files are allowed. Received: ${ext || 'no extension'}`);
          (error as any).code = 'LIMIT_UNEXPECTED_FILE';
          (error as any).userAction = `Please select a ZIP or CBZ file. Supported extensions: ${allowedExtensions.join(', ')}`;
          return cb(error);
        }
        
        // Enhanced MIME type validation with security checks
        const allowedMimeTypes = [
          'application/zip', 
          'application/x-zip-compressed', 
          'application/x-zip',
          'application/octet-stream' // Browsers sometimes send this for ZIP files
        ];
        
        // Reject potentially dangerous MIME types
        const dangerousMimeTypes = [
          'application/x-executable',
          'application/x-msdownload',
          'text/html',
          'text/javascript',
          'application/javascript'
        ];
        
        if (dangerousMimeTypes.includes(mimetype.toLowerCase())) {
          const error = new Error(`File type '${mimetype}' is not allowed for security reasons`);
          (error as any).code = 'SECURITY_VIOLATION';
          (error as any).userAction = 'Please upload only ZIP or CBZ files containing images';
          return cb(error);
        }
        
        if (!allowedMimeTypes.includes(mimetype)) {
          // Log for debugging but still allow if extension is correct (browsers are inconsistent with MIME types)
          console.warn(`[Security] Unusual MIME type for ZIP file: ${mimetype}, filename: ${originalname}`);
          
          // Additional validation: reject if both extension and MIME type are suspicious
          if (!ext.match(/\.(zip|cbz)$/i)) {
            const error = new Error(`Invalid file type. Expected ZIP/CBZ, received: ${mimetype}`);
            (error as any).code = 'LIMIT_UNEXPECTED_FILE';
            (error as any).userAction = 'Please ensure you are uploading a valid ZIP or CBZ file';
            return cb(error);
          }
        }
        
        // Additional security: basic filename sanitization check
        const sanitizedName = path.basename(originalname);
        if (sanitizedName !== originalname) {
          const error = new Error('Filenames with directory paths are not allowed');
          (error as any).code = 'SECURITY_VIOLATION';
          (error as any).userAction = 'Please ensure the filename does not contain directory paths';
          return cb(error);
        }
        
        // Enhanced logging for security monitoring
        console.log(`[Security] Accepted file upload: ${originalname}, size: ${file.size || 'unknown'}, type: ${mimetype}`);
        
        // File passes all validation checks
        cb(null, true);
        
      } catch (error) {
        console.error('[Security] FileFilter error:', error);
        const filterError = new Error('File validation failed');
        (filterError as any).code = 'VALIDATION_ERROR';
        (filterError as any).userAction = 'Please try uploading the file again or contact support';
        cb(filterError);
      }
    }
  });

  // Standardized error classes for chapter upload
  class ChapterUploadError extends Error {
    constructor(
      public code: string,
      message: string,
      public userAction: string,
      public httpStatus: number = 400
    ) {
      super(message);
      this.name = 'ChapterUploadError';
    }
  }

  class SecurityError extends ChapterUploadError {
    constructor(message: string, userAction: string) {
      super('SECURITY_VIOLATION', message, userAction, 400);
      this.name = 'SecurityError';
    }
  }

  class ValidationError extends ChapterUploadError {
    constructor(message: string, userAction: string) {
      super('VALIDATION_FAILED', message, userAction, 400);
      this.name = 'ValidationError';
    }
  }

  class ExtractionError extends ChapterUploadError {
    constructor(message: string, userAction: string) {
      super('EXTRACTION_FAILED', message, userAction, 500);
      this.name = 'ExtractionError';
    }
  }

  // Centralized error response helper
  const sendChapterUploadError = (res: any, requestId: string, error: any) => {
    // Handle standardized chapter upload errors
    if (error instanceof ChapterUploadError) {
      return res.status(error.httpStatus).json({
        requestId,
        code: error.code,
        message: error.message,
        details: {
          userAction: error.userAction,
          errorType: error.name
        },
        timestamp: new Date().toISOString()
      });
    }

    // CRITICAL FIX: Handle database constraint violations from storage.createChapter
    if (error.code === 'DUPLICATE_CHAPTER' && error.statusCode === 409) {
      return res.status(409).json({
        requestId,
        code: error.code,
        message: error.message,
        details: {
          ...error.details,
          errorType: 'ConstraintViolation'
        },
        timestamp: new Date().toISOString()
      });
    }

    // Enhanced Zod validation error handling
    if (error.name === 'ZodError' || error.issues) {
      const zodIssues = error.issues || error.errors || [];
      const detailedErrors = zodIssues.map((issue: any) => {
        const fieldPath = issue.path?.join('.') || 'unknown';
        let userFriendlyMessage = issue.message;
        let actionRequired = 'Please correct this field and try again';
        
        // Provide more specific user actions based on field and error type
        switch (fieldPath) {
          case 'seriesId':
            actionRequired = 'Please select a valid series from the dropdown';
            userFriendlyMessage = 'Series ID is required or invalid';
            break;
          case 'chapterNumber':
            actionRequired = 'Please enter a valid chapter number (e.g., "1", "1.5", "2")';
            userFriendlyMessage = 'Chapter number must be provided and cannot be empty';
            break;
          case 'title':
            actionRequired = 'Please enter a chapter title or leave blank for auto-generation';
            break;
          case 'pages':
            actionRequired = 'Please ensure your ZIP file contains valid image files';
            userFriendlyMessage = 'No valid pages found in uploaded file';
            break;
          default:
            if (issue.code === 'invalid_type') {
              actionRequired = `Please provide a valid ${issue.expected} value for ${fieldPath}`;
            } else if (issue.code === 'too_small') {
              actionRequired = `Please provide a larger value for ${fieldPath}`;
            } else if (issue.code === 'too_big') {
              actionRequired = `Please provide a smaller value for ${fieldPath}`;
            }
        }

        return {
          field: fieldPath,
          message: userFriendlyMessage,
          code: issue.code,
          expected: issue.expected,
          received: issue.received,
          action: actionRequired
        };
      });

      return res.status(400).json({
        requestId,
        code: 'VALIDATION_FAILED',
        message: 'Chapter data validation failed',
        details: {
          validationErrors: detailedErrors,
          fieldCount: detailedErrors.length,
          summary: `${detailedErrors.length} validation error${detailedErrors.length !== 1 ? 's' : ''} found`
        },
        timestamp: new Date().toISOString()
      });
    }

    // Handle Multer errors
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        requestId,
        code: 'FILE_TOO_LARGE',
        message: 'Uploaded file exceeds size limit',
        details: {
          maxSize: '50MB',
          action: 'Please upload a smaller ZIP file',
          tip: 'Try compressing your images or reducing image quality'
        },
        timestamp: new Date().toISOString()
      });
    }

    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        requestId,
        code: 'INVALID_FILE_TYPE',
        message: 'Invalid file type uploaded',
        details: {
          allowedTypes: ['ZIP', 'CBZ'],
          action: 'Please upload a ZIP or CBZ file only',
          tip: 'Ensure your file has the correct extension (.zip or .cbz)'
        },
        timestamp: new Date().toISOString()
      });
    }

    // Generic error handling
    console.error('[chapter-upload] Unexpected error:', error);
    return res.status(500).json({
      requestId,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred during upload',
      details: {
        action: 'Please try again. If the issue persists, contact support',
        errorId: requestId
      },
      timestamp: new Date().toISOString()
    });
  };

  // Helper function to validate ZIP file header (magic bytes)
  const validateZipFile = async (zipPath: string): Promise<boolean> => {
    try {
      const buffer = Buffer.alloc(4);
      const fd = await fsp.open(zipPath, 'r');
      await fd.read(buffer, 0, 4, 0);
      await fd.close();
      
      // Check for ZIP magic bytes: PK\x03\x04
      return buffer[0] === 0x50 && buffer[1] === 0x4B && 
             buffer[2] === 0x03 && buffer[3] === 0x04;
    } catch {
      return false;
    }
  };

  // Helper function to validate image file magic bytes with comprehensive format support
  const validateImageMagicBytes = (buffer: Buffer, filename: string): { isValid: boolean; detectedType: string | null; error?: string } => {
    if (!buffer || buffer.length < 4) {
      return { 
        isValid: false, 
        detectedType: null, 
        error: 'File too small or corrupted' 
      };
    }
    
    // JPEG: FF D8 FF (more robust check)
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      // Additional JPEG validation - check for valid markers
      const hasValidJpegMarker = buffer.length >= 4;
      return { 
        isValid: hasValidJpegMarker, 
        detectedType: 'JPEG',
        error: hasValidJpegMarker ? undefined : 'Invalid JPEG header'
      };
    }
    
    // PNG: 89 50 4E 47 0D 0A 1A 0A (full PNG signature)
    if (buffer.length >= 8 &&
        buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
        buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A) {
      return { 
        isValid: true, 
        detectedType: 'PNG' 
      };
    }
    
    // WebP: RIFF...WEBP (enhanced validation)
    if (buffer.length >= 12 && 
        buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      return { 
        isValid: true, 
        detectedType: 'WebP' 
      };
    }
    
    // GIF: GIF87a or GIF89a
    if (buffer.length >= 6 &&
        buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 &&
        buffer[3] === 0x38 && (buffer[4] === 0x37 || buffer[4] === 0x38) && buffer[5] === 0x61) {
      return { 
        isValid: true, 
        detectedType: buffer[4] === 0x37 ? 'GIF87a' : 'GIF89a' 
      };
    }
    
    // AVIF: Check for ftyp box with 'avif' brand
    if (buffer.length >= 12 &&
        buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70 && // 'ftyp'
        buffer[8] === 0x61 && buffer[9] === 0x76 && buffer[10] === 0x69 && buffer[11] === 0x66) { // 'avif'
      return { 
        isValid: true, 
        detectedType: 'AVIF' 
      };
    }
    
    // BMP: 'BM' at start
    if (buffer.length >= 2 &&
        buffer[0] === 0x42 && buffer[1] === 0x4D) {
      return { 
        isValid: true, 
        detectedType: 'BMP' 
      };
    }
    
    // TIFF: 'II*\0' (little-endian) or 'MM\0*' (big-endian)
    if (buffer.length >= 4) {
      // Little-endian TIFF
      if (buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2A && buffer[3] === 0x00) {
        return { 
          isValid: true, 
          detectedType: 'TIFF (LE)' 
        };
      }
      // Big-endian TIFF
      if (buffer[0] === 0x4D && buffer[1] === 0x4D && buffer[2] === 0x00 && buffer[3] === 0x2A) {
        return { 
          isValid: true, 
          detectedType: 'TIFF (BE)' 
        };
      }
    }
    
    // Detect common non-image file types to provide helpful error messages
    let detectedType = 'Unknown';
    if (buffer.length >= 4) {
      // PDF
      if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
        detectedType = 'PDF';
      }
      // ZIP/RAR archives
      else if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
        detectedType = 'ZIP archive';
      }
      else if (buffer[0] === 0x52 && buffer[1] === 0x61 && buffer[2] === 0x72) {
        detectedType = 'RAR archive';
      }
      // Text files
      else if (buffer.every(byte => byte >= 0x20 && byte <= 0x7E || byte === 0x09 || byte === 0x0A || byte === 0x0D)) {
        detectedType = 'Text file';
      }
      // Executables
      else if (buffer[0] === 0x4D && buffer[1] === 0x5A) {
        detectedType = 'Executable (PE)';
      }
      else if (buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46) {
        detectedType = 'Executable (ELF)';
      }
    }
    
    return { 
      isValid: false, 
      detectedType,
      error: `File '${filename}' is not a valid image file. Detected type: ${detectedType}. Only JPEG, PNG, WebP, GIF, AVIF, BMP, and TIFF images are allowed.`
    };
  };

  // Helper function to detect symlinks and hardlinks using filesystem checks
  const detectSymlinksAndHardlinks = async (filePath: string): Promise<{ isSafe: boolean; type?: string; error?: string }> => {
    try {
      const stats = await fsp.lstat(filePath); // lstat doesn't follow symlinks
      
      // Check for symbolic links
      if (stats.isSymbolicLink()) {
        return { 
          isSafe: false, 
          type: 'symlink', 
          error: `Symbolic link detected: ${path.basename(filePath)}. Symlinks are not allowed for security reasons.` 
        };
      }
      
      // Check for hardlinks (nlink > 1 means multiple hard links to the same inode)
      if (stats.nlink > 1) {
        return { 
          isSafe: false, 
          type: 'hardlink', 
          error: `Hard link detected: ${path.basename(filePath)}. Hard links are not allowed for security reasons.` 
        };
      }
      
      // Additional security: Ensure it's a regular file
      if (!stats.isFile()) {
        return { 
          isSafe: false, 
          type: 'special', 
          error: `Special file type detected: ${path.basename(filePath)}. Only regular files are allowed.` 
        };
      }
      
      return { isSafe: true };
    } catch (error) {
      return { 
        isSafe: false, 
        type: 'error', 
        error: `Failed to analyze file: ${path.basename(filePath)}. ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  };

  // Helper function to sanitize and validate file paths (Zip Slip protection)
  const sanitizeZipPath = (entryPath: string, baseDir: string): string | null => {
    // Remove any directory traversal attempts
    const normalizedPath = path.normalize(entryPath).replace(/^(\.\.[\/\\])+/, '');
    
    // Get just the filename (no directories from ZIP)
    const filename = path.basename(normalizedPath);
    
    // Validate filename length and characters
    if (filename.length === 0 || filename.length > ZIP_LIMITS.MAX_FILENAME_LENGTH) {
      return null;
    }
    
    // Check for dangerous characters
    if (/[<>:"|?*\x00-\x1f]/.test(filename) || filename === '.' || filename === '..') {
      return null;
    }
    
    // Construct safe output path
    const outputPath = path.join(baseDir, filename);
    
    // Verify the resolved path is still within baseDir (final Zip Slip check)
    if (!outputPath.startsWith(baseDir + path.sep) && outputPath !== baseDir) {
      return null;
    }
    
    return outputPath;
  };

  // Secure ZIP extraction with proper limits and validation
  const extractChapterZip = async (zipPath: string, seriesId: string, chapterNumber: string): Promise<ExtractionResult> => {
    // Get series information to use title for folder structure
    const seriesInfo = await storage.getSeries(seriesId);
    if (!seriesInfo) {
      throw new ValidationError('Series not found', 'The specified series does not exist');
    }
    const mangaName = sanitizeMangaName(seriesInfo.title);
    // Validate ZIP file magic bytes first
    if (!(await validateZipFile(zipPath))) {
      throw new ValidationError('Invalid ZIP file format', 'Please ensure you are uploading a valid ZIP or CBZ file');
    }

    const tempDir = path.join(chaptersUploadDir, 'temp', `${Date.now()}-${Math.random()}`);
    const finalDir = path.join(process.cwd(), 'uploads', 'manga', mangaName, 'chapters', chapterNumber);
    
    let zipfile: any = null;
    let tempDirCreated = false;
    const cleanupResources = async () => {
      // Close ZIP file handle to prevent resource leaks
      if (zipfile) {
        try {
          zipfile.close();
        } catch (e) {
          console.error('[cleanup] Error closing ZIP file:', e);
        }
        zipfile = null;
      }
      
      // Remove temporary directory
      if (tempDirCreated) {
        try {
          await fsp.rm(tempDir, { recursive: true, force: true });
        } catch (e) {
          console.error('[cleanup] Error removing temp directory:', e);
        }
        tempDirCreated = false;
      }
    };
    
    try {
      // Create temporary extraction directory
      await fsp.mkdir(tempDir, { recursive: true });
      tempDirCreated = true;
      
      const imageFiles: Array<{ path: string; originalName: string; size: number }> = [];
      let totalUncompressedSize = 0;
      let entryCount = 0;

      // Extract ZIP with security checks
      await new Promise<void>((resolve, reject) => {
        yauzl.open(zipPath, { lazyEntries: true }, (err, zf) => {
          if (err) return reject(err);
          
          zipfile = zf;
          
          const cleanup = () => {
            if (zipfile) {
              try {
                zipfile.close();
              } catch (e) {
                console.error('[cleanup] Error closing ZIP file in handler:', e);
              }
              zipfile = null;
            }
          };

          zipfile.readEntry();
          
          zipfile.on("entry", (entry: any) => {
            entryCount++;
            
            // Check entry count limit
            if (entryCount > ZIP_LIMITS.MAX_ENTRIES) {
              cleanup();
              return reject(new SecurityError(
                `ZIP contains too many files (${entryCount} > ${ZIP_LIMITS.MAX_ENTRIES})`,
                `Please limit your ZIP file to ${ZIP_LIMITS.MAX_ENTRIES} files or fewer`
              ));
            }
            
            // Skip directories
            if (/\/$/.test(entry.fileName)) {
              zipfile.readEntry();
              return;
            }
            
            // Enhanced symlink/hardlink detection will be done after extraction
            
            // Check uncompressed size limit
            if (entry.uncompressedSize > ZIP_LIMITS.MAX_FILE_SIZE) {
              cleanup();
              return reject(new SecurityError(
                `File too large: ${entry.fileName} (${entry.uncompressedSize} bytes > ${ZIP_LIMITS.MAX_FILE_SIZE} bytes)`,
                `Please ensure all files are smaller than ${Math.round(ZIP_LIMITS.MAX_FILE_SIZE / (1024 * 1024))}MB`
              ));
            }
            
            totalUncompressedSize += entry.uncompressedSize;
            if (totalUncompressedSize > ZIP_LIMITS.MAX_TOTAL_SIZE) {
              cleanup();
              return reject(new SecurityError(
                `ZIP total size exceeds limit (${totalUncompressedSize} bytes > ${ZIP_LIMITS.MAX_TOTAL_SIZE} bytes)`,
                `Please reduce the total size of your ZIP file to under ${Math.round(ZIP_LIMITS.MAX_TOTAL_SIZE / (1024 * 1024))}MB`
              ));
            }
            
            // Check file extension
            const ext = path.extname(entry.fileName).toLowerCase();
            if (!ZIP_LIMITS.ALLOWED_EXTENSIONS.includes(ext)) {
              zipfile.readEntry();
              return;
            }
            
            // Sanitize path (Zip Slip protection)
            const safePath = sanitizeZipPath(entry.fileName, tempDir);
            if (!safePath) {
              zipfile.readEntry();
              return;
            }
            
            // Extract file securely
            zipfile.openReadStream(entry, (err: any, readStream: any) => {
              if (err) {
                cleanup();
                return reject(err);
              }
              
              const writeStream = createWriteStream(safePath);
              let bytesWritten = 0;
              let fileBuffer = Buffer.alloc(0);
              let magicBytesValidated = false;
              
              readStream.on('data', (chunk: Buffer) => {
                bytesWritten += chunk.length;
                if (bytesWritten > ZIP_LIMITS.MAX_FILE_SIZE) {
                  writeStream.destroy();
                  // Clean up partial file
                  fsp.unlink(safePath).catch(() => {});
                  cleanup();
                  return reject(new SecurityError(
                    `File size exceeded during extraction: ${entry.fileName}`,
                    `Please ensure all files are smaller than ${Math.round(ZIP_LIMITS.MAX_FILE_SIZE / (1024 * 1024))}MB`
                  ));
                }
                
                // Enhanced image magic bytes validation from first chunk(s)
                if (!magicBytesValidated) {
                  fileBuffer = Buffer.concat([fileBuffer, chunk]);
                  if (fileBuffer.length >= 12) { // Enough bytes to check all image types
                    const validationResult = validateImageMagicBytes(fileBuffer, entry.fileName);
                    if (!validationResult.isValid) {
                      writeStream.destroy();
                      // Clean up partial file
                      fsp.unlink(safePath).catch(() => {});
                      cleanup();
                      return reject(new ValidationError(
                        validationResult.error || `Invalid image file format: ${entry.fileName}`,
                        'Please ensure all files in the ZIP are valid images (JPEG, PNG, WebP, GIF)'
                      ));
                    }
                    magicBytesValidated = true;
                  }
                }
              });
              
              readStream.on('error', (err: any) => {
                writeStream.destroy();
                // Clean up partial file
                fsp.unlink(safePath).catch(() => {});
                cleanup();
                reject(err);
              });
              
              writeStream.on('error', (err: any) => {
                // Clean up partial file
                fsp.unlink(safePath).catch(() => {});
                cleanup();
                reject(err);
              });
              
              writeStream.on('close', async () => {
                try {
                  // Final validation for small files that might not have triggered validation during streaming
                  if (!magicBytesValidated && fileBuffer.length > 0) {
                    const validationResult = validateImageMagicBytes(fileBuffer, entry.fileName);
                    if (!validationResult.isValid) {
                      // Clean up partial file
                      await fsp.unlink(safePath).catch(() => {});
                      cleanup();
                      return reject(new ValidationError(
                        validationResult.error || `Invalid image file format: ${entry.fileName}`,
                        'Please ensure all files in the ZIP are valid images (JPEG, PNG, WebP, GIF)'
                      ));
                    }
                  }
                  
                  // Enhanced security: Check for symlinks, hardlinks, and file type after extraction
                  const linkCheck = await detectSymlinksAndHardlinks(safePath);
                  if (!linkCheck.isSafe) {
                    // Clean up the file
                    await fsp.unlink(safePath).catch(() => {});
                    cleanup();
                    return reject(new SecurityError(
                      linkCheck.error || `Security violation detected: ${entry.fileName}`,
                      'Please remove any symbolic links, hard links, or special files from your ZIP archive'
                    ));
                  }
                  
                  // Final file size validation (additional check)
                  const finalStats = await fsp.stat(safePath);
                  if (finalStats.size > ZIP_LIMITS.MAX_FILE_SIZE) {
                    await fsp.unlink(safePath).catch(() => {});
                    cleanup();
                    return reject(new SecurityError(
                      `Extracted file size exceeds limit: ${entry.fileName} (${finalStats.size} bytes)`,
                      `Please ensure all files are smaller than ${Math.round(ZIP_LIMITS.MAX_FILE_SIZE / (1024 * 1024))}MB`
                    ));
                  }
                  
                  imageFiles.push({
                    path: safePath,
                    originalName: entry.fileName,
                    size: finalStats.size
                  });
                  zipfile.readEntry();
                } catch (error) {
                  // Clean up on any validation error
                  await fsp.unlink(safePath).catch(() => {});
                  cleanup();
                  reject(error);
                }
              });
              
              readStream.pipe(writeStream);
            });
          });
          
          zipfile.on("end", () => {
            cleanup();
            resolve();
          });
          
          zipfile.on("error", (err: any) => {
            cleanup();
            reject(err);
          });
        });
      });

      if (imageFiles.length === 0) {
        throw new ValidationError(
          'No valid images found in ZIP file',
          'Please ensure your ZIP file contains valid image files (JPEG, PNG, WebP, GIF)'
        );
      }

      // Sort files using robust natural sorting with confidence scoring
      const sortResult = naturalSortWithConfidence(imageFiles);
      const sortedImageFiles = sortResult.sortedFiles;
      
      console.log(`[${Date.now()}] Natural sort result:`, {
        confidence: sortResult.confidence,
        requiresManualReorder: sortResult.requiresManualReorder,
        totalFiles: sortResult.metadata.totalFiles,
        hasNumericSequences: sortResult.metadata.hasNumericSequences,
        sequentialNumbers: sortResult.metadata.sequentialNumbers,
        gapCount: sortResult.metadata.gapCount
      });

      // Rename files to sequential order in temp directory first
      const imageUrls: string[] = [];
      const reorderedFiles: string[] = [];
      let coverImageUrl = '';
      
      for (let i = 0; i < sortedImageFiles.length; i++) {
        const file = sortedImageFiles[i];
        const ext = path.extname(file.originalName).toLowerCase();
        const finalFileName = `page-${String(i + 1).padStart(3, '0')}${ext}`;
        const reorderedPath = path.join(tempDir, finalFileName);
        
        // Move file to ordered name within temp directory
        await fsp.rename(file.path, reorderedPath);
        reorderedFiles.push(reorderedPath);
        
        const imageUrl = `/uploads/chapters/${seriesId}/${chapterNumber}/${finalFileName}`;
        imageUrls.push(imageUrl);
        
        // First image becomes the chapter cover
        if (i === 0) {
          coverImageUrl = imageUrl;
        }
      }

      // Atomic replacement with rollback capability
      const backupDir = `${finalDir}.backup-${Date.now()}`;
      let backupCreated = false;
      
      try {
        await fsp.mkdir(path.dirname(finalDir), { recursive: true });
        
        // If final directory exists, backup it first
        try {
          await fsp.access(finalDir);
          await fsp.rename(finalDir, backupDir);
          backupCreated = true;
        } catch (e) {
          // Final directory doesn't exist, no backup needed
        }
        
        // Atomic move: rename temp to final
        await fsp.rename(tempDir, finalDir);
        tempDirCreated = false; // Successfully moved
        
        // Clean up backup after successful replacement
        if (backupCreated) {
          await fsp.rm(backupDir, { recursive: true, force: true });
          backupCreated = false;
        }
        
      } catch (atomicError) {
        // Rollback: restore from backup if it exists
        if (backupCreated) {
          try {
            await fsp.rename(backupDir, finalDir);
          } catch (rollbackError) {
            console.error('[atomic-rollback] Failed to restore backup:', rollbackError);
          }
        }
        throw atomicError;
      }
      
      return { 
        imageUrls, 
        coverImageUrl,
        naturalSortConfidence: sortResult.confidence,
        requiresManualReorder: sortResult.requiresManualReorder
      };
      
    } catch (error) {
      // Always cleanup resources on any error
      await cleanupResources();
      throw error;
    } finally {
      // Final safety cleanup (should be no-op if successful)
      await cleanupResources();
      
      // Always clean up the ZIP file
      try {
        await fsp.unlink(zipPath);
      } catch (unlinkError) {
        console.warn('Failed to delete ZIP file:', unlinkError);
      }
    }
  };

  // Helper function: Extract ZIP and upload to App Storage
  const extractChapterZipToStaging = async (zipPath: string, seriesId: string, chapterNumber: string, requestId: string): Promise<ExtractionResult> => {
    // Get series information to use title for folder structure
    const seriesInfo = await storage.getSeries(seriesId);
    if (!seriesInfo) {
      throw new ValidationError('Series not found', 'The specified series does not exist');
    }
    const mangaName = sanitizeMangaName(seriesInfo.title);

    // Validate ZIP file magic bytes first
    if (!(await validateZipFile(zipPath))) {
      throw new ValidationError('Invalid ZIP file format', 'Please ensure you are uploading a valid ZIP or CBZ file');
    }

    const { uploadImage } = await import("./storage/local-storage");
    
    let zipfile: any = null;
    
    const cleanupZip = async () => {
      if (zipfile) {
        try {
          zipfile.close();
        } catch (e) {
          console.error('[cleanup] Error closing ZIP file:', e);
        }
        zipfile = null;
      }
    };

    try {
      const imageFiles: Array<{ path: string; buffer: Buffer; originalName: string; size: number }> = [];
      let totalUncompressedSize = 0;
      let entryCount = 0;

      // Extract ZIP with security checks - collect files in memory
      await new Promise<void>((resolve, reject) => {
        yauzl.open(zipPath, { lazyEntries: true }, (err, zf) => {
          if (err) return reject(err);
          
          zipfile = zf;
          
          const cleanup = () => {
            if (zipfile) {
              try {
                zipfile.close();
              } catch (e) {
                console.error('[cleanup] Error closing ZIP file in handler:', e);
              }
              zipfile = null;
            }
          };

          zipfile.readEntry();
          
          zipfile.on("entry", (entry: any) => {
            entryCount++;
            
            // Check entry count limit
            if (entryCount > ZIP_LIMITS.MAX_ENTRIES) {
              cleanup();
              return reject(new SecurityError(
                `ZIP contains too many files (${entryCount} > ${ZIP_LIMITS.MAX_ENTRIES})`,
                `Please limit your ZIP file to ${ZIP_LIMITS.MAX_ENTRIES} files or fewer`
              ));
            }
            
            // Skip directories
            if (/\/$/.test(entry.fileName)) {
              zipfile.readEntry();
              return;
            }
            
            // Check uncompressed size limit
            if (entry.uncompressedSize > ZIP_LIMITS.MAX_FILE_SIZE) {
              cleanup();
              return reject(new SecurityError(
                `File too large: ${entry.fileName} (${entry.uncompressedSize} bytes > ${ZIP_LIMITS.MAX_FILE_SIZE} bytes)`,
                `Please ensure all files are smaller than ${Math.round(ZIP_LIMITS.MAX_FILE_SIZE / (1024 * 1024))}MB`
              ));
            }
            
            totalUncompressedSize += entry.uncompressedSize;
            if (totalUncompressedSize > ZIP_LIMITS.MAX_TOTAL_SIZE) {
              cleanup();
              return reject(new SecurityError(
                `ZIP total size exceeds limit (${totalUncompressedSize} bytes > ${ZIP_LIMITS.MAX_TOTAL_SIZE} bytes)`,
                `Please reduce the total size of your ZIP file to under ${Math.round(ZIP_LIMITS.MAX_TOTAL_SIZE / (1024 * 1024))}MB`
              ));
            }
            
            // Check file extension
            const ext = path.extname(entry.fileName).toLowerCase();
            if (!ZIP_LIMITS.ALLOWED_EXTENSIONS.includes(ext)) {
              zipfile.readEntry();
              return;
            }
            
            // Extract file to memory
            zipfile.openReadStream(entry, (err: any, readStream: any) => {
              if (err) {
                cleanup();
                return reject(err);
              }
              
              const chunks: Buffer[] = [];
              let bytesRead = 0;
              let fileBuffer = Buffer.alloc(0);
              let magicBytesValidated = false;
              
              readStream.on('data', (chunk: Buffer) => {
                bytesRead += chunk.length;
                if (bytesRead > ZIP_LIMITS.MAX_FILE_SIZE) {
                  readStream.destroy();
                  cleanup();
                  return reject(new SecurityError(
                    `File size exceeded during extraction: ${entry.fileName}`,
                    `Please ensure all files are smaller than ${Math.round(ZIP_LIMITS.MAX_FILE_SIZE / (1024 * 1024))}MB`
                  ));
                }
                
                // Enhanced image magic bytes validation from first chunk(s)
                if (!magicBytesValidated) {
                  fileBuffer = Buffer.concat([fileBuffer, chunk]);
                  if (fileBuffer.length >= 12) {
                    const validationResult = validateImageMagicBytes(fileBuffer, entry.fileName);
                    if (!validationResult.isValid) {
                      readStream.destroy();
                      cleanup();
                      return reject(new ValidationError(
                        validationResult.error || `Invalid image file format: ${entry.fileName}`,
                        'Please ensure all files in the ZIP are valid images (JPEG, PNG, WebP, GIF)'
                      ));
                    }
                    magicBytesValidated = true;
                  }
                }
                
                chunks.push(chunk);
              });
              
              readStream.on('error', (err: any) => {
                cleanup();
                reject(err);
              });
              
              readStream.on('end', () => {
                const buffer = Buffer.concat(chunks);
                imageFiles.push({
                  path: entry.fileName,
                  buffer,
                  originalName: entry.fileName,
                  size: buffer.length
                });
                zipfile.readEntry();
              });
            });
          });
          
          zipfile.on("end", () => {
            cleanup();
            resolve();
          });
          
          zipfile.on("error", (err: any) => {
            cleanup();
            reject(err);
          });
        });
      });

      // Sort files using robust natural sorting with confidence scoring
      const sortResult = naturalSortWithConfidence(imageFiles);
      const sortedImageFiles = sortResult.sortedFiles;
      
      console.log(`[${requestId}] Natural sort result:`, {
        confidence: sortResult.confidence,
        requiresManualReorder: sortResult.requiresManualReorder,
        totalFiles: sortResult.metadata.totalFiles
      });

      // Upload images to App Storage and create image URLs
      const imageUrls: string[] = [];
      let coverImageUrl = '';
      
      for (let i = 0; i < sortedImageFiles.length; i++) {
        const file = sortedImageFiles[i];
        const ext = path.extname(file.originalName).toLowerCase();
        const finalFileName = `${mangaName}-ch${chapterNumber}-page${String(i + 1).padStart(3, '0')}${ext}`;
        
        // Upload to App Storage
        await uploadImage((file as any).buffer, finalFileName, 'chapters');
        
        // Create image URL pointing to App Storage endpoint
        const imageUrl = `/api/chapters/image/${finalFileName}`;
        imageUrls.push(imageUrl);

        if (i === 0) {
          coverImageUrl = imageUrl;
        }
      }
      
      return { 
        imageUrls, 
        coverImageUrl,
        naturalSortConfidence: sortResult.confidence,
        requiresManualReorder: sortResult.requiresManualReorder
      } as ExtractionResult;
      
    } catch (error) {
      await cleanupZip();
      throw error;
    }
  };

  // Helper function: Atomically commit staging to final location
  const commitStagingToFinal = async (stagingDir: string, finalDir: string, requestId: string): Promise<void> => {
    const backupDir = `${finalDir}.backup-${Date.now()}`;
    let backupCreated = false;
    
    try {
      await fsp.mkdir(path.dirname(finalDir), { recursive: true });
      
      // If final directory exists, backup it first
      try {
        await fsp.access(finalDir);
        await fsp.rename(finalDir, backupDir);
        backupCreated = true;
        console.log(`[${requestId}] Backed up existing directory to ${backupDir}`);
      } catch (accessError) {
        // Final directory doesn't exist, no backup needed
      }
      
      // Atomic move from staging to final
      await fsp.rename(stagingDir, finalDir);
      console.log(`[${requestId}] Committed staging to final location`);
      
      // Remove backup if commit was successful
      if (backupCreated) {
        await fsp.rm(backupDir, { recursive: true, force: true });
      }
      
    } catch (commitError) {
      // Rollback: restore from backup if it exists
      if (backupCreated) {
        try {
          await fsp.rename(backupDir, finalDir);
          console.log(`[${requestId}] Restored from backup after commit failure`);
        } catch (rollbackError) {
          console.error(`[${requestId}] CRITICAL: Failed to restore backup:`, rollbackError);
        }
      }
      throw commitError;
    }
  };

  // Atomic chapter upload with App Storage
  const atomicChapterUpload = async (requestId: string, zipPath: string, chapterData: any, userId?: string): Promise<any> => {
    let databaseChapterId: string | null = null;
    
    try {
      console.log(`[${requestId}] Starting atomic chapter upload to App Storage`);
      
      // Update progress: Starting extraction
      updateProgress(requestId, {
        status: 'extracting',
        progress: 30,
        message: 'Extracting and uploading ZIP file to App Storage...'
      });
      
      // Phase 1: Extract and upload to App Storage
      console.log(`[${requestId}] Phase 1: Extracting and uploading to App Storage`);
      const extractionResult = await extractChapterZipToStaging(zipPath, chapterData.seriesId, chapterData.chapterNumber, requestId);
      
      // Update progress: Extraction complete, validating images
      updateProgress(requestId, {
        status: 'processing',
        progress: 60,
        message: 'Files uploaded to App Storage successfully, validating...',
        totalFiles: extractionResult.imageUrls?.length || 0,
        processedFiles: extractionResult.imageUrls?.length || 0
      });
      
      // Validate extracted images
      const { imageUrls, coverImageUrl } = extractionResult;
      if (!imageUrls || imageUrls.length === 0) {
        throw new ValidationError(
          "No valid images found in ZIP file",
          "Please ensure your ZIP file contains valid image files (JPEG, PNG, WebP, GIF)"
        );
      }

      // Parse chapter data with schema validation including natural sort metadata
      const parsedChapterData = insertChapterSchema.parse({
        ...chapterData,
        pages: imageUrls,
        coverImageUrl,
        requiresManualReorder: extractionResult.requiresManualReorder ? "true" : "false",
        naturalSortConfidence: extractionResult.naturalSortConfidence.toString(),
      });

      // Update progress: Creating database record
      updateProgress(requestId, {
        status: 'finalizing',
        progress: 90,
        message: 'Creating database record...',
        totalFiles: imageUrls.length,
        processedFiles: imageUrls.length
      });

      // Phase 2: Create database record
      console.log(`[${requestId}] Phase 2: Creating database record with ${imageUrls.length} pages`);
      const newChapter = await storage.createChapter(parsedChapterData);
      databaseChapterId = newChapter.id;
      
      // Broadcast chapter creation event
      broadcast.chapter({
        chapterId: newChapter.id,
        seriesId: newChapter.seriesId,
        action: 'created',
        data: newChapter
      }, userId);
      
      console.log(`[${requestId}] Atomic upload completed successfully`);
      return {
        chapter: newChapter,
        extractionResult,
        success: true
      };
      
    } catch (error) {
      console.error(`[${requestId}] Atomic upload failed, initiating rollback:`, error);
      
      // Rollback database changes if chapter was created
      if (databaseChapterId) {
        try {
          console.log(`[${requestId}] Rolling back database: deleting chapter ${databaseChapterId}`);
          const rollbackSuccess = await storage.deleteChapter(databaseChapterId);
          if (rollbackSuccess) {
            console.log(`[${requestId}] Database rollback completed successfully`);
          } else {
            console.error(`[${requestId}] Database rollback failed: chapter not found`);
          }
        } catch (dbRollbackError) {
          console.error(`[${requestId}] CRITICAL: Database rollback failed:`, dbRollbackError);
        }
      }
      
      // Re-throw the original error
      throw error;
    }
  };

  // Chapter ZIP upload endpoint with error wrapper
  app.post("/api/admin/upload-chapter", uploadLimiter, isStaff, doubleCsrfProtection, (req, res, next) => {
    // Generate unique request ID for tracking
    const requestId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize progress tracking
    initializeProgress(requestId);
    
    // Attach request ID to request for use in next middleware
    (req as any).uploadId = requestId;
    
    // Wrap Multer to handle its errors consistently
    uploadChapterZip.single('zip')(req, res, (err) => {
      if (err) {
        updateProgress(requestId, {
          status: 'error',
          progress: 0,
          message: 'Upload failed',
          error: err.message
        });
        return sendChapterUploadError(res, requestId, err);
      }
      next();
    });
  }, async (req, res) => {
    // Use existing request ID from middleware
    const requestId = (req as any).uploadId;
    let extractionCompleted = false;
    let extractionStarted = false;
    let chapterCreated = false;
    let tempFilesCreated: string[] = [];
    
    try {
      console.log(`[${requestId}] Chapter upload request started`);
      
      // Update progress: File received
      updateProgress(requestId, {
        status: 'uploading',
        progress: 10,
        message: 'File uploaded successfully, validating...',
        details: {
          uploadedBytes: req.file ? req.file.size : 0,
          totalBytes: req.file ? req.file.size : 0
        }
      });
      
      if (!req.file) {
        updateProgress(requestId, {
          status: 'error',
          progress: 0,
          message: 'No file provided',
          error: 'No ZIP file provided'
        });
        return res.status(400).json({ 
          requestId,
          code: 'MISSING_FILE',
          message: "No ZIP file provided",
          details: {
            action: "Please select a ZIP file containing chapter images"
          }
        });
      }

      // Update progress: Validating inputs
      updateProgress(requestId, {
        status: 'processing',
        progress: 15,
        message: 'Validating upload parameters...'
      });

      // Input sanitization and validation
      let { seriesId, chapterNumber, title } = req.body;
      
      // Sanitize inputs
      seriesId = typeof seriesId === 'string' ? seriesId.trim() : '';
      chapterNumber = typeof chapterNumber === 'string' ? chapterNumber.trim() : '';
      title = typeof title === 'string' ? title.trim() : '';
      
      // Validate required fields
      if (!seriesId || !chapterNumber) {
        // Clean up uploaded file
        await fsp.unlink(req.file.path).catch(() => {});
        updateProgress(requestId, {
          status: 'error',
          progress: 0,
          message: 'Missing required fields',
          error: 'Series ID and chapter number are required'
        });
        return res.status(400).json({ 
          requestId,
          code: 'MISSING_REQUIRED_FIELDS',
          message: "Series ID and chapter number are required",
          details: {
            missingFields: {
              seriesId: !seriesId,
              chapterNumber: !chapterNumber
            },
            action: "Please provide both series ID and chapter number"
          }
        });
      }

      // Comprehensive input validation
      if (seriesId.length > 50) {
        await fsp.unlink(req.file.path).catch(() => {});
        return res.status(400).json({ 
          requestId,
          code: 'INVALID_SERIES_ID',
          message: "Series ID is too long",
          details: {
            maxLength: 50,
            action: "Please provide a valid series ID"
          }
        });
      }

      if (chapterNumber.length > 20) {
        await fsp.unlink(req.file.path).catch(() => {});
        return res.status(400).json({ 
          requestId,
          code: 'INVALID_CHAPTER_NUMBER',
          message: "Chapter number is too long",
          details: {
            maxLength: 20,
            action: "Please provide a valid chapter number (e.g., '1', '1.5', '2')"
          }
        });
      }

      if (title && title.length > 200) {
        await fsp.unlink(req.file.path).catch(() => {});
        return res.status(400).json({ 
          requestId,
          code: 'INVALID_TITLE_LENGTH',
          message: "Chapter title is too long",
          details: {
            maxLength: 200,
            action: "Please shorten the chapter title or leave it blank"
          }
        });
      }

      // PRE-EXTRACTION VALIDATIONS: Validate everything before creating any files
      console.log(`[${requestId}] Running pre-extraction validations`);
      
      // Validate that the series exists
      const series = await storage.getSeries(seriesId);
      if (!series) {
        await fsp.unlink(req.file.path).catch(() => {});
        return res.status(404).json({ 
          requestId,
          code: 'SERIES_NOT_FOUND',
          message: "Series not found",
          details: {
            seriesId,
            action: "Please verify the series ID exists and try again"
          }
        });
      }

      // Check for duplicate chapter BEFORE processing upload
      console.log(`[${requestId}] Checking for duplicate chapter: series=${seriesId}, chapter=${chapterNumber}`);
      const existingChapter = await storage.checkChapterExists(seriesId, chapterNumber);
      if (existingChapter) {
        await fsp.unlink(req.file.path).catch(() => {});
        return res.status(409).json({ 
          requestId,
          code: 'DUPLICATE_CHAPTER',
          message: `Chapter ${chapterNumber} already exists for this series`,
          details: {
            seriesId,
            chapterNumber,
            existingChapterId: existingChapter.id,
            action: "Please choose a different chapter number or update the existing chapter",
            suggestion: "Consider using a decimal number (e.g., '1.5') for special chapters"
          }
        });
      }

      console.log(`[${requestId}] Pre-extraction validations passed`);

      // Update progress: Validations complete, preparing for extraction
      updateProgress(requestId, {
        status: 'processing',
        progress: 25,
        message: 'Validation complete, preparing to extract files...'
      });

      // Get current user for uploadedBy field
      const currentUser = req.session.user;
      
      // Prepare chapter data for atomic upload
      const chapterDataTemplate = {
        seriesId,
        chapterNumber,
        title: title || undefined,
        isPublished: "true",
        uploadedBy: currentUser?.id || null,
      };

      // ASYNC REFACTOR: Return 202 immediately and process in background
      console.log(`[${requestId}] Validation complete, starting background processing`);
      
      // Return 202 Accepted with upload ID for client to start polling
      res.status(202).json({
        uploadId: requestId,
        message: "Upload accepted, processing in background",
        status: "processing"
      });

      // Start background processing (non-blocking)
      setImmediate(async () => {
        if (!req.file) {
          console.error(`[${requestId}] No file found in request`);
          updateProgress(requestId, {
            status: 'error',
            progress: 0,
            message: 'No file found in request',
            error: 'File upload failed - no file received'
          });
          return;
        }
        await processUploadInBackground(requestId, req.file.path, chapterDataTemplate, currentUser?.id);
      });
      
    } catch (error) {
      console.error(`[${requestId}] Error in upload validation:`, error);
      
      // Update progress: Error occurred
      updateProgress(requestId, {
        status: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Upload validation failed',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
      
      // Clean up uploaded file on validation error
      if (req.file) {
        try {
          await fsp.unlink(req.file.path);
          console.log(`[${requestId}] Cleaned up uploaded ZIP file after validation error`);
        } catch (cleanupError) {
          console.error(`[${requestId}] Error cleaning up ZIP file:`, cleanupError);
        }
      }
      
      // Use centralized error handling for validation errors
      return sendChapterUploadError(res, requestId, error);
    }
  });

  // Get a specific series/manga details (public endpoint)
  app.get("/api/series/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      const series = await storage.getSeries(id);
      if (!series) {
        return res.status(404).json({ message: "Series not found" });
      }

      res.json(series);
    } catch (error) {
      console.error("Error fetching series:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get chapters for a specific series (public endpoint - only published chapters with access control)
  app.get("/api/series/:seriesId/chapters", async (req, res) => {
    try {
      const { seriesId } = req.params;
      
      // Validate that the series exists
      const series = await storage.getSeries(seriesId);
      if (!series) {
        return res.status(404).json({ message: "Series not found" });
      }

      const allChapters = await storage.getChaptersBySeriesId(seriesId);
      
      // Filter to only show published chapters for public access
      const publishedChapters = allChapters.filter(chapter => chapter.isPublished === "true");
      
      // Check access control for each chapter and sanitize data
      const chaptersWithAccessInfo = await Promise.all(
        publishedChapters.map(async (chapter) => {
          // Get access control settings for this chapter
          const accessControl = await storage.getChapterAccessControl(chapter.id);
          
          // Default: chapter is free
          let hasAccess = true;
          let isLocked = false;
          let accessType = "free";
          let unlockCost = 0;
          
          // If there's access control and it's active
          if (accessControl && accessControl.isActive === "true" && accessControl.accessType !== "free") {
            accessType = accessControl.accessType;
            unlockCost = accessControl.unlockCost;
            
            // Check if user is authenticated
            if (req.session?.userId) {
              const testMode = (req.session as any).testMode || false;
              const accessCheck = await storage.checkUserChapterAccess(req.session.userId, chapter.id, testMode);
              hasAccess = accessCheck.canAccess;
              isLocked = !accessCheck.canAccess;
            } else {
              // Unauthenticated users don't have access to premium content
              hasAccess = false;
              isLocked = true;
            }
          }
          
          // Return chapter with access metadata
          // Remove pages array if user doesn't have access
          const chapterData: any = {
            ...chapter,
            isLocked,
            accessType,
            unlockCost,
          };
          
          // Only include pages if user has access
          if (!hasAccess) {
            delete chapterData.pages;
          }
          
          return chapterData;
        })
      );
      
      res.json(chaptersWithAccessInfo);
    } catch (error) {
      console.error("Error fetching chapters:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get a specific chapter (public endpoint - only if published and user has access)
  app.get("/api/chapters/:chapterId", async (req, res) => {
    try {
      const { chapterId } = req.params;
      
      const chapter = await storage.getChapter(chapterId);
      if (!chapter) {
        return res.status(404).json({ message: "Chapter not found" });
      }

      // Only allow access to published chapters for public endpoint
      if (chapter.isPublished !== "true") {
        return res.status(404).json({ message: "Chapter not found" });
      }

      // Check access control if user is authenticated
      if (req.session?.userId) {
        const testMode = (req.session as any).testMode || false;
        const accessCheck = await storage.checkUserChapterAccess(req.session.userId, chapterId, testMode);
        
        if (!accessCheck.canAccess) {
          return res.status(403).json({
            message: accessCheck.reason || "You don't have access to this chapter",
            accessType: accessCheck.accessType,
            unlockCost: accessCheck.unlockCost,
            isUnlocked: false
          });
        }
      } else {
        // For unauthenticated users, check if chapter is free
        const accessControl = await storage.getChapterAccessControl(chapterId);
        if (accessControl && accessControl.accessType !== "free" && accessControl.isActive === "true") {
          return res.status(401).json({
            message: "Please log in to access this chapter",
            accessType: accessControl.accessType,
            unlockCost: accessControl.unlockCost,
            requiresAuth: true
          });
        }
      }

      res.json(chapter);
    } catch (error) {
      console.error("Error fetching chapter:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get chapter access info (public endpoint for displaying lock status)
  app.get("/api/chapters/:chapterId/access-info", async (req, res) => {
    try {
      const { chapterId } = req.params;
      
      const chapter = await storage.getChapter(chapterId);
      if (!chapter) {
        return res.status(404).json({ message: "Chapter not found" });
      }

      const accessControl = await storage.getChapterAccessControl(chapterId);
      
      if (!accessControl || accessControl.accessType === "free" || accessControl.isActive === "false") {
        return res.json({
          accessType: "free",
          unlockCost: 0,
          isActive: false
        });
      }

      res.json({
        accessType: accessControl.accessType,
        unlockCost: accessControl.unlockCost,
        isActive: accessControl.isActive === "true"
      });
    } catch (error) {
      console.error("Error fetching chapter access info:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Search series (public endpoint)
  app.get("/api/search", async (req, res) => {
    try {
      const { q: query, genre, status, type, browse } = req.query;
      
      // Allow browse mode without specific parameters
      const isBrowseMode = browse === 'true';
      
      // Validate query parameter (unless in browse mode)
      if (!isBrowseMode && !query && !genre && !status && !type) {
        return res.status(400).json({ message: "At least one search parameter is required" });
      }
      
      // Ensure query is a string
      const searchQuery = typeof query === 'string' ? query : '';
      
      // Build filters object
      const filters: { genre?: string; status?: string; type?: string } = {};
      if (typeof genre === 'string' && genre) filters.genre = genre;
      if (typeof status === 'string' && status) filters.status = status;
      if (typeof type === 'string' && type) filters.type = type;
      
      const results = await storage.searchSeries(searchQuery, filters, isBrowseMode);
      
      res.json({
        query: searchQuery,
        filters,
        results,
        total: results.length
      });
    } catch (error) {
      console.error("Error searching series:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update chapter details (staff+)
  app.patch("/api/admin/chapters/:chapterId", isStaff, doubleCsrfProtection, async (req, res) => {
    try {
      const { chapterId } = req.params;
      const { title, isPublished } = req.body;
      
      // Validate chapter exists
      const existingChapter = await storage.getChapter(chapterId);
      if (!existingChapter) {
        return res.status(404).json({ message: "Chapter not found" });
      }

      // Update chapter
      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (isPublished !== undefined) updateData.isPublished = isPublished;

      const updatedChapter = await storage.updateChapter(chapterId, updateData);
      
      if (!updatedChapter) {
        return res.status(404).json({ message: "Chapter not found" });
      }

      // Broadcast chapter update event
      broadcast.chapter({
        chapterId,
        seriesId: updatedChapter.seriesId,
        action: 'updated',
        data: updatedChapter
      }, (req as any).session?.user?.id);

      res.json({
        message: "Chapter updated successfully",
        chapter: updatedChapter
      });
    } catch (error) {
      console.error("Error updating chapter:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete chapter (admin only)
  app.delete("/api/admin/chapters/:chapterId", adminAuth, doubleCsrfProtection, async (req, res) => {
    try {
      const { chapterId } = req.params;
      
      // Get chapter details before deletion for cleanup
      const chapter = await storage.getChapter(chapterId);
      if (!chapter) {
        return res.status(404).json({ message: "Chapter not found" });
      }

      // Delete chapter from database
      const deleted = await storage.deleteChapter(chapterId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Chapter not found" });
      }

      // Broadcast chapter deletion event
      broadcast.chapter({
        chapterId,
        seriesId: chapter.seriesId,
        action: 'deleted',
        data: { id: chapterId }
      }, (req as any).session?.user?.id);

      // Clean up chapter image files from local storage
      try {
        if (chapter.pages && Array.isArray(chapter.pages)) {
          console.log(`[cleanup] Deleting ${chapter.pages.length} chapter images from local storage...`);
          
          for (const pageUrl of chapter.pages) {
            try {
              const filename = pageUrl.replace('/api/chapters/image/', '');
              await deleteImage(filename);
              console.log(`[cleanup] Deleted chapter image: ${filename}`);
            } catch (deleteError) {
              console.warn(`[cleanup] Warning: Could not delete image ${pageUrl}:`, deleteError);
            }
          }
          
          console.log(`[cleanup] Chapter images cleanup completed`);
        }
      } catch (cleanupError) {
        console.warn("Warning: Could not clean up chapter files:", cleanupError);
        // Don't fail the deletion if file cleanup fails
      }

      res.json({ message: "Chapter deleted successfully" });
    } catch (error) {
      console.error("Error deleting chapter:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get chapters (admin only) - supports both all chapters and series-specific
  app.get("/api/admin/chapters", adminAuth, async (req, res) => {
    try {
      const { seriesId } = req.query;
      
      if (seriesId) {
        // Get chapters for a specific series
        if (typeof seriesId !== 'string') {
          return res.status(400).json({ message: "Invalid series ID" });
        }
        
        // Verify series exists
        const series = await storage.getSeries(seriesId);
        if (!series) {
          return res.status(404).json({ message: "Series not found" });
        }
        
        // Get chapters for this series
        const chapters = await storage.getChaptersBySeriesId(seriesId);
        res.json(chapters);
      } else {
        // Get all chapters
        const chapters = await storage.getAllChapters();
        res.json(chapters);
      }
    } catch (error) {
      console.error("Error fetching chapters:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get a specific chapter (admin only) - no access restrictions
  app.get("/api/admin/chapters/:chapterId", adminAuth, async (req, res) => {
    try {
      const { chapterId } = req.params;
      
      const chapter = await storage.getChapter(chapterId);
      if (!chapter) {
        return res.status(404).json({ message: "Chapter not found" });
      }

      res.json(chapter);
    } catch (error) {
      console.error("Error fetching chapter:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Check user's access to a chapter (authenticated)
  app.get("/api/chapters/:chapterId/access", async (req, res) => {
    try {
      const { chapterId } = req.params;
      
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const chapter = await storage.getChapter(chapterId);
      if (!chapter) {
        return res.status(404).json({ message: "Chapter not found" });
      }

      const testMode = (req.session as any).testMode || false;
      const accessCheck = await storage.checkUserChapterAccess(req.session.userId, chapterId, testMode);
      
      res.json({
        hasAccess: accessCheck.canAccess,
        accessType: accessCheck.accessType,
        unlockCost: accessCheck.unlockCost,
        isUnlocked: accessCheck.isUnlocked,
        testMode
      });
    } catch (error) {
      console.error("Error checking chapter access:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Unlock chapter with currency (authenticated, CSRF protected, rate limited)
  app.post("/api/chapters/:chapterId/unlock", doubleCsrfProtection, actionLimiter, async (req, res) => {
    try {
      const { chapterId } = req.params;
      
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const chapter = await storage.getChapter(chapterId);
      if (!chapter) {
        return res.status(404).json({ message: "Chapter not found" });
      }

      const accessControl = await storage.getChapterAccessControl(chapterId);
      if (!accessControl || accessControl.accessType === "free") {
        return res.status(400).json({ message: "This chapter is free" });
      }

      const alreadyUnlocked = await storage.hasUserUnlockedChapter(req.session.userId, chapterId);
      if (alreadyUnlocked) {
        return res.status(400).json({ message: "Chapter already unlocked" });
      }

      const result = await storage.unlockChapterForUser(
        req.session.userId, 
        chapterId, 
        accessControl.unlockCost
      );

      if (!result.success) {
        return res.status(400).json({ message: result.error || "Failed to unlock chapter" });
      }

      res.json({
        success: true,
        newBalance: result.newBalance,
        costPaid: accessControl.unlockCost
      });
    } catch (error) {
      console.error("Error unlocking chapter:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get chapter access control settings (admin only)
  app.get("/api/admin/chapters/:chapterId/access", adminAuth, async (req, res) => {
    try {
      const { chapterId } = req.params;

      const chapter = await storage.getChapter(chapterId);
      if (!chapter) {
        return res.status(404).json({ message: "Chapter not found" });
      }

      const accessControl = await storage.getChapterAccessControl(chapterId);
      
      if (!accessControl) {
        return res.json({
          chapterId,
          accessType: "free",
          unlockCost: 0,
          isActive: "true"
        });
      }

      res.json(accessControl);
    } catch (error) {
      console.error("Error fetching chapter access control:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Set chapter access control (admin only, CSRF protected, rate limited)
  app.post("/api/admin/chapters/:chapterId/access", adminAuth, doubleCsrfProtection, actionLimiter, async (req, res) => {
    try {
      const { chapterId } = req.params;
      
      const validatedData = updateChapterAccessControlSchema.parse(req.body);

      const chapter = await storage.getChapter(chapterId);
      if (!chapter) {
        return res.status(404).json({ message: "Chapter not found" });
      }

      if (!validatedData.accessType || validatedData.unlockCost === undefined) {
        return res.status(400).json({ message: "accessType and unlockCost are required" });
      }

      const accessControl = await storage.setChapterAccessControl(
        chapterId,
        validatedData.accessType,
        validatedData.unlockCost
      );

      res.json({
        success: true,
        accessControl
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error setting chapter access control:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Bulk update chapter access control
  app.post("/api/admin/chapters/bulk-access", adminAuth, doubleCsrfProtection, actionLimiter, async (req, res) => {
    try {
      const { chapterIds, accessType, unlockCost } = req.body;

      if (!chapterIds || !Array.isArray(chapterIds) || chapterIds.length === 0) {
        return res.status(400).json({ message: "chapterIds array is required" });
      }

      // Validate accessType and unlockCost using the schema
      const validatedData = updateChapterAccessControlSchema.parse({
        accessType,
        unlockCost
      });

      const results = [];
      for (const chapterId of chapterIds) {
        try {
          const accessControl = await storage.setChapterAccessControl(
            chapterId,
            validatedData.accessType ?? "free",
            validatedData.unlockCost ?? 0
          );
          results.push({ chapterId, success: true, accessControl });
        } catch (error) {
          results.push({ chapterId, success: false, error: error instanceof Error ? error.message : "Unknown error" });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      // Return appropriate status based on results
      if (successCount === 0) {
        return res.status(400).json({
          success: false,
          message: "All updates failed",
          results
        });
      }

      res.json({
        success: successCount === chapterIds.length,
        message: failureCount > 0 
          ? `Updated ${successCount} of ${chapterIds.length} chapters (${failureCount} failed)`
          : `Successfully updated ${successCount} chapters`,
        successCount,
        failureCount,
        results
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error in bulk chapter access update:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin statistics endpoint
  app.get("/api/admin/stats", adminAuth, async (req, res) => {
    try {
      const stats = await storage.getSiteStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching site stats:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin recent series preview endpoint
  app.get("/api/admin/recent-series", adminAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 6;
      
      // Validate limit parameter
      if (isNaN(limit) || limit < 1) {
        return res.status(400).json({ message: "Invalid limit parameter" });
      }
      
      const recentSeries = await storage.getRecentSeries(limit);
      res.json(recentSeries);
    } catch (error) {
      console.error("Error fetching recent series:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin endpoint to update user role (with owner restrictions)
  app.patch("/api/admin/users/:id/role", adminAuth, doubleCsrfProtection, async (req, res) => {
    try {
      const { id } = req.params;
      const roleData = updateUserRoleSchema.parse(req.body);
      
      // Get current user from session
      if (!req.session.user?.username) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const currentUser = await storage.getUserByUsername(req.session.user.username);
      if (!currentUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Get target user to check their current role
      const targetUser = await storage.getUserById(id);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Critical security: Prevent any non-owner from modifying the owner's role
      if (targetUser.role === 'owner' && currentUser.role !== 'owner') {
        return res.status(403).json({ message: "Only the current owner can modify the owner's role" });
      }
      
      // Owner role restrictions
      if (roleData.role === 'owner') {
        // Only existing owner can assign owner role
        if (currentUser.role !== 'owner') {
          return res.status(403).json({ message: "Only the current owner can assign owner privileges" });
        }
        
        // Check if there's already an owner (prevent multiple owners)
        const existingOwner = await storage.getUserByRole('owner');
        if (existingOwner && existingOwner.id !== id) {
          return res.status(409).json({ message: "Only one owner can exist at a time. Please demote the current owner first." });
        }
      }
      
      // Critical: Prevent demoting the last/only owner via role change
      if (targetUser.role === 'owner' && roleData.role !== 'owner') {
        const allUsers = await storage.getAllUsers();
        const ownerCount = allUsers.filter(u => u.role === 'owner').length;
        if (ownerCount <= 1) {
          return res.status(403).json({ message: "Cannot demote the last owner. Transfer ownership to another user first." });
        }
      }
      
      // Only owners can assign admin/owner roles
      if ((roleData.role === 'admin' || roleData.role === 'owner') && currentUser.role !== 'owner') {
        return res.status(403).json({ message: "Only the owner can assign admin or owner privileges" });
      }
      
      // Prevent owner from demoting themselves
      if (currentUser.id === id && currentUser.role === 'owner' && roleData.role !== 'owner') {
        return res.status(403).json({ message: "Owners cannot demote themselves. Transfer ownership to another user first." });
      }
      
      // Prevent admin from demoting themselves (legacy protection)
      if (currentUser.id === id && currentUser.isAdmin === 'true' && !['admin', 'owner'].includes(roleData.role)) {
        return res.status(403).json({ message: "Cannot demote yourself from admin role" });
      }
      
      const updatedUser = await storage.updateUserRole(id, roleData.role);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Broadcast user role change event for real-time updates
      broadcast.user({
        userId: id,
        action: 'role_changed',
        data: { role: roleData.role }
      }, currentUser.id);
      
      // Return safe user data without password
      const { password, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid role data", errors: error.errors });
      }
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ========== USER WARNINGS ENDPOINTS ==========
  
  // Get user warnings
  app.get("/api/admin/users/:id/warnings", adminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const warnings = await storage.getUserWarnings(id);
      res.json(warnings);
    } catch (error) {
      console.error("Error fetching user warnings:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Issue a warning to user
  app.post("/api/admin/users/:id/warn", adminAuth, doubleCsrfProtection, async (req, res) => {
    try {
      const { id } = req.params;
      const { reason, severity, notes } = req.body;
      
      if (!reason || !reason.trim()) {
        return res.status(400).json({ message: "Warning reason is required" });
      }
      
      // Get current admin user
      if (!req.session.user?.username) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const currentUser = await storage.getUserByUsername(req.session.user.username);
      if (!currentUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Create warning
      const warning = await storage.createUserWarning({
        userId: id,
        issuedBy: currentUser.id,
        reason: reason.trim(),
        severity: severity || "low",
        notes: notes?.trim() || null,
        isActive: "true",
      });
      
      // Log the action
      await storage.createActivityLog({
        adminId: currentUser.id,
        action: "warning_issued",
        targetType: "user",
        targetId: id,
        details: JSON.stringify({ reason, severity, warningId: warning.id }),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      
      // Broadcast user warning event for real-time updates
      broadcast.user({
        userId: id,
        action: 'warned',
        data: { reason, severity, warningId: warning.id }
      }, currentUser.id);
      
      res.json(warning);
    } catch (error) {
      console.error("Error issuing warning:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete a warning
  app.delete("/api/admin/warnings/:id", adminAuth, doubleCsrfProtection, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get current admin user for logging
      if (!req.session.user?.username) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const currentUser = await storage.getUserByUsername(req.session.user.username);
      if (!currentUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      await storage.deleteWarning(id);
      
      // Log the action
      await storage.createActivityLog({
        adminId: currentUser.id,
        action: "warning_deleted",
        targetType: "warning",
        targetId: id,
        details: JSON.stringify({ warningId: id }),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      
      // Broadcast cache invalidation for warnings
      broadcast.invalidateCache(['users', 'warnings']);
      
      res.json({ message: "Warning deleted successfully" });
    } catch (error) {
      console.error("Error deleting warning:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ========== BAN/SUSPENSION ENDPOINTS ==========
  
  // Ban a user
  app.post("/api/admin/users/:id/ban", adminAuth, doubleCsrfProtection, async (req, res) => {
    try {
      const { id } = req.params;
      const { banReason, duration } = req.body; // duration in days, null for permanent
      
      if (!banReason || !banReason.trim()) {
        return res.status(400).json({ message: "Ban reason is required" });
      }
      
      // Get current admin user
      if (!req.session.user?.username) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const currentUser = await storage.getUserByUsername(req.session.user.username);
      if (!currentUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Get target user
      const targetUser = await storage.getUser(id);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Prevent banning admins/owners unless you're the owner
      if (['admin', 'owner'].includes(targetUser.role || '') && currentUser.role !== 'owner') {
        return res.status(403).json({ message: "Only the owner can ban admins or other owners" });
      }
      
      // Prevent self-ban
      if (currentUser.id === id) {
        return res.status(403).json({ message: "You cannot ban yourself" });
      }
      
      // Calculate ban expiry date if duration is provided
      let banExpiresAt = null;
      if (duration && duration > 0) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + duration);
        banExpiresAt = expiryDate.toISOString();
      }
      
      // Ban the user
      const bannedUser = await storage.banUser(id, {
        banReason: banReason.trim(),
        bannedBy: currentUser.id,
        banExpiresAt,
      });
      
      // Log the action
      await storage.createActivityLog({
        adminId: currentUser.id,
        action: "user_banned",
        targetType: "user",
        targetId: id,
        details: JSON.stringify({ 
          banReason, 
          duration: duration || "permanent",
          banExpiresAt 
        }),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      
      // Broadcast user ban event
      broadcast.user({
        userId: id,
        action: 'banned',
        data: { banReason, duration, banExpiresAt }
      }, currentUser.id);
      
      const { password, ...safeUser } = bannedUser;
      res.json(safeUser);
    } catch (error) {
      console.error("Error banning user:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Unban a user
  app.post("/api/admin/users/:id/unban", adminAuth, doubleCsrfProtection, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get current admin user
      if (!req.session.user?.username) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const currentUser = await storage.getUserByUsername(req.session.user.username);
      if (!currentUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Unban the user
      const unbannedUser = await storage.unbanUser(id);
      
      // Log the action
      await storage.createActivityLog({
        adminId: currentUser.id,
        action: "user_unbanned",
        targetType: "user",
        targetId: id,
        details: JSON.stringify({ userId: id }),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      
      // Broadcast user unban event
      broadcast.user({
        userId: id,
        action: 'unbanned'
      }, currentUser.id);
      
      const { password, ...safeUser } = unbannedUser;
      res.json(safeUser);
    } catch (error) {
      console.error("Error unbanning user:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ========== ADMIN ACTIVITY LOGS ENDPOINTS ==========
  
  // Get activity logs with filters
  app.get("/api/admin/activity-logs", adminAuth, async (req, res) => {
    try {
      const filters: any = {};
      
      if (req.query.adminId) filters.adminId = req.query.adminId as string;
      if (req.query.action) filters.action = req.query.action as string;
      if (req.query.targetType) filters.targetType = req.query.targetType as string;
      if (req.query.startDate) filters.startDate = req.query.startDate as string;
      if (req.query.endDate) filters.endDate = req.query.endDate as string;
      if (req.query.limit) filters.limit = parseInt(req.query.limit as string);
      
      const logs = await storage.getActivityLogs(filters);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Public endpoints for section-specific series data
  app.get("/api/sections/featured", async (req, res) => {
    try {
      const featuredSeries = await storage.getSeriesBySection("featured");
      res.json(featuredSeries);
    } catch (error) {
      console.error("Error fetching featured series:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/sections/trending", async (req, res) => {
    try {
      const trendingSeries = await storage.getSeriesBySection("trending");
      res.json(trendingSeries);
    } catch (error) {
      console.error("Error fetching trending series:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/sections/popular-today", async (req, res) => {
    try {
      const popularSeries = await storage.getSeriesBySection("popularToday");
      res.json(popularSeries);
    } catch (error) {
      console.error("Error fetching popular today series:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/sections/latest-updates", async (req, res) => {
    try {
      const latestSeries = await storage.getSeriesBySection("latestUpdate");
      res.json(latestSeries);
    } catch (error) {
      console.error("Error fetching latest updates series:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/sections/pinned", async (req, res) => {
    try {
      const pinnedSeries = await storage.getSeriesBySection("pinned");
      res.json(pinnedSeries);
    } catch (error) {
      console.error("Error fetching pinned series:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Public endpoint to get all series
  app.get("/api/series", async (req, res) => {
    try {
      const allSeries = await storage.getAllSeries();
      res.json(allSeries);
    } catch (error) {
      console.error("Error fetching all series:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/library/:seriesId", actionLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { seriesId } = req.params;
      const { status = "reading" } = req.body;
      
      const validStatuses = ["reading", "completed", "plan_to_read", "on_hold", "dropped"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const series = await storage.getSeries(seriesId);
      if (!series) {
        return res.status(404).json({ message: "Series not found" });
      }

      const libraryItem = await storage.addToLibrary(user.id, seriesId, status);
      res.json(libraryItem);
    } catch (error: any) {
      if (error.message?.includes('already in your library')) {
        return res.status(409).json({ message: error.message });
      }
      console.error("Error adding to library:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/library/:seriesId/status", actionLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { seriesId } = req.params;
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }

      const validStatuses = ["reading", "completed", "plan_to_read", "on_hold", "dropped"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const updatedItem = await storage.updateLibraryStatus(user.id, seriesId, status);
      
      if (!updatedItem) {
        return res.status(404).json({ message: "Series not in library" });
      }

      res.json(updatedItem);
    } catch (error) {
      console.error("Error updating library status:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/library/:seriesId", actionLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { seriesId } = req.params;
      const user = await storage.getUserByUsername(req.session.user.username);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const removed = await storage.removeFromLibrary(user.id, seriesId);
      
      if (!removed) {
        return res.status(404).json({ message: "Series not in library" });
      }

      res.json({ message: "Series removed from library" });
    } catch (error) {
      console.error("Error removing from library:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/library", async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const library = await storage.getUserLibrary(user.id);
      res.json(library);
    } catch (error) {
      console.error("Error fetching user library:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/library/check/:seriesId", async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { seriesId } = req.params;
      const user = await storage.getUserByUsername(req.session.user.username);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const inLibrary = await storage.isInLibrary(user.id, seriesId);
      res.json({ inLibrary });
    } catch (error) {
      console.error("Error checking library status:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Follow/Subscribe System Routes
  app.post("/api/follow/:seriesId", actionLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { seriesId } = req.params;
      const { notificationsEnabled } = req.body;
      const user = await storage.getUserByUsername(req.session.user.username);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const series = await storage.getSeries(seriesId);
      if (!series) {
        return res.status(404).json({ message: "Series not found" });
      }

      const follow = await storage.followSeries(
        user.id, 
        seriesId, 
        notificationsEnabled !== undefined ? notificationsEnabled : true
      );
      res.json(follow);
    } catch (error: any) {
      if (error.message?.includes('already following')) {
        return res.status(409).json({ message: error.message });
      }
      console.error("Error following series:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/follow/:seriesId", actionLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { seriesId } = req.params;
      const user = await storage.getUserByUsername(req.session.user.username);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const unfollowed = await storage.unfollowSeries(user.id, seriesId);
      
      if (!unfollowed) {
        return res.status(404).json({ message: "Series not in follows" });
      }

      res.json({ message: "Series unfollowed successfully" });
    } catch (error) {
      console.error("Error unfollowing series:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/follow", async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const follows = await storage.getUserFollows(user.id);
      res.json(follows);
    } catch (error) {
      console.error("Error fetching user follows:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/follow/check/:seriesId", async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { seriesId } = req.params;
      const user = await storage.getUserByUsername(req.session.user.username);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const status = await storage.isFollowing(user.id, seriesId);
      
      res.json(status);
    } catch (error) {
      console.error("Error checking follow status:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/follow/:seriesId/notifications", doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { seriesId } = req.params;
      
      const notificationSchema = z.object({ enabled: z.boolean() });
      const validation = notificationSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid input", 
          errors: validation.error.errors 
        });
      }
      
      const { enabled } = validation.data;

      const user = await storage.getUserByUsername(req.session.user.username);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const updated = await storage.updateFollowNotifications(user.id, seriesId, enabled);
      
      if (!updated) {
        return res.status(404).json({ message: "Follow not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating follow notifications:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/series/:seriesId/followers", async (req, res) => {
    try {
      const { seriesId } = req.params;
      
      const series = await storage.getSeries(seriesId);
      if (!series) {
        return res.status(404).json({ message: "Series not found" });
      }

      const followerCount = await storage.getSeriesFollowerCount(seriesId);
      res.json({ count: followerCount });
    } catch (error) {
      console.error("Error getting follower count:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ===== READING LISTS ENDPOINTS =====

  // Get all reading lists for authenticated user
  app.get("/api/reading-lists", async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const lists = await storage.getReadingLists(user.id);
      res.json(lists);
    } catch (error) {
      console.error("Error fetching reading lists:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create a new reading list
  app.post("/api/reading-lists", actionLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const list = await storage.createReadingList(user.id, req.body);
      res.json(list);
    } catch (error: any) {
      console.error("Error creating reading list:", error);
      res.status(500).json({ message: error.message || "Internal server error" });
    }
  });

  // Update a reading list
  app.patch("/api/reading-lists/:listId", actionLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { listId } = req.params;
      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const updated = await storage.updateReadingList(listId, user.id, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Reading list not found" });
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating reading list:", error);
      res.status(500).json({ message: error.message || "Internal server error" });
    }
  });

  // Delete a reading list
  app.delete("/api/reading-lists/:listId", actionLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { listId } = req.params;
      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const deleted = await storage.deleteReadingList(listId, user.id);
      if (!deleted) {
        return res.status(404).json({ message: "Reading list not found" });
      }

      res.json({ message: "Reading list deleted successfully" });
    } catch (error) {
      console.error("Error deleting reading list:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Add series to reading list
  app.post("/api/reading-lists/:listId/items", actionLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { listId } = req.params;
      const { seriesId } = req.body;

      if (!seriesId) {
        return res.status(400).json({ message: "Series ID is required" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const item = await storage.addToReadingList(listId, seriesId, user.id);
      res.json(item);
    } catch (error: any) {
      console.error("Error adding to reading list:", error);
      res.status(500).json({ message: error.message || "Internal server error" });
    }
  });

  // Remove series from reading list
  app.delete("/api/reading-lists/:listId/items/:seriesId", actionLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { listId, seriesId } = req.params;
      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const removed = await storage.removeFromReadingList(listId, seriesId, user.id);
      if (!removed) {
        return res.status(404).json({ message: "Item not found in reading list" });
      }

      res.json({ message: "Item removed from reading list" });
    } catch (error) {
      console.error("Error removing from reading list:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get reading list items (series in a list)
  app.get("/api/reading-lists/:listId/items", async (req: any, res) => {
    try {
      const { listId } = req.params;
      
      const list = await storage.getReadingListById(listId);
      if (!list) {
        return res.status(404).json({ message: "Reading list not found" });
      }

      if (list.visibility === "private") {
        if (!req.session?.user) {
          return res.status(401).json({ message: "Authentication required" });
        }

        const user = await storage.getUserByUsername(req.session.user.username);
        if (!user || list.userId !== user.id) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const items = await storage.getReadingListItems(listId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching reading list items:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ===== RATING & REVIEW SYSTEM ENDPOINTS =====

  // Submit or update a rating/review for a series
  app.post("/api/ratings/:seriesId", actionLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { seriesId } = req.params;
      const { rating, review } = req.body;

      if (!rating || rating < 1 || rating > 10) {
        return res.status(400).json({ message: "Rating must be between 1 and 10" });
      }

      const series = await storage.getSeries(seriesId);
      if (!series) {
        return res.status(404).json({ message: "Series not found" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const userRating = await storage.createOrUpdateUserRating(user.id, seriesId, rating, review || null);
      res.json(userRating);
    } catch (error) {
      console.error("Error submitting rating:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user's rating for a series
  app.get("/api/ratings/:seriesId/user", async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { seriesId } = req.params;
      const user = await storage.getUserByUsername(req.session.user.username);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const userRating = await storage.getUserRating(user.id, seriesId);
      res.json(userRating || null);
    } catch (error) {
      console.error("Error fetching user rating:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all ratings and reviews for a series
  app.get("/api/ratings/:seriesId", async (req, res) => {
    try {
      const { seriesId } = req.params;
      
      const series = await storage.getSeries(seriesId);
      if (!series) {
        return res.status(404).json({ message: "Series not found" });
      }

      const ratings = await storage.getSeriesRatings(seriesId);
      res.json(ratings);
    } catch (error) {
      console.error("Error fetching series ratings:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get average rating and count for a series
  app.get("/api/ratings/:seriesId/stats", async (req, res) => {
    try {
      const { seriesId } = req.params;
      
      const series = await storage.getSeries(seriesId);
      if (!series) {
        return res.status(404).json({ message: "Series not found" });
      }

      const ratings = await storage.getSeriesRatings(seriesId);
      const average = ratings.length > 0 
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length 
        : 0;
      const stats = {
        average: Math.round(average * 10) / 10,
        count: ratings.length
      };
      res.json(stats);
    } catch (error) {
      console.error("Error fetching rating stats:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete a rating/review
  app.delete("/api/ratings/:seriesId", actionLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { seriesId } = req.params;
      const user = await storage.getUserByUsername(req.session.user.username);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const deleted = await storage.deleteUserRating(user.id, seriesId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Rating not found" });
      }

      res.json({ message: "Rating deleted successfully" });
    } catch (error) {
      console.error("Error deleting rating:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Generate Admin Report
  app.get("/api/admin/report", adminAuth, async (req, res) => {
    try {
      const stats = await storage.getSiteStats();
      const allUsers = await storage.getAllUsers();
      const allSeries = await storage.getAllSeries();
      
      // Calculate additional metrics
      const adminCount = allUsers.filter(user => user.isAdmin === 'true').length;
      const usersByRole = allUsers.reduce((acc, user) => {
        const role = user.role || 'user';
        acc[role] = (acc[role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const seriesByStatus = allSeries.reduce((acc, series) => {
        acc[series.status] = (acc[series.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const seriesByType = allSeries.reduce((acc, series) => {
        acc[series.type] = (acc[series.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const featuredCount = allSeries.filter(series => series.isFeatured === 'true').length;
      const trendingCount = allSeries.filter(series => series.isTrending === 'true').length;

      const report = {
        generatedAt: new Date().toISOString(),
        summary: {
          totalUsers: stats.totalUsers,
          totalSeries: stats.totalSeries,
          adminUsers: adminCount,
          featuredSeries: featuredCount,
          trendingSeries: trendingCount
        },
        userAnalytics: {
          byRole: usersByRole,
          recentUsers: allUsers
            .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
            .slice(0, 10)
            .map(user => ({
              username: user.username,
              email: user.email,
              role: user.role,
              createdAt: user.createdAt
            }))
        },
        seriesAnalytics: {
          byStatus: seriesByStatus,
          byType: seriesByType,
          recentSeries: allSeries
            .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
            .slice(0, 10)
            .map(series => ({
              title: series.title,
              author: series.author,
              type: series.type,
              status: series.status,
              createdAt: series.createdAt
            }))
        }
      };

      res.json(report);
    } catch (error) {
      console.error("Error generating admin report:", error);
      res.status(500).json({ message: "Failed to generate report" });
    }
  });

  // Backup Database
  app.post("/api/admin/backup", adminAuth, doubleCsrfProtection, async (req, res) => {
    try {
      const { spawn } = await import('child_process');
      const backupName = req.body.name || 'admin-backup';
      
      // Execute the backup script
      const backup = spawn('npx', ['tsx', 'scripts/db-backup.ts', backupName], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      backup.stdout.on('data', (data) => {
        output += data.toString();
      });

      backup.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      backup.on('close', (code) => {
        if (code === 0) {
          // Parse filename from output
          const filenameMatch = output.match(/Backup saved as: (.+)/);
          const filename = filenameMatch ? filenameMatch[1] : 'backup created';
          
          res.json({
            message: "Database backup created successfully",
            filename: filename,
            timestamp: new Date().toISOString()
          });
        } else {
          console.error("Backup script error:", errorOutput);
          res.status(500).json({ 
            message: "Failed to create backup",
            error: errorOutput || "Backup process failed"
          });
        }
      });

      backup.on('error', (error) => {
        console.error("Backup spawn error:", error);
        res.status(500).json({ 
          message: "Failed to start backup process",
          error: error.message
        });
      });

    } catch (error) {
      console.error("Error creating backup:", error);
      res.status(500).json({ message: "Failed to create backup" });
    }
  });

  // Advanced Analytics
  app.get("/api/admin/analytics", adminAuth, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const allSeries = await storage.getAllSeries();
      
      // Time-based analytics
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const newUsersLast30Days = allUsers.filter(user => 
        user.createdAt && new Date(user.createdAt) >= thirtyDaysAgo
      ).length;
      
      const newUsersLast7Days = allUsers.filter(user => 
        user.createdAt && new Date(user.createdAt) >= sevenDaysAgo
      ).length;

      const newSeriesLast30Days = allSeries.filter(series => 
        series.createdAt && new Date(series.createdAt) >= thirtyDaysAgo
      ).length;

      const newSeriesLast7Days = allSeries.filter(series => 
        series.createdAt && new Date(series.createdAt) >= sevenDaysAgo
      ).length;

      // Growth calculations
      const userGrowthRate = allUsers.length > 0 ? (newUsersLast30Days / allUsers.length) * 100 : 0;
      const seriesGrowthRate = allSeries.length > 0 ? (newSeriesLast30Days / allSeries.length) * 100 : 0;

      // Popular genres (if available)
      const genrePopularity = allSeries.reduce((acc, series) => {
        if (series.genres) {
          try {
            const genres = JSON.parse(series.genres);
            if (Array.isArray(genres)) {
              genres.forEach(genre => {
                acc[genre] = (acc[genre] || 0) + 1;
              });
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
        return acc;
      }, {} as Record<string, number>);

      // Daily activity simulation (since we don't have real activity tracking)
      const dailyActivity = Array.from({ length: 30 }, (_, i) => {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        return {
          date: date.toISOString().split('T')[0],
          users: Math.floor(Math.random() * 50) + 10, // Simulated
          views: Math.floor(Math.random() * 500) + 100 // Simulated
        };
      }).reverse();

      const analytics = {
        overview: {
          totalUsers: allUsers.length,
          totalSeries: allSeries.length,
          newUsersLast30Days,
          newUsersLast7Days,
          newSeriesLast30Days,
          newSeriesLast7Days,
          userGrowthRate: Math.round(userGrowthRate * 100) / 100,
          seriesGrowthRate: Math.round(seriesGrowthRate * 100) / 100
        },
        genrePopularity: Object.entries(genrePopularity)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 10)
          .map(([genre, count]) => ({ genre, count })),
        dailyActivity,
        userDistribution: {
          byRole: allUsers.reduce((acc, user) => {
            const role = user.role || 'user';
            acc[role] = (acc[role] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        },
        seriesDistribution: {
          byStatus: allSeries.reduce((acc, series) => {
            acc[series.status] = (acc[series.status] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          byType: allSeries.reduce((acc, series) => {
            acc[series.type] = (acc[series.type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        }
      };

      res.json(analytics);
    } catch (error) {
      console.error("Error generating analytics:", error);
      res.status(500).json({ message: "Failed to generate analytics" });
    }
  });


  // Generate placeholder SVG for missing chapter pages
  function generatePlaceholderSVG(filename: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="800" height="1200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:rgb(45,27,61);stop-opacity:1" />
      <stop offset="100%" style="stop-color:rgb(26,22,37);stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#grad)"/>
  <text x="50%" y="45%" font-family="Arial, sans-serif" font-size="28" fill="#9333ea" text-anchor="middle" dominant-baseline="middle">
    Page Not Available
  </text>
  <text x="50%" y="52%" font-family="Arial, sans-serif" font-size="16" fill="#a1a1aa" text-anchor="middle" dominant-baseline="middle">
    ${filename}
  </text>
  <text x="50%" y="58%" font-family="Arial, sans-serif" font-size="14" fill="#71717a" text-anchor="middle" dominant-baseline="middle">
    This page is missing from the chapter
  </text>
  <rect x="350" y="520" width="100" height="100" rx="10" fill="#2d1b3d" stroke="#9333ea" stroke-width="2"/>
  <path d="M 380 550 L 420 550 L 420 570 L 380 570 Z M 390 575 L 390 590 M 410 575 L 410 590" stroke="#9333ea" stroke-width="3" fill="none"/>
</svg>`;
  }

  // Generate placeholder SVG for missing cover images
  function generateCoverPlaceholderSVG(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="600" height="800" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="coverGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:rgb(45,27,61);stop-opacity:1" />
      <stop offset="100%" style="stop-color:rgb(26,22,37);stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#coverGrad)"/>
  <text x="50%" y="45%" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="#9333ea" text-anchor="middle" dominant-baseline="middle">
    No Cover
  </text>
  <text x="50%" y="52%" font-family="Arial, sans-serif" font-size="16" fill="#a1a1aa" text-anchor="middle" dominant-baseline="middle">
    Upload a cover image in admin panel
  </text>
  <g transform="translate(250, 300)">
    <rect x="0" y="0" width="100" height="140" rx="8" fill="#2d1b3d" stroke="#9333ea" stroke-width="3"/>
    <rect x="15" y="15" width="70" height="80" rx="4" fill="#1a1625" stroke="#9333ea" stroke-width="2"/>
    <circle cx="50" cy="40" r="12" fill="#9333ea"/>
    <path d="M 15 80 L 35 60 L 55 75 L 75 55 L 85 65 L 85 95 L 15 95 Z" fill="#9333ea" opacity="0.6"/>
    <rect x="15" y="105" width="70" height="8" rx="2" fill="#9333ea" opacity="0.4"/>
    <rect x="15" y="118" width="50" height="6" rx="2" fill="#9333ea" opacity="0.3"/>
  </g>
</svg>`;
  }

  // Serve chapter images from App Storage
  app.get('/api/chapters/image/*', async (req, res) => {
    try {
      const fullPath = (req.params as any)[0] as string;
      
      // Validate image paths - allow common filename characters but prevent path traversal
      // Allow alphanumeric, underscores, hyphens, dots, spaces, parentheses, brackets, and exclamation marks
      if (!/^[a-zA-Z0-9_\-.\s()\[\]!\/]+\.(jpg|jpeg|png|webp|gif|avif|bmp|tiff|tif)$/i.test(fullPath)) {
        return res.status(400).json({ message: 'Invalid filename format or unsupported file type' });
      }
      
      // Prevent path traversal attacks
      if (fullPath.includes('..') || fullPath.includes('//')) {
        return res.status(400).json({ message: 'Invalid path' });
      }
      
      const { getImageBuffer } = await import("./storage/local-storage");
      
      // Get proper MIME type based on actual file extension
      const ext = path.extname(fullPath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif'
      };
      
      const contentType = mimeTypes[ext];
      if (!contentType) {
        return res.status(400).json({ message: 'Unsupported file type' });
      }
      
      try {
        // Get image from local storage
        const storageKey = `chapters/${fullPath}`;
        const imageBuffer = await getImageBuffer(storageKey);
        
        // Set secure headers for image serving
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Length', imageBuffer.length.toString());
        
        // Send the buffer directly
        res.send(imageBuffer);
      } catch (storageError) {
        console.log(`[image-404] Missing image in local storage: ${fullPath}`);
        // Return placeholder SVG instead of 404
        return res.status(200)
          .setHeader('Content-Type', 'image/svg+xml')
          .setHeader('Cache-Control', 'no-cache')
          .send(generatePlaceholderSVG(fullPath));
      }
      
    } catch (error) {
      console.error('Error serving chapter image:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  });

  // Placeholder cover image endpoint - MUST come before :filename route
  app.get('/api/covers/placeholder', (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(generateCoverPlaceholderSVG());
  });

  // Serve cover images from local disk storage
  app.get('/api/covers/:filename', async (req, res) => {
    try {
      const { filename } = req.params;
      
      // Strict whitelist for image filenames - only allow known safe image extensions
      if (!/^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|gif)$/i.test(filename)) {
        return res.status(400).json({ message: 'Invalid filename format or unsupported file type' });
      }
      
      // Get proper MIME type based on actual file extension
      const ext = path.extname(filename).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif'
      };
      
      const contentType = mimeTypes[ext];
      if (!contentType) {
        return res.status(400).json({ message: 'Unsupported file type' });
      }
      
      // Serve from local disk storage
      const coverPath = path.join(process.cwd(), 'uploads', 'covers', filename);
      
      try {
        await fsp.access(coverPath);
        
        // Set secure headers for image serving
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        
        // Send file from disk
        res.sendFile(coverPath);
      } catch (fileError) {
        console.log(`[cover-404] Missing cover in local storage: ${filename}`);
        return res.status(404).json({ message: 'Cover image not found' });
      }
      
    } catch (error) {
      console.error('Error serving cover image:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  });

  // Comment Routes

  // Get comments for a series (public)
  app.get("/api/series/:seriesId/comments", async (req, res) => {
    try {
      const { seriesId } = req.params;
      
      const series = await storage.getSeries(seriesId);
      if (!series) {
        return res.status(404).json({ message: "Series not found" });
      }

      const comments = await storage.getCommentsBySeriesId(seriesId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching series comments:", error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  // Get comments for a chapter (public)
  app.get("/api/chapters/:chapterId/comments", async (req, res) => {
    try {
      const { chapterId } = req.params;
      
      const chapter = await storage.getChapter(chapterId);
      if (!chapter) {
        return res.status(404).json({ message: "Chapter not found" });
      }

      const comments = await storage.getCommentsByChapterId(chapterId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching chapter comments:", error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  // Reading Progress System Routes
  // Save/update reading progress for a series (authenticated)
  app.post("/api/series/:seriesId/progress", doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { seriesId } = req.params;
      const { chapterId, lastReadPage } = req.body;

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const series = await storage.getSeries(seriesId);
      if (!series) {
        return res.status(404).json({ message: "Series not found" });
      }

      const progress = await storage.saveReadingProgress(
        user.id,
        seriesId,
        chapterId || null,
        lastReadPage || 0
      );

      res.json(progress);
    } catch (error) {
      console.error("Error saving reading progress:", error);
      res.status(500).json({ message: "Failed to save reading progress" });
    }
  });

  // Get reading progress for a specific series (authenticated)
  app.get("/api/series/:seriesId/progress", async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { seriesId } = req.params;
      const user = await storage.getUserByUsername(req.session.user.username);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const progress = await storage.getReadingProgress(user.id, seriesId);
      
      if (!progress) {
        return res.status(404).json({ message: "No reading progress found" });
      }

      res.json(progress);
    } catch (error) {
      console.error("Error fetching reading progress:", error);
      res.status(500).json({ message: "Failed to fetch reading progress" });
    }
  });

  // Get all reading progress for the user (authenticated)
  app.get("/api/progress", async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const progressList = await storage.getUserReadingProgress(user.id);
      res.json(progressList);
    } catch (error) {
      console.error("Error fetching user reading progress:", error);
      res.status(500).json({ message: "Failed to fetch reading progress" });
    }
  });

  // Clear reading progress for a series (authenticated)
  app.delete("/api/series/:seriesId/progress", doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { seriesId } = req.params;
      const user = await storage.getUserByUsername(req.session.user.username);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const deleted = await storage.deleteReadingProgress(user.id, seriesId);
      
      if (!deleted) {
        return res.status(404).json({ message: "No reading progress found" });
      }

      res.json({ message: "Reading progress cleared successfully" });
    } catch (error) {
      console.error("Error deleting reading progress:", error);
      res.status(500).json({ message: "Failed to clear reading progress" });
    }
  });

  // Create a comment for a series (authenticated)
  app.post("/api/series/:seriesId/comments", commentLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { seriesId } = req.params;
      const rawContent = req.body.content;

      // SECURITY FIX: Sanitize content to prevent XSS attacks
      const sanitizedContent = sanitizeHtml(rawContent);

      // Validate input
      const validationResult = insertCommentSchema.safeParse({
        userId: req.session.user.id,
        seriesId,
        content: sanitizedContent,
      });

      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: validationResult.error.errors 
        });
      }

      const series = await storage.getSeries(seriesId);
      if (!series) {
        return res.status(404).json({ message: "Series not found" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const comment = await storage.createComment({
        userId: user.id,
        seriesId,
        content: sanitizedContent,
      });

      res.status(201).json(comment);
    } catch (error) {
      console.error("Error creating series comment:", error);
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  // Create a comment for a chapter (authenticated)
  app.post("/api/chapters/:chapterId/comments", commentLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { chapterId } = req.params;
      const rawContent = req.body.content;

      // SECURITY FIX: Sanitize content to prevent XSS attacks
      const sanitizedContent = sanitizeHtml(rawContent);

      // Validate input
      const validationResult = insertCommentSchema.safeParse({
        userId: req.session.user.id,
        chapterId,
        content: sanitizedContent,
      });

      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: validationResult.error.errors 
        });
      }

      const chapter = await storage.getChapter(chapterId);
      if (!chapter) {
        return res.status(404).json({ message: "Chapter not found" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const comment = await storage.createComment({
        userId: user.id,
        chapterId,
        content: sanitizedContent,
      });

      res.status(201).json(comment);
    } catch (error) {
      console.error("Error creating chapter comment:", error);
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  // Update a comment (authenticated, owner only)
  app.patch("/api/comments/:id", commentLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { id } = req.params;
      const rawContent = req.body.content;

      // SECURITY FIX: Sanitize content to prevent XSS attacks
      const sanitizedContent = sanitizeHtml(rawContent);

      // Validate input
      const validationResult = updateCommentSchema.safeParse({ content: sanitizedContent });

      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: validationResult.error.errors 
        });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Get the existing comment to check ownership
      const existingComment = await storage.getUserComment(user.id);
      if (!existingComment || existingComment.id !== id) {
        // Check if the comment exists and if the user is the owner
        const commentResults = await storage.getCommentsBySeriesId("");
        const allComments = [...commentResults];
        const targetComment = allComments.find(c => c.id === id);
        
        if (!targetComment) {
          return res.status(404).json({ message: "Comment not found" });
        }
        
        if (targetComment.userId !== user.id) {
          return res.status(403).json({ message: "You can only edit your own comments" });
        }
      }

      const updatedComment = await storage.updateComment(id, sanitizedContent);

      if (!updatedComment) {
        return res.status(404).json({ message: "Comment not found" });
      }

      res.json(updatedComment);
    } catch (error) {
      console.error("Error updating comment:", error);
      res.status(500).json({ message: "Failed to update comment" });
    }
  });

  // Delete a comment (authenticated, owner or staff/admin can moderate)
  app.delete("/api/comments/:id", actionLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { id } = req.params;

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Get the comment to check ownership
      const commentsByUser = await storage.getUserComment(user.id);
      const isOwner = commentsByUser && commentsByUser.id === id;
      
      // Staff role or higher can moderate/delete any comment
      const hasStaffAccess = ['staff', 'admin', 'owner'].includes(user.role || '') || user.isAdmin === 'true';

      if (!isOwner && !hasStaffAccess) {
        return res.status(403).json({ message: "You can only delete your own comments" });
      }

      const deleted = await storage.deleteComment(id);

      if (!deleted) {
        return res.status(404).json({ message: "Comment not found" });
      }

      res.json({ message: "Comment deleted successfully" });
    } catch (error) {
      console.error("Error deleting comment:", error);
      res.status(500).json({ message: "Failed to delete comment" });
    }
  });

  // Helper function for atomic currency operations
  async function processCurrencyChange(
    userId: string,
    amount: number,
    type: string,
    description: string,
    relatedEntityId?: string
  ): Promise<{ success: boolean; newBalance?: number; error?: string }> {
    return await storage.processCurrencyChange(userId, amount, type, description, relatedEntityId);
  }

  // Currency API Endpoints
  
  // GET /api/currency/balance - Get user's currency balance (authenticated)
  app.get("/api/currency/balance", async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const balance = await storage.getUserCurrencyBalance(user.id);
      res.json({ balance });
    } catch (error) {
      console.error("Error fetching currency balance:", error);
      res.status(500).json({ message: "Failed to fetch currency balance" });
    }
  });

  // GET /api/currency/transactions - Get user's transaction history (authenticated, paginated)
  app.get("/api/currency/transactions", async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const transactionQuerySchema = z.object({
        limit: z.coerce.number().min(1).max(100).default(50),
        offset: z.coerce.number().min(0).default(0)
      });

      const validatedQuery = transactionQuerySchema.parse({
        limit: req.query.limit,
        offset: req.query.offset
      });

      const transactions = await storage.getCurrencyTransactions(user.id, validatedQuery.limit, validatedQuery.offset);
      res.json(transactions);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid query parameters", errors: error.errors });
      }
      console.error("Error fetching currency transactions:", error);
      res.status(500).json({ message: "Failed to fetch currency transactions" });
    }
  });

  // GET /api/admin/user-transactions/:userId - Get any user's transaction history (admin only)
  app.get("/api/admin/user-transactions/:userId", adminAuth, async (req: any, res) => {
    try {
      const { userId } = req.params;

      const transactionQuerySchema = z.object({
        limit: z.coerce.number().min(1).max(100).default(50),
        offset: z.coerce.number().min(0).default(0)
      });

      const validatedQuery = transactionQuerySchema.parse({
        limit: req.query.limit,
        offset: req.query.offset
      });

      const transactions = await storage.getCurrencyTransactions(userId, validatedQuery.limit, validatedQuery.offset);
      res.json(transactions);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid query parameters", errors: error.errors });
      }
      console.error("Error fetching user transactions:", error);
      res.status(500).json({ message: "Failed to fetch user transactions" });
    }
  });

  // POST /api/currency/admin/add - Admin add currency to user
  app.post("/api/currency/admin/add", actionLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const admin = await storage.getUserByUsername(req.session.user.username);
      if (!admin) {
        return res.status(401).json({ message: "User not found" });
      }

      // Check admin access
      const hasAdminAccess = admin.isAdmin === 'true' || ['admin', 'owner'].includes(admin.role || '');
      if (!hasAdminAccess) {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Validate request body
      const validatedData = adminAddCurrencySchema.parse(req.body);
      
      // Process currency change atomically
      const result = await processCurrencyChange(
        validatedData.userId,
        validatedData.amount,
        "admin_grant",
        validatedData.description,
        validatedData.relatedEntityId
      );

      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }

      res.json({ 
        message: "Currency added successfully",
        newBalance: result.newBalance
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      console.error("Error adding currency:", error);
      res.status(500).json({ message: "Failed to add currency" });
    }
  });

  // POST /api/currency/admin/deduct - Admin deduct currency from user
  app.post("/api/currency/admin/deduct", actionLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const admin = await storage.getUserByUsername(req.session.user.username);
      if (!admin) {
        return res.status(401).json({ message: "User not found" });
      }

      // Check admin access
      const hasAdminAccess = admin.isAdmin === 'true' || ['admin', 'owner'].includes(admin.role || '');
      if (!hasAdminAccess) {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Validate request body
      const validatedData = adminDeductCurrencySchema.parse(req.body);
      
      // Process currency change atomically (negative amount for deduction)
      const result = await processCurrencyChange(
        validatedData.userId,
        -validatedData.amount,
        "admin_deduct",
        validatedData.description,
        validatedData.relatedEntityId
      );

      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }

      res.json({ 
        message: "Currency deducted successfully",
        newBalance: result.newBalance
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      console.error("Error deducting currency:", error);
      res.status(500).json({ message: "Failed to deduct currency" });
    }
  });

  // GET /api/admin/currency/transactions - Get all currency transactions (admin only)
  app.get("/api/admin/currency/transactions", async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const admin = await storage.getUserByUsername(req.session.user.username);
      if (!admin) {
        return res.status(401).json({ message: "User not found" });
      }

      const hasAdminAccess = admin.isAdmin === 'true' || ['admin', 'owner'].includes(admin.role || '');
      if (!hasAdminAccess) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const transactions = await storage.getAllCurrencyTransactions(100);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching admin currency transactions:", error);
      res.status(500).json({ message: "Failed to fetch currency transactions" });
    }
  });

  // GET /api/admin/currency/stats - Get currency statistics (admin only)
  app.get("/api/admin/currency/stats", async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const admin = await storage.getUserByUsername(req.session.user.username);
      if (!admin) {
        return res.status(401).json({ message: "User not found" });
      }

      const hasAdminAccess = admin.isAdmin === 'true' || ['admin', 'owner'].includes(admin.role || '');
      if (!hasAdminAccess) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const stats = await storage.getCurrencyStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching currency stats:", error);
      res.status(500).json({ message: "Failed to fetch currency stats" });
    }
  });

  // POST /api/admin/currency/adjust - Unified admin currency adjustment (admin only)
  app.post("/api/admin/currency/adjust", actionLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const admin = await storage.getUserByUsername(req.session.user.username);
      if (!admin) {
        return res.status(401).json({ message: "User not found" });
      }

      const hasAdminAccess = admin.isAdmin === 'true' || ['admin', 'owner'].includes(admin.role || '');
      if (!hasAdminAccess) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { userId, amount, reason } = req.body;

      if (!userId || amount === undefined || !reason) {
        return res.status(400).json({ message: "userId, amount, and reason are required" });
      }

      // Amount is expected to be a signed integer (positive for add, negative for deduct)
      const result = await processCurrencyChange(
        userId,
        amount,
        amount > 0 ? "admin_grant" : "admin_deduct",
        reason
      );

      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }

      // Broadcast cache invalidation for currency updates
      broadcast.invalidateCache(['currency', `user:${userId}:currency`]);

      res.json({ 
        message: "Currency adjusted successfully",
        newBalance: result.newBalance
      });
    } catch (error) {
      console.error("Error adjusting currency:", error);
      res.status(500).json({ message: "Failed to adjust currency" });
    }
  });

  // GET /api/currency/packages - Get active currency packages (public)
  app.get("/api/currency/packages", async (req: any, res) => {
    try {
      const activeOnly = req.query.activeOnly !== 'false';
      const packages = await storage.getCurrencyPackages(activeOnly);
      res.json(packages);
    } catch (error) {
      console.error("Error fetching currency packages:", error);
      res.status(500).json({ message: "Failed to fetch currency packages" });
    }
  });

  // POST /api/currency/packages - Create currency package (admin only)
  app.post("/api/currency/packages", actionLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const admin = await storage.getUserByUsername(req.session.user.username);
      if (!admin) {
        return res.status(401).json({ message: "User not found" });
      }

      // Check admin access
      const hasAdminAccess = admin.isAdmin === 'true' || ['admin', 'owner'].includes(admin.role || '');
      if (!hasAdminAccess) {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Validate request body
      const validatedData = insertCurrencyPackageSchema.parse(req.body);
      
      const newPackage = await storage.createCurrencyPackage(validatedData);
      res.status(201).json(newPackage);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      console.error("Error creating currency package:", error);
      res.status(500).json({ message: "Failed to create currency package" });
    }
  });

  // PATCH /api/currency/packages/:id - Update currency package (admin only)
  app.patch("/api/currency/packages/:id", actionLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const admin = await storage.getUserByUsername(req.session.user.username);
      if (!admin) {
        return res.status(401).json({ message: "User not found" });
      }

      // Check admin access
      const hasAdminAccess = admin.isAdmin === 'true' || ['admin', 'owner'].includes(admin.role || '');
      if (!hasAdminAccess) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      
      // Validate request body
      const validatedData = updateCurrencyPackageSchema.parse(req.body);
      
      const updatedPackage = await storage.updateCurrencyPackage(id, validatedData);
      
      if (!updatedPackage) {
        return res.status(404).json({ message: "Currency package not found" });
      }

      res.json(updatedPackage);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      console.error("Error updating currency package:", error);
      res.status(500).json({ message: "Failed to update currency package" });
    }
  });

  // DELETE /api/currency/packages/:id - Delete currency package (admin only)
  app.delete("/api/currency/packages/:id", actionLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const admin = await storage.getUserByUsername(req.session.user.username);
      if (!admin) {
        return res.status(401).json({ message: "User not found" });
      }

      // Check admin access
      const hasAdminAccess = admin.isAdmin === 'true' || ['admin', 'owner'].includes(admin.role || '');
      if (!hasAdminAccess) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      
      const deleted = await storage.deleteCurrencyPackage(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Currency package not found" });
      }

      res.json({ message: "Currency package deleted successfully" });
    } catch (error) {
      console.error("Error deleting currency package:", error);
      res.status(500).json({ message: "Failed to delete currency package" });
    }
  });

  // ===== ADVERTISEMENTS ENDPOINTS =====

  // GET /api/admin/ads - List all advertisements (admin only)
  app.get("/api/admin/ads", adminAuth, async (req, res) => {
    try {
      const ads = await storage.getAllAds();
      res.json(ads);
    } catch (error) {
      console.error("Error fetching ads:", error);
      res.status(500).json({ message: "Failed to fetch advertisements" });
    }
  });

  // POST /api/admin/ads - Create new advertisement (admin only)
  app.post("/api/admin/ads", actionLimiter, doubleCsrfProtection, adminAuth, async (req, res) => {
    try {
      const validatedData = insertAdvertisementSchema.parse(req.body);
      
      let adData: any = { ...validatedData };
      
      // Handle two patterns for backward compatibility:
      // 1. New pattern: page + location provided → generate placement
      if (validatedData.page && validatedData.location) {
        adData.placement = `${validatedData.page}_${validatedData.location}`;
      }
      // 2. Legacy pattern: only placement provided → derive page and location
      else if (validatedData.placement) {
        // Import from shared schema for consistency
        const { AD_PAGES, AD_LOCATIONS } = await import("../shared/schema.js");
        
        // Smart parsing: try to match valid page prefixes (longest first to handle underscores)
        const validPages = [...AD_PAGES].sort((a, b) => b.length - a.length); // Sort by length descending
        const validLocations = [...AD_LOCATIONS];
        let foundPage = null;
        let foundLocation = null;
        
        for (const page of validPages) {
          if (validatedData.placement.startsWith(page + '_')) {
            foundPage = page;
            foundLocation = validatedData.placement.substring(page.length + 1); // +1 for the underscore
            break;
          }
        }
        
        // Validate that both page and location are valid
        if (foundPage && foundLocation && validLocations.includes(foundLocation as any)) {
          adData.page = foundPage;
          adData.location = foundLocation;
          // placement already exists in validatedData
        } else {
          // Fallback for invalid placement format
          return res.status(400).json({ 
            message: "Invalid placement format. Must be a valid page_location combination (e.g., 'homepage_sidebar', 'search_results_top_banner')" 
          });
        }
      }
      
      const newAd = await storage.createAd(adData);
      
      // Broadcast ad creation event
      broadcast.ad({
        adId: newAd.id,
        action: 'created',
        data: newAd
      }, (req as any).session?.user?.id);
      
      res.status(201).json(newAd);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      console.error("Error creating ad:", error);
      res.status(500).json({ message: "Failed to create advertisement" });
    }
  });

  // PATCH /api/admin/ads/:id - Update advertisement (admin only)
  app.patch("/api/admin/ads/:id", actionLimiter, doubleCsrfProtection, adminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateAdvertisementSchema.parse(req.body);
      
      // If page or location is being updated, we need to recalculate placement
      // Fetch existing ad to get current page/location values for partial updates
      if ((validatedData.page || validatedData.location) && !validatedData.placement) {
        const existingAd = await storage.getAdById(id);
        if (!existingAd) {
          return res.status(404).json({ message: "Advertisement not found" });
        }
        
        // Use new values if provided, otherwise keep existing values
        const finalPage = validatedData.page || existingAd.page;
        const finalLocation = validatedData.location || existingAd.location;
        
        // Recalculate placement from the final page + location combination
        validatedData.placement = `${finalPage}_${finalLocation}`;
      }
      
      const updatedAd = await storage.updateAd(id, validatedData);
      
      if (!updatedAd) {
        return res.status(404).json({ message: "Advertisement not found" });
      }
      
      // Broadcast ad update event
      broadcast.ad({
        adId: id,
        action: 'updated',
        data: updatedAd
      }, (req as any).session?.user?.id);

      res.json(updatedAd);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      console.error("Error updating ad:", error);
      res.status(500).json({ message: "Failed to update advertisement" });
    }
  });

  // DELETE /api/admin/ads/:id - Delete advertisement (admin only)
  app.delete("/api/admin/ads/:id", actionLimiter, doubleCsrfProtection, adminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteAd(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Advertisement not found" });
      }
      
      // Broadcast ad deletion event
      broadcast.ad({
        adId: id,
        action: 'deleted'
      }, (req as any).session?.user?.id);

      res.json({ message: "Advertisement deleted successfully" });
    } catch (error) {
      console.error("Error deleting ad:", error);
      res.status(500).json({ message: "Failed to delete advertisement" });
    }
  });

  // GET /api/ads/placement/:placement - Get active ads for specific page and location (public)
  // Updated to support new page + location system (backwards compatible with old placement param)
  app.get("/api/ads/placement/:placement", async (req: any, res) => {
    try {
      const { placement } = req.params;
      const { page: queryPage, location: queryLocation } = req.query;
      
      // Use query params if provided (new system), otherwise use placement param (backwards compatibility)
      let page = queryPage as string;
      let location = queryLocation as string | undefined;
      
      // Map old placement values to new page values for backwards compatibility
      if (!page && placement) {
        const placementMap: { [key: string]: string } = {
          'homepage': 'homepage',
          'manga-page': 'manga_detail',
          'chapter-reader': 'reader',
          'browse': 'search_results',
          'all': 'homepage' // Default to homepage for 'all'
        };
        page = placementMap[placement] || 'homepage';
      }
      
      // Validate page
      const validPages = ['homepage', 'manga_detail', 'reader', 'search_results'];
      if (!validPages.includes(page)) {
        return res.status(400).json({ message: "Invalid page value" });
      }
      
      // Validate location if provided
      if (location) {
        const validLocations = ['top_banner', 'bottom_banner', 'sidebar', 'in_content_1', 'in_content_2'];
        if (!validLocations.includes(location)) {
          return res.status(400).json({ message: "Invalid location value" });
        }
      }

      // Detect user context for targeting
      const userAgent = req.headers['user-agent'] || '';
      const deviceType = userAgent.match(/(mobile|tablet|ipad|iphone|android)/i) ? 
        (userAgent.match(/(tablet|ipad)/i) ? 'tablet' : 'mobile') : 'desktop';
      
      const user = req.session?.user ? await storage.getUserByUsername(req.session.user.username) : null;
      const userRole = user?.role || 'user';
      const userCountry = user?.country || null;
      
      // Get user's preferred language from header or profile
      const acceptLanguage = req.headers['accept-language'] || '';
      const userLanguage = acceptLanguage.split(',')[0]?.split('-')[0] || 'en';

      const context = {
        deviceType,
        userRole,
        userCountry,
        userLanguage,
      };

      const ads = await storage.getActiveAdsByPlacement(page, location, context);
      res.json(ads);
    } catch (error) {
      console.error("Error fetching ads by placement:", error);
      res.status(500).json({ message: "Failed to fetch advertisements" });
    }
  });

  // POST /api/ads/:id/click - Track ad click (public)
  app.post("/api/ads/:id/click", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.trackAdClick(id);
      
      if (!success) {
        return res.status(404).json({ message: "Advertisement not found" });
      }

      res.json({ message: "Click tracked successfully" });
    } catch (error) {
      console.error("Error tracking ad click:", error);
      res.status(500).json({ message: "Failed to track click" });
    }
  });

  // POST /api/ads/:id/impression - Track ad impression (public)
  app.post("/api/ads/:id/impression", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.trackAdImpression(id);
      
      if (!success) {
        return res.status(404).json({ message: "Advertisement not found" });
      }

      res.json({ message: "Impression tracked successfully" });
    } catch (error) {
      console.error("Error tracking ad impression:", error);
      res.status(500).json({ message: "Failed to track impression" });
    }
  });

  // GET /api/ads/analytics/overview - Get analytics overview (staff+)
  app.get("/api/ads/analytics/overview", isStaffOrAbove, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      const overview = await storage.getAdAnalyticsOverview(
        startDate as string | undefined,
        endDate as string | undefined
      );
      
      res.json(overview);
    } catch (error) {
      console.error("Error getting analytics overview:", error);
      res.status(500).json({ message: "Failed to get analytics overview" });
    }
  });

  // GET /api/ads/analytics/performance-history - Get daily performance data (staff+)
  app.get("/api/ads/analytics/performance-history", isStaffOrAbove, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      const history = await storage.getAdPerformanceHistory(
        startDate as string | undefined,
        endDate as string | undefined
      );
      
      res.json(history);
    } catch (error) {
      console.error("Error getting performance history:", error);
      res.status(500).json({ message: "Failed to get performance history" });
    }
  });

  // GET /api/ads/analytics/top-performers - Get top performing ads (staff+)
  app.get("/api/ads/analytics/top-performers", isStaffOrAbove, async (req, res) => {
    try {
      const { limit, startDate, endDate } = req.query;
      
      const topAds = await storage.getTopPerformingAds(
        limit ? parseInt(limit as string) : 5,
        startDate as string | undefined,
        endDate as string | undefined
      );
      
      res.json(topAds);
    } catch (error) {
      console.error("Error getting top performers:", error);
      res.status(500).json({ message: "Failed to get top performers" });
    }
  });

  // ===== A/B TESTING / VARIANT MANAGEMENT ENDPOINTS =====

  // GET /api/ads/variants/:variantGroup - Get all variants in a group (staff+)
  app.get("/api/ads/variants/:variantGroup", isStaffOrAbove, async (req, res) => {
    try {
      const { variantGroup } = req.params;
      
      if (!variantGroup) {
        return res.status(400).json({ message: "Variant group is required" });
      }

      const variants = await storage.getAdsByVariantGroup(variantGroup);
      res.json(variants);
    } catch (error) {
      console.error("Error fetching variant group:", error);
      res.status(500).json({ message: "Failed to fetch variant group" });
    }
  });

  // GET /api/ads/analytics/variant-comparison/:variantGroup - Compare variant performance (staff+)
  app.get("/api/ads/analytics/variant-comparison/:variantGroup", isStaffOrAbove, async (req, res) => {
    try {
      const { variantGroup } = req.params;
      const { startDate, endDate } = req.query;
      
      if (!variantGroup) {
        return res.status(400).json({ message: "Variant group is required" });
      }

      const comparison = await storage.getVariantComparisonAnalytics(
        variantGroup,
        startDate as string | undefined,
        endDate as string | undefined
      );
      
      res.json(comparison);
    } catch (error) {
      console.error("Error getting variant comparison:", error);
      res.status(500).json({ message: "Failed to get variant comparison" });
    }
  });

  // POST /api/ads/variants - Create variant group with multiple ads (staff+)
  app.post("/api/ads/variants", actionLimiter, doubleCsrfProtection, isStaffOrAbove, async (req, res) => {
    try {
      const { variantGroup, variants } = req.body;
      
      if (!variantGroup || typeof variantGroup !== 'string') {
        return res.status(400).json({ message: "Variant group name is required" });
      }

      if (!Array.isArray(variants) || variants.length < 2) {
        return res.status(400).json({ message: "At least 2 variants are required for A/B testing" });
      }

      // Validate each variant has required fields
      for (const variant of variants) {
        if (!variant.variantName || !variant.title || !variant.imageUrl || !variant.linkUrl) {
          return res.status(400).json({ 
            message: "Each variant must have variantName, title, imageUrl, and linkUrl" 
          });
        }
      }

      const createdVariants = await storage.createVariantGroup(variants, variantGroup);
      res.status(201).json({ 
        message: "Variant group created successfully", 
        variants: createdVariants 
      });
    } catch (error) {
      console.error("Error creating variant group:", error);
      res.status(500).json({ message: "Failed to create variant group" });
    }
  });

  // GET /api/ads/schedule-status - Get stats on scheduled/active/expired ads (staff+)
  app.get("/api/ads/schedule-status", isStaffOrAbove, async (req, res) => {
    try {
      const now = new Date().toISOString();
      const allAds = await storage.getAllAds();
      
      const scheduled = allAds.filter(ad => 
        ad.startDate && ad.endDate && ad.startDate > now
      ).length;
      
      const active = allAds.filter(ad => 
        ad.isActive === "true" &&
        (!ad.startDate || !ad.endDate || (ad.startDate <= now && ad.endDate > now))
      ).length;
      
      const expired = allAds.filter(ad => 
        ad.endDate && ad.endDate <= now
      ).length;
      
      const upcoming = allAds.filter(ad => 
        ad.startDate && ad.startDate > now && ad.isActive === "false"
      ).length;

      res.json({
        scheduled,
        active,
        expired,
        upcoming,
        total: allAds.length,
        lastUpdated: now
      });
    } catch (error) {
      console.error("Error getting schedule status:", error);
      res.status(500).json({ message: "Failed to get schedule status" });
    }
  });

  // POST /api/admin/ads/refresh-schedules - Manually trigger schedule update (staff+)
  app.post("/api/admin/ads/refresh-schedules", actionLimiter, doubleCsrfProtection, isStaffOrAbove, async (req, res) => {
    try {
      const result = await storage.autoUpdateAdSchedules();
      
      res.json({
        success: true,
        activated: result.activated,
        deactivated: result.deactivated,
        message: `Schedule refreshed: ${result.activated} ads activated, ${result.deactivated} ads deactivated`
      });
    } catch (error) {
      console.error("Error refreshing schedules:", error);
      res.status(500).json({ message: "Failed to refresh schedules" });
    }
  });

  // POST /api/admin/ads/bulk-enable - Enable multiple ads (admin only)
  app.post("/api/admin/ads/bulk-enable", actionLimiter, doubleCsrfProtection, adminAuth, async (req, res) => {
    try {
      const { ids } = req.body;
      
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "Invalid or empty ids array" });
      }

      await storage.updateManyAdsStatus(ids, true);
      
      // Broadcast bulk operation event
      broadcast.bulkOperation({
        operation: 'bulk_enable',
        entityType: 'ads',
        count: ids.length,
        data: { ids, status: true }
      }, (req as any).session?.user?.id);
      
      res.json({
        success: true,
        message: `${ids.length} ad(s) enabled successfully`
      });
    } catch (error) {
      console.error("Error enabling ads:", error);
      res.status(500).json({ message: "Failed to enable ads" });
    }
  });

  // POST /api/admin/ads/bulk-disable - Disable multiple ads (admin only)
  app.post("/api/admin/ads/bulk-disable", actionLimiter, doubleCsrfProtection, adminAuth, async (req, res) => {
    try {
      const { ids } = req.body;
      
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "Invalid or empty ids array" });
      }

      await storage.updateManyAdsStatus(ids, false);
      
      // Broadcast bulk operation event
      broadcast.bulkOperation({
        operation: 'bulk_disable',
        entityType: 'ads',
        count: ids.length,
        data: { ids, status: false }
      }, (req as any).session?.user?.id);
      
      res.json({
        success: true,
        message: `${ids.length} ad(s) disabled successfully`
      });
    } catch (error) {
      console.error("Error disabling ads:", error);
      res.status(500).json({ message: "Failed to disable ads" });
    }
  });

  // POST /api/admin/ads/bulk-delete - Delete multiple ads (admin only)
  app.post("/api/admin/ads/bulk-delete", actionLimiter, doubleCsrfProtection, adminAuth, async (req, res) => {
    try {
      const { ids } = req.body;
      
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "Invalid or empty ids array" });
      }

      await storage.deleteAdsByIds(ids);
      
      // Broadcast bulk operation event
      broadcast.bulkOperation({
        operation: 'bulk_delete',
        entityType: 'ads',
        count: ids.length,
        data: { ids }
      }, (req as any).session?.user?.id);
      
      res.json({
        success: true,
        message: `${ids.length} ad(s) deleted successfully`
      });
    } catch (error) {
      console.error("Error deleting ads:", error);
      res.status(500).json({ message: "Failed to delete ads" });
    }
  });

  // POST /api/admin/ads/import - Import multiple ads from CSV/JSON (admin only)
  app.post("/api/admin/ads/import", actionLimiter, doubleCsrfProtection, adminAuth, async (req, res) => {
    try {
      const { ads } = req.body;
      
      if (!Array.isArray(ads) || ads.length === 0) {
        return res.status(400).json({ message: "Invalid or empty ads array" });
      }

      const result = await storage.insertAdvertisementsBulk(ads);
      
      // Broadcast bulk operation event
      broadcast.bulkOperation({
        operation: 'bulk_import',
        entityType: 'ads',
        count: result.success,
        data: { total: ads.length, success: result.success, errors: result.errors.length }
      }, (req as any).session?.user?.id);
      
      res.json({
        success: result.success,
        errors: result.errors,
        message: result.errors.length > 0 
          ? `Imported ${result.success} ad(s) with ${result.errors.length} error(s)`
          : `Successfully imported ${result.success} ad(s)`
      });
    } catch (error) {
      console.error("Error importing ads:", error);
      res.status(500).json({ message: "Failed to import ads" });
    }
  });

  // GET /api/admin/ads/export - Export ads as CSV or JSON (admin only)
  app.get("/api/admin/ads/export", adminAuth, async (req, res) => {
    try {
      const format = req.query.format as string || 'csv';
      const ads = await storage.getAllAds();

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=ads-export.json');
        res.json(ads);
      } else if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=ads-export.csv');
        
        // CSV Headers
        const headers = [
          'id', 'title', 'description', 'imageUrl', 'linkUrl', 'type', 'page', 'location',
          'isActive', 'startDate', 'endDate', 'displayOrder', 'targetCountries', 
          'targetDeviceTypes', 'targetUserRoles', 'targetLanguages', 'budget', 
          'costPerClick', 'costPerImpression', 'conversionGoal', 'frequencyCap', 
          'dailyBudget', 'tags', 'notes'
        ];
        
        const csvRows = [headers.join(',')];
        
        for (const ad of ads) {
          const row = [
            ad.id || '',
            `"${(ad.title || '').replace(/"/g, '""')}"`,
            `"${(ad.description || '').replace(/"/g, '""')}"`,
            ad.imageUrl || '',
            ad.linkUrl || '',
            ad.type || '',
            ad.page || '',
            ad.location || '',
            ad.isActive || 'false',
            ad.startDate || '',
            ad.endDate || '',
            ad.displayOrder || '0',
            ad.targetCountries ? (typeof ad.targetCountries === 'string' ? JSON.parse(ad.targetCountries) : ad.targetCountries).join('|') : '',
            ad.targetDeviceTypes ? (typeof ad.targetDeviceTypes === 'string' ? JSON.parse(ad.targetDeviceTypes) : ad.targetDeviceTypes).join('|') : '',
            ad.targetUserRoles ? (typeof ad.targetUserRoles === 'string' ? JSON.parse(ad.targetUserRoles) : ad.targetUserRoles).join('|') : '',
            ad.targetLanguages ? (typeof ad.targetLanguages === 'string' ? JSON.parse(ad.targetLanguages) : ad.targetLanguages).join('|') : '',
            ad.budget || '',
            ad.costPerClick || '',
            ad.costPerImpression || '',
            ad.conversionGoal || '',
            ad.frequencyCap || '',
            ad.dailyBudget || '',
            ad.tags ? (typeof ad.tags === 'string' ? JSON.parse(ad.tags) : ad.tags).join('|') : '',
            `"${(ad.notes || '').replace(/"/g, '""')}"`
          ];
          csvRows.push(row.join(','));
        }
        
        res.send(csvRows.join('\n'));
      } else {
        res.status(400).json({ message: "Invalid format. Use 'csv' or 'json'" });
      }
    } catch (error) {
      console.error("Error exporting ads:", error);
      res.status(500).json({ message: "Failed to export ads" });
    }
  });

  // POST /api/currency/purchase - Create payment intent for currency purchase (authenticated)
  // From blueprint:javascript_stripe integration
  app.post("/api/currency/purchase", actionLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const { packageId } = req.body;
      if (!packageId) {
        return res.status(400).json({ message: "Package ID is required" });
      }

      const packages = await storage.getCurrencyPackages(false);
      const currencyPackage = packages.find(p => p.id === packageId);
      if (!currencyPackage || currencyPackage.isActive !== 'true') {
        return res.status(404).json({ message: "Currency package not found or inactive" });
      }

      // Check if Stripe is configured
      if (!stripe) {
        return res.status(503).json({ 
          message: "Payment processing not configured. Please contact administrator.",
          isStripeConfigured: false 
        });
      }

      // Create Stripe payment intent
      const amount = Math.round(parseFloat(currencyPackage.priceUSD) * 100); // Convert to cents
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "usd",
        metadata: {
          userId: user.id,
          packageId: currencyPackage.id,
          packageName: currencyPackage.name,
          currencyAmount: currencyPackage.currencyAmount.toString(),
          bonusPercentage: currencyPackage.bonusPercentage.toString(),
        },
      });

      res.json({ 
        clientSecret: paymentIntent.client_secret,
        isStripeConfigured: true 
      });
    } catch (error: any) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ 
        message: "Error creating payment intent: " + error.message 
      });
    }
  });

  // GET /api/currency/purchases - Get user's purchase history (authenticated)
  app.get("/api/currency/purchases", async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const purchases = await storage.getUserPurchases(user.id);
      res.json(purchases);
    } catch (error) {
      console.error("Error fetching user purchases:", error);
      res.status(500).json({ message: "Failed to fetch user purchases" });
    }
  });

  // ========== SUBSCRIPTION API ENDPOINTS ==========

  // GET /api/subscriptions/packages - Get all subscription packages
  app.get("/api/subscriptions/packages", async (req: any, res) => {
    try {
      const activeOnly = req.query.activeOnly !== 'false';
      const packages = await storage.getSubscriptionPackages(activeOnly);
      res.json(packages);
    } catch (error) {
      console.error("Error fetching subscription packages:", error);
      res.status(500).json({ message: "Failed to fetch subscription packages" });
    }
  });

  // GET /api/subscriptions/my-subscription - Get current user's subscription
  app.get("/api/subscriptions/my-subscription", async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const subscription = await storage.getUserActiveSubscription(user.id);
      res.json(subscription || null);
    } catch (error) {
      console.error("Error fetching user subscription:", error);
      res.status(500).json({ message: "Failed to fetch user subscription" });
    }
  });

  // POST /api/subscriptions/create-payment - Create subscription payment intent
  app.post("/api/subscriptions/create-payment", actionLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const { packageId } = req.body;
      if (!packageId) {
        return res.status(400).json({ message: "Package ID is required" });
      }

      const pkg = await storage.getSubscriptionPackageById(packageId);
      if (!pkg || pkg.isActive !== 'true') {
        return res.status(404).json({ message: "Subscription package not found or inactive" });
      }

      if (!stripe) {
        return res.status(503).json({ 
          message: "Payment processing not configured",
          isStripeConfigured: false 
        });
      }

      // Create or get Stripe customer
      let stripeCustomerId = user.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          name: user.username || undefined,
          metadata: { userId: user.id }
        });
        stripeCustomerId = customer.id;
        await storage.updateUserStripeCustomerId(user.id, stripeCustomerId);
      }

      // Create subscription
      const subscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: pkg.stripePriceId || undefined }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          userId: user.id,
          packageId: pkg.id,
          packageName: pkg.name,
        },
      });

      const invoice: any = subscription.latest_invoice;
      const paymentIntent: any = invoice?.payment_intent;

      res.json({ 
        clientSecret: paymentIntent?.client_secret || '',
        subscriptionId: subscription.id,
        isStripeConfigured: true 
      });
    } catch (error: any) {
      console.error("Error creating subscription:", error);
      res.status(500).json({ 
        message: "Error creating subscription: " + error.message 
      });
    }
  });

  // GET /api/subscriptions/current - Get current user's subscription with details
  app.get("/api/subscriptions/current", async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const subscription = await storage.getUserActiveSubscription(user.id);
      if (!subscription) {
        return res.status(404).json({ message: "No active subscription" });
      }

      const pkg = subscription.packageId 
        ? await storage.getSubscriptionPackageById(subscription.packageId)
        : null;
      res.json({
        ...subscription,
        packageName: pkg?.name || "Unknown",
        priceUSD: pkg?.priceUSD || "0",
        features: pkg?.features || "[]"
      });
    } catch (error) {
      console.error("Error fetching subscription:", error);
      res.status(500).json({ message: "Failed to fetch subscription" });
    }
  });

  // POST /api/subscriptions/subscribe - Create new subscription (SIMULATED)
  app.post("/api/subscriptions/subscribe", actionLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const { packageId } = req.body;
      const pkg = await storage.getSubscriptionPackageById(packageId);
      if (!pkg || pkg.isActive !== 'true') {
        return res.status(404).json({ message: "Package not found or inactive" });
      }

      // Check if user already has an active subscription
      const existingSub = await storage.getUserActiveSubscription(user.id);
      if (existingSub && existingSub.status === 'active') {
        return res.status(400).json({ message: "You already have an active subscription" });
      }

      // SIMULATED: Create subscription without payment processing
      const now = new Date();
      const monthLater = new Date(now);
      monthLater.setMonth(monthLater.getMonth() + 1);

      await storage.createUserSubscription({
        userId: user.id,
        packageId: pkg.id,
        status: 'active',
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: monthLater.toISOString(),
        cancelAtPeriodEnd: 'false',
        stripeCustomerId: null,
        stripeSubscriptionId: null
      });

      // Grant monthly coins if applicable
      if (pkg.coinBonus && pkg.coinBonus > 0) {
        await storage.processCurrencyChange(
          user.id,
          pkg.coinBonus,
          'subscription_bonus',
          `${pkg.name} monthly coin bonus`
        );
      }

      res.json({ 
        message: `Successfully subscribed to ${pkg.name}!`,
        success: true,
        package: pkg
      });
    } catch (error: any) {
      console.error("Error creating subscription:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/subscriptions/cancel - Cancel subscription
  app.post("/api/subscriptions/cancel", actionLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const subscription = await storage.getUserActiveSubscription(user.id);
      if (!subscription) {
        return res.status(404).json({ message: "No active subscription found" });
      }

      if (stripe && subscription.stripeSubscriptionId) {
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          cancel_at_period_end: true
        });
      }

      await storage.cancelUserSubscription(subscription.id);
      res.json({ message: "Subscription will be cancelled at period end" });
    } catch (error: any) {
      console.error("Error cancelling subscription:", error);
      res.status(500).json({ message: "Failed to cancel subscription" });
    }
  });

  // POST /api/subscriptions/reactivate - Reactivate cancelled subscription
  app.post("/api/subscriptions/reactivate", actionLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const subscription = await storage.getUserActiveSubscription(user.id);
      if (!subscription) {
        return res.status(404).json({ message: "No subscription found" });
      }

      if (stripe && subscription.stripeSubscriptionId) {
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          cancel_at_period_end: false
        });
      }

      // Update subscription to not cancel at period end
      await db.update(userSubscriptions)
        .set({ cancelAtPeriodEnd: 'false' })
        .where(eq(userSubscriptions.id, subscription.id))
        .run();

      res.json({ message: "Subscription reactivated successfully" });
    } catch (error: any) {
      console.error("Error reactivating subscription:", error);
      res.status(500).json({ message: "Failed to reactivate subscription" });
    }
  });

  // ========== FLASH SALES API ENDPOINTS ==========

  // POST /api/flash-sales/purchase - Purchase flash sale (SIMULATED)
  app.post("/api/flash-sales/purchase", actionLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const { saleId } = req.body;
      if (!saleId) {
        return res.status(400).json({ message: "Sale ID is required" });
      }

      const sales: any[] = await storage.getActiveFlashSales();
      const sale = sales.find((s: any) => s.id === saleId);
      
      if (!sale) {
        return res.status(404).json({ message: "Flash sale not found or expired" });
      }

      // Check if max purchases reached
      if (sale.maxPurchases && (sale.currentPurchases || 0) >= sale.maxPurchases) {
        return res.status(400).json({ message: "Flash sale sold out" });
      }

      // SIMULATED: Grant coins based on the sale
      let coinsToGrant = 0;
      
      if (sale.type === 'coin_package' && sale.targetId) {
        const packages = await storage.getCurrencyPackages(false);
        const pkg = packages.find((p: any) => p.id === sale.targetId);
        if (pkg) {
          coinsToGrant = pkg.currencyAmount + Math.floor((pkg.currencyAmount * (pkg.bonusPercentage || 0)) / 100);
        }
      } else {
        // Default coin amount for non-package sales
        coinsToGrant = 500;
      }

      await storage.processCurrencyChange(
        user.id,
        coinsToGrant,
        'flash_sale',
        `Flash Sale: ${sale.name}`
      );

      // Update sale purchase count
      await storage.incrementFlashSalePurchaseCount(saleId);

      res.json({ 
        message: "Flash sale purchase successful!",
        success: true,
        coinsReceived: coinsToGrant,
        saleName: sale.name
      });
    } catch (error: any) {
      console.error("Error purchasing flash sale:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ========== BATTLE PASS API ENDPOINTS ==========

  // GET /api/battle-pass/progress - Get user's battle pass progress
  app.get("/api/battle-pass/progress", async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const progress = await storage.getUserBattlePassProgress(user.id);
      const season = await storage.getCurrentBattlePassSeason();
      
      if (!progress || !season) {
        return res.json({ progress: null, season: null });
      }
      
      res.json({ 
        progress, 
        season: {
          id: season.id,
          name: season.name,
          description: season.description,
          startDate: season.startDate,
          endDate: season.endDate
        }
      });
    } catch (error) {
      console.error("Error fetching battle pass progress:", error);
      res.status(500).json({ message: "Failed to fetch progress" });
    }
  });

  // GET /api/battle-pass/rewards - Get battle pass rewards
  app.get("/api/battle-pass/rewards", async (req: any, res) => {
    try {
      const season = await storage.getCurrentBattlePassSeason();
      if (!season) {
        return res.json([]);
      }

      const rewards = await storage.getBattlePassRewards(season.id);
      
      // Group rewards by tier and structure them for the frontend
      const tierMap = new Map<number, { level: number; freeReward: any; premiumReward: any; claimed: boolean }>();
      
      rewards.forEach((reward: any) => {
        const tier = reward.tier;
        if (!tierMap.has(tier)) {
          tierMap.set(tier, {
            level: tier,
            freeReward: { type: 'coins', amount: 0, name: 'No reward' },
            premiumReward: { type: 'coins', amount: 0, name: 'No reward' },
            claimed: reward.claimed || false
          });
        }
        
        const tierData = tierMap.get(tier)!;
        const rewardObj = {
          type: reward.rewardType || 'coins',
          amount: parseInt(reward.rewardValue) || 0,
          name: reward.rewardName || `${reward.rewardType} reward`
        };
        
        // Handle both boolean and string values for isPremium
        const isPremium = reward.isPremium === true || reward.isPremium === 'true';
        
        if (isPremium) {
          tierData.premiumReward = rewardObj;
        } else {
          tierData.freeReward = rewardObj;
        }
        
        // Update claimed status if this reward has it
        if (reward.claimed !== undefined) {
          tierData.claimed = reward.claimed;
        }
      });
      
      const structuredRewards = Array.from(tierMap.values()).sort((a, b) => a.level - b.level);
      res.json(structuredRewards);
    } catch (error) {
      console.error("Error fetching rewards:", error);
      res.status(500).json({ message: "Failed to fetch rewards" });
    }
  });

  // POST /api/battle-pass/upgrade - Upgrade to premium battle pass (SIMULATED)
  app.post("/api/battle-pass/upgrade", actionLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const season = await storage.getCurrentBattlePassSeason();
      if (!season) {
        return res.status(404).json({ message: "No active season" });
      }

      // SIMULATED: Just update the progress to premium status
      const progress = await storage.getUserBattlePassProgress(user.id);
      if (!progress) {
        return res.status(404).json({ message: "Progress not found" });
      }

      await storage.upgradeBattlePassToPremium(user.id, season.id);
      
      res.json({ 
        message: "Successfully upgraded to Premium Battle Pass!",
        success: true 
      });
    } catch (error: any) {
      console.error("Error upgrading battle pass:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/battle-pass/claim - Claim battle pass reward
  app.post("/api/battle-pass/claim", actionLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { level } = req.body;
      res.json({ message: "Reward claimed", level });
    } catch (error: any) {
      console.error("Error claiming reward:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ========== ADMIN VIP/SUBSCRIPTION MANAGEMENT ENDPOINTS ==========

  // GET /api/admin/subscriptions - Get all subscription packages
  app.get("/api/admin/subscriptions", isStaffOrAbove, async (req: any, res) => {
    try {
      const packages = await storage.getSubscriptionPackages();
      res.json(packages);
    } catch (error) {
      console.error("Error fetching subscription packages:", error);
      res.status(500).json({ message: "Failed to fetch subscription packages" });
    }
  });

  // POST /api/admin/subscriptions - Create new subscription package
  app.post("/api/admin/subscriptions", isStaffOrAbove, doubleCsrfProtection, async (req: any, res) => {
    try {
      const { 
        name, 
        description, 
        priceUSD, 
        billingCycle, 
        features, 
        coinBonus, 
        discountPercentage,
        isAdFree,
        trialDays,
        isActive,
        displayOrder,
        stripePriceId
      } = req.body;
      
      // TODO: Integrate Stripe product/price creation here
      // If stripe is configured and no stripePriceId provided, create one:
      // if (stripe && !stripePriceId) {
      //   const product = await stripe.products.create({ name, description });
      //   const price = await stripe.prices.create({
      //     product: product.id,
      //     unit_amount: Math.round(parseFloat(priceUSD) * 100),
      //     currency: 'usd',
      //     recurring: { interval: billingCycle === 'yearly' ? 'year' : 'month' }
      //   });
      //   stripePriceId = price.id;
      // }
      
      const newPackage = await storage.createSubscriptionPackage({
        name,
        description,
        priceUSD,
        billingCycle,
        features: typeof features === 'string' ? features : JSON.stringify(features),
        coinBonus: coinBonus || 0,
        discountPercentage: discountPercentage || 0,
        isAdFree: isAdFree || 'false',
        earlyAccess: 'false',
        exclusiveContent: 'false',
        trialDays: trialDays || 0,
        isActive: isActive || 'true',
        displayOrder: displayOrder || 0,
        stripePriceId: stripePriceId || null
      });

      // Broadcast subscription package creation event
      broadcast.subscription({
        packageId: newPackage.id,
        action: 'created',
        data: newPackage
      }, req.session?.user?.id);

      res.json(newPackage);
    } catch (error) {
      console.error("Error creating subscription package:", error);
      res.status(500).json({ message: "Failed to create subscription package" });
    }
  });

  // PUT /api/admin/subscriptions/:id - Update subscription package
  app.put("/api/admin/subscriptions/:id", isStaffOrAbove, doubleCsrfProtection, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      if (updates.features && typeof updates.features !== 'string') {
        updates.features = JSON.stringify(updates.features);
      }
      
      const updated = await storage.updateSubscriptionPackage(id, updates);
      
      // Broadcast subscription package update event
      broadcast.subscription({
        packageId: id,
        action: 'updated',
        data: updated
      }, req.session?.user?.id);
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating subscription package:", error);
      res.status(500).json({ message: "Failed to update subscription package" });
    }
  });

  // DELETE /api/admin/subscriptions/:id - Delete subscription package
  app.delete("/api/admin/subscriptions/:id", isStaffOrAbove, doubleCsrfProtection, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteSubscriptionPackage(id);
      
      // Broadcast subscription package deletion event
      broadcast.subscription({
        packageId: id,
        action: 'deleted',
        data: { id }
      }, req.session?.user?.id);
      
      res.json({ message: "Subscription package deleted successfully" });
    } catch (error) {
      console.error("Error deleting subscription package:", error);
      res.status(500).json({ message: "Failed to delete subscription package" });
    }
  });

  // ========== ADMIN BATTLE PASS MANAGEMENT ENDPOINTS ==========

  // GET /api/admin/battle-pass/seasons - Get all battle pass seasons
  app.get("/api/admin/battle-pass/seasons", isStaffOrAbove, async (req: any, res) => {
    try {
      const seasons = await storage.getAllBattlePassSeasons();
      res.json(seasons);
    } catch (error) {
      console.error("Error fetching battle pass seasons:", error);
      res.status(500).json({ message: "Failed to fetch battle pass seasons" });
    }
  });

  // POST /api/admin/battle-pass/seasons - Create new season
  app.post("/api/admin/battle-pass/seasons", isStaffOrAbove, doubleCsrfProtection, async (req: any, res) => {
    try {
      const { name, startDate, endDate, premiumPrice } = req.body;
      
      const newSeason = await storage.createBattlePassSeason({
        name,
        startDate,
        endDate,
        premiumPrice: premiumPrice || '9.99',
        maxTier: 50
      });

      // Broadcast battle pass season creation event
      broadcast.battlePass({
        seasonId: newSeason.id,
        action: 'season_created',
        data: newSeason
      }, req.session?.user?.id);

      res.json(newSeason);
    } catch (error) {
      console.error("Error creating battle pass season:", error);
      res.status(500).json({ message: "Failed to create battle pass season" });
    }
  });

  // PUT /api/admin/battle-pass/seasons/:id - Update season
  app.put("/api/admin/battle-pass/seasons/:id", isStaffOrAbove, doubleCsrfProtection, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const updated = await storage.updateBattlePassSeason(id, updates);
      
      // Broadcast battle pass season update event
      broadcast.battlePass({
        seasonId: id,
        action: 'season_updated',
        data: updated
      }, req.session?.user?.id);
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating battle pass season:", error);
      res.status(500).json({ message: "Failed to update battle pass season" });
    }
  });

  // DELETE /api/admin/battle-pass/seasons/:id - Delete season
  app.delete("/api/admin/battle-pass/seasons/:id", isStaffOrAbove, doubleCsrfProtection, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteBattlePassSeason(id);
      
      // Broadcast battle pass season deletion event
      broadcast.battlePass({
        seasonId: id,
        action: 'season_deleted',
        data: { id }
      }, req.session?.user?.id);
      
      res.json({ message: "Battle pass season deleted successfully" });
    } catch (error) {
      console.error("Error deleting battle pass season:", error);
      res.status(500).json({ message: "Failed to delete battle pass season" });
    }
  });

  // GET /api/admin/battle-pass/tiers/:seasonId - Get all tiers for a season
  app.get("/api/admin/battle-pass/tiers/:seasonId", isStaffOrAbove, async (req: any, res) => {
    try {
      const { seasonId } = req.params;
      const tiers = await storage.getBattlePassRewards(seasonId);
      res.json(tiers);
    } catch (error) {
      console.error("Error fetching battle pass tiers:", error);
      res.status(500).json({ message: "Failed to fetch battle pass tiers" });
    }
  });

  // POST /api/admin/battle-pass/tiers - Create new tier/reward
  app.post("/api/admin/battle-pass/tiers", isStaffOrAbove, doubleCsrfProtection, async (req: any, res) => {
    try {
      const { seasonId, tier, freeReward, premiumReward, xpRequired } = req.body;
      
      const newTier = await storage.createBattlePassTier({
        seasonId,
        tier,
        freeReward: JSON.stringify(freeReward),
        premiumReward: JSON.stringify(premiumReward),
        xpRequired: xpRequired || 100
      });

      // Broadcast battle pass tier creation event
      broadcast.battlePass({
        seasonId: seasonId,
        action: 'tier_created',
        data: newTier
      }, req.session?.user?.id);

      res.json(newTier);
    } catch (error) {
      console.error("Error creating battle pass tier:", error);
      res.status(500).json({ message: "Failed to create battle pass tier" });
    }
  });

  // PUT /api/admin/battle-pass/tiers/:id - Update tier
  app.put("/api/admin/battle-pass/tiers/:id", isStaffOrAbove, doubleCsrfProtection, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      if (updates.freeReward && typeof updates.freeReward !== 'string') {
        updates.freeReward = JSON.stringify(updates.freeReward);
      }
      if (updates.premiumReward && typeof updates.premiumReward !== 'string') {
        updates.premiumReward = JSON.stringify(updates.premiumReward);
      }
      
      const updated = await storage.updateBattlePassTier(id, updates);
      
      // Broadcast battle pass tier update event
      broadcast.battlePass({
        seasonId: updated.seasonId,
        action: 'tier_updated',
        data: updated
      }, req.session?.user?.id);
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating battle pass tier:", error);
      res.status(500).json({ message: "Failed to update battle pass tier" });
    }
  });

  // DELETE /api/admin/battle-pass/tiers/:id - Delete tier
  app.delete("/api/admin/battle-pass/tiers/:id", isStaffOrAbove, doubleCsrfProtection, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteBattlePassTier(id);
      res.json({ message: "Battle pass tier deleted successfully" });
    } catch (error) {
      console.error("Error deleting battle pass tier:", error);
      res.status(500).json({ message: "Failed to delete battle pass tier" });
    }
  });

  // ========== ADMIN MONETIZATION API ENDPOINTS ==========

  // GET /api/admin/monetization/purchases - Get all purchases for export (admin only)
  app.get("/api/admin/monetization/purchases", isStaffOrAbove, async (req: any, res) => {
    try {
      const { limit = '1000', offset = '0', status } = req.query;
      
      const purchases = await storage.getAllPurchases(
        parseInt(limit as string),
        parseInt(offset as string),
        status as string
      );
      
      res.json(purchases);
    } catch (error) {
      console.error("Error fetching purchases:", error);
      res.status(500).json({ message: "Failed to fetch purchases" });
    }
  });

  // POST /api/admin/monetization/refund - Process refund (admin only)
  app.post("/api/admin/monetization/refund", isStaffOrAbove, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const admin = await storage.getUserByUsername(req.session.user.username);
      if (!admin) {
        return res.status(401).json({ message: "User not found" });
      }

      const { purchaseId, reason } = req.body;
      
      if (!purchaseId || !reason) {
        return res.status(400).json({ message: "Purchase ID and reason are required" });
      }
      
      const result = await storage.processRefund(purchaseId, admin.id, reason);
      
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }
      
      res.json({ message: result.message });
    } catch (error) {
      console.error("Error processing refund:", error);
      res.status(500).json({ message: "Failed to process refund" });
    }
  });

  // GET /api/admin/monetization/stats - Get monetization statistics
  app.get("/api/admin/monetization/stats", isStaffOrAbove, async (req: any, res) => {
    try {
      const { range } = req.query;
      
      // Calculate date ranges based on time range filter
      const now = new Date();
      let startDate: string | undefined;
      let endDate = now.toISOString();
      let previousStartDate: string | undefined;
      let previousEndDate: string | undefined;
      
      if (range === '7d') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        previousStartDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
        previousEndDate = startDate;
      } else if (range === '30d') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        previousStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
        previousEndDate = startDate;
      } else if (range === '90d') {
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
        previousStartDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString();
        previousEndDate = startDate;
      } else if (range === '1y') {
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
        previousStartDate = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000).toISOString();
        previousEndDate = startDate;
      }
      
      // Get all analytics data in parallel
      const [
        totalRevenue,
        monthlyRevenue,
        revenueByType,
        activeSubscriptions,
        mrr,
        averageOrderValue,
        conversionRate,
        revenueGrowth
      ] = await Promise.all([
        storage.getTotalRevenue(startDate, endDate),
        storage.getMonthlyRevenue(),
        storage.getRevenueByType(startDate, endDate),
        storage.getActiveSubscriptionsCount(),
        storage.getMRR(),
        storage.getAverageOrderValue(startDate, endDate),
        storage.getConversionRate(startDate, endDate),
        previousStartDate && previousEndDate 
          ? storage.getRevenueGrowth(startDate!, endDate, previousStartDate, previousEndDate)
          : Promise.resolve(0)
      ]);
      
      const stats = {
        totalRevenue,
        monthlyRevenue,
        revenueGrowth,
        activeSubscriptions,
        subscriptionRevenue: revenueByType.subscriptionRevenue,
        coinSalesRevenue: revenueByType.coinSalesRevenue,
        flashSalesRevenue: revenueByType.flashSalesRevenue,
        averageOrderValue,
        conversionRate,
        mrr
      };
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching monetization stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // GET /api/admin/monetization/top-packages - Get top selling packages
  app.get("/api/admin/monetization/top-packages", isStaffOrAbove, async (req: any, res) => {
    try {
      const { range, limit = '10' } = req.query;
      
      const now = new Date();
      let startDate: string | undefined;
      let endDate = now.toISOString();
      
      if (range === '7d') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (range === '30d') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      } else if (range === '90d') {
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      } else if (range === '1y') {
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
      }
      
      const packages = await storage.getTopSellingPackages(parseInt(limit as string), startDate, endDate);
      res.json(packages);
    } catch (error) {
      console.error("Error fetching top packages:", error);
      res.status(500).json({ message: "Failed to fetch packages" });
    }
  });

  // GET /api/admin/monetization/revenue-history - Get revenue history
  app.get("/api/admin/monetization/revenue-history", isStaffOrAbove, async (req: any, res) => {
    try {
      const { range } = req.query;
      
      const now = new Date();
      let startDate: string | undefined;
      let endDate = now.toISOString();
      let interval = 'daily';
      
      if (range === '7d') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        interval = 'daily';
      } else if (range === '30d') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        interval = 'daily';
      } else if (range === '90d') {
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
        interval = 'daily';
      } else if (range === '1y') {
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
        interval = 'monthly';
      }
      
      const history = await storage.getRevenueHistory(startDate, endDate, interval);
      res.json(history);
    } catch (error) {
      console.error("Error fetching revenue history:", error);
      res.status(500).json({ message: "Failed to fetch history" });
    }
  });

  // ========== DAILY REWARDS API ENDPOINTS ==========

  // GET /api/rewards/daily-status - Get user's daily reward status
  app.get("/api/rewards/daily-status", async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const status = await storage.getUserDailyRewardStatus(user.id);
      res.json(status);
    } catch (error) {
      console.error("Error fetching daily reward status:", error);
      res.status(500).json({ message: "Failed to fetch daily reward status" });
    }
  });

  // POST /api/rewards/claim-daily - Claim daily reward
  app.post("/api/rewards/claim-daily", actionLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const result = await storage.claimDailyReward(user.id);
      res.json(result);
    } catch (error: any) {
      console.error("Error claiming daily reward:", error);
      res.status(400).json({ message: error.message || "Failed to claim daily reward" });
    }
  });

  // ========== ACHIEVEMENTS API ENDPOINTS ==========

  // GET /api/achievements - Get all achievements
  app.get("/api/achievements", async (req: any, res) => {
    try {
      const achievements = await storage.getAllAchievements();
      res.json(achievements);
    } catch (error) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });

  // GET /api/achievements/my-progress - Get user's achievement progress
  app.get("/api/achievements/my-progress", async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const progress = await storage.getUserAchievementProgress(user.id);
      res.json(progress);
    } catch (error) {
      console.error("Error fetching achievement progress:", error);
      res.status(500).json({ message: "Failed to fetch achievement progress" });
    }
  });

  // ========== REFERRAL API ENDPOINTS ==========

  // GET /api/referrals/my-code - Get or create user's referral code
  app.get("/api/referrals/my-code", async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const code = await storage.getUserReferralCode(user.id);
      res.json(code);
    } catch (error) {
      console.error("Error fetching referral code:", error);
      res.status(500).json({ message: "Failed to fetch referral code" });
    }
  });

  // GET /api/referrals/my-referrals - Get user's referral stats
  app.get("/api/referrals/my-referrals", async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const referrals = await storage.getUserReferrals(user.id);
      res.json(referrals);
    } catch (error) {
      console.error("Error fetching referrals:", error);
      res.status(500).json({ message: "Failed to fetch referrals" });
    }
  });

  // POST /api/referrals/apply - Apply referral code
  app.post("/api/referrals/apply", actionLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ message: "Referral code is required" });
      }

      const result = await storage.applyReferralCode(user.id, code);
      res.json(result);
    } catch (error: any) {
      console.error("Error applying referral code:", error);
      res.status(400).json({ message: error.message || "Failed to apply referral code" });
    }
  });

  // ========== FLASH SALES API ENDPOINTS ==========

  // GET /api/flash-sales/active - Get active flash sales
  app.get("/api/flash-sales/active", async (req: any, res) => {
    try {
      const sales = await storage.getActiveFlashSales();
      res.json(sales);
    } catch (error) {
      console.error("Error fetching flash sales:", error);
      res.status(500).json({ message: "Failed to fetch flash sales" });
    }
  });

  // ========== ADMIN FLASH SALES API ENDPOINTS ==========

  // GET /api/admin/flash-sales - Get all flash sales (admin only)
  app.get("/api/admin/flash-sales", isStaffOrAbove, async (req: any, res) => {
    try {
      const sales = await storage.getAllFlashSales();
      res.json(sales);
    } catch (error) {
      console.error("Error fetching flash sales:", error);
      res.status(500).json({ message: "Failed to fetch flash sales" });
    }
  });

  // POST /api/admin/flash-sales/create - Create flash sale (admin only)
  app.post("/api/admin/flash-sales/create", isStaffOrAbove, doubleCsrfProtection, async (req: any, res) => {
    try {
      const { name, description, type, targetId, discountPercentage, originalPrice, salePrice, startTime, endTime, maxPurchases } = req.body;
      
      if (!name || !type || !discountPercentage || !originalPrice || !salePrice || !startTime || !endTime) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      const sale = await storage.createFlashSale({
        name,
        description,
        type,
        targetId,
        discountPercentage,
        originalPrice,
        salePrice,
        startTime,
        endTime,
        maxPurchases,
        currentPurchases: 0,
        isActive: "true"
      });
      
      // Broadcast flash sale creation event
      broadcast.flashSale({
        saleId: sale.id,
        action: 'created',
        data: sale
      }, req.session?.user?.id);
      
      res.status(201).json(sale);
    } catch (error) {
      console.error("Error creating flash sale:", error);
      res.status(500).json({ message: "Failed to create flash sale" });
    }
  });

  // PATCH /api/admin/flash-sales/:id - Update flash sale (admin only)
  app.patch("/api/admin/flash-sales/:id", isStaffOrAbove, doubleCsrfProtection, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const updatedSale = await storage.updateFlashSale(id, updates);
      
      if (!updatedSale) {
        return res.status(404).json({ message: "Flash sale not found" });
      }
      
      // Broadcast flash sale update event
      broadcast.flashSale({
        saleId: id,
        action: 'updated',
        data: updatedSale
      }, req.session?.user?.id);
      
      res.json(updatedSale);
    } catch (error) {
      console.error("Error updating flash sale:", error);
      res.status(500).json({ message: "Failed to update flash sale" });
    }
  });

  // DELETE /api/admin/flash-sales/:id - Delete flash sale (admin only)
  app.delete("/api/admin/flash-sales/:id", isStaffOrAbove, doubleCsrfProtection, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      const deleted = await storage.deleteFlashSale(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Flash sale not found" });
      }
      
      // Broadcast flash sale deletion event
      broadcast.flashSale({
        saleId: id,
        action: 'deleted',
        data: { id }
      }, req.session?.user?.id);
      
      res.json({ message: "Flash sale deleted successfully" });
    } catch (error) {
      console.error("Error deleting flash sale:", error);
      res.status(500).json({ message: "Failed to delete flash sale" });
    }
  });

  // ========== GIFT API ENDPOINTS ==========

  // POST /api/gifts/send - Send a gift
  app.post("/api/gifts/send", actionLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const { recipientId, recipientEmail, giftType, giftAmount, packageId, message } = req.body;

      const result = await storage.sendGift({
        senderId: user.id,
        recipientId,
        recipientEmail,
        giftType,
        giftAmount,
        packageId,
        message
      });

      res.json(result);
    } catch (error: any) {
      console.error("Error sending gift:", error);
      res.status(400).json({ message: error.message || "Failed to send gift" });
    }
  });

  // GET /api/gifts/received - Get user's received gifts
  app.get("/api/gifts/received", async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const gifts = await storage.getUserReceivedGifts(user.id);
      res.json(gifts);
    } catch (error) {
      console.error("Error fetching received gifts:", error);
      res.status(500).json({ message: "Failed to fetch received gifts" });
    }
  });

  // POST /api/gifts/:giftId/claim - Claim a gift
  app.post("/api/gifts/:giftId/claim", actionLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const result = await storage.claimGift(req.params.giftId, user.id);
      res.json(result);
    } catch (error: any) {
      console.error("Error claiming gift:", error);
      res.status(400).json({ message: error.message || "Failed to claim gift" });
    }
  });

  // ========== LOYALTY API ENDPOINTS ==========

  // GET /api/loyalty/my-status - Get user's loyalty status
  app.get("/api/loyalty/my-status", async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const status = await storage.getUserLoyaltyStatus(user.id);
      res.json(status);
    } catch (error) {
      console.error("Error fetching loyalty status:", error);
      res.status(500).json({ message: "Failed to fetch loyalty status" });
    }
  });

  // GET /api/loyalty/tiers - Get all loyalty tiers
  app.get("/api/loyalty/tiers", async (req: any, res) => {
    try {
      const tiers = await storage.getLoyaltyTiers();
      res.json(tiers);
    } catch (error) {
      console.error("Error fetching loyalty tiers:", error);
      res.status(500).json({ message: "Failed to fetch loyalty tiers" });
    }
  });

  // ========== BATTLE PASS API ENDPOINTS ==========

  // GET /api/battle-pass/current-season - Get current active season
  app.get("/api/battle-pass/current-season", async (req: any, res) => {
    try {
      const season = await storage.getCurrentBattlePassSeason();
      res.json(season || null);
    } catch (error) {
      console.error("Error fetching current season:", error);
      res.status(500).json({ message: "Failed to fetch current season" });
    }
  });

  // GET /api/battle-pass/my-progress - Get user's battle pass progress
  app.get("/api/battle-pass/my-progress", async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const progress = await storage.getUserBattlePassProgress(user.id);
      res.json(progress || null);
    } catch (error) {
      console.error("Error fetching battle pass progress:", error);
      res.status(500).json({ message: "Failed to fetch battle pass progress" });
    }
  });

  // POST /api/battle-pass/claim-reward - Claim battle pass reward
  app.post("/api/battle-pass/claim-reward", actionLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const { tier } = req.body;
      const result = await storage.claimBattlePassReward(user.id, tier);
      res.json(result);
    } catch (error: any) {
      console.error("Error claiming battle pass reward:", error);
      res.status(400).json({ message: error.message || "Failed to claim reward" });
    }
  });

  // ========== BULK CHAPTER UNLOCK API ENDPOINTS ==========

  // POST /api/chapters/unlock-series - Unlock all chapters of a series
  app.post("/api/chapters/unlock-series", actionLimiter, doubleCsrfProtection, async (req: any, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUserByUsername(req.session.user.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const { seriesId } = req.body;
      if (!seriesId) {
        return res.status(400).json({ message: "Series ID is required" });
      }

      const result = await storage.unlockAllSeriesChapters(user.id, seriesId);
      res.json(result);
    } catch (error: any) {
      console.error("Error unlocking series:", error);
      res.status(400).json({ message: error.message || "Failed to unlock series" });
    }
  });

  // ========== STRIPE WEBHOOKS ==========

  // Stripe webhook for handling payment events
  app.post("/api/webhooks/stripe", express.raw({ type: 'application/json' }), async (req, res) => {
    if (!stripe) {
      return res.status(503).json({ message: "Stripe not configured" });
    }

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      return res.status(400).json({ message: "Missing signature or webhook secret" });
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).json({ message: `Webhook Error: ${err.message}` });
    }

    try {
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const paymentIntent: any = event.data.object;
          const { userId, packageId, currencyAmount, bonusPercentage } = paymentIntent.metadata;

          if (userId && packageId && currencyAmount) {
            const totalCoins = parseInt(currencyAmount) + Math.floor((parseInt(currencyAmount) * parseInt(bonusPercentage || '0')) / 100);
            
            await storage.recordCurrencyPurchase({
              userId,
              packageId,
              amountPaid: (paymentIntent.amount / 100).toFixed(2),
              currencyReceived: totalCoins,
              paymentProvider: 'stripe',
              transactionId: paymentIntent.id,
              status: 'completed'
            });

            await storage.processCurrencyChange(
              userId,
              totalCoins,
              'purchase',
              `Purchased ${currencyAmount} coins (+${bonusPercentage}% bonus)`,
              packageId
            );
          }
          break;
        }

        case 'invoice.payment_succeeded': {
          const invoice: any = event.data.object;
          const subscriptionId = invoice.subscription;
          
          if (subscriptionId) {
            const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId);
            const subscription = subscriptionResponse as any;
            const userId = subscription.metadata?.userId;
            const packageId = subscription.metadata?.packageId;

            if (userId && packageId) {
              await storage.activateUserSubscription({
                userId,
                packageId,
                stripeCustomerId: subscription.customer as string,
                stripeSubscriptionId: subscription.id,
                currentPeriodStart: new Date((subscription.current_period_start || Date.now() / 1000) * 1000).toISOString(),
                currentPeriodEnd: new Date((subscription.current_period_end || Date.now() / 1000) * 1000).toISOString(),
              });
            }
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription: any = event.data.object;
          if (subscription.id) {
            await storage.expireUserSubscription(subscription.id);
          }
          break;
        }

        case 'customer.subscription.updated': {
          const subscription: any = event.data.object;
          if (subscription.id) {
            await storage.updateUserSubscriptionStatus(
              subscription.id,
              subscription.status,
              subscription.cancel_at_period_end
            );
          }
          break;
        }
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // RSS Feed Routes for Series Updates
  app.get("/api/rss/all", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const allSeries = await storage.getAllSeries();
      const recentSeries = allSeries
        .sort((a, b) => new Date(b.updatedAt ?? b.createdAt ?? Date.now()).getTime() - new Date(a.updatedAt ?? a.createdAt ?? Date.now()).getTime())
        .slice(0, limit);

      const baseUrl = req.protocol + '://' + req.get('host');
      
      let rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AmourScans - All Series Updates</title>
    <link>${baseUrl}</link>
    <description>Latest manga and manhwa series updates from AmourScans</description>
    <language>en-us</language>
    <atom:link href="${baseUrl}/api/rss/all" rel="self" type="application/rss+xml" />
`;

      for (const series of recentSeries) {
        const pubDate = new Date(series.updatedAt ?? series.createdAt ?? Date.now()).toUTCString();
        rssXml += `
    <item>
      <title>${series.title}</title>
      <link>${baseUrl}/series/${series.id}</link>
      <description>${series.description || 'No description available'}</description>
      <pubDate>${pubDate}</pubDate>
      <guid>${baseUrl}/series/${series.id}</guid>
    </item>`;
      }

      rssXml += `
  </channel>
</rss>`;

      res.set('Content-Type', 'application/rss+xml');
      res.send(rssXml);
    } catch (error) {
      console.error("Error generating RSS feed:", error);
      res.status(500).json({ message: "Failed to generate RSS feed" });
    }
  });

  app.get("/api/rss/series/:seriesId", async (req, res) => {
    try {
      const { seriesId } = req.params;
      const series = await storage.getSeries(seriesId);
      
      if (!series) {
        return res.status(404).json({ message: "Series not found" });
      }

      const chapters = await storage.getChaptersBySeriesId(series.id);
      const recentChapters = chapters
        .sort((a: Chapter, b: Chapter) => new Date(b.createdAt ?? Date.now()).getTime() - new Date(a.createdAt ?? Date.now()).getTime())
        .slice(0, 50);

      const baseUrl = req.protocol + '://' + req.get('host');
      
      let rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AmourScans - ${series.title}</title>
    <link>${baseUrl}/series/${seriesId}</link>
    <description>Latest chapter updates for ${series.title}</description>
    <language>en-us</language>
    <atom:link href="${baseUrl}/api/rss/series/${seriesId}" rel="self" type="application/rss+xml" />
`;

      for (const chapter of recentChapters) {
        const pubDate = new Date(chapter.createdAt ?? Date.now()).toUTCString();
        rssXml += `
    <item>
      <title>Chapter ${chapter.chapterNumber}${chapter.title ? ': ' + chapter.title : ''}</title>
      <link>${baseUrl}/read/${seriesId}/${chapter.chapterNumber}</link>
      <description>Chapter ${chapter.chapterNumber} of ${series.title}</description>
      <pubDate>${pubDate}</pubDate>
      <guid>${baseUrl}/read/${seriesId}/${chapter.chapterNumber}</guid>
    </item>`;
      }

      rssXml += `
  </channel>
</rss>`;

      res.set('Content-Type', 'application/rss+xml');
      res.send(rssXml);
    } catch (error) {
      console.error("Error generating series RSS feed:", error);
      res.status(500).json({ message: "Failed to generate RSS feed" });
    }
  });

  // Package Management Routes
  
  // Get all packages (unified)
  app.get("/api/admin/packages", adminAuth, async (req, res) => {
    try {
      const packages = await packageMgmt.getAllPackages();
      res.json(packages);
    } catch (error) {
      console.error("Error fetching packages:", error);
      res.status(500).json({ message: "Failed to fetch packages" });
    }
  });

  // Coupons Management
  app.get("/api/admin/coupons", adminAuth, async (req, res) => {
    try {
      const coupons = await packageMgmt.getCoupons();
      res.json(coupons);
    } catch (error) {
      console.error("Error fetching coupons:", error);
      res.status(500).json({ message: "Failed to fetch coupons" });
    }
  });

  app.post("/api/admin/coupons", adminAuth, doubleCsrfProtection, async (req, res) => {
    try {
      const coupon = await packageMgmt.createCoupon(req.body);
      
      // Broadcast coupon creation event
      broadcast.coupon(coupon.id, 'created', coupon, (req as any).session?.user?.id);
      
      res.json(coupon);
    } catch (error) {
      console.error("Error creating coupon:", error);
      res.status(500).json({ message: "Failed to create coupon" });
    }
  });

  app.put("/api/admin/coupons/:id", adminAuth, doubleCsrfProtection, async (req, res) => {
    try {
      const coupon = await packageMgmt.updateCoupon(req.params.id, req.body);
      
      // Broadcast coupon update event
      broadcast.coupon(req.params.id, 'updated', coupon, (req as any).session?.user?.id);
      
      res.json(coupon);
    } catch (error) {
      console.error("Error updating coupon:", error);
      res.status(500).json({ message: "Failed to update coupon" });
    }
  });

  app.delete("/api/admin/coupons/:id", adminAuth, doubleCsrfProtection, async (req, res) => {
    try {
      await packageMgmt.deleteCoupon(req.params.id);
      
      // Broadcast coupon deletion event
      broadcast.coupon(req.params.id, 'deleted', undefined, (req as any).session?.user?.id);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting coupon:", error);
      res.status(500).json({ message: "Failed to delete coupon" });
    }
  });

  app.post("/api/admin/coupons/validate", adminAuth, doubleCsrfProtection, async (req, res) => {
    try {
      const { code, amount } = req.body;
      const validation = await packageMgmt.validateCoupon(code, amount);
      res.json(validation);
    } catch (error) {
      console.error("Error validating coupon:", error);
      res.status(500).json({ message: "Failed to validate coupon" });
    }
  });

  // Package Bundles
  app.get("/api/admin/bundles", adminAuth, async (req, res) => {
    try {
      const bundles = await packageMgmt.getPackageBundles();
      res.json(bundles);
    } catch (error) {
      console.error("Error fetching bundles:", error);
      res.status(500).json({ message: "Failed to fetch bundles" });
    }
  });

  app.post("/api/admin/bundles", adminAuth, doubleCsrfProtection, async (req, res) => {
    try {
      const bundle = await packageMgmt.createPackageBundle(req.body);
      
      // Broadcast package/bundle creation event
      broadcast.package(bundle.id, 'created', bundle, (req as any).session?.user?.id);
      
      res.json(bundle);
    } catch (error) {
      console.error("Error creating bundle:", error);
      res.status(500).json({ message: "Failed to create bundle" });
    }
  });

  app.put("/api/admin/bundles/:id", adminAuth, doubleCsrfProtection, async (req, res) => {
    try {
      const bundle = await packageMgmt.updatePackageBundle(req.params.id, req.body);
      
      // Broadcast package/bundle update event
      broadcast.package(req.params.id, 'updated', bundle, (req as any).session?.user?.id);
      
      res.json(bundle);
    } catch (error) {
      console.error("Error updating bundle:", error);
      res.status(500).json({ message: "Failed to update bundle" });
    }
  });

  app.delete("/api/admin/bundles/:id", adminAuth, doubleCsrfProtection, async (req, res) => {
    try {
      await packageMgmt.deletePackageBundle(req.params.id);
      
      // Broadcast package/bundle deletion event
      broadcast.package(req.params.id, 'deleted', undefined, (req as any).session?.user?.id);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting bundle:", error);
      res.status(500).json({ message: "Failed to delete bundle" });
    }
  });

  // Invoices
  app.get("/api/admin/invoices", adminAuth, async (req, res) => {
    try {
      const { userId, status, startDate, endDate } = req.query;
      const invoices = await packageMgmt.getInvoices({
        userId: userId as string,
        status: status as string,
        startDate: startDate as string,
        endDate: endDate as string
      });
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.get("/api/admin/invoices/:id", adminAuth, async (req, res) => {
    try {
      const invoice = await packageMgmt.getInvoiceById(req.params.id);
      const items = await packageMgmt.getInvoiceItems(req.params.id);
      res.json({ ...invoice, items });
    } catch (error) {
      console.error("Error fetching invoice:", error);
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  app.post("/api/admin/invoices/:id/pdf", adminAuth, async (req, res) => {
    try {
      const pdfPath = await packageMgmt.generateInvoicePDF(req.params.id);
      res.json({ pdfPath });
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  // Manual Assignments
  app.get("/api/admin/manual-assignments", adminAuth, async (req, res) => {
    try {
      const { userId } = req.query;
      const assignments = await packageMgmt.getManualAssignments(userId as string);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      res.status(500).json({ message: "Failed to fetch assignments" });
    }
  });

  app.post("/api/admin/manual-assignments", adminAuth, doubleCsrfProtection, async (req: any, res) => {
    try {
      const assignment = await packageMgmt.createManualAssignment({
        ...req.body,
        assignedBy: req.session?.user?.id
      });
      res.json(assignment);
    } catch (error) {
      console.error("Error creating assignment:", error);
      res.status(500).json({ message: "Failed to create assignment" });
    }
  });

  app.delete("/api/admin/manual-assignments/:id", adminAuth, doubleCsrfProtection, async (req, res) => {
    try {
      await packageMgmt.revokeManualAssignment(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error revoking assignment:", error);
      res.status(500).json({ message: "Failed to revoke assignment" });
    }
  });

  // Subscribers Export
  app.get("/api/admin/subscribers", adminAuth, async (req, res) => {
    try {
      const { status, packageId, startDate, endDate } = req.query;
      const csv = await packageMgmt.exportSubscribersToCSV({
        status: status as string,
        packageId: packageId as string,
        startDate: startDate as string,
        endDate: endDate as string
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=subscribers.csv');
      res.send(csv);
    } catch (error) {
      console.error("Error exporting subscribers:", error);
      res.status(500).json({ message: "Failed to export subscribers" });
    }
  });

  // Offline Purchases & Reconciliation
  app.get("/api/admin/offline-purchases", adminAuth, async (req, res) => {
    try {
      const purchases = await packageMgmt.getOfflinePurchases();
      res.json(purchases);
    } catch (error) {
      console.error("Error fetching offline purchases:", error);
      res.status(500).json({ message: "Failed to fetch offline purchases" });
    }
  });

  app.post("/api/admin/purchases/:id/offline", adminAuth, doubleCsrfProtection, async (req, res) => {
    try {
      const purchase = await packageMgmt.flagPurchaseOffline(req.params.id);
      res.json(purchase);
    } catch (error) {
      console.error("Error flagging purchase:", error);
      res.status(500).json({ message: "Failed to flag purchase" });
    }
  });

  app.post("/api/admin/purchases/:id/reconcile", adminAuth, doubleCsrfProtection, async (req, res) => {
    try {
      const purchase = await packageMgmt.reconcilePurchase(req.params.id, req.body);
      res.json(purchase);
    } catch (error) {
      console.error("Error reconciling purchase:", error);
      res.status(500).json({ message: "Failed to reconcile purchase" });
    }
  });

  // Trial Management
  app.post("/api/admin/subscriptions/:id/activate-trial", adminAuth, doubleCsrfProtection, async (req, res) => {
    try {
      const { userId, trialDays } = req.body;
      const subscription = await packageMgmt.activateTrial(userId, req.params.id, trialDays);
      res.json(subscription);
    } catch (error) {
      console.error("Error activating trial:", error);
      res.status(500).json({ message: "Failed to activate trial" });
    }
  });

  // ============================================================================
  // ROLE AUTHORITY MANAGEMENT ROUTES (Discord-style)
  // ============================================================================
  
  // Get all roles with their permissions (Owner only)
  app.get("/api/roles", isOwner, async (req, res) => {
    try {
      const roles = await storage.getAllRolesWithPermissions();
      res.json(roles);
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ message: "Failed to fetch roles" });
    }
  });
  
  // Get specific role with permissions (Owner only)
  app.get("/api/roles/:id", isOwner, async (req, res) => {
    try {
      const role = await storage.getRoleWithPermissions(req.params.id);
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }
      res.json(role);
    } catch (error) {
      console.error("Error fetching role:", error);
      res.status(500).json({ message: "Failed to fetch role" });
    }
  });
  
  // Create new role (Owner only)
  app.post("/api/roles", isOwner, doubleCsrfProtection, async (req: any, res) => {
    try {
      const validatedData = insertRoleSchema.parse(req.body);
      const role = await storage.createRole(validatedData);
      
      // Get current user for broadcast
      const currentUser = await storage.getUserByUsername(req.session.user.username);
      
      // Broadcast role creation event for real-time updates
      broadcast.role({
        roleId: role.id,
        action: 'created',
        data: role
      }, currentUser?.id);
      
      res.status(201).json(role);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating role:", error);
      res.status(500).json({ message: "Failed to create role" });
    }
  });
  
  // Update role (Owner only)
  app.put("/api/roles/:id", isOwner, doubleCsrfProtection, async (req: any, res) => {
    try {
      const validatedData = updateRoleSchema.parse(req.body);
      const role = await storage.updateRole(req.params.id, validatedData);
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }
      
      // Get current user for broadcast
      const currentUser = await storage.getUserByUsername(req.session.user.username);
      
      // Broadcast role update event for real-time updates
      broadcast.role({
        roleId: req.params.id,
        action: 'updated',
        data: role
      }, currentUser?.id);
      
      res.json(role);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error updating role:", error);
      res.status(500).json({ message: "Failed to update role" });
    }
  });
  
  // Delete role (Owner only)
  app.delete("/api/roles/:id", isOwner, doubleCsrfProtection, async (req: any, res) => {
    try {
      const success = await storage.deleteRole(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Role not found or cannot be deleted" });
      }
      
      // Get current user for broadcast
      const currentUser = await storage.getUserByUsername(req.session.user.username);
      
      // Broadcast role deletion event for real-time updates
      broadcast.role({
        roleId: req.params.id,
        action: 'deleted',
        data: { id: req.params.id }
      }, currentUser?.id);
      
      res.json({ message: "Role deleted successfully" });
    } catch (error) {
      console.error("Error deleting role:", error);
      res.status(500).json({ message: "Failed to delete role" });
    }
  });
  
  // Get permissions for a role (Owner only)
  app.get("/api/roles/:id/permissions", isOwner, async (req, res) => {
    try {
      const permissions = await storage.getRolePermissions(req.params.id);
      if (!permissions) {
        return res.status(404).json({ message: "Role permissions not found" });
      }
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching role permissions:", error);
      res.status(500).json({ message: "Failed to fetch role permissions" });
    }
  });
  
  // Update permissions for a role (Owner only)
  app.put("/api/roles/:id/permissions", isOwner, doubleCsrfProtection, async (req: any, res) => {
    try {
      const permissionsData = { ...req.body, roleId: req.params.id };
      const validatedData = updateRolePermissionsSchema.parse(permissionsData);
      const permissions = await storage.updateRolePermissions(req.params.id, validatedData);
      if (!permissions) {
        return res.status(404).json({ message: "Role permissions not found" });
      }
      
      // Get current user for broadcast
      const currentUser = await storage.getUserByUsername(req.session.user.username);
      
      // Broadcast role permissions update event for real-time updates
      broadcast.role({
        roleId: req.params.id,
        action: 'permissions_updated',
        data: permissions
      }, currentUser?.id);
      
      res.json(permissions);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid permission data", errors: error.errors });
      }
      console.error("Error updating role permissions:", error);
      res.status(500).json({ message: "Failed to update role permissions" });
    }
  });
  
  // Assign role to user (Owner only)
  app.put("/api/users/:userId/role", isOwner, doubleCsrfProtection, async (req, res) => {
    try {
      const { roleName } = req.body;
      if (!roleName) {
        return res.status(400).json({ message: "Role name is required" });
      }
      
      const user = await storage.assignUserRole(req.params.userId, roleName);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error assigning user role:", error);
      res.status(500).json({ message: "Failed to assign user role" });
    }
  });
  
  // Get user's effective permissions based on their role
  app.get("/api/users/:userId/permissions", async (req: any, res) => {
    try {
      // Allow users to check their own permissions or require owner for checking others
      if (req.params.userId !== req.session?.passport?.user && !req.session?.passport?.isOwner) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const permissions = await storage.getUserPermissions(req.params.userId);
      if (!permissions) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      res.status(500).json({ message: "Failed to fetch user permissions" });
    }
  });

  // Mount SEO routes (sitemap.xml, robots.txt)
  app.use(seoRouter);

  const httpServer = createServer(app);

  return httpServer;
}
