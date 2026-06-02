// Local authentication with SQLite sessions - replitAuth.ts
import session from "express-session";
import type { Express, RequestHandler } from "express";
import Database from "better-sqlite3";
import { existsSync, mkdirSync, copyFileSync, unlinkSync, readFileSync, writeFileSync, chmodSync, statSync } from "fs";
import { dirname, join } from "path";
import { randomBytes } from "crypto";

// SECURITY: Extend session type to include timeout tracking
declare module "express-session" {
  interface SessionData {
    userId?: string;
    user?: any;
    createdAt?: number;
    lastActivity?: number;
    lastRenewal?: number;
  }
}

// Utility functions for session database corruption handling
// Derive data directory from env vars so it works in containers (Render/Fly) where /app is read-only
const _dataDir = process.env.SESSIONS_PATH
  ? dirname(process.env.SESSIONS_PATH)
  : process.env.DATABASE_PATH
  ? dirname(process.env.DATABASE_PATH)
  : './data';
const sessionsBackupDir = join(_dataDir, "backups");

// Use same conservative corruption detection for sessions
function isSessionSevereCorruption(error: any): boolean {
  if (!error || typeof error.message !== 'string') return false;
  
  // Only treat these as severe corruption requiring session database recreation
  const severeCorruptionIndicators = [
    'database disk image is malformed',
    'file is not a database',
    'SQLITE_CORRUPT',
    'SQLITE_NOTADB',
    'corrupt database',
    'malformed database',
    'database corruption'
  ];
  
  return severeCorruptionIndicators.some(indicator => 
    error.message.toLowerCase().includes(indicator.toLowerCase())
  );
}

// Check for recoverable session schema issues
function isSessionRecoverableIssue(error: any): boolean {
  if (!error || typeof error.message !== 'string') return false;
  
  const recoverableIndicators = [
    'no such table',
    'table already exists',
    'database schema has changed'
  ];
  
  return recoverableIndicators.some(indicator => 
    error.message.toLowerCase().includes(indicator.toLowerCase())
  );
}

// Check for session disk space issues
function isSessionDiskSpaceIssue(error: any): boolean {
  if (!error || typeof error.message !== 'string') return false;
  
  return error.message.toLowerCase().includes('database or disk is full') ||
         error.message.toLowerCase().includes('SQLITE_FULL');
}

function safeSessionDatabaseBackup(dbFilePath: string, reason: string): string {
  // Ensure backup directory exists
  if (!existsSync(sessionsBackupDir)) {
    mkdirSync(sessionsBackupDir, { recursive: true, mode: 0o755 });
    console.log('[sessions-protection] 📁 Created sessions backup directory:', sessionsBackupDir);
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${dbFilePath.split('/').pop()?.replace('.db', '')}-backup-${timestamp}.db`;
  const backupPath = join(sessionsBackupDir, fileName);
  
  try {
    if (existsSync(dbFilePath)) {
      console.log(`[sessions-protection] 🛡️  Creating safe backup of session database`);
      console.log(`[sessions-protection] 📄 Source: ${dbFilePath}`);
      console.log(`[sessions-protection] 💾 Backup: ${backupPath}`);
      console.log(`[sessions-protection] 🔍 Reason: ${reason}`);
      
      // Create backup
      copyFileSync(dbFilePath, backupPath);
      
      // Validate backup
      try {
        const testDb = new Database(backupPath, { readonly: true });
        testDb.exec('SELECT 1');
        testDb.close();
        console.log(`[sessions-protection] ✅ Session backup validated successfully`);
      } catch (validationError) {
        console.error(`[sessions-protection] ⚠️  Session backup validation failed:`, validationError);
        return '';
      }
      
      // Create preserved copy and then move original to allow fresh creation
      const preservedPath = `${dbFilePath}.preserved-${timestamp}`;
      try {
        copyFileSync(dbFilePath, preservedPath);
        console.log(`[sessions-protection] 🔒 Original session database preserved at: ${preservedPath}`);
        
        // Now move the original corrupted session file to allow fresh database creation
        const corruptedMovePath = `${dbFilePath}.corrupted-${timestamp}`;
        const fs = require('fs');
        fs.renameSync(dbFilePath, corruptedMovePath);
        console.log(`[sessions-protection] 🗑️  Moved corrupted session file to: ${corruptedMovePath}`);
        console.log(`[sessions-protection] 💡 Recovery can now create fresh session database at: ${dbFilePath}`);
        
      } catch (moveError) {
        console.error(`[sessions-protection] ❌ Could not move corrupted session file - aborting recovery:`, moveError);
        return '';
      }
      
      return backupPath;
    }
  } catch (backupError) {
    console.error(`[sessions-protection] ❌ Failed to create safe session backup: ${backupError}`);
  }
  
  return '';
}

function createSessionDatabaseSafely(dbFilePath: string): Database.Database | null {
  try {
    console.log(`[sessions-recovery] 🔧 Creating fresh sessions database: ${dbFilePath}`);
    const db = new Database(dbFilePath);
    
    // Test the database connection
    db.exec('SELECT 1');
    
    // Initialize sessions table
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expire INTEGER NOT NULL
      )
    `);
    
    // Create index for faster cleanup
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire)
    `);
    
    console.log(`[sessions-recovery] ✅ Successfully created and initialized sessions database: ${dbFilePath}`);
    return db;
  } catch (error) {
    console.error(`[sessions-recovery] ❌ Failed to create sessions database ${dbFilePath}:`, error);
    return null;
  }
}

// SQLite Session Store for offline compatibility
class SQLiteSessionStore extends session.Store {
  private db: Database.Database;

  constructor() {
    super();
    
    const sessionDbPath = process.env.SESSIONS_PATH || "./data/sessions.db";
    const sessionDbDir = dirname(sessionDbPath);
    
    // Ensure sessions directory exists
    if (!existsSync(sessionDbDir)) {
      mkdirSync(sessionDbDir, { recursive: true });
    }
    
    this.db = this.initializeSessionDatabase(sessionDbPath);
  }

  private initializeSessionDatabase(sessionDbPath: string): Database.Database {
    let attempts = 0;
    const maxAttempts = 3;
    
    // Ensure session database directory exists
    const sessionDbDir = dirname(sessionDbPath);
    if (!existsSync(sessionDbDir)) {
      mkdirSync(sessionDbDir, { recursive: true, mode: 0o755 });
      console.log(`[sessions-protection] 📁 Created session database directory: ${sessionDbDir}`);
    }
    
    while (attempts < maxAttempts) {
      try {
        console.log(`[sessions] Initializing session database (attempt ${attempts + 1}/${maxAttempts})`);
        
        // Try to open the database
        const db = new Database(sessionDbPath);
        
        // PERFORMANCE: Enable WAL mode for better concurrency
        db.pragma('journal_mode = WAL');
        
        // PERFORMANCE: Set synchronous to NORMAL for better performance
        db.pragma('synchronous = NORMAL');
        
        // PERFORMANCE: Increase cache size for session queries
        db.pragma('cache_size = -32000'); // 32MB cache
        
        // PERFORMANCE: Use memory for temporary storage
        db.pragma('temp_store = MEMORY');
        
        console.log('[sessions] ✅ Performance optimizations enabled (WAL mode, increased cache)');
        
        // Test database integrity properly
        const integrityResult = db.prepare('PRAGMA integrity_check').get() as any;
        if (integrityResult && integrityResult.integrity_check !== 'ok') {
          console.log(`[sessions] ⚠️  Session database integrity check warning: ${JSON.stringify(integrityResult)}`);
          // Continue but log the warning - this might be recoverable
        }
        
        // Create sessions table if it doesn't exist
        db.exec(`
          CREATE TABLE IF NOT EXISTS sessions (
            sid TEXT PRIMARY KEY,
            sess TEXT NOT NULL,
            expire INTEGER NOT NULL
          )
        `);
        
        // Create index for faster cleanup
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire)
        `);
        
        console.log("[sessions] ✅ SQLite session store initialized successfully");
        return db;
        
      } catch (error) {
        attempts++;
        console.error(`[sessions] ❌ Failed to initialize session database (attempt ${attempts}):`, error);
        
        // Handle different types of session errors conservatively
        if (isSessionSevereCorruption(error)) {
          console.log('[sessions-protection] 🚨 SEVERE session database corruption detected! Starting careful recovery...');
          
          // Create safe backup before any recovery attempts
          const backupPath = safeSessionDatabaseBackup(sessionDbPath, `Severe session corruption: ${(error as Error).message}`);
          if (backupPath) {
            console.log(`[sessions-protection] 💾 Session database safely backed up to: ${backupPath}`);
            
            // Try to create a fresh database only if backup succeeded
            const freshDb = createSessionDatabaseSafely(sessionDbPath);
            if (freshDb) {
              console.log('[sessions-recovery] ✅ Successfully recovered with fresh session database');
              console.log(`[sessions-recovery] 💡 Your original session data is preserved in: ${backupPath}`);
              return freshDb;
            }
          } else {
            console.error('[sessions-protection] ❌ Could not create safe session backup - aborting recovery');
          }
        } else if (isSessionRecoverableIssue(error)) {
          console.log('[sessions] 🔧 Detected recoverable session schema issue, attempting gentle repair...');
          
          // For session schema issues, try to create missing tables without destroying data
          try {
            const db = new Database(sessionDbPath);
            db.exec(`
              CREATE TABLE IF NOT EXISTS sessions (
                sid TEXT PRIMARY KEY,
                sess TEXT NOT NULL,
                expire INTEGER NOT NULL
              )
            `);
            db.exec(`
              CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire)
            `);
            console.log('[sessions] ✅ Session schema issue resolved successfully');
            return db;
          } catch (schemaError) {
            console.error('[sessions] ❌ Could not resolve session schema issue:', schemaError);
          }
        } else if (isSessionDiskSpaceIssue(error)) {
          console.error('[sessions] 💾 SESSION DISK SPACE ISSUE: Cannot initialize session database');
          console.error('[sessions] 💡 Please free up disk space and restart the application');
          throw new Error('Insufficient disk space for session database operation');
        }
        
        if (attempts >= maxAttempts) {
          console.error('[sessions] ❌ Failed to initialize session database after all attempts');
          console.error('[sessions-protection] 🛡️  Your session data has been protected - no files were deleted');
          throw new Error(`Session database initialization failed after ${maxAttempts} attempts: ${(error as Error).message}`);
        }
        
        // Wait a bit before retrying
        console.log('[sessions] ⏳ Waiting before retry...');
        require('child_process').execSync('sleep 1');
      }
    }
    
    throw new Error('Unexpected error in session database initialization');
  }

  get(sid: string, callback: (err?: any, session?: session.SessionData | null) => void): void {
    try {
      const stmt = this.db.prepare('SELECT sess, expire FROM sessions WHERE sid = ? AND expire > ?');
      const result = stmt.get(sid, Date.now()) as { sess: string; expire: number } | undefined;
      
      if (result) {
        const sessionData = JSON.parse(result.sess);
        callback(null, sessionData);
      } else {
        callback(null, null);
      }
    } catch (error) {
      callback(error);
    }
  }

  set(sid: string, sess: session.SessionData, callback?: (err?: any) => void): void {
    try {
      const expire = sess.cookie?.expires ? sess.cookie.expires.getTime() : Date.now() + (7 * 24 * 60 * 60 * 1000);
      const stmt = this.db.prepare('INSERT OR REPLACE INTO sessions (sid, sess, expire) VALUES (?, ?, ?)');
      stmt.run(sid, JSON.stringify(sess), expire);
      
      if (callback) callback();
    } catch (error) {
      if (callback) callback(error);
    }
  }

  destroy(sid: string, callback?: (err?: any) => void): void {
    try {
      const stmt = this.db.prepare('DELETE FROM sessions WHERE sid = ?');
      stmt.run(sid);
      
      if (callback) callback();
    } catch (error) {
      if (callback) callback(error);
    }
  }

  clear(callback?: (err?: any) => void): void {
    try {
      this.db.exec('DELETE FROM sessions');
      if (callback) callback();
    } catch (error) {
      if (callback) callback(error);
    }
  }

  length(callback: (err: any, length?: number) => void): void {
    try {
      const result = this.db.prepare('SELECT COUNT(*) as count FROM sessions WHERE expire > ?').get(Date.now()) as { count: number };
      callback(null, result.count);
    } catch (error) {
      callback(error);
    }
  }

  // Clean up expired sessions
  cleanup(): void {
    try {
      const stmt = this.db.prepare('DELETE FROM sessions WHERE expire <= ?');
      const result = stmt.run(Date.now());
      if (result.changes > 0) {
        console.log(`[sessions] Cleaned up ${result.changes} expired sessions`);
      }
    } catch (error) {
      console.error("[sessions] Error cleaning up expired sessions:", error);
    }
  }
}

// Function to get or create a persistent session secret
function getOrCreateSessionSecret(): string {
  // Derive data directory from env vars so it works in containers (Render/Fly) where /app is read-only
  const dataDir = process.env.SESSIONS_PATH
    ? dirname(process.env.SESSIONS_PATH)
    : process.env.DATABASE_PATH
    ? dirname(process.env.DATABASE_PATH)
    : './data';
  const secretFilePath = join(dataDir, 'session-secret.key');
  
  // Ensure data directory exists
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
    console.log('[sessions] Created data directory:', dataDir);
  }
  
  // Try to read existing secret file
  if (existsSync(secretFilePath)) {
    try {
      // Check and enforce secure file permissions
      const stats = statSync(secretFilePath);
      const mode = stats.mode & parseInt('777', 8);
      if (mode !== parseInt('600', 8)) {
        console.warn('[sessions] ⚠️  Session secret file has insecure permissions, fixing...');
        chmodSync(secretFilePath, 0o600);
      }
      
      const secret = readFileSync(secretFilePath, 'utf8').trim();
      if (secret && secret.length >= 32) {
        console.log('[sessions] ✅ Using existing persistent session secret');
        return secret;
      } else {
        console.warn('[sessions] ⚠️  Invalid session secret in file, generating new one');
      }
    } catch (error) {
      console.warn('[sessions] ⚠️  Failed to read session secret file, generating new one:', error);
    }
  }
  
  // Generate new session secret
  const newSecret = randomBytes(64).toString('hex');
  
  try {
    writeFileSync(secretFilePath, newSecret, { encoding: 'utf8', mode: 0o600 });
    console.log('[sessions] ✅ Generated and saved new persistent session secret to:', secretFilePath);
    return newSecret;
  } catch (error) {
    console.error('[sessions] ❌ Failed to save session secret to file:', error);
    console.warn('[sessions] ⚠️  Using temporary session secret (sessions will not persist)');
    return newSecret;
  }
}

// Function to get or create a persistent CSRF secret
export function getOrCreateCsrfSecret(): string {
  // Derive data directory from env vars so it works in containers (Render/Fly) where /app is read-only
  const dataDir = process.env.SESSIONS_PATH
    ? dirname(process.env.SESSIONS_PATH)
    : process.env.DATABASE_PATH
    ? dirname(process.env.DATABASE_PATH)
    : './data';
  const secretFilePath = join(dataDir, 'csrf-secret.key');
  
  // Ensure data directory exists
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
    console.log('[csrf] Created data directory:', dataDir);
  }
  
  // Try to read existing secret file
  if (existsSync(secretFilePath)) {
    try {
      // Check and enforce secure file permissions
      const stats = statSync(secretFilePath);
      const mode = stats.mode & parseInt('777', 8);
      if (mode !== parseInt('600', 8)) {
        console.warn('[csrf] ⚠️  CSRF secret file has insecure permissions, fixing...');
        chmodSync(secretFilePath, 0o600);
      }
      
      const secret = readFileSync(secretFilePath, 'utf8').trim();
      if (secret && secret.length >= 32) {
        console.log('[csrf] ✅ Using existing persistent CSRF secret');
        return secret;
      } else {
        console.warn('[csrf] ⚠️  Invalid CSRF secret in file, generating new one');
      }
    } catch (error) {
      console.warn('[csrf] ⚠️  Failed to read CSRF secret file, generating new one:', error);
    }
  }
  
  // Generate new CSRF secret (64 bytes = 128 hex characters)
  const newSecret = randomBytes(64).toString('hex');
  
  try {
    writeFileSync(secretFilePath, newSecret, { encoding: 'utf8', mode: 0o600 });
    console.log('[csrf] ✅ Generated and saved new persistent CSRF secret to:', secretFilePath);
    return newSecret;
  } catch (error) {
    console.error('[csrf] ❌ Failed to save CSRF secret to file:', error);
    console.warn('[csrf] ⚠️  Using temporary CSRF secret (protection will not persist)');
    return newSecret;
  }
}

export function getSession() {
  // SECURITY: Implement proper session timeout
  // Absolute timeout: maximum session lifetime (24 hours)
  // Idle timeout: session expires after inactivity (2 hours)
  const ABSOLUTE_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
  const IDLE_TIMEOUT = 2 * 60 * 60 * 1000;      // 2 hours
  const RENEWAL_WINDOW = 5 * 60 * 1000;          // Renew if older than 5 minutes
  
  // Get persistent session secret from file
  const sessionSecret = getOrCreateSessionSecret();
  
  // Always use SQLite session store for true offline capability and consistency
  console.log("[sessions] Using SQLite session store for offline compatibility");
  const sessionStore: session.Store = new SQLiteSessionStore();
  
  // Setup periodic cleanup for SQLite sessions
  if (sessionStore instanceof SQLiteSessionStore) {
    // Clean up expired sessions every hour
    setInterval(() => {
      sessionStore.cleanup();
    }, 60 * 60 * 1000);
    
    // Clean up on startup
    sessionStore.cleanup();
  }
  
  return session({
    secret: sessionSecret,
    store: sessionStore,
    resave: false, // Don't save on every request
    saveUninitialized: false,
    rolling: false, // We handle rolling manually with middleware
    name: "auth.sid", // Align with logout cookie name
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: ABSOLUTE_TIMEOUT, // Reduced from 1 week to 24 hours
    },
  });
}

/**
 * SECURITY: Session timeout and renewal middleware
 * Implements idle timeout and rolling session renewal
 */
export const sessionTimeoutMiddleware: RequestHandler = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    // Not authenticated - skip
    return next();
  }
  
  const now = Date.now();
  const ABSOLUTE_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours (matches cookie maxAge)
  const IDLE_TIMEOUT = 2 * 60 * 60 * 1000;      // 2 hours
  const RENEWAL_WINDOW = 5 * 60 * 1000;          // Renew if older than 5 minutes
  
  // Initialize session timestamps on first authenticated request
  if (!req.session.createdAt) {
    req.session.createdAt = now;
    req.session.lastActivity = now;
  }
  
  const sessionAge = now - (req.session.createdAt || now);
  const timeSinceLastActivity = now - (req.session.lastActivity || now);
  
  // SECURITY: Check absolute timeout first (session cannot live forever)
  if (sessionAge > ABSOLUTE_TIMEOUT) {
    console.log(`[sessions] Session expired (absolute timeout): ${req.session.userId}`);
    req.session.destroy((err) => {
      if (err) {
        console.error('[sessions] Error destroying expired session:', err);
      }
    });
    return res.status(401).json({ 
      message: "Session expired. Please log in again.",
      code: "SESSION_ABSOLUTE_TIMEOUT"
    });
  }
  
  // SECURITY: Check idle timeout
  if (timeSinceLastActivity > IDLE_TIMEOUT) {
    console.log(`[sessions] Session expired due to inactivity: ${req.session.userId}`);
    req.session.destroy((err) => {
      if (err) {
        console.error('[sessions] Error destroying expired session:', err);
      }
    });
    return res.status(401).json({ 
      message: "Session expired due to inactivity",
      code: "SESSION_IDLE_TIMEOUT"
    });
  }
  
  // Update last activity timestamp
  req.session.lastActivity = now;
  
  // Rolling session renewal: renew cookie if it's been more than RENEWAL_WINDOW since last renewal
  // Note: This extends the expiration but doesn't reset createdAt (absolute timeout still applies)
  const timeSinceRenewal = now - (req.session.lastRenewal || req.session.createdAt || now);
  if (timeSinceRenewal > RENEWAL_WINDOW) {
    req.session.lastRenewal = now;
    // Touch the session to update cookie maxAge (extends expiration)
    req.session.touch();
    console.log(`[sessions] Session renewed for user: ${req.session.userId}`);
  }
  
  next();
};

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  
  // SECURITY: Apply session timeout and renewal middleware after session middleware
  app.use(sessionTimeoutMiddleware);
  
  console.log("[auth] Local authentication only - using SQLite sessions");
  console.log("[auth] Username/password authentication ready");
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // Check local session-based authentication
  if (req.session?.userId) {
    // User is authenticated via local session
    return next();
  }
  
  // No valid authentication found
  return res.status(401).json({ message: "Unauthorized" });
};

// Role-based authorization middleware
import type { User } from "@shared/schema";

// Helper to get user with role info from request
async function getUserFromRequest(req: any): Promise<User | null> {
  if (!req.session?.user) {
    return null;
  }
  
  // Import storage dynamically to avoid circular dependency
  const { storage } = await import("./storage");
  const user = await storage.getUserByUsername(req.session.user.username);
  return user ?? null;
}

// Check if user has staff role or higher (staff, admin, owner)
export const isStaff: RequestHandler = async (req, res, next) => {
  try {
    const user = await getUserFromRequest(req);
    
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const hasStaffAccess = ['staff', 'admin', 'owner'].includes(user.role || '') || user.isAdmin === 'true';
    
    if (!hasStaffAccess) {
      return res.status(403).json({ message: "Forbidden: Staff access required" });
    }
    
    // Attach user to request for downstream use
    (req as any).user = user;
    next();
  } catch (error) {
    console.error("Staff auth error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Check if user has premium role or higher (premium, staff, admin, owner)
export const isPremium: RequestHandler = async (req, res, next) => {
  try {
    const user = await getUserFromRequest(req);
    
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const hasPremiumAccess = ['premium', 'staff', 'admin', 'owner'].includes(user.role || '') || user.isAdmin === 'true';
    
    if (!hasPremiumAccess) {
      return res.status(403).json({ message: "Forbidden: Premium access required" });
    }
    
    // Attach user to request for downstream use
    (req as any).user = user;
    next();
  } catch (error) {
    console.error("Premium auth error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Check if user has admin role or higher (admin, owner)
export const isAdmin: RequestHandler = async (req, res, next) => {
  try {
    const user = await getUserFromRequest(req);
    
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const hasAdminAccess = user.isAdmin === 'true' || ['admin', 'owner'].includes(user.role || '');
    
    if (!hasAdminAccess) {
      return res.status(403).json({ message: "Forbidden: Admin access required" });
    }
    
    // Attach user to request for downstream use
    (req as any).user = user;
    next();
  } catch (error) {
    console.error("Admin auth error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Check if user has owner role (highest level)
export const isOwner: RequestHandler = async (req, res, next) => {
  try {
    const user = await getUserFromRequest(req);
    
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const hasOwnerAccess = user.role === 'owner';
    
    if (!hasOwnerAccess) {
      return res.status(403).json({ message: "Forbidden: Owner access required" });
    }
    
    // Attach user to request for downstream use
    (req as any).user = user;
    next();
  } catch (error) {
    console.error("Owner auth error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Middleware to check if user is staff or above (convenience function)
export const isStaffOrAbove = isStaff;

// Permission-based authorization middleware
export function requirePermission(...permissions: string[]): RequestHandler {
  return async (req, res, next) => {
    try {
      const user = await getUserFromRequest(req);
      
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Owner has all permissions
      if (user.role === 'owner') {
        (req as any).user = user;
        return next();
      }
      
      // Import storage dynamically to avoid circular dependency
      const { storage } = await import("./storage");
      const userPermissions = await storage.getUserPermissions(user.id);
      
      if (!userPermissions) {
        return res.status(403).json({ message: "Forbidden: No permissions found" });
      }
      
      // Check if user has all required permissions
      for (const permission of permissions) {
        const permissionValue = userPermissions[permission as keyof typeof userPermissions];
        if (permissionValue !== "true") {
          return res.status(403).json({ 
            message: `Forbidden: Missing permission '${permission}'` 
          });
        }
      }
      
      // Attach user to request for downstream use
      (req as any).user = user;
      next();
    } catch (error) {
      console.error("Permission auth error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };
}

// Helper function to check if user has specific permission(s)
export async function hasPermission(userId: string, ...permissions: string[]): Promise<boolean> {
  try {
    // Import storage dynamically to avoid circular dependency
    const { storage } = await import("./storage");
    
    // Get user to check if they're the owner (owners have all permissions)
    const user = await storage.getUser(userId);
    if (user?.role === 'owner') {
      return true;
    }
    
    const userPermissions = await storage.getUserPermissions(userId);
    if (!userPermissions) {
      return false;
    }
    
    // Check if user has all required permissions
    for (const permission of permissions) {
      const permissionValue = userPermissions[permission as keyof typeof userPermissions];
      if (permissionValue !== "true") {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error("Error checking permissions:", error);
    return false;
  }
}