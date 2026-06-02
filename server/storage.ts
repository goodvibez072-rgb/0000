import { type User, type InsertUser, type UpsertUser, users, type Series, type InsertSeries, type UpsertSeries, series, type Language, type InsertLanguage, languages, type SeriesTranslation, type InsertSeriesTranslation, seriesTranslations, type Chapter, type InsertChapter, type UpsertChapter, chapters, type Setting, type InsertSetting, type UpsertSetting, settings, type SettingResponse, type UserLibrary, type InsertUserLibrary, userLibrary, type UserFollow, type InsertUserFollow, userFollows, type Comment, type InsertComment, type CommentWithUser, comments, type ReadingProgress, type InsertReadingProgress, type ReadingProgressWithSeries, readingProgress, type ReadingList, type InsertReadingList, readingLists, type ReadingListItem, type InsertReadingListItem, readingListItems, type EmailVerificationToken, type InsertEmailVerificationToken, emailVerificationTokens, type PasswordResetToken, type InsertPasswordResetToken, passwordResetTokens, type UserRating, type InsertUserRating, type UserRatingWithUser, userRatings, type UserFollowUser, type InsertUserFollowUser, userFollowsUsers, type CurrencyTransaction, type InsertCurrencyTransaction, currencyTransactions, type CurrencyPackage, type InsertCurrencyPackage, currencyPackages, type UserPurchase, type InsertUserPurchase, userPurchases, type ChapterAccessControl, type InsertChapterAccessControl, chapterAccessControl, type UserChapterUnlock, type InsertUserChapterUnlock, userChapterUnlocks, type DmcaNotice, type InsertDmcaNotice, dmcaNotices, type Advertisement, type InsertAdvertisement, advertisements, adPerformanceHistory, type SubscriptionPackage, type InsertSubscriptionPackage, subscriptionPackages, type UserSubscription, type InsertUserSubscription, userSubscriptions, type DailyReward, type InsertDailyReward, dailyRewards, type UserDailyClaim, type InsertUserDailyClaim, userDailyClaims, type Achievement, type InsertAchievement, achievements, type UserAchievement, type InsertUserAchievement, userAchievements, type Coupon, type InsertCoupon, coupons, type CouponRedemption, type InsertCouponRedemption, couponRedemptions, type PackageBundle, type InsertPackageBundle, packageBundles, type Invoice, type InsertInvoice, invoices, type InvoiceItem, type InsertInvoiceItem, invoiceItems, type ManualAssignment, type InsertManualAssignment, manualAssignments, type ReferralCode, type InsertReferralCode, referralCodes, type Referral, type InsertReferral, referrals, type FlashSale, type InsertFlashSale, flashSales, type GiftTransaction, type InsertGiftTransaction, giftTransactions, type LoyaltyTier, type InsertLoyaltyTier, loyaltyTiers, type UserLoyalty, type InsertUserLoyalty, userLoyalty, type BattlePassSeason, type InsertBattlePassSeason, battlePassSeasons, type BattlePassReward, type InsertBattlePassReward, battlePassRewards, type UserBattlePassProgress, type InsertUserBattlePassProgress, userBattlePassProgress, type UserWarning, type InsertUserWarning, userWarnings, type AdminActivityLog, type InsertAdminActivityLog, adminActivityLogs, type Role, type InsertRole, roles, type RolePermissions, type InsertRolePermissions, rolePermissions } from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, sql, desc, asc, and, or, like, inArray, gte, lte } from "drizzle-orm";
import { existsSync, mkdirSync, copyFileSync, unlinkSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { randomBytes } from "crypto";

// Database paths - supports both local development and Fly.io deployment
// Fly.io sets DATABASE_PATH and SESSIONS_PATH to /data/database.db and /data/sessions.db
// Local development uses ./data/database.db and ./data/sessions.db
const dbPath = process.env.DATABASE_PATH || "./data/database.db";
const sessionsDbPath = process.env.SESSIONS_PATH || "./data/sessions.db";
const backupDir = join(dirname(dbPath), "backups");

console.log(`[database] Using database path: ${dbPath}`);
console.log(`[database] Using sessions path: ${sessionsDbPath}`);
console.log(`[database] Using backup directory: ${backupDir}`);

// Ensure data directory exists
const dbDir = dirname(dbPath);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
  console.log(`[database] Created data directory: ${dbDir}`);
}

// Ensure backup directory exists
if (!existsSync(backupDir)) {
  mkdirSync(backupDir, { recursive: true });
  console.log('[backup] Created backup directory:', backupDir);
}

// Conservative database corruption detection - only treat severe corruption as true corruption
function isSevereCorruption(error: any): boolean {
  if (!error || typeof error.message !== 'string') return false;
  
  // Only treat these as true corruption requiring database recreation
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

// Check for recoverable schema issues that don't require data destruction
function isRecoverableSchemaIssue(error: any): boolean {
  if (!error || typeof error.message !== 'string') return false;
  
  const recoverableIndicators = [
    'no such table',
    'table already exists',
    'database schema has changed',
    'no such column'
  ];
  
  return recoverableIndicators.some(indicator => 
    error.message.toLowerCase().includes(indicator.toLowerCase())
  );
}

// Check for disk space issues that need attention but not data destruction
function isDiskSpaceIssue(error: any): boolean {
  if (!error || typeof error.message !== 'string') return false;
  
  return error.message.toLowerCase().includes('database or disk is full') ||
         error.message.toLowerCase().includes('SQLITE_FULL');
}

function safeDatabaseBackup(dbFilePath: string, reason: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${dbFilePath.split('/').pop()?.replace('.db', '')}-backup-${timestamp}.db`;
  const backupPath = join(backupDir, fileName);
  
  try {
    if (existsSync(dbFilePath)) {
      console.log(`[data-protection] 🛡️  Creating safe backup of database before recovery`);
      console.log(`[data-protection] 📄 Source: ${dbFilePath}`);
      console.log(`[data-protection] 💾 Backup: ${backupPath}`);
      console.log(`[data-protection] 🔍 Reason: ${reason}`);
      
      // Create backup
      copyFileSync(dbFilePath, backupPath);
      
      // Validate backup by trying to open it
      try {
        const testDb = new Database(backupPath, { readonly: true });
        testDb.exec('SELECT 1');
        testDb.close();
        console.log(`[data-protection] ✅ Backup validated successfully`);
      } catch (validationError) {
        console.error(`[data-protection] ⚠️  Backup validation failed, keeping original:`, validationError);
        // If backup is invalid, don't proceed with recovery
        return '';
      }
      
      // Create preserved copy and then move original to allow fresh creation
      const preservedPath = `${dbFilePath}.preserved-${timestamp}`;
      try {
        copyFileSync(dbFilePath, preservedPath);
        console.log(`[data-protection] 🔒 Original database preserved at: ${preservedPath}`);
        
        // Now move the original corrupted file to allow fresh database creation
        const corruptedMovePath = `${dbFilePath}.corrupted-${timestamp}`;
        const fs = require('fs');
        fs.renameSync(dbFilePath, corruptedMovePath);
        console.log(`[data-protection] 🗑️  Moved corrupted file to: ${corruptedMovePath}`);
        console.log(`[data-protection] 💡 Recovery can now create fresh database at: ${dbFilePath}`);
        
      } catch (moveError) {
        console.error(`[data-protection] ❌ Could not move corrupted file - aborting recovery:`, moveError);
        return '';
      }
      
      return backupPath;
    }
  } catch (backupError) {
    console.error(`[data-protection] ❌ Failed to create safe backup: ${backupError}`);
  }
  
  return '';
}

function createDatabaseSafely(dbFilePath: string, initFunction: (db: Database.Database) => void): Database.Database | null {
  try {
    // Ensure data directory exists before creating database
    const dbDirectory = dirname(dbFilePath);
    if (!existsSync(dbDirectory)) {
      mkdirSync(dbDirectory, { recursive: true, mode: 0o755 });
      console.log(`[data-protection] 📁 Created data directory: ${dbDirectory}`);
    }
    
    console.log(`[recovery] 🔧 Creating fresh database: ${dbFilePath}`);
    const db = new Database(dbFilePath);
    
    // Test the database connection
    db.exec('SELECT 1');
    
    // Initialize schema/tables
    initFunction(db);
    
    // Verify the database was created properly
    db.exec('PRAGMA integrity_check');
    
    console.log(`[recovery] ✅ Successfully created and verified: ${dbFilePath}`);
    return db;
  } catch (error) {
    console.error(`[recovery] ❌ Failed to create database ${dbFilePath}:`, error);
    return null;
  }
}

// JSON serialization helpers for SQLite
function serializeJson(obj: any): string {
  return obj ? JSON.stringify(obj) : "";
}

function deserializeJson(str: string | null): any {
  if (!str || str === "" || str === "null") return [];
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // User operations for legacy auth
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  // Replit Auth required operations
  upsertUser(user: UpsertUser): Promise<User>;
  // Admin user management operations
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, userData: Partial<UpsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  // Series management operations
  getAllSeries(): Promise<Series[]>;
  getSeries(id: string): Promise<Series | undefined>;
  createSeries(seriesData: InsertSeries): Promise<Series>;
  updateSeries(id: string, seriesData: Partial<UpsertSeries>): Promise<Series | undefined>;
  deleteSeries(id: string): Promise<boolean>;
  getSeriesBySection(section: "featured" | "trending" | "popularToday" | "latestUpdate" | "pinned"): Promise<Series[]>;
  searchSeries(query: string, filters?: { genre?: string; status?: string; type?: string }, browseMode?: boolean): Promise<Series[]>;
  // Chapter management operations
  getAllChapters(): Promise<Chapter[]>;
  getChapter(id: string): Promise<Chapter | undefined>;
  getChaptersBySeriesId(seriesId: string): Promise<Chapter[]>;
  checkChapterExists(seriesId: string, chapterNumber: string): Promise<Chapter | undefined>;
  createChapter(chapterData: InsertChapter): Promise<Chapter>;
  updateChapter(id: string, chapterData: Partial<UpsertChapter>): Promise<Chapter | undefined>;
  deleteChapter(id: string): Promise<boolean>;
  deleteChaptersBySeriesId(seriesId: string): Promise<boolean>;
  // Settings management operations
  getAllSettings(): Promise<SettingResponse[]>;
  getSettingsByCategory(category: string): Promise<SettingResponse[]>;
  getSetting(category: string, key: string): Promise<SettingResponse | undefined>;
  setSetting(category: string, key: string, value: string, type?: string, description?: string, isPublic?: boolean): Promise<SettingResponse>;
  updateSetting(id: string, settingData: Partial<UpsertSetting>): Promise<SettingResponse | undefined>;
  deleteSetting(id: string): Promise<boolean>;
  // Statistics for admin dashboard
  getSiteStats(): Promise<{ totalUsers: number; totalSeries: number; activeReaders: number; dailyViews: number; }>;
  // Get recent series for admin dashboard preview
  getRecentSeries(limit?: number): Promise<Series[]>;
  // Role management operations
  updateUserRole(id: string, role: string): Promise<User | undefined>;
  // Database constraint verification
  verifyUniqueConstraints(): Promise<{ isValid: boolean; details: any; }>;
  // User Library operations
  addToLibrary(userId: string, seriesId: string, status?: string): Promise<UserLibrary>;
  removeFromLibrary(userId: string, seriesId: string): Promise<boolean>;
  updateLibraryStatus(userId: string, seriesId: string, status: string): Promise<UserLibrary | undefined>;
  getUserLibrary(userId: string): Promise<Array<UserLibrary & { series: Series }>>;
  isInLibrary(userId: string, seriesId: string): Promise<boolean>;
  // User Follows operations
  followSeries(userId: string, seriesId: string, notificationsEnabled?: boolean): Promise<UserFollow & { notificationsEnabled: boolean }>;
  unfollowSeries(userId: string, seriesId: string): Promise<boolean>;
  getUserFollows(userId: string): Promise<Array<Omit<UserFollow, 'notificationsEnabled'> & { notificationsEnabled: boolean; series: Series }>>;
  isFollowing(userId: string, seriesId: string): Promise<{ isFollowing: boolean; notificationsEnabled?: boolean }>;
  updateFollowNotifications(userId: string, seriesId: string, enabled: boolean): Promise<(UserFollow & { notificationsEnabled: boolean }) | undefined>;
  getSeriesFollowerCount(seriesId: string): Promise<number>;
  // Comments operations
  createComment(commentData: InsertComment): Promise<CommentWithUser>;
  updateComment(id: string, content: string): Promise<CommentWithUser | undefined>;
  deleteComment(id: string): Promise<boolean>;
  getCommentsBySeriesId(seriesId: string): Promise<CommentWithUser[]>;
  getCommentsByChapterId(chapterId: string): Promise<CommentWithUser[]>;
  getUserComment(userId: string, seriesId?: string, chapterId?: string): Promise<CommentWithUser | undefined>;
  // Reading Progress operations
  saveReadingProgress(userId: string, seriesId: string, chapterId: string | null, lastReadPage: number): Promise<ReadingProgress>;
  getReadingProgress(userId: string, seriesId: string): Promise<ReadingProgress | undefined>;
  getUserReadingProgress(userId: string): Promise<ReadingProgressWithSeries[]>;
  deleteReadingProgress(userId: string, seriesId: string): Promise<boolean>;
  // Email Verification Token operations
  createEmailVerificationToken(userId: string): Promise<EmailVerificationToken>;
  getEmailVerificationToken(token: string): Promise<EmailVerificationToken | undefined>;
  deleteEmailVerificationToken(token: string): Promise<boolean>;
  markEmailAsVerified(userId: string): Promise<User | undefined>;
  // Password Reset Token operations
  createPasswordResetToken(userId: string): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenAsUsed(token: string): Promise<boolean>;
  deletePasswordResetToken(token: string): Promise<boolean>;
  resetUserPassword(userId: string, newPasswordHash: string): Promise<User | undefined>;
  // User Rating operations
  createOrUpdateUserRating(userId: string, seriesId: string, rating: number, review?: string): Promise<UserRating>;
  getUserRating(userId: string, seriesId: string): Promise<UserRating | undefined>;
  getSeriesRatings(seriesId: string): Promise<UserRatingWithUser[]>;
  deleteUserRating(userId: string, seriesId: string): Promise<boolean>;
  getSeriesAverageRating(seriesId: string): Promise<number>;
  // User Follow User operations
  followUser(followerId: string, followingId: string): Promise<UserFollowUser>;
  unfollowUser(followerId: string, followingId: string): Promise<boolean>;
  getUserFollowers(userId: string): Promise<UserFollowUser[]>;
  getUserFollowing(userId: string): Promise<UserFollowUser[]>;
  isFollowingUser(followerId: string, followingId: string): Promise<boolean>;
  // Currency operations
  getUserCurrencyBalance(userId: string): Promise<number>;
  getCurrencyTransactions(userId: string, limit?: number, offset?: number): Promise<CurrencyTransaction[]>;
  addCurrencyTransaction(userId: string, amount: number, type: string, description: string, relatedEntityId?: string): Promise<CurrencyTransaction>;
  updateUserCurrencyBalance(userId: string, newBalance: number): Promise<User | undefined>;
  processCurrencyChange(userId: string, amount: number, type: string, description: string, relatedEntityId?: string): Promise<{ success: boolean; newBalance?: number; error?: string }>;
  getCurrencyPackages(activeOnly?: boolean): Promise<CurrencyPackage[]>;
  createCurrencyPackage(data: InsertCurrencyPackage): Promise<CurrencyPackage>;
  updateCurrencyPackage(id: string, data: Partial<InsertCurrencyPackage>): Promise<CurrencyPackage | undefined>;
  deleteCurrencyPackage(id: string): Promise<boolean>;
  createUserPurchase(data: InsertUserPurchase): Promise<UserPurchase>;
  getUserPurchases(userId: string): Promise<UserPurchase[]>;
  // Chapter Access Control operations
  getChapterAccessControl(chapterId: string): Promise<ChapterAccessControl | undefined>;
  setChapterAccessControl(chapterId: string, accessType: string, unlockCost: number): Promise<ChapterAccessControl>;
  hasUserUnlockedChapter(userId: string, chapterId: string): Promise<boolean>;
  unlockChapterForUser(userId: string, chapterId: string, costPaid: number): Promise<{ success: boolean; newBalance: number; error?: string }>;
  checkUserChapterAccess(userId: string, chapterId: string): Promise<{ canAccess: boolean; accessType: string; unlockCost?: number; isUnlocked?: boolean; reason?: string }>;
  // Reading Lists operations
  getReadingLists(userId: string): Promise<ReadingList[]>;
  getReadingListById(listId: string): Promise<ReadingList | undefined>;
  createReadingList(userId: string, data: any): Promise<ReadingList>;
  updateReadingList(listId: string, userId: string, data: any): Promise<ReadingList | undefined>;
  deleteReadingList(listId: string, userId: string): Promise<boolean>;
  addToReadingList(listId: string, seriesId: string, userId: string): Promise<ReadingListItem>;
  removeFromReadingList(listId: string, seriesId: string, userId: string): Promise<boolean>;
  getReadingListItems(listId: string): Promise<ReadingListItem[]>;
  // Advertisements operations
  getAllAds(): Promise<Advertisement[]>;
  getAdById(id: string): Promise<Advertisement | undefined>;
  getActiveAdsByPlacement(page: string, location?: string, context?: { deviceType: string; userRole: string; userCountry: string | null; userLanguage: string }): Promise<Advertisement[]>;
  createAd(data: InsertAdvertisement): Promise<Advertisement>;
  updateAd(id: string, data: Partial<InsertAdvertisement>): Promise<Advertisement | undefined>;
  deleteAd(id: string): Promise<boolean>;
  trackAdClick(id: string): Promise<boolean>;
  trackAdImpression(id: string): Promise<boolean>;
  autoUpdateAdSchedules(): Promise<{ activated: number; deactivated: number }>;
  bulkCreateAds(adsData: InsertAdvertisement[]): Promise<{ success: Advertisement[]; failed: Array<{ index: number; error: string }> }>;
  bulkUpdateAds(adIds: string[], updates: Partial<InsertAdvertisement>): Promise<{ successCount: number; failedCount: number }>;
  bulkDeleteAds(adIds: string[]): Promise<{ successCount: number; failedCount: number }>;
  // Ad Analytics operations
  getAdAnalyticsOverview(startDate?: string, endDate?: string): Promise<{
    totalImpressions: number;
    totalClicks: number;
    averageCTR: number;
  }>;
  getAdPerformanceHistory(startDate?: string, endDate?: string): Promise<Array<{
    date: string;
    impressions: number;
    clicks: number;
    ctr: number;
  }>>;
  getTopPerformingAds(limit?: number, startDate?: string, endDate?: string): Promise<Array<{
    id: string;
    title: string;
    type: string;
    placement: string;
    impressions: number;
    clicks: number;
    ctr: number;
  }>>;
  // A/B Testing / Variant operations
  getAdsByVariantGroup(variantGroup: string): Promise<Advertisement[]>;
  getVariantComparisonAnalytics(variantGroup: string, startDate?: string, endDate?: string): Promise<Array<{
    variantName: string;
    impressions: number;
    clicks: number;
    ctr: number;
    adId: string;
    title: string;
  }>>;
  createVariantGroup(variants: Array<Omit<InsertAdvertisement, 'variantGroup'> & { variantName: string }>, variantGroup: string): Promise<Advertisement[]>;
  // Revenue Analytics operations
  getTotalRevenue(startDate?: string, endDate?: string): Promise<number>;
  getMonthlyRevenue(month?: string): Promise<number>;
  getRevenueByType(startDate?: string, endDate?: string): Promise<{ subscriptionRevenue: number; coinSalesRevenue: number; flashSalesRevenue: number }>;
  getRevenueGrowth(currentStart: string, currentEnd: string, previousStart: string, previousEnd: string): Promise<number>;
  getTopSellingPackages(limit?: number, startDate?: string, endDate?: string): Promise<Array<{ id: string; name: string; type: string; totalSales: number; revenue: string }>>;
  getRevenueHistory(startDate?: string, endDate?: string, interval?: string): Promise<Array<{ date: string; revenue: number }>>;
  getConversionRate(startDate?: string, endDate?: string): Promise<number>;
  getAverageOrderValue(startDate?: string, endDate?: string): Promise<number>;
  getActiveSubscriptionsCount(): Promise<number>;
  getMRR(): Promise<number>;
  getPurchaseByTransactionId(transactionId: string): Promise<UserPurchase | undefined>;
  getAllPurchases(limit?: number, offset?: number, status?: string): Promise<Array<UserPurchase & { username: string }>>;
  processRefund(purchaseId: string, adminId: string, reason: string): Promise<{ success: boolean; message: string }>;
  // Flash Sales operations
  getActiveFlashSales(): Promise<FlashSale[]>;
  getAllFlashSales(): Promise<FlashSale[]>;
  createFlashSale(data: InsertFlashSale): Promise<FlashSale>;
  updateFlashSale(id: string, updates: Partial<InsertFlashSale>): Promise<FlashSale | undefined>;
  deleteFlashSale(id: string): Promise<boolean>;
  // Role Authority Management operations
  getAllRolesWithPermissions(): Promise<Array<Role & { permissions: RolePermissions }>>;
  getRoleWithPermissions(roleId: string): Promise<(Role & { permissions: RolePermissions }) | undefined>;
  createRole(roleData: InsertRole): Promise<Role & { permissions: RolePermissions }>;
  updateRole(roleId: string, roleData: Partial<InsertRole>): Promise<Role | undefined>;
  deleteRole(roleId: string): Promise<boolean>;
  getRolePermissions(roleId: string): Promise<RolePermissions | undefined>;
  updateRolePermissions(roleId: string, permissionsData: Partial<InsertRolePermissions>): Promise<RolePermissions | undefined>;
  assignUserRole(userId: string, roleName: string): Promise<User | undefined>;
  getUserPermissions(userId: string): Promise<RolePermissions | null>;
}


// Column definitions for migration system
interface ColumnDefinition {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
}

// Expected columns for users table
const USERS_EXPECTED_COLUMNS: ColumnDefinition[] = [
  { name: 'id', type: 'TEXT', nullable: false },
  { name: 'username', type: 'TEXT', nullable: true },
  { name: 'email', type: 'TEXT', nullable: true },
  { name: 'password', type: 'TEXT', nullable: true },
  { name: 'profile_picture', type: 'TEXT', nullable: true },
  { name: 'country', type: 'TEXT', nullable: true },
  { name: 'is_admin', type: 'TEXT', nullable: false, defaultValue: "'false'" },
  { name: 'role', type: 'TEXT', nullable: false, defaultValue: "'user'" },
  { name: 'first_name', type: 'TEXT', nullable: true },
  { name: 'last_name', type: 'TEXT', nullable: true },
  { name: 'profile_image_url', type: 'TEXT', nullable: true },
  { name: 'created_at', type: 'TEXT', nullable: true, defaultValue: "(datetime('now'))" },
  { name: 'updated_at', type: 'TEXT', nullable: true, defaultValue: "(datetime('now'))" }
];

// Expected columns for series table
const SERIES_EXPECTED_COLUMNS: ColumnDefinition[] = [
  { name: 'id', type: 'TEXT', nullable: false },
  { name: 'title', type: 'TEXT', nullable: false },
  { name: 'description', type: 'TEXT', nullable: true },
  { name: 'author', type: 'TEXT', nullable: true },
  { name: 'artist', type: 'TEXT', nullable: true },
  { name: 'status', type: 'TEXT', nullable: false, defaultValue: "'ongoing'" },
  { name: 'type', type: 'TEXT', nullable: false, defaultValue: "'manga'" },
  { name: 'genres', type: 'TEXT', nullable: true },
  { name: 'cover_image_url', type: 'TEXT', nullable: true },
  { name: 'rating', type: 'TEXT', nullable: true },
  { name: 'total_chapters', type: 'INTEGER', nullable: true },
  { name: 'published_year', type: 'INTEGER', nullable: true },
  { name: 'is_adult', type: 'TEXT', nullable: false, defaultValue: "'false'" },
  { name: 'is_featured', type: 'TEXT', nullable: false, defaultValue: "'false'" },
  { name: 'is_trending', type: 'TEXT', nullable: false, defaultValue: "'false'" },
  { name: 'is_popular_today', type: 'TEXT', nullable: false, defaultValue: "'false'" },
  { name: 'is_latest_update', type: 'TEXT', nullable: false, defaultValue: "'false'" },
  { name: 'created_at', type: 'TEXT', nullable: true, defaultValue: "(datetime('now'))" },
  { name: 'updated_at', type: 'TEXT', nullable: true, defaultValue: "(datetime('now'))" }
];

// Expected columns for settings table
const SETTINGS_EXPECTED_COLUMNS: ColumnDefinition[] = [
  { name: 'id', type: 'TEXT', nullable: false },
  { name: 'category', type: 'TEXT', nullable: false },
  { name: 'key', type: 'TEXT', nullable: false },
  { name: 'value', type: 'TEXT', nullable: false },
  { name: 'type', type: 'TEXT', nullable: false, defaultValue: "'string'" },
  { name: 'description', type: 'TEXT', nullable: true },
  { name: 'is_public', type: 'TEXT', nullable: false, defaultValue: "'false'" },
  { name: 'created_at', type: 'TEXT', nullable: true, defaultValue: "(datetime('now'))" },
  { name: 'updated_at', type: 'TEXT', nullable: true, defaultValue: "(datetime('now'))" }
];

// Expected columns for user_library table
const USER_LIBRARY_EXPECTED_COLUMNS: ColumnDefinition[] = [
  { name: 'id', type: 'TEXT', nullable: false },
  { name: 'user_id', type: 'TEXT', nullable: false },
  { name: 'series_id', type: 'TEXT', nullable: false },
  { name: 'status', type: 'TEXT', nullable: false, defaultValue: "'reading'" },
  { name: 'added_at', type: 'TEXT', nullable: true, defaultValue: "(datetime('now'))" },
  { name: 'updated_at', type: 'TEXT', nullable: true, defaultValue: "(datetime('now'))" }
];

// Expected columns for user_follows table
const USER_FOLLOWS_EXPECTED_COLUMNS: ColumnDefinition[] = [
  { name: 'id', type: 'TEXT', nullable: false },
  { name: 'user_id', type: 'TEXT', nullable: false },
  { name: 'series_id', type: 'TEXT', nullable: false },
  { name: 'followed_at', type: 'TEXT', nullable: true, defaultValue: "(datetime('now'))" },
  { name: 'notifications_enabled', type: 'TEXT', nullable: false, defaultValue: "'true'" }
];

// Expected columns for comments table
const COMMENTS_EXPECTED_COLUMNS: ColumnDefinition[] = [
  { name: 'id', type: 'TEXT', nullable: false },
  { name: 'user_id', type: 'TEXT', nullable: false },
  { name: 'series_id', type: 'TEXT', nullable: true },
  { name: 'chapter_id', type: 'TEXT', nullable: true },
  { name: 'content', type: 'TEXT', nullable: false },
  { name: 'created_at', type: 'TEXT', nullable: true, defaultValue: "(datetime('now'))" },
  { name: 'updated_at', type: 'TEXT', nullable: true, defaultValue: "(datetime('now'))" }
];

// Expected columns for reading_progress table
const READING_PROGRESS_EXPECTED_COLUMNS: ColumnDefinition[] = [
  { name: 'id', type: 'TEXT', nullable: false },
  { name: 'user_id', type: 'TEXT', nullable: false },
  { name: 'series_id', type: 'TEXT', nullable: false },
  { name: 'chapter_id', type: 'TEXT', nullable: true },
  { name: 'last_read_page', type: 'INTEGER', nullable: false, defaultValue: '0' },
  { name: 'last_read_at', type: 'TEXT', nullable: true, defaultValue: "(datetime('now'))" },
  { name: 'created_at', type: 'TEXT', nullable: true, defaultValue: "(datetime('now'))" },
  { name: 'updated_at', type: 'TEXT', nullable: true, defaultValue: "(datetime('now'))" }
];

// Expected columns for chapters table
const CHAPTERS_EXPECTED_COLUMNS: ColumnDefinition[] = [
  { name: 'id', type: 'TEXT', nullable: false },
  { name: 'series_id', type: 'TEXT', nullable: false },
  { name: 'chapter_number', type: 'TEXT', nullable: false },
  { name: 'title', type: 'TEXT', nullable: true },
  { name: 'pages', type: 'TEXT', nullable: false },
  { name: 'total_pages', type: 'INTEGER', nullable: false, defaultValue: '0' },
  { name: 'is_published', type: 'TEXT', nullable: false, defaultValue: "'true'" },
  { name: 'uploaded_by', type: 'TEXT', nullable: true },
  { name: 'created_at', type: 'TEXT', nullable: true, defaultValue: "(datetime('now'))" },
  { name: 'updated_at', type: 'TEXT', nullable: true, defaultValue: "(datetime('now'))" }
];

// Expected columns for dmca_notices table
const DMCA_NOTICES_EXPECTED_COLUMNS: ColumnDefinition[] = [
  { name: 'id', type: 'TEXT', nullable: false },
  { name: 'full_name', type: 'TEXT', nullable: false },
  { name: 'email', type: 'TEXT', nullable: false },
  { name: 'phone', type: 'TEXT', nullable: false },
  { name: 'copyright_work', type: 'TEXT', nullable: false },
  { name: 'infringing_url', type: 'TEXT', nullable: false },
  { name: 'description', type: 'TEXT', nullable: true },
  { name: 'signature', type: 'TEXT', nullable: false },
  { name: 'ip_address', type: 'TEXT', nullable: true },
  { name: 'good_faith_declaration', type: 'TEXT', nullable: false },
  { name: 'accuracy_declaration', type: 'TEXT', nullable: false },
  { name: 'status', type: 'TEXT', nullable: false, defaultValue: "'pending'" },
  { name: 'reviewed_by', type: 'TEXT', nullable: true },
  { name: 'review_notes', type: 'TEXT', nullable: true },
  { name: 'reviewed_at', type: 'TEXT', nullable: true },
  { name: 'created_at', type: 'TEXT', nullable: true, defaultValue: "(datetime('now'))" },
  { name: 'updated_at', type: 'TEXT', nullable: true, defaultValue: "(datetime('now'))" }
];

// Expected columns for advertisements table
const ADVERTISEMENTS_EXPECTED_COLUMNS: ColumnDefinition[] = [
  { name: 'id', type: 'TEXT', nullable: false },
  { name: 'title', type: 'TEXT', nullable: false },
  { name: 'description', type: 'TEXT', nullable: true },
  { name: 'image_url', type: 'TEXT', nullable: false },
  { name: 'link_url', type: 'TEXT', nullable: false },
  { name: 'type', type: 'TEXT', nullable: false },
  { name: 'placement', type: 'TEXT', nullable: true }, // Made nullable for backward compatibility
  { name: 'page', type: 'TEXT', nullable: false, defaultValue: "'homepage'" }, // New column for page location
  { name: 'location', type: 'TEXT', nullable: false, defaultValue: "'top_banner'" }, // New column for specific location
  { name: 'is_active', type: 'TEXT', nullable: false, defaultValue: "'true'" },
  { name: 'start_date', type: 'TEXT', nullable: true },
  { name: 'end_date', type: 'TEXT', nullable: true },
  { name: 'display_order', type: 'INTEGER', nullable: false, defaultValue: '0' },
  { name: 'click_count', type: 'INTEGER', nullable: false, defaultValue: '0' },
  { name: 'impression_count', type: 'INTEGER', nullable: false, defaultValue: '0' },
  { name: 'variant_group', type: 'TEXT', nullable: true }, // A/B testing support
  { name: 'variant_name', type: 'TEXT', nullable: true }, // A/B testing support
  { name: 'target_countries', type: 'TEXT', nullable: true }, // Advanced targeting
  { name: 'target_device_types', type: 'TEXT', nullable: true }, // Advanced targeting
  { name: 'target_user_roles', type: 'TEXT', nullable: true }, // Advanced targeting
  { name: 'target_languages', type: 'TEXT', nullable: true }, // Advanced targeting
  { name: 'budget', type: 'TEXT', nullable: true }, // Performance tracking
  { name: 'cost_per_click', type: 'TEXT', nullable: true }, // Performance tracking
  { name: 'cost_per_impression', type: 'TEXT', nullable: true }, // Performance tracking
  { name: 'conversion_goal', type: 'TEXT', nullable: true }, // Performance tracking
  { name: 'conversion_count', type: 'INTEGER', nullable: false, defaultValue: '0' }, // Performance tracking
  { name: 'frequency_cap', type: 'INTEGER', nullable: true }, // Delivery control
  { name: 'daily_budget', type: 'TEXT', nullable: true }, // Budget control
  { name: 'total_budget_spent', type: 'TEXT', nullable: true, defaultValue: "'0.00'" }, // Budget tracking
  { name: 'tags', type: 'TEXT', nullable: true }, // Organization
  { name: 'notes', type: 'TEXT', nullable: true }, // Admin notes
  { name: 'created_at', type: 'TEXT', nullable: true, defaultValue: "(datetime('now'))" },
  { name: 'updated_at', type: 'TEXT', nullable: true, defaultValue: "(datetime('now'))" }
];

// Function to get existing columns for a table
function getTableColumns(sqliteInstance: Database.Database, tableName: string): string[] {
  try {
    const columns = sqliteInstance.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>;
    
    return columns.map(col => col.name);
  } catch (error) {
    console.log(`[migration] Table ${tableName} does not exist yet, will be created`);
    return [];
  }
}

// Function to check if table exists
function tableExists(sqliteInstance: Database.Database, tableName: string): boolean {
  try {
    const result = sqliteInstance.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name=?
    `).get(tableName);
    return !!result;
  } catch (error) {
    return false;
  }
}

// Function to migrate missing columns for a table
function migrateTableColumns(
  sqliteInstance: Database.Database, 
  tableName: string, 
  expectedColumns: ColumnDefinition[]
): void {
  console.log(`[migration] Checking column drift for table: ${tableName}`);
  
  // Check if table exists
  if (!tableExists(sqliteInstance, tableName)) {
    console.log(`[migration] Table ${tableName} doesn't exist yet, will be created`);
    return;
  }
  
  // Get existing columns
  const existingColumns = getTableColumns(sqliteInstance, tableName);
  console.log(`[migration] Existing columns in ${tableName}:`, existingColumns);
  
  // Find missing columns
  const missingColumns = expectedColumns.filter(
    expected => !existingColumns.includes(expected.name)
  );
  
  if (missingColumns.length === 0) {
    console.log(`[migration] ✅ All columns present in ${tableName}`);
    return;
  }
  
  console.log(`[migration] Found ${missingColumns.length} missing columns in ${tableName}:`, 
    missingColumns.map(col => col.name));
  
  // Add missing columns
  for (const column of missingColumns) {
    try {
      let alterStatement = `ALTER TABLE "${tableName}" ADD COLUMN "${column.name}" ${column.type}`;
      
      // Add NOT NULL constraint if required and has default value
      if (!column.nullable && column.defaultValue) {
        alterStatement += ` NOT NULL DEFAULT ${column.defaultValue}`;
      } else if (column.defaultValue) {
        alterStatement += ` DEFAULT ${column.defaultValue}`;
      }
      
      console.log(`[migration] Adding column: ${alterStatement}`);
      sqliteInstance.exec(alterStatement);
      console.log(`[migration] ✅ Successfully added column ${column.name} to ${tableName}`);
    } catch (error) {
      console.error(`[migration] ❌ Failed to add column ${column.name} to ${tableName}:`, error);
      // Continue with other columns even if one fails
    }
  }
}

// Function to verify and enforce unique constraint on chapters table
function verifyAndEnforceUniqueConstraint(sqliteInstance: Database.Database): void {
  console.log('[constraint] Verifying unique constraint on chapters table...');
  
  try {
    // First, check if the unique index already exists
    const indexes = sqliteInstance.prepare(`PRAGMA index_list('chapters')`).all() as Array<{
      seq: number;
      name: string;
      unique: number;
      origin: string;
      partial: number;
    }>;
    
    // Look for existing unique index on series_id and chapter_number
    const existingUniqueIndex = indexes.find(index => 
      index.unique === 1 && (
        index.name === 'unique_series_chapter' ||
        index.name === 'sqlite_autoindex_chapters_1' || // SQLite auto-generated unique index
        index.name.includes('unique') && index.name.includes('series') && index.name.includes('chapter')
      )
    );
    
    if (existingUniqueIndex) {
      console.log(`[constraint] ✅ Unique constraint already exists: ${existingUniqueIndex.name}`);
      
      // Verify the index actually covers our columns
      const indexInfo = sqliteInstance.prepare(`PRAGMA index_info('${existingUniqueIndex.name}')`).all() as Array<{
        seqno: number;
        cid: number;
        name: string;
      }>;
      
      const columnNames = indexInfo.map(col => col.name).sort();
      const expectedColumns = ['series_id', 'chapter_number'].sort();
      
      if (JSON.stringify(columnNames) === JSON.stringify(expectedColumns)) {
        console.log('[constraint] ✅ Existing unique index covers correct columns');
        return;
      } else {
        console.log(`[constraint] ⚠️  Existing unique index covers wrong columns: ${columnNames.join(', ')} (expected: ${expectedColumns.join(', ')})`);
      }
    }
    
    // Create the unique index if it doesn't exist or is incorrect
    console.log('[constraint] 🔧 Creating unique index on chapters(series_id, chapter_number)...');
    sqliteInstance.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS unique_series_chapter 
      ON chapters(series_id, chapter_number)
    `);
    
    // Verify the index was created successfully
    const indexesAfter = sqliteInstance.prepare(`PRAGMA index_list('chapters')`).all() as Array<{
      seq: number;
      name: string;
      unique: number;
      origin: string;
      partial: number;
    }>;
    
    const newUniqueIndex = indexesAfter.find(index => 
      index.unique === 1 && index.name === 'unique_series_chapter'
    );
    
    if (!newUniqueIndex) {
      throw new Error('Failed to create unique index - index not found after creation');
    }
    
    // Double-check the index info
    const newIndexInfo = sqliteInstance.prepare(`PRAGMA index_info('unique_series_chapter')`).all() as Array<{
      seqno: number;
      cid: number;
      name: string;
    }>;
    
    const newColumnNames = newIndexInfo.map(col => col.name).sort();
    const expectedCols = ['series_id', 'chapter_number'].sort();
    
    if (JSON.stringify(newColumnNames) !== JSON.stringify(expectedCols)) {
      throw new Error(`Unique index created with wrong columns: ${newColumnNames.join(', ')} (expected: ${expectedCols.join(', ')})`);
    }
    
    console.log('[constraint] ✅ Unique index created and verified successfully');
    
    // Test constraint enforcement with a simple query (non-destructive)
    const testResult = sqliteInstance.prepare(`
      SELECT sql FROM sqlite_master 
      WHERE type='index' AND name='unique_series_chapter'
    `).get() as { sql: string } | undefined;
    
    if (!testResult || !testResult.sql.toUpperCase().includes('UNIQUE')) {
      throw new Error('Unique index exists but may not be enforcing uniqueness');
    }
    
    console.log('[constraint] ✅ Constraint enforcement verified');
    
  } catch (error) {
    console.error('[constraint] ❌ CRITICAL: Failed to verify/create unique constraint:', error);
    console.error('[constraint] 🚨 Database startup must abort - duplicate chapters could be created!');
    throw new Error(`CRITICAL DATABASE SAFETY ERROR: Could not ensure unique constraint on chapters table: ${(error as Error).message}`);
  }
}

// Function to initialize schema synchronously during module load
function initializeSchema(sqliteInstance: Database.Database): void {
  console.log('[schema] Initializing database schema...');
  
  try {
    // Create users table with all fields from the Drizzle schema
    sqliteInstance.exec(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "username" TEXT UNIQUE,
        "email" TEXT UNIQUE,
        "password" TEXT,
        "profile_picture" TEXT,
        "country" TEXT,
        "is_admin" TEXT NOT NULL DEFAULT 'false',
        "role" TEXT NOT NULL DEFAULT 'user',
        "first_name" TEXT,
        "last_name" TEXT,
        "profile_image_url" TEXT,
        "created_at" TEXT DEFAULT (datetime('now')),
        "updated_at" TEXT DEFAULT (datetime('now'))
      );
    `);

    // Create series table with all fields from the Drizzle schema
    sqliteInstance.exec(`
      CREATE TABLE IF NOT EXISTS "series" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "author" TEXT,
        "artist" TEXT,
        "status" TEXT NOT NULL DEFAULT 'ongoing',
        "type" TEXT NOT NULL DEFAULT 'manga',
        "genres" TEXT,
        "cover_image_url" TEXT,
        "rating" TEXT,
        "total_chapters" INTEGER,
        "published_year" INTEGER,
        "is_adult" TEXT NOT NULL DEFAULT 'false',
        "is_featured" TEXT NOT NULL DEFAULT 'false',
        "is_trending" TEXT NOT NULL DEFAULT 'false',
        "is_popular_today" TEXT NOT NULL DEFAULT 'false',
        "is_latest_update" TEXT NOT NULL DEFAULT 'false',
        "created_at" TEXT DEFAULT (datetime('now')),
        "updated_at" TEXT DEFAULT (datetime('now'))
      );
    `);

    // Create languages table for multi-language support
    sqliteInstance.exec(`
      CREATE TABLE IF NOT EXISTS "languages" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "code" TEXT NOT NULL UNIQUE,
        "name" TEXT NOT NULL,
        "native_name" TEXT NOT NULL,
        "is_active" TEXT NOT NULL DEFAULT 'true',
        "is_default" TEXT NOT NULL DEFAULT 'false',
        "created_at" TEXT DEFAULT (datetime('now')),
        "updated_at" TEXT DEFAULT (datetime('now'))
      );
    `);

    // Create series_translations table for storing translated series metadata
    sqliteInstance.exec(`
      CREATE TABLE IF NOT EXISTS "series_translations" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "series_id" TEXT NOT NULL,
        "language_id" TEXT NOT NULL,
        "title" TEXT,
        "description" TEXT,
        "created_at" TEXT DEFAULT (datetime('now')),
        "updated_at" TEXT DEFAULT (datetime('now')),
        FOREIGN KEY ("series_id") REFERENCES "series" ("id") ON DELETE CASCADE,
        FOREIGN KEY ("language_id") REFERENCES "languages" ("id") ON DELETE CASCADE,
        UNIQUE ("series_id", "language_id")
      );
    `);

    // Create settings table with all fields from the Drizzle schema
    sqliteInstance.exec(`
      CREATE TABLE IF NOT EXISTS "settings" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "category" TEXT NOT NULL,
        "key" TEXT NOT NULL,
        "value" TEXT NOT NULL,
        "type" TEXT NOT NULL DEFAULT 'string',
        "description" TEXT,
        "is_public" TEXT NOT NULL DEFAULT 'false',
        "created_at" TEXT DEFAULT (datetime('now')),
        "updated_at" TEXT DEFAULT (datetime('now'))
      );
    `);

    // Create user_library table for bookmarking manga series
    sqliteInstance.exec(`
      CREATE TABLE IF NOT EXISTS "user_library" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "user_id" TEXT NOT NULL,
        "series_id" TEXT NOT NULL,
        "added_at" TEXT DEFAULT (datetime('now')),
        FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
        FOREIGN KEY ("series_id") REFERENCES "series" ("id") ON DELETE CASCADE,
        UNIQUE ("user_id", "series_id")
      );
    `);

    // Create user_follows table for subscribing to manga series
    sqliteInstance.exec(`
      CREATE TABLE IF NOT EXISTS "user_follows" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "user_id" TEXT NOT NULL,
        "series_id" TEXT NOT NULL,
        "followed_at" TEXT DEFAULT (datetime('now')),
        "notifications_enabled" TEXT NOT NULL DEFAULT 'true',
        FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
        FOREIGN KEY ("series_id") REFERENCES "series" ("id") ON DELETE CASCADE,
        UNIQUE ("user_id", "series_id")
      );
    `);

    // Create comments table for series and chapter discussions
    sqliteInstance.exec(`
      CREATE TABLE IF NOT EXISTS "comments" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "user_id" TEXT NOT NULL,
        "series_id" TEXT,
        "chapter_id" TEXT,
        "content" TEXT NOT NULL,
        "created_at" TEXT DEFAULT (datetime('now')),
        "updated_at" TEXT DEFAULT (datetime('now')),
        FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
        FOREIGN KEY ("series_id") REFERENCES "series" ("id") ON DELETE CASCADE,
        FOREIGN KEY ("chapter_id") REFERENCES "chapters" ("id") ON DELETE CASCADE
      );
    `);

    // Create reading_progress table for tracking user's reading position
    sqliteInstance.exec(`
      CREATE TABLE IF NOT EXISTS "reading_progress" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "user_id" TEXT NOT NULL,
        "series_id" TEXT NOT NULL,
        "chapter_id" TEXT,
        "last_read_page" INTEGER NOT NULL DEFAULT 0,
        "last_read_at" TEXT DEFAULT (datetime('now')),
        "created_at" TEXT DEFAULT (datetime('now')),
        "updated_at" TEXT DEFAULT (datetime('now')),
        FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
        FOREIGN KEY ("series_id") REFERENCES "series" ("id") ON DELETE CASCADE,
        FOREIGN KEY ("chapter_id") REFERENCES "chapters" ("id") ON DELETE SET NULL,
        UNIQUE ("user_id", "series_id")
      );
    `);

    // Create chapters table with all fields from the Drizzle schema
    sqliteInstance.exec(`
      CREATE TABLE IF NOT EXISTS "chapters" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "series_id" TEXT NOT NULL,
        "chapter_number" TEXT NOT NULL,
        "title" TEXT,
        "pages" TEXT NOT NULL,
        "total_pages" INTEGER NOT NULL DEFAULT 0,
        "is_published" TEXT NOT NULL DEFAULT 'true',
        "uploaded_by" TEXT,
        "created_at" TEXT DEFAULT (datetime('now')),
        "updated_at" TEXT DEFAULT (datetime('now')),
        FOREIGN KEY ("series_id") REFERENCES "series" ("id") ON DELETE CASCADE,
        FOREIGN KEY ("uploaded_by") REFERENCES "users" ("id"),
        UNIQUE ("series_id", "chapter_number")
      );
    `);

    // Create indexes for chapters table
    sqliteInstance.exec(`
      CREATE INDEX IF NOT EXISTS "series_chapter_idx" ON "chapters" ("series_id", "chapter_number");
    `);

    // Create advertisements table
    sqliteInstance.exec(`
      CREATE TABLE IF NOT EXISTS "advertisements" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "image_url" TEXT NOT NULL,
        "link_url" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "placement" TEXT NOT NULL,
        "is_active" TEXT NOT NULL DEFAULT 'true',
        "start_date" TEXT,
        "end_date" TEXT,
        "display_order" INTEGER NOT NULL DEFAULT 0,
        "click_count" INTEGER NOT NULL DEFAULT 0,
        "impression_count" INTEGER NOT NULL DEFAULT 0,
        "created_at" TEXT DEFAULT (datetime('now')),
        "updated_at" TEXT DEFAULT (datetime('now'))
      );
    `);
    
    // Create indexes for advertisements table
    sqliteInstance.exec(`
      CREATE INDEX IF NOT EXISTS "ads_placement_active_idx" ON "advertisements" ("placement", "is_active");
      CREATE INDEX IF NOT EXISTS "ads_display_order_idx" ON "advertisements" ("display_order");
      CREATE INDEX IF NOT EXISTS "ads_active_idx" ON "advertisements" ("is_active");
    `);

    // Run column migration after table creation
    console.log('[migration] Starting column drift migration...');
    migrateTableColumns(sqliteInstance, 'users', USERS_EXPECTED_COLUMNS);
    migrateTableColumns(sqliteInstance, 'series', SERIES_EXPECTED_COLUMNS);
    migrateTableColumns(sqliteInstance, 'settings', SETTINGS_EXPECTED_COLUMNS);
    migrateTableColumns(sqliteInstance, 'user_library', USER_LIBRARY_EXPECTED_COLUMNS);
    migrateTableColumns(sqliteInstance, 'user_follows', USER_FOLLOWS_EXPECTED_COLUMNS);
    migrateTableColumns(sqliteInstance, 'comments', COMMENTS_EXPECTED_COLUMNS);
    migrateTableColumns(sqliteInstance, 'reading_progress', READING_PROGRESS_EXPECTED_COLUMNS);
    migrateTableColumns(sqliteInstance, 'chapters', CHAPTERS_EXPECTED_COLUMNS);
    migrateTableColumns(sqliteInstance, 'dmca_notices', DMCA_NOTICES_EXPECTED_COLUMNS);
    migrateTableColumns(sqliteInstance, 'advertisements', ADVERTISEMENTS_EXPECTED_COLUMNS);
    console.log('[migration] ✅ Column drift migration completed');

    // Create indexes for better performance
    sqliteInstance.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS "users_username_unique" ON "users" ("username");
      CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique" ON "users" ("email");
      CREATE INDEX IF NOT EXISTS "settings_category_idx" ON "settings" ("category");
      CREATE UNIQUE INDEX IF NOT EXISTS "settings_category_key_unique" ON "settings" ("category", "key");
      CREATE INDEX IF NOT EXISTS "user_series_idx" ON "user_library" ("user_id", "series_id");
      CREATE INDEX IF NOT EXISTS "comments_user_idx" ON "comments" ("user_id");
      CREATE INDEX IF NOT EXISTS "comments_series_idx" ON "comments" ("series_id");
      CREATE INDEX IF NOT EXISTS "comments_chapter_idx" ON "comments" ("chapter_id");
      CREATE INDEX IF NOT EXISTS "user_series_progress_idx" ON "reading_progress" ("user_id", "series_id");
    `);

    // CRITICAL: Enforce unique constraint on chapters table (PRODUCTION-CRITICAL)
    // This ensures ALL database instances (new and existing) have the constraint
    verifyAndEnforceUniqueConstraint(sqliteInstance);

    console.log('[schema] ✅ Database schema initialized successfully');
  } catch (error) {
    console.error('[schema] ❌ Failed to initialize schema:', error);
    throw error;
  }
}

// Function to seed default languages
function seedDefaultLanguages(sqliteInstance: Database.Database): void {
  try {
    // Check if languages already exist
    const count = sqliteInstance.prepare('SELECT COUNT(*) as count FROM languages').get() as { count: number };
    
    if (count.count === 0) {
      console.log('[seed] Seeding default languages...');
      
      const defaultLanguages = [
        { code: 'en', name: 'English', nativeName: 'English', isDefault: 'true' },
        { code: 'es', name: 'Spanish', nativeName: 'Español', isDefault: 'false' },
        { code: 'ja', name: 'Japanese', nativeName: '日本語', isDefault: 'false' },
        { code: 'fr', name: 'French', nativeName: 'Français', isDefault: 'false' },
        { code: 'de', name: 'German', nativeName: 'Deutsch', isDefault: 'false' },
        { code: 'zh', name: 'Chinese', nativeName: '中文', isDefault: 'false' },
        { code: 'ko', name: 'Korean', nativeName: '한국어', isDefault: 'false' },
        { code: 'pt', name: 'Portuguese', nativeName: 'Português', isDefault: 'false' },
        { code: 'ru', name: 'Russian', nativeName: 'Русский', isDefault: 'false' },
        { code: 'ar', name: 'Arabic', nativeName: 'العربية', isDefault: 'false' },
      ];
      
      const stmt = sqliteInstance.prepare(`
        INSERT INTO languages (id, code, name, native_name, is_active, is_default)
        VALUES (?, ?, ?, ?, 'true', ?)
      `);
      
      for (const lang of defaultLanguages) {
        stmt.run(crypto.randomUUID(), lang.code, lang.name, lang.nativeName, lang.isDefault);
      }
      
      console.log('[seed] ✅ Default languages seeded successfully');
    } else {
      console.log('[seed] ✅ Languages already exist, skipping seed');
    }
  } catch (error) {
    console.error('[seed] ⚠️  Failed to seed default languages:', error);
  }
}

// Function to seed default daily rewards
function seedDefaultDailyRewards(sqliteInstance: Database.Database): void {
  try {
    // Check if daily rewards already exist
    const count = sqliteInstance.prepare('SELECT COUNT(*) as count FROM daily_rewards').get() as { count: number };
    
    if (count.count === 0) {
      console.log('[seed] Seeding default daily rewards...');
      
      // Default 30-day reward cycle
      const defaultRewards = [
        { day: 1, coinReward: 10, bonusMultiplier: '1.0', isSpecial: 'false' },
        { day: 2, coinReward: 15, bonusMultiplier: '1.0', isSpecial: 'false' },
        { day: 3, coinReward: 20, bonusMultiplier: '1.2', isSpecial: 'false' },
        { day: 4, coinReward: 25, bonusMultiplier: '1.0', isSpecial: 'false' },
        { day: 5, coinReward: 30, bonusMultiplier: '1.3', isSpecial: 'false' },
        { day: 6, coinReward: 35, bonusMultiplier: '1.0', isSpecial: 'false' },
        { day: 7, coinReward: 50, bonusMultiplier: '1.5', isSpecial: 'true' },
        { day: 8, coinReward: 40, bonusMultiplier: '1.0', isSpecial: 'false' },
        { day: 9, coinReward: 45, bonusMultiplier: '1.0', isSpecial: 'false' },
        { day: 10, coinReward: 50, bonusMultiplier: '1.2', isSpecial: 'false' },
        { day: 11, coinReward: 55, bonusMultiplier: '1.0', isSpecial: 'false' },
        { day: 12, coinReward: 60, bonusMultiplier: '1.0', isSpecial: 'false' },
        { day: 13, coinReward: 65, bonusMultiplier: '1.0', isSpecial: 'false' },
        { day: 14, coinReward: 80, bonusMultiplier: '1.5', isSpecial: 'true' },
        { day: 15, coinReward: 70, bonusMultiplier: '1.0', isSpecial: 'false' },
        { day: 16, coinReward: 75, bonusMultiplier: '1.0', isSpecial: 'false' },
        { day: 17, coinReward: 80, bonusMultiplier: '1.0', isSpecial: 'false' },
        { day: 18, coinReward: 85, bonusMultiplier: '1.0', isSpecial: 'false' },
        { day: 19, coinReward: 90, bonusMultiplier: '1.0', isSpecial: 'false' },
        { day: 20, coinReward: 95, bonusMultiplier: '1.2', isSpecial: 'false' },
        { day: 21, coinReward: 120, bonusMultiplier: '1.5', isSpecial: 'true' },
        { day: 22, coinReward: 100, bonusMultiplier: '1.0', isSpecial: 'false' },
        { day: 23, coinReward: 105, bonusMultiplier: '1.0', isSpecial: 'false' },
        { day: 24, coinReward: 110, bonusMultiplier: '1.0', isSpecial: 'false' },
        { day: 25, coinReward: 115, bonusMultiplier: '1.2', isSpecial: 'false' },
        { day: 26, coinReward: 120, bonusMultiplier: '1.0', isSpecial: 'false' },
        { day: 27, coinReward: 125, bonusMultiplier: '1.0', isSpecial: 'false' },
        { day: 28, coinReward: 150, bonusMultiplier: '1.5', isSpecial: 'true' },
        { day: 29, coinReward: 140, bonusMultiplier: '1.0', isSpecial: 'false' },
        { day: 30, coinReward: 200, bonusMultiplier: '2.0', isSpecial: 'true' }
      ];
      
      const stmt = sqliteInstance.prepare(`
        INSERT INTO daily_rewards (id, day, coin_reward, bonus_multiplier, is_special)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      for (const reward of defaultRewards) {
        stmt.run(crypto.randomUUID(), reward.day, reward.coinReward, reward.bonusMultiplier, reward.isSpecial);
      }
      
      console.log('[seed] ✅ Default daily rewards seeded successfully (30-day cycle)');
    } else {
      console.log('[seed] ✅ Daily rewards already exist, skipping seed');
    }
  } catch (error) {
    console.error('[seed] ⚠️  Failed to seed default daily rewards:', error);
  }
}

// Function to seed default OAuth provider settings
function seedDefaultOAuthSettings(sqliteInstance: Database.Database): void {
  try {
    // Check if OAuth settings already exist
    const count = sqliteInstance.prepare(
      "SELECT COUNT(*) as count FROM settings WHERE category='auth' AND key LIKE 'oauth_%'"
    ).get() as { count: number };
    
    if (count.count === 0) {
      console.log('[seed] Seeding default OAuth provider settings...');
      
      const defaultOAuthSettings = [
        { category: 'auth', key: 'oauth_google_enabled', value: 'false', type: 'boolean', description: 'Enable Google OAuth login', isPublic: 'true' },
        { category: 'auth', key: 'oauth_google_client_id', value: '', type: 'string', description: 'Google OAuth Client ID', isPublic: 'false' },
        { category: 'auth', key: 'oauth_google_client_secret', value: '', type: 'string', description: 'Google OAuth Client Secret', isPublic: 'false' },
        { category: 'auth', key: 'oauth_discord_enabled', value: 'false', type: 'boolean', description: 'Enable Discord OAuth login', isPublic: 'true' },
        { category: 'auth', key: 'oauth_discord_client_id', value: '', type: 'string', description: 'Discord OAuth Client ID', isPublic: 'false' },
        { category: 'auth', key: 'oauth_discord_client_secret', value: '', type: 'string', description: 'Discord OAuth Client Secret', isPublic: 'false' }
      ];
      
      const stmt = sqliteInstance.prepare(`
        INSERT INTO settings (id, category, key, value, type, description, is_public, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `);
      
      for (const setting of defaultOAuthSettings) {
        stmt.run(
          crypto.randomUUID(),
          setting.category,
          setting.key,
          setting.value,
          setting.type,
          setting.description,
          setting.isPublic
        );
      }
      
      console.log('[seed] ✅ Default OAuth provider settings seeded successfully');
    } else {
      console.log('[seed] ✅ OAuth settings already exist, skipping seed');
    }
  } catch (error) {
    console.error('[seed] ⚠️  Failed to seed default OAuth settings:', error);
  }
}

// Initialize main database with resilient error handling
let sqlite: Database.Database;
export let db: ReturnType<typeof drizzle>;

function initializeMainDatabase(): { sqlite: Database.Database; db: ReturnType<typeof drizzle> } {
  let attempts = 0;
  const maxAttempts = 3;
  
  // Ensure data directory structure exists
  const dataDirectories = [dbDir, backupDir];
  dataDirectories.forEach(dir => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true, mode: 0o755 });
      console.log(`[data-protection] 📁 Created directory: ${dir}`);
    }
  });
  
  while (attempts < maxAttempts) {
    try {
      console.log(`[database] Initializing main database (attempt ${attempts + 1}/${maxAttempts})`);
      
      // Try to open the database
      const sqliteInstance = new Database(dbPath);
      
      // PERFORMANCE: Enable WAL mode for better concurrency and performance
      // WAL (Write-Ahead Logging) allows readers and writers to operate concurrently
      sqliteInstance.pragma('journal_mode = WAL');
      
      // PERFORMANCE: Set synchronous to NORMAL for better performance (still crash-safe with WAL)
      sqliteInstance.pragma('synchronous = NORMAL');
      
      // PERFORMANCE: Increase cache size to 64MB for better query performance
      sqliteInstance.pragma('cache_size = -64000');
      
      // PERFORMANCE: Enable memory-mapped I/O for faster reads (256MB)
      sqliteInstance.pragma('mmap_size = 268435456');
      
      // PERFORMANCE: Set temp_store to memory for faster temporary operations
      sqliteInstance.pragma('temp_store = MEMORY');
      
      // PERFORMANCE: Optimize page size for better performance (8KB)
      sqliteInstance.pragma('page_size = 8192');
      
      console.log('[database] ✅ Performance optimizations enabled (WAL mode, increased cache, mmap)');
      
      // MONITORING: Add slow query logging for performance optimization
      const SLOW_QUERY_THRESHOLD_MS = 100; // Log queries slower than 100ms
      const originalPrepare = sqliteInstance.prepare.bind(sqliteInstance);
      
      sqliteInstance.prepare = function(sql: string) {
        const stmt = originalPrepare(sql);
        
        // Wrap execution methods to measure performance
        const wrapMethod = (methodName: 'get' | 'all' | 'run', originalMethod: any) => {
          return function(...args: any[]): any {
            const startTime = Date.now();
            const result = originalMethod(...args);
            const duration = Date.now() - startTime;
            
            if (duration > SLOW_QUERY_THRESHOLD_MS) {
              // Only log in development or when explicitly enabled
              if (process.env.NODE_ENV !== 'production' || process.env.LOG_SLOW_QUERIES === 'true') {
                console.warn(`[database] ⚠️  SLOW QUERY (${duration}ms): ${sql.substring(0, 100)}${sql.length > 100 ? '...' : ''}`);
              }
            }
            
            return result;
          };
        };
        
        stmt.get = wrapMethod('get', stmt.get.bind(stmt)) as typeof stmt.get;
        stmt.all = wrapMethod('all', stmt.all.bind(stmt)) as typeof stmt.all;
        stmt.run = wrapMethod('run', stmt.run.bind(stmt)) as typeof stmt.run;
        
        return stmt;
      } as typeof sqliteInstance.prepare;
      
      console.log('[database] ✅ Slow query monitoring enabled (threshold: 100ms)');
      
      // Test database integrity properly
      const integrityResult = sqliteInstance.prepare('PRAGMA integrity_check').get() as any;
      if (integrityResult && integrityResult.integrity_check !== 'ok') {
        console.log(`[database] ⚠️  Database integrity check warning: ${JSON.stringify(integrityResult)}`);
        // Continue but log the warning - this might be recoverable
      }
      
      // Initialize schema
      initializeSchema(sqliteInstance);
      
      // Seed default languages
      seedDefaultLanguages(sqliteInstance);
      
      // Seed default daily rewards
      seedDefaultDailyRewards(sqliteInstance);
      
      // Seed default OAuth settings
      seedDefaultOAuthSettings(sqliteInstance);
      
      const drizzleDb = drizzle(sqliteInstance);
      
      console.log('[database] ✅ Main database initialized successfully');
      return { sqlite: sqliteInstance, db: drizzleDb };
      
    } catch (error) {
      attempts++;
      console.error(`[database] ❌ Failed to initialize main database (attempt ${attempts}):`, error);
      
      // Handle different types of errors more conservatively
      if (isSevereCorruption(error)) {
        console.log('[data-protection] 🚨 SEVERE database corruption detected! Starting careful recovery...');
        
        // Create safe backup before any recovery attempts
        const backupPath = safeDatabaseBackup(dbPath, `Severe corruption: ${(error as Error).message}`);
        if (backupPath) {
          console.log(`[data-protection] 💾 Database safely backed up to: ${backupPath}`);
          
          // Try to create a fresh database only if backup succeeded
          const freshDb = createDatabaseSafely(dbPath, initializeSchema);
          if (freshDb) {
            const drizzleDb = drizzle(freshDb);
            console.log('[recovery] ✅ Successfully recovered with fresh database');
            console.log(`[recovery] 💡 Your original data is preserved in: ${backupPath}`);
            return { sqlite: freshDb, db: drizzleDb };
          }
        } else {
          console.error('[data-protection] ❌ Could not create safe backup - aborting recovery to protect your data');
        }
      } else if (isRecoverableSchemaIssue(error)) {
        console.log('[database] 🔧 Detected recoverable schema issue, attempting gentle repair...');
        
        // For schema issues, try to create missing tables without destroying existing data
        try {
          const sqliteInstance = new Database(dbPath);
          initializeSchema(sqliteInstance);
          const drizzleDb = drizzle(sqliteInstance);
          console.log('[database] ✅ Schema issue resolved successfully');
          return { sqlite: sqliteInstance, db: drizzleDb };
        } catch (schemaError) {
          console.error('[database] ❌ Could not resolve schema issue:', schemaError);
        }
      } else if (isDiskSpaceIssue(error)) {
        console.error('[database] 💾 DISK SPACE ISSUE: Cannot initialize database due to insufficient space');
        console.error('[database] 💡 Please free up disk space and restart the application');
        throw new Error('Insufficient disk space for database operation');
      }
      
      if (attempts >= maxAttempts) {
        console.error('[database] ❌ Failed to initialize database after all attempts');
        console.error('[data-protection] 🛡️  Your data has been protected - no files were deleted');
        throw new Error(`Database initialization failed after ${maxAttempts} attempts: ${(error as Error).message}`);
      }
      
      // Wait a bit before retrying
      console.log('[database] ⏳ Waiting before retry...');
      require('child_process').execSync('sleep 1');
    }
  }
  
  throw new Error('Unexpected error in database initialization');
}

// Initialize the database with error handling
const { sqlite: sqliteInstance, db: drizzleDb } = initializeMainDatabase();
sqlite = sqliteInstance;
db = drizzleDb;

export class DatabaseStorage implements IStorage {
  async validateConnection(): Promise<boolean> {
    try {
      await db.select().from(users).limit(1);
      return true;
    } catch (error) {
      console.error("Database connection validation failed:", error);
      return false;
    }
  }
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    if (!username) return undefined;
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    if (!email) return undefined;
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  // Replit Auth required method
  async upsertUser(userData: UpsertUser): Promise<User> {
    // For SQLite, we need to handle upsert differently
    const existingUser = await this.getUser(userData.id!);
    
    if (existingUser) {
      // Update existing user
      const result = await db
        .update(users)
        .set({
          ...userData,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(users.id, userData.id!))
        .returning();
      return result[0];
    } else {
      // Create new user
      const result = await db
        .insert(users)
        .values({
          ...userData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .returning();
      return result[0];
    }
  }

  // Admin user management methods
  async getAllUsers(): Promise<User[]> {
    const result = await db.select().from(users);
    return result;
  }

  async updateUser(id: string, userData: Partial<UpsertUser>): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({
        ...userData,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  // Series management methods
  
  // Helper method to enrich series with chapter data (count and latest chapters)
  private async enrichSeriesWithChapterData(seriesList: Series[]): Promise<any[]> {
    if (seriesList.length === 0) {
      return [];
    }
    
    const seriesIds = seriesList.map(s => s.id);
    
    // Get all chapters for these series in one query using Drizzle's inArray
    const allChaptersResult = await db
      .select()
      .from(chapters)
      .where(inArray(chapters.seriesId, seriesIds));
    
    // Group chapters by series ID
    const chaptersBySeriesId = new Map<string, any[]>();
    for (const chapter of allChaptersResult) {
      if (!chaptersBySeriesId.has(chapter.seriesId)) {
        chaptersBySeriesId.set(chapter.seriesId, []);
      }
      chaptersBySeriesId.get(chapter.seriesId)!.push({
        ...chapter,
        pages: deserializeJson(chapter.pages),
      });
    }
    
    // Sort chapters within each series by chapter number (descending)
    for (const [seriesId, chapterList] of Array.from(chaptersBySeriesId.entries())) {
      chapterList.sort((a: any, b: any) => {
        const numA = parseFloat(a.chapterNumber) || 0;
        const numB = parseFloat(b.chapterNumber) || 0;
        return numB - numA; // Descending order (latest first)
      });
    }
    
    // Get all chapter IDs to fetch access control in one query
    const allChapterIds = allChaptersResult.map(ch => ch.id);
    
    // Fetch access control for all chapters in one query
    const accessControlResults = allChapterIds.length > 0 
      ? await db
          .select()
          .from(chapterAccessControl)
          .where(inArray(chapterAccessControl.chapterId, allChapterIds))
      : [];
    
    // Create a map of chapter ID to access control
    const accessControlMap = new Map<string, any>();
    for (const ac of accessControlResults) {
      accessControlMap.set(ac.chapterId, ac);
    }
    
    // Enrich each series with chapter data including access control
    return seriesList.map(s => {
      const seriesChapters = chaptersBySeriesId.get(s.id) || [];
      const latestChapters = seriesChapters.slice(0, 4); // Get top 4 latest chapters
      
      return {
        ...s,
        chapterCount: seriesChapters.length,
        latestChapters: latestChapters.map(ch => {
          const accessControl = accessControlMap.get(ch.id);
          const hasLock = !!(accessControl && accessControl.accessType !== "free" && accessControl.isActive === "true");
          
          // Calculate if chapter is new (within last 7 days)
          const createdDate = new Date(ch.createdAt);
          const now = new Date();
          const daysDiff = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
          const isNew = daysDiff <= 7;
          
          return {
            id: ch.id,
            chapterNumber: ch.chapterNumber,
            title: ch.title,
            createdAt: ch.createdAt,
            totalPages: ch.totalPages,
            hasLock: hasLock,
            isNew: isNew,
          };
        }),
      };
    });
  }
  
  async getAllSeries(): Promise<Series[]> {
    const result = await db.select().from(series).orderBy(desc(series.createdAt));
    
    // Deserialize JSON fields for all series
    const deserializedSeries = result.map(s => ({
      ...s,
      genres: deserializeJson(s.genres),
    })) as Series[];
    
    // Enrich with chapter data
    return this.enrichSeriesWithChapterData(deserializedSeries);
  }

  async getSeries(id: string): Promise<Series | undefined> {
    const result = await db.select().from(series).where(eq(series.id, id)).limit(1);
    
    if (result[0]) {
      // Deserialize JSON fields
      return {
        ...result[0],
        genres: deserializeJson(result[0].genres),
      } as Series;
    }
    
    return undefined;
  }

  async createSeries(seriesData: InsertSeries): Promise<Series> {
    // Handle JSON serialization for genres
    const processedData = {
      ...seriesData,
      genres: seriesData.genres ? serializeJson(seriesData.genres) : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const result = await db.insert(series).values(processedData).returning();
    
    // Deserialize JSON fields in the response
    const returnedSeries = result[0];
    return {
      ...returnedSeries,
      genres: deserializeJson(returnedSeries.genres),
    } as Series;
  }

  async updateSeries(id: string, seriesData: Partial<UpsertSeries>): Promise<Series | undefined> {
    // Handle JSON serialization for genres
    const processedData: any = {
      ...seriesData,
      updatedAt: new Date().toISOString(),
    };
    
    if (seriesData.genres !== undefined) {
      processedData.genres = seriesData.genres ? serializeJson(seriesData.genres) : null;
    }
    
    const result = await db
      .update(series)
      .set(processedData)
      .where(eq(series.id, id))
      .returning();
    
    if (result[0]) {
      // Deserialize JSON fields in the response
      return {
        ...result[0],
        genres: deserializeJson(result[0].genres),
      } as Series;
    }
    
    return undefined;
  }

  async deleteSeries(id: string): Promise<boolean> {
    const result = await db.delete(series).where(eq(series.id, id)).returning();
    return result.length > 0;
  }

  async getSeriesBySection(section: "featured" | "trending" | "popularToday" | "latestUpdate" | "pinned"): Promise<Series[]> {
    let whereCondition;
    
    switch (section) {
      case "featured":
        whereCondition = eq(series.isFeatured, "true");
        break;
      case "trending":
        whereCondition = eq(series.isTrending, "true");
        break;
      case "popularToday":
        whereCondition = eq(series.isPopularToday, "true");
        break;
      case "latestUpdate":
        whereCondition = eq(series.isLatestUpdate, "true");
        break;
      case "pinned":
        whereCondition = eq(series.isPinned, "true");
        break;
      default:
        throw new Error(`Invalid section: ${section}`);
    }
    
    const result = await db
      .select()
      .from(series)
      .where(whereCondition)
      .orderBy(desc(series.updatedAt));
    
    // Deserialize JSON fields for all series
    const deserializedSeries = result.map(s => ({
      ...s,
      genres: deserializeJson(s.genres),
    })) as Series[];
    
    // Enrich with chapter data
    return this.enrichSeriesWithChapterData(deserializedSeries);
  }

  async searchSeries(query: string, filters?: { genre?: string; status?: string; type?: string }, browseMode = false): Promise<Series[]> {
    // In browse mode, allow searching with no query or filters to show all series
    if (!browseMode && !query.trim() && !filters) {
      return [];
    }

    let conditions = [];
    
    // Search across title, description, author, and artist if query is provided
    if (query.trim()) {
      const searchTerm = `%${query.trim()}%`;
      conditions.push(
        or(
          like(series.title, searchTerm),
          like(series.description, searchTerm),
          like(series.author, searchTerm),
          like(series.artist, searchTerm),
          like(series.genres, searchTerm) // Search in genres JSON string
        )
      );
    }

    // Add filters if provided
    if (filters?.status) {
      conditions.push(eq(series.status, filters.status));
    }
    if (filters?.type) {
      conditions.push(eq(series.type, filters.type));
    }
    if (filters?.genre && filters.genre !== "all") {
      conditions.push(like(series.genres, `%${filters.genre}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const result = await db
      .select()
      .from(series)
      .where(whereClause)
      .orderBy(desc(series.updatedAt))
      .limit(50); // Limit search results to 50 items for performance
    
    // Deserialize JSON fields for all series
    return result.map(s => ({
      ...s,
      genres: deserializeJson(s.genres),
    })) as Series[];
  }

  async getSeriesByAuthor(authorName: string): Promise<Series[]> {
    const result = await db
      .select()
      .from(series)
      .where(eq(series.author, authorName))
      .orderBy(desc(series.updatedAt));
    
    // Deserialize JSON fields for all series
    const deserializedSeries = result.map(s => ({
      ...s,
      genres: deserializeJson(s.genres),
    })) as Series[];
    
    // Enrich with chapter data
    return this.enrichSeriesWithChapterData(deserializedSeries);
  }

  async getSeriesByArtist(artistName: string): Promise<Series[]> {
    const result = await db
      .select()
      .from(series)
      .where(eq(series.artist, artistName))
      .orderBy(desc(series.updatedAt));
    
    // Deserialize JSON fields for all series
    const deserializedSeries = result.map(s => ({
      ...s,
      genres: deserializeJson(s.genres),
    })) as Series[];
    
    // Enrich with chapter data
    return this.enrichSeriesWithChapterData(deserializedSeries);
  }

  // Chapter management methods
  async getAllChapters(): Promise<Chapter[]> {
    const result = await db.select().from(chapters).orderBy(desc(chapters.createdAt));
    
    // Deserialize JSON fields for all chapters
    return result.map(c => ({
      ...c,
      pages: deserializeJson(c.pages),
    })) as Chapter[];
  }

  async getChapter(id: string): Promise<Chapter | undefined> {
    const result = await db.select().from(chapters).where(eq(chapters.id, id)).limit(1);
    
    if (result[0]) {
      // Deserialize JSON fields in the response
      return {
        ...result[0],
        pages: deserializeJson(result[0].pages),
      } as Chapter;
    }
    
    return undefined;
  }

  async getChaptersBySeriesId(seriesId: string): Promise<Chapter[]> {
    const result = await db
      .select()
      .from(chapters)
      .where(eq(chapters.seriesId, seriesId))
      .orderBy(sql`CAST(${chapters.chapterNumber} AS REAL) ASC`);
    
    // Deserialize JSON fields for all chapters
    return result.map(c => ({
      ...c,
      pages: deserializeJson(c.pages),
    })) as Chapter[];
  }

  async checkChapterExists(seriesId: string, chapterNumber: string): Promise<Chapter | undefined> {
    try {
      const result = await db
        .select()
        .from(chapters)
        .where(and(
          eq(chapters.seriesId, seriesId),
          eq(chapters.chapterNumber, chapterNumber)
        ))
        .limit(1);
      
      if (result[0]) {
        // Deserialize JSON fields in the response
        return {
          ...result[0],
          pages: deserializeJson(result[0].pages),
        } as Chapter;
      }
      
      return undefined;
    } catch (error) {
      console.error("Error checking chapter existence:", error);
      // CRITICAL FIX: Fail-closed on database errors instead of returning undefined
      // This ensures race conditions don't create duplicate chapters
      throw new Error(`Database error while checking chapter existence: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async createChapter(chapterData: InsertChapter): Promise<Chapter> {
    try {
      // Pages are already serialized by the schema transform, don't double-serialize
      // Always compute totalPages from pages array, ignore any client-supplied value
      const pagesArray = Array.isArray(chapterData.pages) 
        ? chapterData.pages 
        : (chapterData.pages ? JSON.parse(chapterData.pages as string) : []);
        
      // CRITICAL FIX: Explicitly strip any client-supplied totalPages from input
      // Server must always recompute from pages array to prevent client override
      const { totalPages: clientTotalPages, ...cleanedData } = chapterData as any;
      
      const processedData = {
        ...cleanedData,
        pages: serializeJson(pagesArray), // Ensure pages are properly serialized as JSON string
        totalPages: pagesArray.length, // Always server-computed, single source of truth
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      const result = await db.insert(chapters).values(processedData).returning();
      
      // Deserialize JSON fields in the response
      return {
        ...result[0],
        pages: deserializeJson(result[0].pages),
      } as Chapter;
    } catch (error: any) {
      console.error("Error creating chapter:", error);
      
      // CRITICAL FIX: Comprehensive constraint violation detection
      // SQLite can return various error codes and messages for constraint violations
      const isConstraintViolation = 
        // Specific SQLite constraint error codes
        error.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
        error.code === 'SQLITE_CONSTRAINT' ||
        error.code === 'UNIQUE constraint failed' ||
        // Message pattern matching for unique constraint failures
        error.message?.includes('UNIQUE constraint failed') ||
        error.message?.includes('uniqueSeriesChapter') ||
        error.message?.includes('unique_series_chapter') ||
        // General constraint patterns
        error.message?.toLowerCase().includes('constraint') && 
        (error.message?.toLowerCase().includes('unique') || 
         error.message?.toLowerCase().includes('duplicate')) ||
        // SQLite-specific patterns
        error.message?.includes('chapters.series_id') && error.message?.includes('chapters.chapter_number') ||
        // Error name patterns
        error.name?.includes('SqliteError') && error.message?.toLowerCase().includes('unique');
      
      if (isConstraintViolation) {
        console.log(`[storage] 🚫 Unique constraint violation detected: ${error.message}`);
        console.log(`[storage] 📊 Attempted to create duplicate: series_id=${chapterData.seriesId}, chapter_number=${chapterData.chapterNumber}`);
        
        // Create standardized constraint violation error
        const constraintError = new Error(`Chapter ${chapterData.chapterNumber} already exists for series ${chapterData.seriesId}`);
        (constraintError as any).code = 'DUPLICATE_CHAPTER';
        (constraintError as any).statusCode = 409;
        (constraintError as any).details = {
          seriesId: chapterData.seriesId,
          chapterNumber: chapterData.chapterNumber,
          constraint: 'unique_series_chapter',
          action: 'Please choose a different chapter number or update the existing chapter',
          originalError: {
            code: error.code,
            message: error.message,
            name: error.name
          }
        };
        
        // Log for debugging but don't expose internal error details to client
        console.log(`[storage] 🔍 Original constraint error details:`, {
          code: error.code,
          message: error.message,
          name: error.name,
          stack: error.stack?.split('\n')[0] // Just first line of stack
        });
        
        throw constraintError;
      }
      
      // Enhanced logging for non-constraint errors
      console.error(`[storage] ❌ Unexpected error creating chapter:`, {
        code: error.code,
        message: error.message,
        name: error.name,
        seriesId: chapterData.seriesId,
        chapterNumber: chapterData.chapterNumber
      });
      
      // Re-throw other database errors
      throw error;
    }
  }

  async updateChapter(id: string, chapterData: Partial<UpsertChapter>): Promise<Chapter | undefined> {
    // Pages are already serialized by the schema transform, don't double-serialize
    const processedData = {
      ...chapterData,
      updatedAt: new Date().toISOString(),
    };
    
    // Always recompute totalPages if pages are being updated, ignore client-supplied value
    if (chapterData.pages !== undefined) {
      const pagesArray = Array.isArray(chapterData.pages) 
        ? chapterData.pages 
        : (chapterData.pages ? JSON.parse(chapterData.pages as string) : []);
      
      // Remove any client-supplied totalPages and compute from pages
      delete (processedData as any).totalPages;
      processedData.totalPages = pagesArray.length;
    } else {
      // If pages aren't being updated, don't touch totalPages to preserve existing value
      delete (processedData as any).totalPages;
    }
    
    const result = await db
      .update(chapters)
      .set(processedData)
      .where(eq(chapters.id, id))
      .returning();
    
    if (result[0]) {
      // Deserialize JSON fields in the response
      return {
        ...result[0],
        pages: deserializeJson(result[0].pages),
      } as Chapter;
    }
    
    return undefined;
  }

  async deleteChapter(id: string): Promise<boolean> {
    const result = await db.delete(chapters).where(eq(chapters.id, id)).returning();
    return result.length > 0;
  }

  async deleteChaptersBySeriesId(seriesId: string): Promise<boolean> {
    const result = await db.delete(chapters).where(eq(chapters.seriesId, seriesId)).returning();
    return result.length > 0;
  }

  // Get site statistics for admin dashboard
  async getSiteStats() {
    try {
      const [userCount, seriesCount] = await Promise.all([
        db.select({ count: sql<number>`cast(count(*) as int)` }).from(users),
        db.select({ count: sql<number>`cast(count(*) as int)` }).from(series)
      ]);

      return {
        totalUsers: Number(userCount[0]?.count || 0),
        totalSeries: Number(seriesCount[0]?.count || 0),
        activeReaders: 0, // Will need session tracking to implement this
        dailyViews: 0, // Will need view tracking to implement this
      };
    } catch (error) {
      console.error("Error fetching site stats:", error);
      return {
        totalUsers: 0,
        totalSeries: 0,
        activeReaders: 0,
        dailyViews: 0,
      };
    }
  }

  // Get recent series for admin dashboard preview
  async getRecentSeries(limit: number = 6): Promise<Series[]> {
    try {
      // Validate and clamp limit
      const validLimit = Math.max(1, Math.min(24, limit));
      
      const result = await db
        .select()
        .from(series)
        .orderBy(desc(series.createdAt)) // Show newest first!
        .limit(validLimit);
      
      // Deserialize JSON fields for all series
      return result.map(s => ({
        ...s,
        genres: deserializeJson(s.genres),
      })) as Series[];
    } catch (error) {
      console.error("Error fetching recent series:", error);
      throw error; // Don't swallow the error
    }
  }

  // Update user role
  async updateUserRole(id: string, role: string): Promise<User | undefined> {
    try {
      const result = await db
        .update(users)
        .set({
          role: role,
          // Also update isAdmin for backward compatibility
          isAdmin: role === 'admin' || role === 'owner' ? 'true' : 'false',
          updatedAt: new Date().toISOString(),
        })
        .where(eq(users.id, id))
        .returning();
      
      return result[0];
    } catch (error) {
      console.error("Error updating user role:", error);
      return undefined;
    }
  }

  // Get user by role (for owner role validation)
  async getUserByRole(role: string): Promise<User | undefined> {
    try {
      const result = await db
        .select()
        .from(users)
        .where(eq(users.role, role))
        .limit(1);
      
      return result[0];
    } catch (error) {
      console.error("Error fetching user by role:", error);
      return undefined;
    }
  }

  // Get user by ID (for role validation and authorization)
  async getUserById(id: string): Promise<User | undefined> {
    try {
      const result = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      
      return result[0];
    } catch (error) {
      console.error("Error fetching user by id:", error);
      return undefined;
    }
  }

  // Verify unique constraints are properly enforced
  async verifyUniqueConstraints(): Promise<{ isValid: boolean; details: any; }> {
    try {
      console.log('[verification] 🔍 Verifying database unique constraints...');
      
      // Check if unique index exists on chapters table
      const indexes = sqlite.prepare(`PRAGMA index_list('chapters')`).all() as Array<{
        seq: number;
        name: string;
        unique: number;
        origin: string;
        partial: number;
      }>;
      
      const uniqueIndexes = indexes.filter(index => index.unique === 1);
      console.log(`[verification] Found ${uniqueIndexes.length} unique indexes:`, uniqueIndexes.map(i => i.name));
      
      // Verify the specific unique constraint exists
      const hasUniqueConstraint = uniqueIndexes.some(index => 
        index.name === 'unique_series_chapter' ||
        index.name === 'sqlite_autoindex_chapters_1' ||
        (index.name.includes('unique') && index.name.includes('series') && index.name.includes('chapter'))
      );
      
      if (!hasUniqueConstraint) {
        return {
          isValid: false,
          details: {
            error: 'No unique constraint found on chapters(series_id, chapter_number)',
            foundIndexes: uniqueIndexes,
            criticalIssue: 'Database allows duplicate chapters!'
          }
        };
      }
      
      // Find the actual constraint
      const constraintIndex = uniqueIndexes.find(index => 
        index.name === 'unique_series_chapter' ||
        index.name === 'sqlite_autoindex_chapters_1' ||
        (index.name.includes('unique') && index.name.includes('series') && index.name.includes('chapter'))
      );
      
      // Verify the constraint covers the correct columns
      const indexInfo = sqlite.prepare(`PRAGMA index_info('${constraintIndex!.name}')`).all() as Array<{
        seqno: number;
        cid: number;
        name: string;
      }>;
      
      const columnNames = indexInfo.map(col => col.name).sort();
      const expectedColumns = ['series_id', 'chapter_number'].sort();
      
      if (JSON.stringify(columnNames) !== JSON.stringify(expectedColumns)) {
        return {
          isValid: false,
          details: {
            error: 'Unique constraint exists but covers wrong columns',
            expectedColumns,
            actualColumns: columnNames,
            indexName: constraintIndex!.name
          }
        };
      }
      
      console.log(`[verification] ✅ Unique constraint verified: ${constraintIndex!.name} covers ${columnNames.join(', ')}`);
      
      return {
        isValid: true,
        details: {
          constraintName: constraintIndex!.name,
          coveredColumns: columnNames,
          allUniqueIndexes: uniqueIndexes.map(i => ({
            name: i.name,
            origin: i.origin
          })),
          message: 'Unique constraint properly enforced on chapters(series_id, chapter_number)'
        }
      };
      
    } catch (error) {
      console.error('[verification] ❌ Error verifying unique constraints:', error);
      return {
        isValid: false,
        details: {
          error: 'Failed to verify unique constraints',
          exception: (error as Error).message,
          criticalIssue: 'Cannot verify database safety!'
        }
      };
    }
  }

  // Initialize owner role - assign to first admin if no owner exists
  async initializeOwnerRole(): Promise<void> {
    try {
      // Check if owner already exists
      const existingOwner = await this.getUserByRole('owner');
      if (existingOwner) {
        console.log('[owner-init] ✅ Owner role already exists:', existingOwner.username);
        return;
      }

      // Find first admin user to promote to owner
      const firstAdmin = await db
        .select()
        .from(users)
        .where(eq(users.isAdmin, 'true'))
        .orderBy(asc(users.createdAt))
        .limit(1);

      if (firstAdmin.length === 0) {
        console.log('[owner-init] ⚠️ No admin users found to promote to owner');
        return;
      }

      const adminUser = firstAdmin[0];
      
      // Promote first admin to owner
      await db
        .update(users)
        .set({
          role: 'owner',
          isAdmin: 'true', // Ensure isAdmin remains true
          updatedAt: new Date().toISOString(),
        })
        .where(eq(users.id, adminUser.id));

      console.log(`[owner-init] ✅ Promoted admin '${adminUser.username}' to owner role`);
    } catch (error) {
      console.error('[owner-init] ❌ Error initializing owner role:', error);
    }
  }

  async initializeAdIntensity(): Promise<void> {
    try {
      // Check if ad_intensity_level setting already exists
      const existingLevelSetting = await this.getSetting('system', 'ad_intensity_level');
      
      if (!existingLevelSetting) {
        // Create default ad intensity setting (Level 2 = moderate)
        await this.setSetting(
          'system', 
          'ad_intensity_level', 
          '2', 
          'number',
          'Controls ad quantity per page: 1 (1 ad/page), 2 (multiple ads on big pages), 3 (max ads)',
          true // isPublic - so frontend can read it
        );
        console.log('[ad-intensity] ✅ Ad intensity level initialized to Level 2 (Moderate)');
      } else {
        console.log('[ad-intensity] ✅ Ad intensity level already configured:', existingLevelSetting.value);
      }

      // Check if ads_enabled setting already exists
      const existingEnabledSetting = await this.getSetting('system', 'ads_enabled');
      
      if (!existingEnabledSetting) {
        // Create default ads enabled setting (true = enabled)
        await this.setSetting(
          'system',
          'ads_enabled',
          'true',
          'boolean',
          'Global toggle to enable/disable all advertisements',
          true // isPublic - so frontend can read it
        );
        console.log('[ad-intensity] ✅ Ads enabled status initialized to true (enabled)');
      } else {
        console.log('[ad-intensity] ✅ Ads enabled status already configured:', existingEnabledSetting.value);
      }
    } catch (error) {
      console.error('[ad-intensity] ❌ Error initializing ad intensity:', error);
      // Don't throw - this is not critical for app startup
    }
  }

  // Settings management methods
  async getAllSettings(): Promise<SettingResponse[]> {
    try {
      const result = await db
        .select()
        .from(settings)
        .orderBy(asc(settings.category), asc(settings.key));
      
      // Convert isPublic from string to boolean for API responses
      return result.map(setting => ({
        ...setting,
        isPublic: setting.isPublic === "true"
      }));
    } catch (error) {
      console.error("Error fetching all settings:", error);
      return [];
    }
  }

  async getSettingsByCategory(category: string): Promise<SettingResponse[]> {
    try {
      const result = await db
        .select()
        .from(settings)
        .where(eq(settings.category, category))
        .orderBy(asc(settings.key));
      
      // Convert isPublic from string to boolean for API responses
      return result.map(setting => ({
        ...setting,
        isPublic: setting.isPublic === "true"
      }));
    } catch (error) {
      console.error("Error fetching settings by category:", error);
      return [];
    }
  }

  async getSetting(category: string, key: string): Promise<SettingResponse | undefined> {
    try {
      const result = await db
        .select()
        .from(settings)
        .where(and(
          eq(settings.category, category),
          eq(settings.key, key)
        ))
        .limit(1);
      
      if (result[0]) {
        // Convert isPublic from string to boolean for API responses  
        return {
          ...result[0],
          isPublic: result[0].isPublic === "true"
        };
      }
      
      return undefined;
    } catch (error) {
      console.error("Error fetching setting:", error);
      return undefined;
    }
  }

  async setSetting(
    category: string, 
    key: string, 
    value: string, 
    type: string = "string",
    description?: string,
    isPublic: boolean = false
  ): Promise<SettingResponse> {
    try {
      // Check if setting already exists
      const existingSetting = await this.getSetting(category, key);
      
      if (existingSetting) {
        // Update existing setting
        const result = await db
          .update(settings)
          .set({
            value,
            type,
            description,
            isPublic: isPublic ? "true" : "false",
            updatedAt: new Date().toISOString(),
          })
          .where(eq(settings.id, existingSetting.id))
          .returning();
        
        // Convert isPublic back to boolean for API response
        return {
          ...result[0],
          isPublic: result[0].isPublic === "true"
        };
      } else {
        // Create new setting
        const result = await db
          .insert(settings)
          .values({
            category,
            key,
            value,
            type,
            description,
            isPublic: isPublic ? "true" : "false",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .returning();
        
        // Convert isPublic back to boolean for API response
        return {
          ...result[0],
          isPublic: result[0].isPublic === "true"
        };
      }
    } catch (error) {
      console.error("Error setting value:", error);
      throw error;
    }
  }

  async updateSetting(id: string, settingData: Partial<UpsertSetting>): Promise<SettingResponse | undefined> {
    try {
      // Convert isPublic boolean to string for storage if provided
      const processedData = {
        ...settingData,
        updatedAt: new Date().toISOString(),
      };
      
      if (settingData.isPublic !== undefined) {
        processedData.isPublic = settingData.isPublic ? "true" : "false";
      }

      const result = await db
        .update(settings)
        .set(processedData)
        .where(eq(settings.id, id))
        .returning();
      
      if (result[0]) {
        // Convert isPublic back to boolean for API response
        return {
          ...result[0],
          isPublic: result[0].isPublic === "true"
        };
      }
      
      return undefined;
    } catch (error) {
      console.error("Error updating setting:", error);
      return undefined;
    }
  }

  async deleteSetting(id: string): Promise<boolean> {
    try {
      const result = await db
        .delete(settings)
        .where(eq(settings.id, id))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting setting:", error);
      return false;
    }
  }

  async getOAuthProviderConfig(provider: 'google' | 'discord'): Promise<{
    enabled: boolean;
    clientId: string;
    clientSecret: string;
  }> {
    try {
      const enabledSetting = await this.getSetting('auth', `oauth_${provider}_enabled`);
      const clientIdSetting = await this.getSetting('auth', `oauth_${provider}_client_id`);
      const clientSecretSetting = await this.getSetting('auth', `oauth_${provider}_client_secret`);

      return {
        enabled: enabledSetting?.value === 'true',
        clientId: clientIdSetting?.value || '',
        clientSecret: clientSecretSetting?.value || ''
      };
    } catch (error) {
      console.error(`Error fetching OAuth config for ${provider}:`, error);
      return { enabled: false, clientId: '', clientSecret: '' };
    }
  }

  async setOAuthProviderConfig(
    provider: 'google' | 'discord',
    config: { enabled?: boolean; clientId?: string; clientSecret?: string }
  ): Promise<void> {
    try {
      if (config.enabled !== undefined) {
        await this.setSetting(
          'auth',
          `oauth_${provider}_enabled`,
          config.enabled ? 'true' : 'false',
          'boolean',
          `Enable ${provider.charAt(0).toUpperCase() + provider.slice(1)} OAuth login`,
          true
        );
      }

      if (config.clientId !== undefined) {
        await this.setSetting(
          'auth',
          `oauth_${provider}_client_id`,
          config.clientId,
          'string',
          `${provider.charAt(0).toUpperCase() + provider.slice(1)} OAuth Client ID`,
          false
        );
      }

      if (config.clientSecret !== undefined) {
        await this.setSetting(
          'auth',
          `oauth_${provider}_client_secret`,
          config.clientSecret,
          'string',
          `${provider.charAt(0).toUpperCase() + provider.slice(1)} OAuth Client Secret`,
          false
        );
      }
    } catch (error) {
      console.error(`Error setting OAuth config for ${provider}:`, error);
      throw error;
    }
  }

  async getEnabledOAuthProviders(): Promise<string[]> {
    try {
      const enabledProviders: string[] = [];
      
      const googleConfig = await this.getOAuthProviderConfig('google');
      if (googleConfig.enabled && googleConfig.clientId && googleConfig.clientSecret) {
        enabledProviders.push('google');
      }
      
      const discordConfig = await this.getOAuthProviderConfig('discord');
      if (discordConfig.enabled && discordConfig.clientId && discordConfig.clientSecret) {
        enabledProviders.push('discord');
      }
      
      return enabledProviders;
    } catch (error) {
      console.error('Error fetching enabled OAuth providers:', error);
      return [];
    }
  }

  async addToLibrary(userId: string, seriesId: string, status: string = "reading"): Promise<UserLibrary> {
    try {
      const result = await db
        .insert(userLibrary)
        .values({
          userId,
          seriesId,
          status,
          addedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .returning();
      
      return result[0];
    } catch (error: any) {
      if (error.message?.includes('UNIQUE constraint failed')) {
        throw new Error('Series is already in your library');
      }
      console.error("Error adding to library:", error);
      throw error;
    }
  }

  async updateLibraryStatus(userId: string, seriesId: string, status: string): Promise<UserLibrary | undefined> {
    try {
      const result = await db
        .update(userLibrary)
        .set({ 
          status,
          updatedAt: new Date().toISOString()
        })
        .where(and(
          eq(userLibrary.userId, userId),
          eq(userLibrary.seriesId, seriesId)
        ))
        .returning();
      
      return result[0];
    } catch (error) {
      console.error("Error updating library status:", error);
      return undefined;
    }
  }

  async removeFromLibrary(userId: string, seriesId: string): Promise<boolean> {
    try {
      const result = await db
        .delete(userLibrary)
        .where(and(
          eq(userLibrary.userId, userId),
          eq(userLibrary.seriesId, seriesId)
        ))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error("Error removing from library:", error);
      return false;
    }
  }

  async getUserLibrary(userId: string): Promise<Array<UserLibrary & { series: Series }>> {
    try {
      const result = await db
        .select({
          id: userLibrary.id,
          userId: userLibrary.userId,
          seriesId: userLibrary.seriesId,
          status: userLibrary.status,
          addedAt: userLibrary.addedAt,
          updatedAt: userLibrary.updatedAt,
          series: series,
        })
        .from(userLibrary)
        .innerJoin(series, eq(userLibrary.seriesId, series.id))
        .where(eq(userLibrary.userId, userId))
        .orderBy(desc(userLibrary.addedAt));
      
      return result.map(row => ({
        id: row.id,
        userId: row.userId,
        seriesId: row.seriesId,
        status: row.status,
        addedAt: row.addedAt,
        updatedAt: row.updatedAt,
        series: row.series,
      }));
    } catch (error) {
      console.error("Error fetching user library:", error);
      return [];
    }
  }

  async isInLibrary(userId: string, seriesId: string): Promise<boolean> {
    try {
      const result = await db
        .select()
        .from(userLibrary)
        .where(and(
          eq(userLibrary.userId, userId),
          eq(userLibrary.seriesId, seriesId)
        ))
        .limit(1);
      
      return result.length > 0;
    } catch (error) {
      console.error("Error checking library status:", error);
      return false;
    }
  }

  async followSeries(userId: string, seriesId: string, notificationsEnabled: boolean = true): Promise<UserFollow & { notificationsEnabled: boolean }> {
    try {
      const result = await db
        .insert(userFollows)
        .values({
          userId,
          seriesId,
          followedAt: new Date().toISOString(),
          notificationsEnabled: notificationsEnabled ? "true" : "false",
        })
        .returning();
      
      const follow = result[0];
      return {
        ...follow,
        notificationsEnabled: follow.notificationsEnabled === "true"
      } as UserFollow & { notificationsEnabled: boolean };
    } catch (error: any) {
      if (error.message?.includes('UNIQUE constraint failed')) {
        throw new Error('You are already following this series');
      }
      console.error("Error following series:", error);
      throw error;
    }
  }

  async unfollowSeries(userId: string, seriesId: string): Promise<boolean> {
    try {
      const result = await db
        .delete(userFollows)
        .where(and(
          eq(userFollows.userId, userId),
          eq(userFollows.seriesId, seriesId)
        ))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error("Error unfollowing series:", error);
      return false;
    }
  }

  async getUserFollows(userId: string): Promise<Array<Omit<UserFollow, 'notificationsEnabled'> & { notificationsEnabled: boolean; series: Series }>> {
    try {
      const result = await db
        .select({
          id: userFollows.id,
          userId: userFollows.userId,
          seriesId: userFollows.seriesId,
          followedAt: userFollows.followedAt,
          notificationsEnabled: userFollows.notificationsEnabled,
          series: series,
        })
        .from(userFollows)
        .innerJoin(series, eq(userFollows.seriesId, series.id))
        .where(eq(userFollows.userId, userId))
        .orderBy(desc(userFollows.followedAt));
      
      return result.map(row => ({
        id: row.id,
        userId: row.userId,
        seriesId: row.seriesId,
        followedAt: row.followedAt,
        notificationsEnabled: row.notificationsEnabled === "true",
        series: row.series,
      }));
    } catch (error) {
      console.error("Error fetching user follows:", error);
      return [];
    }
  }

  async isFollowing(userId: string, seriesId: string): Promise<{ isFollowing: boolean; notificationsEnabled?: boolean }> {
    try {
      const result = await db
        .select()
        .from(userFollows)
        .where(and(
          eq(userFollows.userId, userId),
          eq(userFollows.seriesId, seriesId)
        ))
        .limit(1);
      
      if (!result[0]) {
        return { isFollowing: false };
      }
      
      return {
        isFollowing: true,
        notificationsEnabled: result[0].notificationsEnabled === "true"
      };
    } catch (error) {
      console.error("Error checking follow status:", error);
      return { isFollowing: false };
    }
  }

  async updateFollowNotifications(userId: string, seriesId: string, enabled: boolean): Promise<(UserFollow & { notificationsEnabled: boolean }) | undefined> {
    try {
      const result = await db
        .update(userFollows)
        .set({
          notificationsEnabled: enabled ? "true" : "false",
        })
        .where(and(
          eq(userFollows.userId, userId),
          eq(userFollows.seriesId, seriesId)
        ))
        .returning();
      
      if (!result[0]) return undefined;
      
      const follow = result[0];
      return {
        ...follow,
        notificationsEnabled: follow.notificationsEnabled === "true"
      } as UserFollow & { notificationsEnabled: boolean };
    } catch (error) {
      console.error("Error updating follow notifications:", error);
      return undefined;
    }
  }

  async getSeriesFollowerCount(seriesId: string): Promise<number> {
    try {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(userFollows)
        .where(eq(userFollows.seriesId, seriesId));
      
      return result[0]?.count || 0;
    } catch (error) {
      console.error("Error getting follower count:", error);
      return 0;
    }
  }

  async createComment(commentData: InsertComment): Promise<CommentWithUser> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    const newComment = await db.insert(comments).values({
      id,
      userId: commentData.userId,
      seriesId: commentData.seriesId || null,
      chapterId: commentData.chapterId || null,
      content: commentData.content,
      createdAt: now,
      updatedAt: now,
    }).returning();

    const result = await db
      .select({
        id: comments.id,
        userId: comments.userId,
        seriesId: comments.seriesId,
        chapterId: comments.chapterId,
        content: comments.content,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        username: users.username,
        profilePicture: users.profilePicture,
        profileImageUrl: users.profileImageUrl,
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.id, id));

    const comment = result[0];
    return {
      id: comment.id,
      userId: comment.userId,
      seriesId: comment.seriesId,
      chapterId: comment.chapterId,
      content: comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      user: {
        id: comment.userId,
        username: comment.username,
        profilePicture: comment.profilePicture,
        profileImageUrl: comment.profileImageUrl,
      }
    };
  }

  async updateComment(id: string, content: string): Promise<CommentWithUser | undefined> {
    const now = new Date().toISOString();
    
    await db
      .update(comments)
      .set({ content, updatedAt: now })
      .where(eq(comments.id, id));

    const result = await db
      .select({
        id: comments.id,
        userId: comments.userId,
        seriesId: comments.seriesId,
        chapterId: comments.chapterId,
        content: comments.content,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        username: users.username,
        profilePicture: users.profilePicture,
        profileImageUrl: users.profileImageUrl,
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.id, id));

    if (result.length === 0) return undefined;

    const comment = result[0];
    return {
      id: comment.id,
      userId: comment.userId,
      seriesId: comment.seriesId,
      chapterId: comment.chapterId,
      content: comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      user: {
        id: comment.userId,
        username: comment.username,
        profilePicture: comment.profilePicture,
        profileImageUrl: comment.profileImageUrl,
      }
    };
  }

  async deleteComment(id: string): Promise<boolean> {
    try {
      await db.delete(comments).where(eq(comments.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting comment:", error);
      return false;
    }
  }

  async getCommentsBySeriesId(seriesId: string): Promise<CommentWithUser[]> {
    const results = await db
      .select({
        id: comments.id,
        userId: comments.userId,
        seriesId: comments.seriesId,
        chapterId: comments.chapterId,
        content: comments.content,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        username: users.username,
        profilePicture: users.profilePicture,
        profileImageUrl: users.profileImageUrl,
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.seriesId, seriesId))
      .orderBy(desc(comments.createdAt));

    return results.map(comment => ({
      id: comment.id,
      userId: comment.userId,
      seriesId: comment.seriesId,
      chapterId: comment.chapterId,
      content: comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      user: {
        id: comment.userId,
        username: comment.username,
        profilePicture: comment.profilePicture,
        profileImageUrl: comment.profileImageUrl,
      }
    }));
  }

  async getCommentsByChapterId(chapterId: string): Promise<CommentWithUser[]> {
    const results = await db
      .select({
        id: comments.id,
        userId: comments.userId,
        seriesId: comments.seriesId,
        chapterId: comments.chapterId,
        content: comments.content,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        username: users.username,
        profilePicture: users.profilePicture,
        profileImageUrl: users.profileImageUrl,
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.chapterId, chapterId))
      .orderBy(desc(comments.createdAt));

    return results.map(comment => ({
      id: comment.id,
      userId: comment.userId,
      seriesId: comment.seriesId,
      chapterId: comment.chapterId,
      content: comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      user: {
        id: comment.userId,
        username: comment.username,
        profilePicture: comment.profilePicture,
        profileImageUrl: comment.profileImageUrl,
      }
    }));
  }

  async getUserComment(userId: string, seriesId?: string, chapterId?: string): Promise<CommentWithUser | undefined> {
    const baseQuery = db
      .select({
        id: comments.id,
        userId: comments.userId,
        seriesId: comments.seriesId,
        chapterId: comments.chapterId,
        content: comments.content,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        username: users.username,
        profilePicture: users.profilePicture,
        profileImageUrl: users.profileImageUrl,
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id));

    let results;
    if (seriesId) {
      results = await baseQuery.where(and(
        eq(comments.userId, userId),
        eq(comments.seriesId, seriesId)
      )).limit(1);
    } else if (chapterId) {
      results = await baseQuery.where(and(
        eq(comments.userId, userId),
        eq(comments.chapterId, chapterId)
      )).limit(1);
    } else {
      results = await baseQuery.where(eq(comments.userId, userId)).limit(1);
    }
    
    if (results.length === 0) return undefined;

    const comment = results[0];
    return {
      id: comment.id,
      userId: comment.userId,
      seriesId: comment.seriesId,
      chapterId: comment.chapterId,
      content: comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      user: {
        id: comment.userId,
        username: comment.username,
        profilePicture: comment.profilePicture,
        profileImageUrl: comment.profileImageUrl,
      }
    };
  }

  async saveReadingProgress(userId: string, seriesId: string, chapterId: string | null, lastReadPage: number): Promise<ReadingProgress> {
    const now = new Date().toISOString();
    
    const existing = await db
      .select()
      .from(readingProgress)
      .where(and(
        eq(readingProgress.userId, userId),
        eq(readingProgress.seriesId, seriesId)
      ))
      .limit(1);

    if (existing.length > 0) {
      const updated = await db
        .update(readingProgress)
        .set({
          chapterId: chapterId,
          lastReadPage,
          lastReadAt: now,
          updatedAt: now,
        })
        .where(and(
          eq(readingProgress.userId, userId),
          eq(readingProgress.seriesId, seriesId)
        ))
        .returning();
      
      return updated[0];
    } else {
      const id = crypto.randomUUID();
      const inserted = await db
        .insert(readingProgress)
        .values({
          id,
          userId,
          seriesId,
          chapterId,
          lastReadPage,
          lastReadAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      
      return inserted[0];
    }
  }

  async getReadingProgress(userId: string, seriesId: string): Promise<ReadingProgress | undefined> {
    const results = await db
      .select()
      .from(readingProgress)
      .where(and(
        eq(readingProgress.userId, userId),
        eq(readingProgress.seriesId, seriesId)
      ))
      .limit(1);

    return results.length > 0 ? results[0] : undefined;
  }

  async getUserReadingProgress(userId: string): Promise<ReadingProgressWithSeries[]> {
    const results = await db
      .select({
        id: readingProgress.id,
        userId: readingProgress.userId,
        seriesId: readingProgress.seriesId,
        chapterId: readingProgress.chapterId,
        lastReadPage: readingProgress.lastReadPage,
        lastReadAt: readingProgress.lastReadAt,
        createdAt: readingProgress.createdAt,
        updatedAt: readingProgress.updatedAt,
        seriesData: series,
        chapterData: chapters,
      })
      .from(readingProgress)
      .leftJoin(series, eq(readingProgress.seriesId, series.id))
      .leftJoin(chapters, eq(readingProgress.chapterId, chapters.id))
      .where(eq(readingProgress.userId, userId))
      .orderBy(desc(readingProgress.lastReadAt));

    return results.map(result => ({
      id: result.id,
      userId: result.userId,
      seriesId: result.seriesId,
      chapterId: result.chapterId,
      chapterNumber: result.chapterData?.chapterNumber || null,
      lastReadPage: result.lastReadPage,
      lastReadAt: result.lastReadAt,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      series: result.seriesData!,
    }));
  }

  async deleteReadingProgress(userId: string, seriesId: string): Promise<boolean> {
    try {
      await db
        .delete(readingProgress)
        .where(and(
          eq(readingProgress.userId, userId),
          eq(readingProgress.seriesId, seriesId)
        ));
      return true;
    } catch (error) {
      console.error("Error deleting reading progress:", error);
      return false;
    }
  }

  async createEmailVerificationToken(userId: string): Promise<EmailVerificationToken> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    const result = await db.insert(emailVerificationTokens).values({
      userId,
      token,
      expiresAt
    }).returning();
    return result[0];
  }

  async getEmailVerificationToken(token: string): Promise<EmailVerificationToken | undefined> {
    const result = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.token, token))
      .limit(1);
    return result[0];
  }

  async deleteEmailVerificationToken(token: string): Promise<boolean> {
    try {
      await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.token, token));
      return true;
    } catch (error) {
      console.error("Error deleting email verification token:", error);
      return false;
    }
  }

  async markEmailAsVerified(userId: string): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({
        emailVerified: "true",
        emailVerifiedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async createPasswordResetToken(userId: string): Promise<PasswordResetToken> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    
    const result = await db.insert(passwordResetTokens).values({
      userId,
      token,
      expiresAt,
      used: "false"
    }).returning();
    return result[0];
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const result = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token))
      .limit(1);
    return result[0];
  }

  async markPasswordResetTokenAsUsed(token: string): Promise<boolean> {
    try {
      await db
        .update(passwordResetTokens)
        .set({ used: "true" })
        .where(eq(passwordResetTokens.token, token));
      return true;
    } catch (error) {
      console.error("Error marking password reset token as used:", error);
      return false;
    }
  }

  async deletePasswordResetToken(token: string): Promise<boolean> {
    try {
      await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token));
      return true;
    } catch (error) {
      console.error("Error deleting password reset token:", error);
      return false;
    }
  }

  async resetUserPassword(userId: string, newPasswordHash: string): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({
        password: newPasswordHash,
        updatedAt: new Date().toISOString()
      })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async createOrUpdateUserRating(userId: string, seriesId: string, rating: number, review?: string): Promise<UserRating> {
    const existing = await this.getUserRating(userId, seriesId);
    
    if (existing) {
      const result = await db
        .update(userRatings)
        .set({
          rating,
          review,
          updatedAt: new Date().toISOString()
        })
        .where(and(
          eq(userRatings.userId, userId),
          eq(userRatings.seriesId, seriesId)
        ))
        .returning();
      return result[0];
    } else {
      const result = await db
        .insert(userRatings)
        .values({
          userId,
          seriesId,
          rating,
          review
        })
        .returning();
      return result[0];
    }
  }

  async getUserRating(userId: string, seriesId: string): Promise<UserRating | undefined> {
    const result = await db
      .select()
      .from(userRatings)
      .where(and(
        eq(userRatings.userId, userId),
        eq(userRatings.seriesId, seriesId)
      ))
      .limit(1);
    return result[0];
  }

  async getSeriesRatings(seriesId: string): Promise<UserRatingWithUser[]> {
    const results = await db
      .select({
        id: userRatings.id,
        userId: userRatings.userId,
        seriesId: userRatings.seriesId,
        rating: userRatings.rating,
        review: userRatings.review,
        createdAt: userRatings.createdAt,
        updatedAt: userRatings.updatedAt,
        user: {
          id: users.id,
          username: users.username,
          profilePicture: users.profilePicture,
          profileImageUrl: users.profileImageUrl
        }
      })
      .from(userRatings)
      .innerJoin(users, eq(userRatings.userId, users.id))
      .where(eq(userRatings.seriesId, seriesId))
      .orderBy(desc(userRatings.createdAt));
    
    return results;
  }

  async deleteUserRating(userId: string, seriesId: string): Promise<boolean> {
    try {
      await db
        .delete(userRatings)
        .where(and(
          eq(userRatings.userId, userId),
          eq(userRatings.seriesId, seriesId)
        ));
      return true;
    } catch (error) {
      console.error("Error deleting user rating:", error);
      return false;
    }
  }

  async getSeriesAverageRating(seriesId: string): Promise<number> {
    const result = await db
      .select({
        avg: sql<number>`AVG(${userRatings.rating})`
      })
      .from(userRatings)
      .where(eq(userRatings.seriesId, seriesId));
    
    return result[0]?.avg || 0;
  }

  async followUser(followerId: string, followingId: string): Promise<UserFollowUser> {
    const result = await db
      .insert(userFollowsUsers)
      .values({
        followerId,
        followingId
      })
      .returning();
    return result[0];
  }

  async unfollowUser(followerId: string, followingId: string): Promise<boolean> {
    try {
      await db
        .delete(userFollowsUsers)
        .where(and(
          eq(userFollowsUsers.followerId, followerId),
          eq(userFollowsUsers.followingId, followingId)
        ));
      return true;
    } catch (error) {
      console.error("Error unfollowing user:", error);
      return false;
    }
  }

  async getUserFollowers(userId: string): Promise<UserFollowUser[]> {
    const result = await db
      .select()
      .from(userFollowsUsers)
      .where(eq(userFollowsUsers.followingId, userId))
      .orderBy(desc(userFollowsUsers.followedAt));
    return result;
  }

  async getUserFollowing(userId: string): Promise<UserFollowUser[]> {
    const result = await db
      .select()
      .from(userFollowsUsers)
      .where(eq(userFollowsUsers.followerId, userId))
      .orderBy(desc(userFollowsUsers.followedAt));
    return result;
  }

  async isFollowingUser(followerId: string, followingId: string): Promise<boolean> {
    const result = await db
      .select()
      .from(userFollowsUsers)
      .where(and(
        eq(userFollowsUsers.followerId, followerId),
        eq(userFollowsUsers.followingId, followingId)
      ))
      .limit(1);
    return result.length > 0;
  }

  async getUserCurrencyBalance(userId: string): Promise<number> {
    const user = await db
      .select({ currencyBalance: users.currencyBalance })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return user[0]?.currencyBalance ?? 0;
  }

  async getCurrencyTransactions(userId: string, limit: number = 50, offset: number = 0): Promise<CurrencyTransaction[]> {
    const transactions = await db
      .select()
      .from(currencyTransactions)
      .where(eq(currencyTransactions.userId, userId))
      .orderBy(desc(currencyTransactions.createdAt))
      .limit(limit)
      .offset(offset);
    return transactions;
  }

  async addCurrencyTransaction(userId: string, amount: number, type: string, description: string, relatedEntityId?: string): Promise<CurrencyTransaction> {
    const newTransaction: InsertCurrencyTransaction = {
      userId,
      amount,
      type,
      description,
      relatedEntityId,
    };

    const result = await db
      .insert(currencyTransactions)
      .values(newTransaction)
      .returning();
    
    return result[0];
  }

  async updateUserCurrencyBalance(userId: string, newBalance: number): Promise<User | undefined> {
    const updated = await db
      .update(users)
      .set({ 
        currencyBalance: newBalance,
        updatedAt: sql`(datetime('now'))`
      })
      .where(eq(users.id, userId))
      .returning();
    
    return updated[0];
  }

  async processCurrencyChange(
    userId: string,
    amount: number,
    type: string,
    description: string,
    relatedEntityId?: string
  ): Promise<{ success: boolean; newBalance?: number; error?: string }> {
    try {
      // Use Drizzle to get current balance to ensure consistency
      const userResult = await db
        .select({ username: users.username, currencyBalance: users.currencyBalance })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      
      if (!userResult || userResult.length === 0) {
        return { success: false, error: "User not found" };
      }
      
      const user = userResult[0];
      const currentBalance = user.currencyBalance ?? 0;
      const newBalance = currentBalance + amount;
      
      console.log(`[BALANCE] User: ${user.username}, Current: ${currentBalance}, Amount: ${amount}, New: ${newBalance}`);
      
      const result = sqlite.transaction(() => {
        
        // Only prevent negative balances for non-admin operations
        // Admin operations (admin_grant, admin_deduct) can create negative balances for corrections/refunds
        const isAdminOperation = type.includes('admin');
        if (newBalance < 0 && !isAdminOperation) {
          throw new Error("Insufficient currency balance");
        }
        
        const transactionId = randomBytes(16).toString('hex');
        const now = new Date().toISOString();
        
        sqlite.prepare(`
          INSERT INTO currency_transactions (id, user_id, amount, type, description, related_entity_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(transactionId, userId, amount, type, description, relatedEntityId || null, now);
        
        sqlite.prepare(`
          UPDATE users 
          SET currency_balance = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(newBalance, userId);
        
        return { success: true, newBalance };
      })();
      
      return result;
    } catch (error) {
      console.error("Error processing currency change:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to process currency change" 
      };
    }
  }

  async getAllCurrencyTransactions(limit: number = 100): Promise<any[]> {
    const result = sqlite.prepare(`
      SELECT 
        ct.id,
        ct.user_id as userId,
        u.username,
        ct.amount,
        ct.type,
        ct.description as reason,
        ct.created_at as createdAt
      FROM currency_transactions ct
      JOIN users u ON ct.user_id = u.id
      ORDER BY ct.created_at DESC
      LIMIT ?
    `).all(limit);
    
    return result as any[];
  }

  async getCurrencyStats(): Promise<{
    totalDistributed: number;
    totalSpent: number;
    activeUsers: number;
  }> {
    const distributed = sqlite.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM currency_transactions
      WHERE amount > 0
    `).get() as { total: number };

    const spent = sqlite.prepare(`
      SELECT COALESCE(SUM(ABS(amount)), 0) as total
      FROM currency_transactions
      WHERE amount < 0
    `).get() as { total: number };

    const activeUsers = sqlite.prepare(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM currency_transactions
    `).get() as { count: number };

    return {
      totalDistributed: distributed.total,
      totalSpent: spent.total,
      activeUsers: activeUsers.count,
    };
  }

  async getCurrencyPackages(activeOnly: boolean = false): Promise<CurrencyPackage[]> {
    let query = db
      .select()
      .from(currencyPackages);

    if (activeOnly) {
      query = query.where(eq(currencyPackages.isActive, "true")) as any;
    }

    const packages = await query.orderBy(asc(currencyPackages.displayOrder));
    return packages;
  }

  async createCurrencyPackage(data: InsertCurrencyPackage): Promise<CurrencyPackage> {
    const result = await db
      .insert(currencyPackages)
      .values(data)
      .returning();
    
    return result[0];
  }

  async updateCurrencyPackage(id: string, data: Partial<InsertCurrencyPackage>): Promise<CurrencyPackage | undefined> {
    const updated = await db
      .update(currencyPackages)
      .set({ 
        ...data,
        updatedAt: sql`(datetime('now'))`
      })
      .where(eq(currencyPackages.id, id))
      .returning();
    
    return updated[0];
  }

  async deleteCurrencyPackage(id: string): Promise<boolean> {
    try {
      await db
        .delete(currencyPackages)
        .where(eq(currencyPackages.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting currency package:", error);
      return false;
    }
  }

  async createUserPurchase(data: InsertUserPurchase): Promise<UserPurchase> {
    const result = await db
      .insert(userPurchases)
      .values(data)
      .returning();
    
    return result[0];
  }

  async getUserPurchases(userId: string): Promise<UserPurchase[]> {
    const purchases = await db
      .select()
      .from(userPurchases)
      .where(eq(userPurchases.userId, userId))
      .orderBy(desc(userPurchases.createdAt));
    
    return purchases;
  }

  async getPurchaseByTransactionId(transactionId: string): Promise<UserPurchase | undefined> {
    const purchase = await db
      .select()
      .from(userPurchases)
      .where(eq(userPurchases.transactionId, transactionId))
      .limit(1);
    
    return purchase[0];
  }

  // ========== REVENUE ANALYTICS IMPLEMENTATIONS ==========

  async getTotalRevenue(startDate?: string, endDate?: string): Promise<number> {
    try {
      const whereConditions = [eq(userPurchases.status, 'completed')];
      
      if (startDate && endDate) {
        whereConditions.push(gte(userPurchases.createdAt, startDate));
        whereConditions.push(lte(userPurchases.createdAt, endDate));
      }

      const purchases = await db.select({ amount: userPurchases.amountPaid })
        .from(userPurchases)
        .where(and(...whereConditions))
        .all();
      const total = purchases.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);
      return Math.round(total * 100) / 100;
    } catch (error) {
      console.error("Error getting total revenue:", error);
      return 0;
    }
  }

  async getMonthlyRevenue(month?: string): Promise<number> {
    try {
      const targetMonth = month || new Date().toISOString().substring(0, 7);
      const startOfMonth = `${targetMonth}-01`;
      const endOfMonth = new Date(new Date(startOfMonth).getFullYear(), new Date(startOfMonth).getMonth() + 1, 0).toISOString();
      
      return await this.getTotalRevenue(startOfMonth, endOfMonth);
    } catch (error) {
      console.error("Error getting monthly revenue:", error);
      return 0;
    }
  }

  async getRevenueByType(startDate?: string, endDate?: string): Promise<{ subscriptionRevenue: number; coinSalesRevenue: number; flashSalesRevenue: number }> {
    try {
      const whereConditions = [eq(userPurchases.status, 'completed')];
      
      if (startDate && endDate) {
        whereConditions.push(gte(userPurchases.createdAt, startDate));
        whereConditions.push(lte(userPurchases.createdAt, endDate));
      }

      const purchases = await db.select()
        .from(userPurchases)
        .where(and(...whereConditions))
        .all();
      
      let subscriptionRevenue = 0;
      let coinSalesRevenue = 0;
      let flashSalesRevenue = 0;

      for (const purchase of purchases) {
        const amount = parseFloat(purchase.amountPaid || '0');
        
        if (purchase.paymentProvider === 'stripe_subscription') {
          subscriptionRevenue += amount;
        } else if (purchase.paymentProvider === 'flash_sale') {
          flashSalesRevenue += amount;
        } else {
          coinSalesRevenue += amount;
        }
      }

      return {
        subscriptionRevenue: Math.round(subscriptionRevenue * 100) / 100,
        coinSalesRevenue: Math.round(coinSalesRevenue * 100) / 100,
        flashSalesRevenue: Math.round(flashSalesRevenue * 100) / 100
      };
    } catch (error) {
      console.error("Error getting revenue by type:", error);
      return { subscriptionRevenue: 0, coinSalesRevenue: 0, flashSalesRevenue: 0 };
    }
  }

  async getRevenueGrowth(currentStart: string, currentEnd: string, previousStart: string, previousEnd: string): Promise<number> {
    try {
      const currentRevenue = await this.getTotalRevenue(currentStart, currentEnd);
      const previousRevenue = await this.getTotalRevenue(previousStart, previousEnd);
      
      if (previousRevenue === 0) return currentRevenue > 0 ? 100 : 0;
      
      const growth = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
      return Math.round(growth * 10) / 10;
    } catch (error) {
      console.error("Error calculating revenue growth:", error);
      return 0;
    }
  }

  async getTopSellingPackages(limit: number = 10, startDate?: string, endDate?: string): Promise<Array<{ id: string; name: string; type: string; totalSales: number; revenue: string }>> {
    try {
      const whereConditions = [eq(userPurchases.status, 'completed')];
      
      if (startDate && endDate) {
        whereConditions.push(gte(userPurchases.createdAt, startDate));
        whereConditions.push(lte(userPurchases.createdAt, endDate));
      }

      const purchases = await db.select()
        .from(userPurchases)
        .where(and(...whereConditions))
        .all();
      
      // PERFORMANCE OPTIMIZATION: Fetch all packages once before loop to prevent N+1 query
      // This reduces 1000+ queries to just 1 query when processing many purchases
      const allPackages = await this.getCurrencyPackages(false);
      const packageMap = new Map(allPackages.map(p => [p.id, p]));
      
      const packageStats = new Map<string, { id: string; name: string; type: string; totalSales: number; revenue: number }>();
      
      for (const purchase of purchases) {
        if (!purchase.packageId) continue;
        
        const key = purchase.packageId;
        const existing = packageStats.get(key);
        const amount = parseFloat(purchase.amountPaid || '0');
        
        if (existing) {
          existing.totalSales++;
          existing.revenue += amount;
        } else {
          // Use pre-fetched packageMap instead of querying inside loop
          const pkg = packageMap.get(purchase.packageId);
          packageStats.set(key, {
            id: purchase.packageId,
            name: pkg?.name || 'Unknown Package',
            type: purchase.paymentProvider === 'stripe_subscription' ? 'subscription' : 'coin_package',
            totalSales: 1,
            revenue: amount
          });
        }
      }
      
      return Array.from(packageStats.values())
        .sort((a, b) => b.totalSales - a.totalSales)
        .slice(0, limit)
        .map(pkg => ({
          ...pkg,
          revenue: pkg.revenue.toFixed(2)
        }));
    } catch (error) {
      console.error("Error getting top selling packages:", error);
      return [];
    }
  }

  async getRevenueHistory(startDate?: string, endDate?: string, interval: string = 'daily'): Promise<Array<{ date: string; revenue: number }>> {
    try {
      const whereConditions = [eq(userPurchases.status, 'completed')];
      
      if (startDate && endDate) {
        whereConditions.push(gte(userPurchases.createdAt, startDate));
        whereConditions.push(lte(userPurchases.createdAt, endDate));
      }

      const purchases = await db.select()
        .from(userPurchases)
        .where(and(...whereConditions))
        .all();
      
      const revenueByDate = new Map<string, number>();
      
      for (const purchase of purchases) {
        const date = new Date(purchase.createdAt!);
        let dateKey: string;
        
        if (interval === 'monthly') {
          dateKey = date.toISOString().substring(0, 7);
        } else {
          dateKey = date.toISOString().substring(0, 10);
        }
        
        const amount = parseFloat(purchase.amountPaid || '0');
        revenueByDate.set(dateKey, (revenueByDate.get(dateKey) || 0) + amount);
      }
      
      return Array.from(revenueByDate.entries())
        .map(([date, revenue]) => ({ date, revenue: Math.round(revenue * 100) / 100 }))
        .sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      console.error("Error getting revenue history:", error);
      return [];
    }
  }

  async getConversionRate(startDate?: string, endDate?: string): Promise<number> {
    try {
      // Get total unique users who made purchases
      const whereConditions = [eq(userPurchases.status, 'completed')];
      
      if (startDate && endDate) {
        whereConditions.push(gte(userPurchases.createdAt, startDate));
        whereConditions.push(lte(userPurchases.createdAt, endDate));
      }

      const purchases = await db.select({ userId: userPurchases.userId })
        .from(userPurchases)
        .where(and(...whereConditions))
        .all();
      const uniqueBuyers = new Set(purchases.map(p => p.userId)).size;
      
      // Get total active users
      const stats = await this.getCurrencyStats();
      const totalUsers = stats.activeUsers || 1;
      
      const conversionRate = (uniqueBuyers / totalUsers) * 100;
      return Math.round(conversionRate * 10) / 10;
    } catch (error) {
      console.error("Error calculating conversion rate:", error);
      return 0;
    }
  }

  async getAverageOrderValue(startDate?: string, endDate?: string): Promise<number> {
    try {
      const whereConditions = [eq(userPurchases.status, 'completed')];
      
      if (startDate && endDate) {
        whereConditions.push(gte(userPurchases.createdAt, startDate));
        whereConditions.push(lte(userPurchases.createdAt, endDate));
      }

      const purchases = await db.select({ amount: userPurchases.amountPaid })
        .from(userPurchases)
        .where(and(...whereConditions))
        .all();
      
      if (purchases.length === 0) return 0;
      
      const total = purchases.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);
      const average = total / purchases.length;
      
      return Math.round(average * 100) / 100;
    } catch (error) {
      console.error("Error calculating average order value:", error);
      return 0;
    }
  }

  async getActiveSubscriptionsCount(): Promise<number> {
    try {
      const subscriptions = await db.select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.status, 'active'))
        .all();
      
      return subscriptions.length;
    } catch (error) {
      console.error("Error getting active subscriptions count:", error);
      return 0;
    }
  }

  async getMRR(): Promise<number> {
    try {
      const activeSubscriptions = await db.select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.status, 'active'))
        .all();
      
      let mrr = 0;
      
      for (const sub of activeSubscriptions) {
        if (!sub.packageId) continue;
        const pkg = await this.getSubscriptionPackageById(sub.packageId);
        if (pkg && pkg.priceUSD) {
          const price = parseFloat(pkg.priceUSD);
          
          if (pkg.billingCycle === 'yearly') {
            mrr += price / 12;
          } else {
            mrr += price;
          }
        }
      }
      
      return Math.round(mrr * 100) / 100;
    } catch (error) {
      console.error("Error calculating MRR:", error);
      return 0;
    }
  }

  async getAllPurchases(limit: number = 1000, offset: number = 0, status?: string): Promise<Array<UserPurchase & { username: string }>> {
    try {
      let query = db.select({
        purchase: userPurchases,
        username: users.username
      })
      .from(userPurchases)
      .leftJoin(users, eq(userPurchases.userId, users.id))
      .orderBy(desc(userPurchases.createdAt))
      .limit(limit)
      .offset(offset);

      if (status) {
        query = query.where(eq(userPurchases.status, status)) as any;
      }

      const results = await query.all();
      
      return results.map(r => ({
        ...r.purchase,
        username: r.username || 'Unknown'
      }));
    } catch (error) {
      console.error("Error getting all purchases:", error);
      return [];
    }
  }

  async processRefund(purchaseId: string, adminId: string, reason: string): Promise<{ success: boolean; message: string }> {
    try {
      // Get the purchase
      const purchase = await db.select()
        .from(userPurchases)
        .where(eq(userPurchases.id, purchaseId))
        .limit(1)
        .then(results => results[0]);

      if (!purchase) {
        return { success: false, message: "Purchase not found" };
      }

      if (purchase.status === 'refunded') {
        return { success: false, message: "Purchase already refunded" };
      }

      if (purchase.status !== 'completed') {
        return { success: false, message: "Can only refund completed purchases" };
      }

      // Update purchase status to refunded
      await db.update(userPurchases)
        .set({ status: 'refunded' })
        .where(eq(userPurchases.id, purchaseId))
        .run();

      // Deduct the coins that were granted (if any)
      if (purchase.currencyReceived > 0) {
        await this.processCurrencyChange(
          purchase.userId,
          -purchase.currencyReceived,
          'refund',
          `Refund for purchase ${purchaseId}: ${reason}`,
          purchaseId
        );
      }

      return { success: true, message: "Refund processed successfully" };
    } catch (error: any) {
      console.error("Error processing refund:", error);
      return { success: false, message: error.message || "Failed to process refund" };
    }
  }

  async getChapterAccessControl(chapterId: string): Promise<ChapterAccessControl | undefined> {
    const accessControl = await db
      .select()
      .from(chapterAccessControl)
      .where(eq(chapterAccessControl.chapterId, chapterId))
      .limit(1);
    
    return accessControl[0];
  }

  async setChapterAccessControl(chapterId: string, accessType: string, unlockCost: number): Promise<ChapterAccessControl> {
    const existing = await this.getChapterAccessControl(chapterId);
    
    if (existing) {
      const updated = await db
        .update(chapterAccessControl)
        .set({
          accessType,
          unlockCost,
          isActive: "true",
          updatedAt: sql`(datetime('now'))`
        })
        .where(eq(chapterAccessControl.chapterId, chapterId))
        .returning();
      
      return updated[0];
    } else {
      const inserted = await db
        .insert(chapterAccessControl)
        .values({
          chapterId,
          accessType,
          unlockCost,
          isActive: "true"
        })
        .returning();
      
      return inserted[0];
    }
  }

  async hasUserUnlockedChapter(userId: string, chapterId: string): Promise<boolean> {
    const unlock = await db
      .select()
      .from(userChapterUnlocks)
      .where(
        and(
          eq(userChapterUnlocks.userId, userId),
          eq(userChapterUnlocks.chapterId, chapterId)
        )
      )
      .limit(1);
    
    return unlock.length > 0;
  }

  async unlockChapterForUser(userId: string, chapterId: string, costPaid: number): Promise<{ success: boolean; newBalance: number; error?: string }> {
    try {
      return await db.transaction(async (tx) => {
        const chapter = await tx
          .select()
          .from(chapters)
          .where(eq(chapters.id, chapterId))
          .limit(1);
        
        if (!chapter || chapter.length === 0) {
          throw new Error("Chapter not found");
        }

        const accessControl = await tx
          .select()
          .from(chapterAccessControl)
          .where(eq(chapterAccessControl.chapterId, chapterId))
          .limit(1);
        
        if (!accessControl || accessControl.length === 0 || accessControl[0].accessType === "free") {
          throw new Error("Chapter is free or has no access control");
        }

        const alreadyUnlocked = await tx
          .select()
          .from(userChapterUnlocks)
          .where(
            and(
              eq(userChapterUnlocks.userId, userId),
              eq(userChapterUnlocks.chapterId, chapterId)
            )
          )
          .limit(1);
        
        if (alreadyUnlocked.length > 0) {
          throw new Error("Chapter already unlocked");
        }

        const user = await tx
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        
        if (!user || user.length === 0) {
          throw new Error("User not found");
        }

        const currentBalance = user[0].currencyBalance || 0;
        
        if (currentBalance < costPaid) {
          throw new Error("Insufficient currency balance");
        }

        const newBalance = currentBalance - costPaid;

        await tx
          .update(users)
          .set({ currencyBalance: newBalance })
          .where(eq(users.id, userId));

        await tx
          .insert(currencyTransactions)
          .values({
            userId,
            amount: -costPaid,
            type: "unlock_chapter",
            description: `Unlocked chapter ${chapter[0].chapterNumber}`,
            relatedEntityId: chapterId
          });

        await tx
          .insert(userChapterUnlocks)
          .values({
            userId,
            chapterId,
            costPaid
          });

        return { success: true, newBalance };
      });
    } catch (error: any) {
      console.error("Error unlocking chapter:", error);
      return { 
        success: false, 
        newBalance: 0, 
        error: error.message || "Failed to unlock chapter" 
      };
    }
  }

  async checkUserChapterAccess(userId: string, chapterId: string, testMode: boolean = false): Promise<{ canAccess: boolean; accessType: string; unlockCost?: number; isUnlocked?: boolean; reason?: string }> {
    try {
      const user = await this.getUser(userId);
      
      if (!user) {
        return { 
          canAccess: false, 
          accessType: "unknown", 
          reason: "User not found" 
        };
      }

      // Admin/Staff bypass - skip if test mode is enabled
      if (!testMode && (user.role === "admin" || user.role === "owner" || user.role === "staff")) {
        return { 
          canAccess: true, 
          accessType: "free", 
          reason: "Admin/Staff bypass" 
        };
      }

      const accessControl = await this.getChapterAccessControl(chapterId);
      
      if (!accessControl || accessControl.accessType === "free" || accessControl.isActive === "false") {
        return { 
          canAccess: true, 
          accessType: "free" 
        };
      }

      const isUnlocked = await this.hasUserUnlockedChapter(userId, chapterId);
      
      if (isUnlocked) {
        return { 
          canAccess: true, 
          accessType: accessControl.accessType, 
          isUnlocked: true 
        };
      }

      return {
        canAccess: false,
        accessType: accessControl.accessType,
        unlockCost: accessControl.unlockCost,
        isUnlocked: false,
        reason: `Chapter requires ${accessControl.unlockCost} coins to unlock`
      };
    } catch (error) {
      console.error("Error checking chapter access:", error);
      return { 
        canAccess: false, 
        accessType: "unknown", 
        reason: "Error checking access" 
      };
    }
  }

  // Reading Lists operations
  async getReadingLists(userId: string): Promise<ReadingList[]> {
    try {
      // PERFORMANCE OPTIMIZATION: Use single query with LEFT JOIN + COUNT instead of N+1 pattern
      // This reduces 21 queries to 1 query when user has 20 reading lists
      const lists = await db
        .select({
          id: readingLists.id,
          userId: readingLists.userId,
          name: readingLists.name,
          description: readingLists.description,
          visibility: readingLists.visibility,
          createdAt: readingLists.createdAt,
          updatedAt: readingLists.updatedAt,
          itemCount: sql<number>`COUNT(${readingListItems.id})`.as('itemCount')
        })
        .from(readingLists)
        .leftJoin(readingListItems, eq(readingLists.id, readingListItems.listId))
        .where(eq(readingLists.userId, userId))
        .groupBy(readingLists.id)
        .all();
      
      return lists as ReadingList[];
    } catch (error) {
      console.error("Error getting reading lists:", error);
      return [];
    }
  }

  async getReadingListById(listId: string): Promise<ReadingList | undefined> {
    try {
      const [list] = await db.select().from(readingLists).where(eq(readingLists.id, listId)).limit(1).all();
      return list;
    } catch (error) {
      console.error("Error getting reading list:", error);
      return undefined;
    }
  }

  async createReadingList(userId: string, data: any): Promise<ReadingList> {
    const newList = await db.insert(readingLists).values({
      userId,
      name: data.name,
      description: data.description,
      visibility: data.visibility || 'private',
    }).returning().get();
    return newList;
  }

  async updateReadingList(listId: string, userId: string, data: any): Promise<ReadingList | undefined> {
    try {
      const list = await this.getReadingListById(listId);
      if (!list || list.userId !== userId) return undefined;
      
      const updated = await db.update(readingLists)
        .set({ ...data, updatedAt: sql`(datetime('now'))` })
        .where(eq(readingLists.id, listId))
        .returning()
        .get();
      return updated;
    } catch (error) {
      console.error("Error updating reading list:", error);
      return undefined;
    }
  }

  async deleteReadingList(listId: string, userId: string): Promise<boolean> {
    try {
      const list = await this.getReadingListById(listId);
      if (!list || list.userId !== userId) return false;
      
      await db.delete(readingLists).where(eq(readingLists.id, listId)).run();
      return true;
    } catch (error) {
      console.error("Error deleting reading list:", error);
      return false;
    }
  }

  async addToReadingList(listId: string, seriesId: string, userId: string): Promise<ReadingListItem> {
    const list = await this.getReadingListById(listId);
    if (!list || list.userId !== userId) {
      throw new Error("Reading list not found or access denied");
    }

    const existing = await db.select().from(readingListItems)
      .where(and(eq(readingListItems.listId, listId), eq(readingListItems.seriesId, seriesId)))
      .limit(1).all();
    
    if (existing.length > 0) {
      throw new Error("Series already in reading list");
    }

    const item = await db.insert(readingListItems).values({
      listId,
      seriesId,
    }).returning().get();
    return item;
  }

  async removeFromReadingList(listId: string, seriesId: string, userId: string): Promise<boolean> {
    try {
      const list = await this.getReadingListById(listId);
      if (!list || list.userId !== userId) return false;
      
      await db.delete(readingListItems)
        .where(and(eq(readingListItems.listId, listId), eq(readingListItems.seriesId, seriesId)))
        .run();
      return true;
    } catch (error) {
      console.error("Error removing from reading list:", error);
      return false;
    }
  }

  async getReadingListItems(listId: string): Promise<ReadingListItem[]> {
    try {
      return await db.select().from(readingListItems).where(eq(readingListItems.listId, listId)).all();
    } catch (error) {
      console.error("Error getting reading list items:", error);
      return [];
    }
  }

  async getAllAds(): Promise<Advertisement[]> {
    try {
      const ads = await db
        .select()
        .from(advertisements)
        .orderBy(asc(advertisements.displayOrder), desc(advertisements.createdAt))
        .all();
      return ads;
    } catch (error) {
      console.error("Error getting all ads:", error);
      return [];
    }
  }

  async getAdById(id: string): Promise<Advertisement | undefined> {
    try {
      const ad = await db
        .select()
        .from(advertisements)
        .where(eq(advertisements.id, id))
        .get();
      return ad;
    } catch (error) {
      console.error("Error getting ad by id:", error);
      return undefined;
    }
  }

  async getActiveAdsByPlacement(page: string, location?: string, context?: { deviceType: string; userRole: string; userCountry: string | null; userLanguage: string }): Promise<Advertisement[]> {
    try {
      const now = new Date().toISOString();
      
      // Build placement conditions - if location is provided, filter by both page and location
      const placementConditions = location 
        ? and(
            eq(advertisements.page, page),
            eq(advertisements.location, location)
          )
        : eq(advertisements.page, page);
      
      const allAds = await db
        .select()
        .from(advertisements)
        .where(
          and(
            eq(advertisements.isActive, "true"),
            placementConditions,
            or(
              and(
                sql`${advertisements.startDate} IS NOT NULL`,
                sql`${advertisements.endDate} IS NOT NULL`,
                sql`${advertisements.startDate} <= ${now}`,
                sql`${advertisements.endDate} >= ${now}`
              ),
              and(
                sql`${advertisements.startDate} IS NULL`,
                sql`${advertisements.endDate} IS NULL`
              )
            )
          )
        )
        .orderBy(asc(advertisements.displayOrder), desc(advertisements.createdAt))
        .all();
      
      // Apply targeting filters if context is provided
      let targetedAds = allAds;
      if (context) {
        targetedAds = allAds.filter(ad => {
          // Country targeting
          if (ad.targetCountries) {
            try {
              const countries = JSON.parse(ad.targetCountries);
              if (countries.length > 0 && context.userCountry) {
                if (!countries.includes(context.userCountry)) {
                  return false;
                }
              }
            } catch (e) {
              console.error(`[ads] Skipping ad ${ad.id} - malformed targetCountries JSON:`, e);
              return false; // Skip ads with malformed targeting data
            }
          }
          
          // Device type targeting
          if (ad.targetDeviceTypes) {
            try {
              const devices = JSON.parse(ad.targetDeviceTypes);
              if (devices.length > 0) {
                if (!devices.includes(context.deviceType)) {
                  return false;
                }
              }
            } catch (e) {
              console.error(`[ads] Skipping ad ${ad.id} - malformed targetDeviceTypes JSON:`, e);
              return false; // Skip ads with malformed targeting data
            }
          }
          
          // User role targeting
          if (ad.targetUserRoles) {
            try {
              const roles = JSON.parse(ad.targetUserRoles);
              if (roles.length > 0) {
                if (!roles.includes(context.userRole)) {
                  return false;
                }
              }
            } catch (e) {
              console.error(`[ads] Skipping ad ${ad.id} - malformed targetUserRoles JSON:`, e);
              return false; // Skip ads with malformed targeting data
            }
          }
          
          // Language targeting
          if (ad.targetLanguages) {
            try {
              const languages = JSON.parse(ad.targetLanguages);
              if (languages.length > 0) {
                if (!languages.includes(context.userLanguage)) {
                  return false;
                }
              }
            } catch (e) {
              console.error(`[ads] Skipping ad ${ad.id} - malformed targetLanguages JSON:`, e);
              return false; // Skip ads with malformed targeting data
            }
          }
          
          return true;
        });
      }
      
      // A/B Testing: Handle variant groups
      // Group ads by variantGroup
      const variantGroups = new Map<string, Advertisement[]>();
      const nonVariantAds: Advertisement[] = [];
      
      for (const ad of targetedAds) {
        if (ad.variantGroup) {
          if (!variantGroups.has(ad.variantGroup)) {
            variantGroups.set(ad.variantGroup, []);
          }
          variantGroups.get(ad.variantGroup)!.push(ad);
        } else {
          nonVariantAds.push(ad);
        }
      }
      
      // Randomly select one variant from each group
      const selectedVariants: Advertisement[] = [];
      for (const [group, variants] of Array.from(variantGroups.entries())) {
        if (variants.length > 0) {
          const randomIndex = Math.floor(Math.random() * variants.length);
          selectedVariants.push(variants[randomIndex]);
        }
      }
      
      // Combine non-variant ads with selected variants
      const finalAds = [...nonVariantAds, ...selectedVariants];
      
      // Sort by displayOrder and createdAt
      finalAds.sort((a, b) => {
        if (a.displayOrder !== b.displayOrder) {
          return a.displayOrder - b.displayOrder;
        }
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
      
      return finalAds;
    } catch (error) {
      console.error("Error getting active ads by placement:", error);
      return [];
    }
  }

  async createAd(data: InsertAdvertisement): Promise<Advertisement> {
    try {
      const ad = await db
        .insert(advertisements)
        .values(data)
        .returning()
        .get();
      return ad;
    } catch (error) {
      console.error("Error creating ad:", error);
      throw new Error("Failed to create advertisement");
    }
  }

  async updateAd(id: string, data: Partial<InsertAdvertisement>): Promise<Advertisement | undefined> {
    try {
      const updated = await db
        .update(advertisements)
        .set({
          ...data,
          updatedAt: sql`(datetime('now'))`
        })
        .where(eq(advertisements.id, id))
        .returning()
        .get();
      return updated;
    } catch (error) {
      console.error("Error updating ad:", error);
      return undefined;
    }
  }

  async deleteAd(id: string): Promise<boolean> {
    try {
      await db
        .delete(advertisements)
        .where(eq(advertisements.id, id))
        .run();
      return true;
    } catch (error) {
      console.error("Error deleting ad:", error);
      return false;
    }
  }

  async bulkCreateAds(adsData: InsertAdvertisement[]): Promise<{ success: Advertisement[]; failed: Array<{ index: number; error: string }> }> {
    const success: Advertisement[] = [];
    const failed: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < adsData.length; i++) {
      try {
        const ad = await db
          .insert(advertisements)
          .values(adsData[i])
          .returning()
          .get();
        success.push(ad);
      } catch (error: any) {
        console.error(`Error creating ad at index ${i}:`, error);
        failed.push({ 
          index: i, 
          error: error?.message || 'Failed to create advertisement' 
        });
      }
    }

    return { success, failed };
  }

  async bulkUpdateAds(adIds: string[], updates: Partial<InsertAdvertisement>): Promise<{ successCount: number; failedCount: number }> {
    let successCount = 0;
    let failedCount = 0;

    for (const id of adIds) {
      try {
        const updated = await db
          .update(advertisements)
          .set({
            ...updates,
            updatedAt: sql`(datetime('now'))`
          })
          .where(eq(advertisements.id, id))
          .returning()
          .get();
        
        if (updated) {
          successCount++;
        } else {
          failedCount++;
        }
      } catch (error) {
        console.error(`Error updating ad ${id}:`, error);
        failedCount++;
      }
    }

    return { successCount, failedCount };
  }

  async bulkDeleteAds(adIds: string[]): Promise<{ successCount: number; failedCount: number }> {
    let successCount = 0;
    let failedCount = 0;

    for (const id of adIds) {
      try {
        await db
          .delete(advertisements)
          .where(eq(advertisements.id, id))
          .run();
        successCount++;
      } catch (error) {
        console.error(`Error deleting ad ${id}:`, error);
        failedCount++;
      }
    }

    return { successCount, failedCount };
  }

  async updateManyAdsStatus(ids: string[], isActive: boolean): Promise<void> {
    try {
      const activeValue = isActive ? "true" : "false";
      
      for (const id of ids) {
        await db
          .update(advertisements)
          .set({
            isActive: activeValue,
            updatedAt: sql`(datetime('now'))`
          })
          .where(eq(advertisements.id, id))
          .run();
      }
    } catch (error) {
      console.error('Error updating ads status:', error);
      throw error;
    }
  }

  async deleteAdsByIds(ids: string[]): Promise<void> {
    try {
      for (const id of ids) {
        await db
          .delete(advertisements)
          .where(eq(advertisements.id, id))
          .run();
      }
    } catch (error) {
      console.error('Error deleting ads:', error);
      throw error;
    }
  }

  async insertAdvertisementsBulk(ads: InsertAdvertisement[]): Promise<{ 
    success: number; 
    errors: Array<{row: number, field: string, message: string}> 
  }> {
    let success = 0;
    const errors: Array<{row: number, field: string, message: string}> = [];

    for (let i = 0; i < ads.length; i++) {
      try {
        const adData = ads[i];
        
        // Validate required fields
        if (!adData.title || !adData.imageUrl || !adData.linkUrl) {
          if (!adData.title) {
            errors.push({ row: i + 1, field: 'title', message: 'Title is required' });
          }
          if (!adData.imageUrl) {
            errors.push({ row: i + 1, field: 'imageUrl', message: 'Image URL is required' });
          }
          if (!adData.linkUrl) {
            errors.push({ row: i + 1, field: 'linkUrl', message: 'Link URL is required' });
          }
          continue;
        }

        // Validate date order if both dates provided
        if (adData.startDate && adData.endDate && adData.startDate > adData.endDate) {
          errors.push({ 
            row: i + 1, 
            field: 'dates', 
            message: 'Start date must be before end date' 
          });
          continue;
        }

        // Insert the ad
        await db
          .insert(advertisements)
          .values(adData)
          .run();
        
        success++;
      } catch (error: any) {
        console.error(`Error inserting ad at row ${i + 1}:`, error);
        errors.push({ 
          row: i + 1, 
          field: 'general', 
          message: error?.message || 'Failed to insert advertisement' 
        });
      }
    }

    return { success, errors };
  }

  async autoUpdateAdSchedules(): Promise<{ activated: number; deactivated: number }> {
    try {
      const now = new Date().toISOString();
      let activated = 0;
      let deactivated = 0;

      // Get all ads with scheduling dates
      const scheduledAds = await db
        .select()
        .from(advertisements)
        .where(
          or(
            sql`${advertisements.startDate} IS NOT NULL`,
            sql`${advertisements.endDate} IS NOT NULL`
          )
        )
        .all();

      for (const ad of scheduledAds) {
        // Check if ad should be activated
        // Conditions: has start date, start date has passed, (no end date OR end date hasn't passed), and is currently inactive
        if (
          ad.startDate &&
          ad.startDate <= now &&
          (!ad.endDate || ad.endDate > now) &&
          ad.isActive === "false"
        ) {
          await db
            .update(advertisements)
            .set({ 
              isActive: "true",
              updatedAt: sql`(datetime('now'))`
            })
            .where(eq(advertisements.id, ad.id))
            .run();
          
          activated++;
          console.log(`[ad-scheduler] ✅ Activated ad: "${ad.title}" (ID: ${ad.id})`);
        }

        // Check if ad should be deactivated
        // Conditions: has end date, end date has passed, and is currently active
        if (
          ad.endDate &&
          ad.endDate <= now &&
          ad.isActive === "true"
        ) {
          await db
            .update(advertisements)
            .set({ 
              isActive: "false",
              updatedAt: sql`(datetime('now'))`
            })
            .where(eq(advertisements.id, ad.id))
            .run();
          
          deactivated++;
          console.log(`[ad-scheduler] 🔴 Deactivated ad: "${ad.title}" (ID: ${ad.id})`);
        }
      }

      if (activated > 0 || deactivated > 0) {
        console.log(`[ad-scheduler] 📊 Schedule update complete: ${activated} activated, ${deactivated} deactivated`);
      }

      return { activated, deactivated };
    } catch (error) {
      console.error("[ad-scheduler] ❌ Error updating ad schedules:", error);
      return { activated: 0, deactivated: 0 };
    }
  }

  async trackAdClick(id: string): Promise<boolean> {
    try {
      // Get the ad to find its variantName for A/B testing tracking
      const ad = await db.select().from(advertisements).where(eq(advertisements.id, id)).get();
      if (!ad) {
        console.error("Ad not found for tracking click:", id);
        return false;
      }

      await db
        .update(advertisements)
        .set({
          clickCount: sql`${advertisements.clickCount} + 1`
        })
        .where(eq(advertisements.id, id))
        .run();

      const today = new Date().toISOString().split('T')[0];
      const existing = await db.select().from(adPerformanceHistory)
        .where(and(eq(adPerformanceHistory.adId, id), eq(adPerformanceHistory.date, today)))
        .get();
      
      if (existing) {
        const newClicks = existing.clicks + 1;
        const newCtr = existing.impressions > 0 
          ? ((newClicks / existing.impressions) * 100).toFixed(2) 
          : "0.00";
        await db.update(adPerformanceHistory)
          .set({ clicks: newClicks, ctr: newCtr })
          .where(eq(adPerformanceHistory.id, existing.id))
          .run();
      } else {
        await db.insert(adPerformanceHistory)
          .values({ 
            adId: id, 
            date: today, 
            clicks: 1, 
            impressions: 0, 
            ctr: "0.00",
            variantName: ad.variantName || null // Track variant for A/B testing
          })
          .run();
      }

      return true;
    } catch (error) {
      console.error("Error tracking ad click:", error);
      return false;
    }
  }

  async trackAdImpression(id: string): Promise<boolean> {
    try {
      // Get the ad to find its variantName for A/B testing tracking
      const ad = await db.select().from(advertisements).where(eq(advertisements.id, id)).get();
      if (!ad) {
        console.error("Ad not found for tracking impression:", id);
        return false;
      }

      await db
        .update(advertisements)
        .set({
          impressionCount: sql`${advertisements.impressionCount} + 1`
        })
        .where(eq(advertisements.id, id))
        .run();

      const today = new Date().toISOString().split('T')[0];
      const existing = await db.select().from(adPerformanceHistory)
        .where(and(eq(adPerformanceHistory.adId, id), eq(adPerformanceHistory.date, today)))
        .get();
      
      if (existing) {
        const newImpressions = existing.impressions + 1;
        const newCtr = newImpressions > 0 
          ? ((existing.clicks / newImpressions) * 100).toFixed(2) 
          : "0.00";
        await db.update(adPerformanceHistory)
          .set({ impressions: newImpressions, ctr: newCtr })
          .where(eq(adPerformanceHistory.id, existing.id))
          .run();
      } else {
        await db.insert(adPerformanceHistory)
          .values({ 
            adId: id, 
            date: today, 
            impressions: 1, 
            clicks: 0, 
            ctr: "0.00",
            variantName: ad.variantName || null // Track variant for A/B testing
          })
          .run();
      }

      return true;
    } catch (error) {
      console.error("Error tracking ad impression:", error);
      return false;
    }
  }

  async getAdAnalyticsOverview(startDate?: string, endDate?: string): Promise<{
    totalImpressions: number;
    totalClicks: number;
    averageCTR: number;
  }> {
    try {
      let query = db.select({
        impressions: adPerformanceHistory.impressions,
        clicks: adPerformanceHistory.clicks,
      }).from(adPerformanceHistory);

      const conditions = [];
      if (startDate) {
        conditions.push(sql`${adPerformanceHistory.date} >= ${startDate}`);
      }
      if (endDate) {
        conditions.push(sql`${adPerformanceHistory.date} <= ${endDate}`);
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      const results = await query.all();

      const totalImpressions = results.reduce((sum, r) => sum + (r.impressions || 0), 0);
      const totalClicks = results.reduce((sum, r) => sum + (r.clicks || 0), 0);
      const averageCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

      return {
        totalImpressions,
        totalClicks,
        averageCTR: parseFloat(averageCTR.toFixed(2)),
      };
    } catch (error) {
      console.error("Error getting ad analytics overview:", error);
      return { totalImpressions: 0, totalClicks: 0, averageCTR: 0 };
    }
  }

  async getAdPerformanceHistory(startDate?: string, endDate?: string): Promise<Array<{
    date: string;
    impressions: number;
    clicks: number;
    ctr: number;
  }>> {
    try {
      let query = db.select({
        date: adPerformanceHistory.date,
        impressions: sql<number>`SUM(${adPerformanceHistory.impressions})`.as('impressions'),
        clicks: sql<number>`SUM(${adPerformanceHistory.clicks})`.as('clicks'),
      }).from(adPerformanceHistory);

      const conditions = [];
      if (startDate) {
        conditions.push(sql`${adPerformanceHistory.date} >= ${startDate}`);
      }
      if (endDate) {
        conditions.push(sql`${adPerformanceHistory.date} <= ${endDate}`);
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      const results = await query
        .groupBy(adPerformanceHistory.date)
        .orderBy(asc(adPerformanceHistory.date))
        .all();

      return results.map(r => ({
        date: r.date,
        impressions: r.impressions || 0,
        clicks: r.clicks || 0,
        ctr: r.impressions > 0 ? parseFloat(((r.clicks / r.impressions) * 100).toFixed(2)) : 0,
      }));
    } catch (error) {
      console.error("Error getting ad performance history:", error);
      return [];
    }
  }

  async getTopPerformingAds(limit: number = 5, startDate?: string, endDate?: string): Promise<Array<{
    id: string;
    title: string;
    type: string;
    placement: string;
    impressions: number;
    clicks: number;
    ctr: number;
  }>> {
    try {
      let query = db.select({
        adId: adPerformanceHistory.adId,
        impressions: sql<number>`SUM(${adPerformanceHistory.impressions})`.as('impressions'),
        clicks: sql<number>`SUM(${adPerformanceHistory.clicks})`.as('clicks'),
      }).from(adPerformanceHistory);

      const conditions = [];
      if (startDate) {
        conditions.push(sql`${adPerformanceHistory.date} >= ${startDate}`);
      }
      if (endDate) {
        conditions.push(sql`${adPerformanceHistory.date} <= ${endDate}`);
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      const performanceData = await query
        .groupBy(adPerformanceHistory.adId)
        .all();

      const adsWithCTR = performanceData
        .map(p => ({
          adId: p.adId,
          impressions: p.impressions || 0,
          clicks: p.clicks || 0,
          ctr: p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0,
        }))
        .sort((a, b) => b.ctr - a.ctr)
        .slice(0, limit);

      const adIds = adsWithCTR.map(a => a.adId);
      if (adIds.length === 0) return [];

      const ads = await db.select()
        .from(advertisements)
        .where(inArray(advertisements.id, adIds))
        .all();

      const adMap = new Map(ads.map(ad => [ad.id, ad]));

      return adsWithCTR
        .map(perf => {
          const ad = adMap.get(perf.adId);
          if (!ad) return null;
          return {
            id: ad.id,
            title: ad.title,
            type: ad.type,
            placement: ad.location ? `${ad.page} - ${ad.location}` : ad.page,
            impressions: perf.impressions,
            clicks: perf.clicks,
            ctr: parseFloat(perf.ctr.toFixed(2)),
          };
        })
        .filter(Boolean) as Array<{
          id: string;
          title: string;
          type: string;
          placement: string;
          impressions: number;
          clicks: number;
          ctr: number;
        }>;
    } catch (error) {
      console.error("Error getting top performing ads:", error);
      return [];
    }
  }

  async getAdsByVariantGroup(variantGroup: string): Promise<Advertisement[]> {
    try {
      const ads = await db
        .select()
        .from(advertisements)
        .where(eq(advertisements.variantGroup, variantGroup))
        .orderBy(asc(advertisements.variantName))
        .all();
      return ads;
    } catch (error) {
      console.error("Error getting ads by variant group:", error);
      return [];
    }
  }

  async getVariantComparisonAnalytics(variantGroup: string, startDate?: string, endDate?: string): Promise<Array<{
    variantName: string;
    impressions: number;
    clicks: number;
    ctr: number;
    adId: string;
    title: string;
  }>> {
    try {
      // Get all ads in the variant group
      const variantAds = await this.getAdsByVariantGroup(variantGroup);
      if (variantAds.length === 0) return [];

      const adIds = variantAds.map(ad => ad.id);

      // Build query for performance data
      let query = db.select({
        variantName: adPerformanceHistory.variantName,
        adId: adPerformanceHistory.adId,
        impressions: sql<number>`SUM(${adPerformanceHistory.impressions})`.as('impressions'),
        clicks: sql<number>`SUM(${adPerformanceHistory.clicks})`.as('clicks'),
      }).from(adPerformanceHistory)
      .where(inArray(adPerformanceHistory.adId, adIds));

      const conditions = [inArray(adPerformanceHistory.adId, adIds)];
      if (startDate) {
        conditions.push(sql`${adPerformanceHistory.date} >= ${startDate}`);
      }
      if (endDate) {
        conditions.push(sql`${adPerformanceHistory.date} <= ${endDate}`);
      }

      const performanceData = await db.select({
        variantName: adPerformanceHistory.variantName,
        adId: adPerformanceHistory.adId,
        impressions: sql<number>`SUM(${adPerformanceHistory.impressions})`.as('impressions'),
        clicks: sql<number>`SUM(${adPerformanceHistory.clicks})`.as('clicks'),
      }).from(adPerformanceHistory)
      .where(and(...conditions))
      .groupBy(adPerformanceHistory.adId, adPerformanceHistory.variantName)
      .all();

      // Create ad map for quick lookup
      const adMap = new Map(variantAds.map(ad => [ad.id, ad]));

      // Combine performance data with ad info
      const results = performanceData.map(perf => {
        const ad = adMap.get(perf.adId);
        if (!ad) return null;
        
        const impressions = perf.impressions || 0;
        const clicks = perf.clicks || 0;
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

        return {
          variantName: perf.variantName || ad.variantName || 'Unknown',
          impressions,
          clicks,
          ctr: parseFloat(ctr.toFixed(2)),
          adId: ad.id,
          title: ad.title,
        };
      }).filter(Boolean) as Array<{
        variantName: string;
        impressions: number;
        clicks: number;
        ctr: number;
        adId: string;
        title: string;
      }>;

      // Include variants with no performance data (0 impressions/clicks)
      for (const ad of variantAds) {
        if (!results.find(r => r.adId === ad.id)) {
          results.push({
            variantName: ad.variantName || 'Unknown',
            impressions: 0,
            clicks: 0,
            ctr: 0,
            adId: ad.id,
            title: ad.title,
          });
        }
      }

      return results.sort((a, b) => a.variantName.localeCompare(b.variantName));
    } catch (error) {
      console.error("Error getting variant comparison analytics:", error);
      return [];
    }
  }

  async createVariantGroup(
    variants: Array<Omit<InsertAdvertisement, 'variantGroup'> & { variantName: string }>,
    variantGroup: string
  ): Promise<Advertisement[]> {
    try {
      const createdAds: Advertisement[] = [];
      
      for (const variant of variants) {
        const adData = {
          ...variant,
          variantGroup,
        };
        
        const ad = await db
          .insert(advertisements)
          .values(adData)
          .returning()
          .get();
        
        createdAds.push(ad);
      }
      
      return createdAds;
    } catch (error) {
      console.error("Error creating variant group:", error);
      throw new Error("Failed to create variant group");
    }
  }

  async createDmcaNotice(data: InsertDmcaNotice): Promise<DmcaNotice> {
    const result = await db
      .insert(dmcaNotices)
      .values(data)
      .returning();
    
    return result[0];
  }

  async getAllDmcaNotices(): Promise<DmcaNotice[]> {
    const notices = await db
      .select()
      .from(dmcaNotices)
      .orderBy(desc(dmcaNotices.createdAt));
    
    return notices;
  }

  async getDmcaNoticeById(id: string): Promise<DmcaNotice | undefined> {
    const notice = await db
      .select()
      .from(dmcaNotices)
      .where(eq(dmcaNotices.id, id))
      .limit(1);
    
    return notice[0];
  }

  async updateDmcaNoticeStatus(
    id: string, 
    status: string, 
    reviewNotes: string | null | undefined, 
    reviewedBy: string | null | undefined
  ): Promise<DmcaNotice | undefined> {
    const updated = await db
      .update(dmcaNotices)
      .set({
        status,
        reviewNotes: reviewNotes || null,
        reviewedBy: reviewedBy || null,
        reviewedAt: sql`(datetime('now'))`,
        updatedAt: sql`(datetime('now'))`
      })
      .where(eq(dmcaNotices.id, id))
      .returning();
    
    return updated[0];
  }

  // ========== SUBSCRIPTION STORAGE METHODS ==========
  
  async getSubscriptionPackages(activeOnly: boolean = true): Promise<SubscriptionPackage[]> {
    try {
      let query = db.select().from(subscriptionPackages);
      if (activeOnly) {
        query = query.where(eq(subscriptionPackages.isActive, 'true')) as any;
      }
      return await query.orderBy(subscriptionPackages.displayOrder).all();
    } catch (error) {
      console.error("Error getting subscription packages:", error);
      return [];
    }
  }

  async getSubscriptionPackageById(id: string): Promise<SubscriptionPackage | undefined> {
    try {
      const [pkg] = await db.select().from(subscriptionPackages).where(eq(subscriptionPackages.id, id)).limit(1).all();
      return pkg;
    } catch (error) {
      console.error("Error getting subscription package:", error);
      return undefined;
    }
  }

  async getUserActiveSubscription(userId: string): Promise<UserSubscription | undefined> {
    try {
      const [subscription] = await db.select().from(userSubscriptions)
        .where(and(eq(userSubscriptions.userId, userId), eq(userSubscriptions.status, 'active')))
        .limit(1).all();
      return subscription;
    } catch (error) {
      console.error("Error getting user subscription:", error);
      return undefined;
    }
  }

  async updateUserStripeCustomerId(userId: string, stripeCustomerId: string): Promise<void> {
    try {
      await db.update(users)
        .set({ stripeCustomerId })
        .where(eq(users.id, userId))
        .run();
    } catch (error) {
      console.error("Error updating Stripe customer ID:", error);
    }
  }

  async activateUserSubscription(data: {
    userId: string;
    packageId: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
  }): Promise<void> {
    try {
      await db.insert(userSubscriptions).values({
        userId: data.userId,
        packageId: data.packageId,
        stripeCustomerId: data.stripeCustomerId,
        stripeSubscriptionId: data.stripeSubscriptionId,
        status: 'active',
        currentPeriodStart: data.currentPeriodStart,
        currentPeriodEnd: data.currentPeriodEnd,
        cancelAtPeriodEnd: 'false',
      }).run();
    } catch (error) {
      console.error("Error activating subscription:", error);
    }
  }

  async cancelUserSubscription(subscriptionId: string): Promise<void> {
    try {
      await db.update(userSubscriptions)
        .set({ cancelAtPeriodEnd: 'true', updatedAt: sql`(datetime('now'))` })
        .where(eq(userSubscriptions.id, subscriptionId))
        .run();
    } catch (error) {
      console.error("Error cancelling subscription:", error);
    }
  }

  async expireUserSubscription(stripeSubscriptionId: string): Promise<void> {
    try {
      await db.update(userSubscriptions)
        .set({ status: 'expired', updatedAt: sql`(datetime('now'))` })
        .where(eq(userSubscriptions.stripeSubscriptionId, stripeSubscriptionId))
        .run();
    } catch (error) {
      console.error("Error expiring subscription:", error);
    }
  }

  async updateUserSubscriptionStatus(stripeSubscriptionId: string, status: string, cancelAtPeriodEnd: boolean): Promise<void> {
    try {
      await db.update(userSubscriptions)
        .set({ 
          status, 
          cancelAtPeriodEnd: cancelAtPeriodEnd ? 'true' : 'false',
          updatedAt: sql`(datetime('now'))` 
        })
        .where(eq(userSubscriptions.stripeSubscriptionId, stripeSubscriptionId))
        .run();
    } catch (error) {
      console.error("Error updating subscription status:", error);
    }
  }

  async recordCurrencyPurchase(data: InsertUserPurchase): Promise<void> {
    try {
      await db.insert(userPurchases).values(data).run();
    } catch (error) {
      console.error("Error recording currency purchase:", error);
    }
  }

  // ========== DAILY REWARDS STORAGE METHODS ==========

  async getUserDailyRewardStatus(userId: string): Promise<any> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      
      const [todayClaim] = await db.select().from(userDailyClaims)
        .where(and(eq(userDailyClaims.userId, userId), eq(userDailyClaims.claimDate, today)))
        .limit(1).all();
      
      if (todayClaim) {
        return { canClaim: false, currentDay: todayClaim.day, claimedToday: true };
      }

      const [yesterdayClaim] = await db.select().from(userDailyClaims)
        .where(and(eq(userDailyClaims.userId, userId), eq(userDailyClaims.claimDate, yesterday)))
        .limit(1).all();
      
      const currentDay = yesterdayClaim ? yesterdayClaim.day + 1 : 1;
      const [nextReward] = await db.select().from(dailyRewards).where(eq(dailyRewards.day, currentDay)).limit(1).all();

      return { 
        canClaim: true, 
        currentDay, 
        claimedToday: false,
        nextReward: nextReward ? nextReward.coinReward : 10
      };
    } catch (error) {
      console.error("Error getting daily reward status:", error);
      return { canClaim: false, currentDay: 1, claimedToday: false };
    }
  }

  async claimDailyReward(userId: string): Promise<any> {
    try {
      const status = await this.getUserDailyRewardStatus(userId);
      if (!status.canClaim) {
        throw new Error("Already claimed today");
      }

      const [reward] = await db.select().from(dailyRewards)
        .where(eq(dailyRewards.day, status.currentDay))
        .limit(1).all();

      const coinsEarned = reward ? reward.coinReward : 10;
      const today = new Date().toISOString().split('T')[0];

      await db.insert(userDailyClaims).values({
        userId,
        claimDate: today,
        day: status.currentDay,
        coinsEarned
      }).run();

      await this.processCurrencyChange(userId, coinsEarned, 'daily_reward', `Daily login reward - Day ${status.currentDay}`);

      return { success: true, coinsEarned, day: status.currentDay };
    } catch (error: any) {
      console.error("Error claiming daily reward:", error);
      throw error;
    }
  }

  // ========== ACHIEVEMENTS STORAGE METHODS ==========

  async getAllAchievements(): Promise<Achievement[]> {
    try {
      return await db.select().from(achievements).orderBy(achievements.displayOrder).all();
    } catch (error) {
      console.error("Error getting achievements:", error);
      return [];
    }
  }

  async getUserAchievementProgress(userId: string): Promise<any[]> {
    try {
      const allAchievements = await this.getAllAchievements();
      const earnedAchievements = await db.select().from(userAchievements).where(eq(userAchievements.userId, userId)).all();
      
      return allAchievements.map(achievement => {
        const earned = earnedAchievements.find(ua => ua.achievementId === achievement.id);
        return {
          ...achievement,
          earned: !!earned,
          earnedAt: earned?.earnedAt,
          progress: earned?.progress
        };
      });
    } catch (error) {
      console.error("Error getting achievement progress:", error);
      return [];
    }
  }

  // ========== REFERRAL STORAGE METHODS ==========

  async getUserReferralCode(userId: string): Promise<ReferralCode> {
    try {
      const [existing] = await db.select().from(referralCodes)
        .where(eq(referralCodes.userId, userId))
        .limit(1).all();
      
      if (existing) return existing;

      const code = `REF${userId.slice(0, 8).toUpperCase()}`;
      const newCode = await db.insert(referralCodes).values({
        userId,
        code,
        uses: 0,
        coinRewardReferrer: 100,
        coinRewardReferred: 50,
        isActive: 'true'
      }).returning().get();

      return newCode;
    } catch (error) {
      console.error("Error getting referral code:", error);
      throw error;
    }
  }

  async getUserReferrals(userId: string): Promise<Referral[]> {
    try {
      return await db.select().from(referrals).where(eq(referrals.referrerId, userId)).all();
    } catch (error) {
      console.error("Error getting referrals:", error);
      return [];
    }
  }

  async applyReferralCode(userId: string, code: string): Promise<any> {
    try {
      const [referralCode] = await db.select().from(referralCodes)
        .where(and(eq(referralCodes.code, code), eq(referralCodes.isActive, 'true')))
        .limit(1).all();

      if (!referralCode) throw new Error("Invalid referral code");
      if (referralCode.userId === userId) throw new Error("Cannot use your own referral code");

      const [existing] = await db.select().from(referrals)
        .where(eq(referrals.referredId, userId))
        .limit(1).all();

      if (existing) throw new Error("Referral code already used");

      await db.insert(referrals).values({
        referrerId: referralCode.userId,
        referredId: userId,
        codeId: referralCode.id,
        referrerRewardAmount: referralCode.coinRewardReferrer,
        referredRewardAmount: referralCode.coinRewardReferred,
        status: 'completed'
      }).run();

      await db.update(referralCodes).set({ uses: referralCode.uses + 1 }).where(eq(referralCodes.id, referralCode.id)).run();

      await this.processCurrencyChange(referralCode.userId, referralCode.coinRewardReferrer ?? 0, 'referral_reward', 'Referral bonus - new user');
      await this.processCurrencyChange(userId, referralCode.coinRewardReferred ?? 0, 'referral_bonus', 'Referral bonus for joining');

      return { success: true, coinsEarned: referralCode.coinRewardReferred };
    } catch (error: any) {
      throw error;
    }
  }

  // ========== FLASH SALES STORAGE METHODS ==========

  async getActiveFlashSales(): Promise<FlashSale[]> {
    try {
      const now = new Date().toISOString();
      return await db.select().from(flashSales)
        .where(and(
          eq(flashSales.isActive, 'true'),
          sql`${flashSales.startTime} <= ${now}`,
          sql`${flashSales.endTime} >= ${now}`
        ))
        .all();
    } catch (error) {
      console.error("Error getting flash sales:", error);
      return [];
    }
  }

  async getAllFlashSales(): Promise<FlashSale[]> {
    try {
      return await db.select().from(flashSales)
        .orderBy(desc(flashSales.createdAt))
        .all();
    } catch (error) {
      console.error("Error getting all flash sales:", error);
      return [];
    }
  }

  async createFlashSale(data: InsertFlashSale): Promise<FlashSale> {
    try {
      const sale = await db.insert(flashSales)
        .values(data)
        .returning()
        .get();
      return sale;
    } catch (error) {
      console.error("Error creating flash sale:", error);
      throw new Error("Failed to create flash sale");
    }
  }

  async updateFlashSale(id: string, updates: Partial<InsertFlashSale>): Promise<FlashSale | undefined> {
    try {
      const updated = await db.update(flashSales)
        .set(updates)
        .where(eq(flashSales.id, id))
        .returning()
        .get();
      return updated;
    } catch (error) {
      console.error("Error updating flash sale:", error);
      return undefined;
    }
  }

  async deleteFlashSale(id: string): Promise<boolean> {
    try {
      await db.delete(flashSales)
        .where(eq(flashSales.id, id))
        .run();
      return true;
    } catch (error) {
      console.error("Error deleting flash sale:", error);
      return false;
    }
  }

  // ========== GIFT STORAGE METHODS ==========

  async sendGift(data: any): Promise<any> {
    try {
      const sender = await this.getUser(data.senderId);
      if (!sender) throw new Error("Sender not found");

      if (data.giftType === 'coins') {
        if ((sender.currencyBalance ?? 0) < data.giftAmount) {
          throw new Error("Insufficient balance");
        }
        await this.processCurrencyChange(data.senderId, -data.giftAmount, 'gift_sent', `Gift to user`);
      }

      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      
      const gift = await db.insert(giftTransactions).values({
        senderId: data.senderId,
        recipientId: data.recipientId,
        recipientEmail: data.recipientEmail,
        giftType: data.giftType,
        giftAmount: data.giftAmount,
        packageId: data.packageId,
        message: data.message,
        status: 'pending',
        expiresAt
      }).returning().get();

      return { success: true, gift };
    } catch (error: any) {
      throw error;
    }
  }

  async getUserReceivedGifts(userId: string): Promise<GiftTransaction[]> {
    try {
      const user = await this.getUser(userId);
      return await db.select().from(giftTransactions)
        .where(or(eq(giftTransactions.recipientId, userId), eq(giftTransactions.recipientEmail, user?.email || '')))
        .orderBy(desc(giftTransactions.createdAt))
        .all();
    } catch (error) {
      console.error("Error getting received gifts:", error);
      return [];
    }
  }

  async claimGift(giftId: string, userId: string): Promise<any> {
    try {
      const [gift] = await db.select().from(giftTransactions)
        .where(eq(giftTransactions.id, giftId))
        .limit(1).all();

      if (!gift) throw new Error("Gift not found");
      if (gift.status !== 'pending') throw new Error("Gift already claimed");
      if (gift.recipientId && gift.recipientId !== userId) throw new Error("This gift is not for you");

      if (gift.giftType === 'coins' && gift.giftAmount) {
        await this.processCurrencyChange(userId, gift.giftAmount, 'gift_received', `Gift from user`);
      }

      await db.update(giftTransactions)
        .set({ status: 'claimed', claimedAt: sql`(datetime('now'))`, recipientId: userId })
        .where(eq(giftTransactions.id, giftId))
        .run();

      return { success: true, giftType: gift.giftType, amount: gift.giftAmount };
    } catch (error: any) {
      throw error;
    }
  }

  // ========== LOYALTY STORAGE METHODS ==========

  async getUserLoyaltyStatus(userId: string): Promise<any> {
    try {
      const [loyalty] = await db.select().from(userLoyalty).where(eq(userLoyalty.userId, userId)).limit(1).all();
      
      if (!loyalty) {
        const newLoyalty = await db.insert(userLoyalty).values({ userId, points: 0, lifetimePoints: 0 }).returning().get();
        return { ...newLoyalty, tier: null };
      }

      const [tier] = loyalty.tierId ? await db.select().from(loyaltyTiers).where(eq(loyaltyTiers.id, loyalty.tierId)).limit(1).all() : [null];
      return { ...loyalty, tier };
    } catch (error) {
      console.error("Error getting loyalty status:", error);
      return null;
    }
  }

  async getLoyaltyTiers(): Promise<LoyaltyTier[]> {
    try {
      return await db.select().from(loyaltyTiers).orderBy(loyaltyTiers.displayOrder).all();
    } catch (error) {
      console.error("Error getting loyalty tiers:", error);
      return [];
    }
  }

  // ========== BATTLE PASS STORAGE METHODS ==========

  async getCurrentBattlePassSeason(): Promise<BattlePassSeason | undefined> {
    try {
      const now = new Date().toISOString();
      const [season] = await db.select().from(battlePassSeasons)
        .where(and(
          eq(battlePassSeasons.isActive, 'true'),
          sql`${battlePassSeasons.startDate} <= ${now}`,
          sql`${battlePassSeasons.endDate} >= ${now}`
        ))
        .limit(1).all();
      return season;
    } catch (error) {
      console.error("Error getting current season:", error);
      return undefined;
    }
  }

  async getUserBattlePassProgress(userId: string): Promise<any> {
    try {
      const season = await this.getCurrentBattlePassSeason();
      if (!season) return null;

      const [progress] = await db.select().from(userBattlePassProgress)
        .where(and(eq(userBattlePassProgress.userId, userId), eq(userBattlePassProgress.seasonId, season.id)))
        .limit(1).all();

      if (!progress) {
        const newProgress = await db.insert(userBattlePassProgress).values({
          userId,
          seasonId: season.id,
          currentTier: 0,
          experience: 0,
          isPremium: 'false'
        }).returning().get();
        return { ...newProgress, season };
      }

      return { ...progress, season };
    } catch (error) {
      console.error("Error getting battle pass progress:", error);
      return null;
    }
  }

  async claimBattlePassReward(userId: string, tier: number): Promise<any> {
    try {
      const progress = await this.getUserBattlePassProgress(userId);
      if (!progress || progress.currentTier < tier) {
        throw new Error("Tier not unlocked");
      }

      const [reward] = await db.select().from(battlePassRewards)
        .where(and(eq(battlePassRewards.seasonId, progress.seasonId), eq(battlePassRewards.tier, tier)))
        .limit(1).all();

      if (!reward) throw new Error("Reward not found");
      if (reward.isPremium === 'true' && progress.isPremium !== 'true') {
        throw new Error("Premium tier required");
      }

      if (reward.rewardType === 'coins') {
        const amount = parseInt(reward.rewardValue);
        await this.processCurrencyChange(userId, amount, 'battle_pass_reward', `Battle Pass Tier ${tier} reward`);
      }

      return { success: true, reward };
    } catch (error: any) {
      throw error;
    }
  }

  async getBattlePassRewards(seasonId: string): Promise<any[]> {
    try {
      return await db.select().from(battlePassRewards)
        .where(eq(battlePassRewards.seasonId, seasonId))
        .orderBy(battlePassRewards.tier)
        .all();
    } catch (error) {
      console.error("Error getting battle pass rewards:", error);
      return [];
    }
  }

  async upgradeBattlePassToPremium(userId: string, seasonId: string): Promise<any> {
    try {
      const [updated] = await db.update(userBattlePassProgress)
        .set({ isPremium: 'true' })
        .where(and(
          eq(userBattlePassProgress.userId, userId),
          eq(userBattlePassProgress.seasonId, seasonId)
        ))
        .returning();
      return updated;
    } catch (error) {
      console.error("Error upgrading to premium:", error);
      throw error;
    }
  }

  // ========== FLASH SALES METHODS ==========

  async incrementFlashSalePurchaseCount(saleId: string): Promise<void> {
    try {
      await db.update(flashSales)
        .set({ currentPurchases: sql`${flashSales.currentPurchases} + 1` })
        .where(eq(flashSales.id, saleId))
        .run();
    } catch (error) {
      console.error("Error incrementing flash sale count:", error);
    }
  }

  // ========== SUBSCRIPTION METHODS ==========

  async createUserSubscription(data: any): Promise<any> {
    try {
      const [subscription] = await db.insert(userSubscriptions)
        .values({
          ...data,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .returning();
      return subscription;
    } catch (error) {
      console.error("Error creating subscription:", error);
      throw error;
    }
  }

  // ========== BULK CHAPTER UNLOCK STORAGE METHODS ==========

  async unlockAllSeriesChapters(userId: string, seriesId: string): Promise<any> {
    try {
      const seriesChapters: Chapter[] = await db.select().from(chapters).where(eq(chapters.seriesId, seriesId)).all();
      const chapterIds = seriesChapters.map((c: Chapter) => c.id);
      
      if (chapterIds.length === 0) {
        return { success: true, chaptersUnlocked: 0, totalCost: 0 };
      }
      
      const accessControls = await db.select().from(chapterAccessControl)
        .where(and(
          inArray(chapterAccessControl.chapterId, chapterIds),
          eq(chapterAccessControl.accessType, 'premium')
        ))
        .all();

      const totalCost = accessControls.reduce((sum, ac) => sum + ac.unlockCost, 0);
      const user = await this.getUser(userId);
      
      if (!user || (user.currencyBalance ?? 0) < totalCost) {
        throw new Error(`Insufficient balance. Need ${totalCost} coins`);
      }

      for (const control of accessControls) {
        const unlocked = await this.hasUserUnlockedChapter(userId, control.chapterId);
        if (!unlocked) {
          await db.insert(userChapterUnlocks).values({
            userId,
            chapterId: control.chapterId,
            costPaid: control.unlockCost
          }).run();
        }
      }

      await this.processCurrencyChange(userId, -totalCost, 'bulk_unlock', `Unlocked all chapters of series`);

      return { success: true, chaptersUnlocked: accessControls.length, totalCost };
    } catch (error: any) {
      throw error;
    }
  }

  // ========== ADMIN SUBSCRIPTION PACKAGE MANAGEMENT ==========

  async createSubscriptionPackage(data: any): Promise<any> {
    try {
      const pkg = await db
        .insert(subscriptionPackages)
        .values(data)
        .returning()
        .get();
      return pkg;
    } catch (error) {
      console.error("Error creating subscription package:", error);
      throw new Error("Failed to create subscription package");
    }
  }

  async updateSubscriptionPackage(id: string, data: any): Promise<any> {
    try {
      const updated = await db
        .update(subscriptionPackages)
        .set(data)
        .where(eq(subscriptionPackages.id, id))
        .returning()
        .get();
      return updated;
    } catch (error) {
      console.error("Error updating subscription package:", error);
      throw new Error("Failed to update subscription package");
    }
  }

  async deleteSubscriptionPackage(id: string): Promise<void> {
    try {
      await db
        .delete(subscriptionPackages)
        .where(eq(subscriptionPackages.id, id))
        .run();
    } catch (error) {
      console.error("Error deleting subscription package:", error);
      throw new Error("Failed to delete subscription package");
    }
  }

  // ========== ADMIN BATTLE PASS SEASON MANAGEMENT ==========

  async getAllBattlePassSeasons(): Promise<any[]> {
    try {
      const seasons = await db
        .select()
        .from(battlePassSeasons)
        .orderBy(desc(battlePassSeasons.createdAt))
        .all();
      return seasons;
    } catch (error) {
      console.error("Error fetching all battle pass seasons:", error);
      return [];
    }
  }

  async createBattlePassSeason(data: any): Promise<any> {
    try {
      const season = await db
        .insert(battlePassSeasons)
        .values(data)
        .returning()
        .get();
      return season;
    } catch (error) {
      console.error("Error creating battle pass season:", error);
      throw new Error("Failed to create battle pass season");
    }
  }

  async updateBattlePassSeason(id: string, data: any): Promise<any> {
    try {
      const updated = await db
        .update(battlePassSeasons)
        .set(data)
        .where(eq(battlePassSeasons.id, id))
        .returning()
        .get();
      return updated;
    } catch (error) {
      console.error("Error updating battle pass season:", error);
      throw new Error("Failed to update battle pass season");
    }
  }

  async deleteBattlePassSeason(id: string): Promise<void> {
    try {
      await db
        .delete(battlePassSeasons)
        .where(eq(battlePassSeasons.id, id))
        .run();
    } catch (error) {
      console.error("Error deleting battle pass season:", error);
      throw new Error("Failed to delete battle pass season");
    }
  }

  // ========== ADMIN BATTLE PASS TIER MANAGEMENT ==========

  async createBattlePassTier(data: any): Promise<any> {
    try {
      const tier = await db
        .insert(battlePassRewards)
        .values(data)
        .returning()
        .get();
      return tier;
    } catch (error) {
      console.error("Error creating battle pass tier:", error);
      throw new Error("Failed to create battle pass tier");
    }
  }

  async updateBattlePassTier(id: string, data: any): Promise<any> {
    try {
      const updated = await db
        .update(battlePassRewards)
        .set(data)
        .where(eq(battlePassRewards.id, id))
        .returning()
        .get();
      return updated;
    } catch (error) {
      console.error("Error updating battle pass tier:", error);
      throw new Error("Failed to update battle pass tier");
    }
  }

  async deleteBattlePassTier(id: string): Promise<void> {
    try {
      await db
        .delete(battlePassRewards)
        .where(eq(battlePassRewards.id, id))
        .run();
    } catch (error) {
      console.error("Error deleting battle pass tier:", error);
      throw new Error("Failed to delete battle pass tier");
    }
  }

  // ========== USER WARNINGS MANAGEMENT ==========

  async getUserWarnings(userId: string): Promise<any[]> {
    try {
      const warnings = await db
        .select({
          id: userWarnings.id,
          userId: userWarnings.userId,
          issuedBy: userWarnings.issuedBy,
          reason: userWarnings.reason,
          severity: userWarnings.severity,
          notes: userWarnings.notes,
          isActive: userWarnings.isActive,
          createdAt: userWarnings.createdAt,
          adminUsername: users.username,
          adminEmail: users.email,
        })
        .from(userWarnings)
        .leftJoin(users, eq(userWarnings.issuedBy, users.id))
        .where(eq(userWarnings.userId, userId))
        .orderBy(desc(userWarnings.createdAt))
        .all();
      return warnings;
    } catch (error) {
      console.error("Error fetching user warnings:", error);
      return [];
    }
  }

  async getUserActiveWarningsCount(userId: string): Promise<number> {
    try {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(userWarnings)
        .where(and(eq(userWarnings.userId, userId), eq(userWarnings.isActive, "true")))
        .get();
      return result?.count || 0;
    } catch (error) {
      console.error("Error counting active warnings:", error);
      return 0;
    }
  }

  async createUserWarning(data: any): Promise<any> {
    try {
      const warning = await db
        .insert(userWarnings)
        .values(data)
        .returning()
        .get();
      return warning;
    } catch (error) {
      console.error("Error creating user warning:", error);
      throw new Error("Failed to create user warning");
    }
  }

  async deleteWarning(warningId: string): Promise<void> {
    try {
      await db
        .delete(userWarnings)
        .where(eq(userWarnings.id, warningId))
        .run();
    } catch (error) {
      console.error("Error deleting warning:", error);
      throw new Error("Failed to delete warning");
    }
  }

  async dismissWarning(warningId: string): Promise<any> {
    try {
      const updated = await db
        .update(userWarnings)
        .set({ isActive: "false" })
        .where(eq(userWarnings.id, warningId))
        .returning()
        .get();
      return updated;
    } catch (error) {
      console.error("Error dismissing warning:", error);
      throw new Error("Failed to dismiss warning");
    }
  }

  // ========== BAN/SUSPENSION MANAGEMENT ==========

  async banUser(userId: string, banData: any): Promise<any> {
    try {
      const updated = await db
        .update(users)
        .set({
          isBanned: "true",
          banReason: banData.banReason,
          bannedBy: banData.bannedBy,
          bannedAt: new Date().toISOString(),
          banExpiresAt: banData.banExpiresAt || null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(users.id, userId))
        .returning()
        .get();
      return updated;
    } catch (error) {
      console.error("Error banning user:", error);
      throw new Error("Failed to ban user");
    }
  }

  async unbanUser(userId: string): Promise<any> {
    try {
      const updated = await db
        .update(users)
        .set({
          isBanned: "false",
          banReason: null,
          bannedBy: null,
          bannedAt: null,
          banExpiresAt: null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(users.id, userId))
        .returning()
        .get();
      return updated;
    } catch (error) {
      console.error("Error unbanning user:", error);
      throw new Error("Failed to unban user");
    }
  }

  async checkBanExpiration(userId: string): Promise<boolean> {
    try {
      const user = await this.getUser(userId);
      if (!user || user.isBanned !== "true") return false;
      
      if (user.banExpiresAt) {
        const expiryDate = new Date(user.banExpiresAt);
        const now = new Date();
        
        if (now >= expiryDate) {
          // Ban has expired, unban the user
          await this.unbanUser(userId);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error("Error checking ban expiration:", error);
      return false;
    }
  }

  // ========== ADMIN ACTIVITY LOGS ==========

  async createActivityLog(data: any): Promise<any> {
    try {
      const log = await db
        .insert(adminActivityLogs)
        .values(data)
        .returning()
        .get();
      return log;
    } catch (error) {
      console.error("Error creating activity log:", error);
      throw new Error("Failed to create activity log");
    }
  }

  async getActivityLogs(filters?: any): Promise<any[]> {
    try {
      let query = db
        .select({
          id: adminActivityLogs.id,
          adminId: adminActivityLogs.adminId,
          action: adminActivityLogs.action,
          targetType: adminActivityLogs.targetType,
          targetId: adminActivityLogs.targetId,
          details: adminActivityLogs.details,
          ipAddress: adminActivityLogs.ipAddress,
          userAgent: adminActivityLogs.userAgent,
          createdAt: adminActivityLogs.createdAt,
          adminUsername: users.username,
          adminEmail: users.email,
        })
        .from(adminActivityLogs)
        .leftJoin(users, eq(adminActivityLogs.adminId, users.id))
        .$dynamic();

      // Apply filters
      const conditions = [];
      if (filters?.adminId) {
        conditions.push(eq(adminActivityLogs.adminId, filters.adminId));
      }
      if (filters?.action) {
        conditions.push(eq(adminActivityLogs.action, filters.action));
      }
      if (filters?.targetType) {
        conditions.push(eq(adminActivityLogs.targetType, filters.targetType));
      }
      if (filters?.startDate) {
        conditions.push(gte(adminActivityLogs.createdAt, filters.startDate));
      }
      if (filters?.endDate) {
        conditions.push(lte(adminActivityLogs.createdAt, filters.endDate));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const logs = await query
        .orderBy(desc(adminActivityLogs.createdAt))
        .limit(filters?.limit || 100)
        .all();

      return logs;
    } catch (error) {
      console.error("Error fetching activity logs:", error);
      return [];
    }
  }

  async updateUserLastLogin(userId: string): Promise<void> {
    try {
      await db
        .update(users)
        .set({
          lastLoginAt: new Date().toISOString(),
          loginCount: sql`${users.loginCount} + 1`,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(users.id, userId))
        .run();
    } catch (error) {
      console.error("Error updating user last login:", error);
    }
  }

  // ============================================================================
  // ROLE AUTHORITY MANAGEMENT METHODS
  // ============================================================================

  async getAllRolesWithPermissions(): Promise<Array<Role & { permissions: RolePermissions }>> {
    try {
      const allRoles = await db.select().from(roles).orderBy(desc(roles.hierarchyLevel));
      
      const rolesWithPermissions = await Promise.all(
        allRoles.map(async (role) => {
          const [permissions] = await db
            .select()
            .from(rolePermissions)
            .where(eq(rolePermissions.roleId, role.id))
            .limit(1);
          
          return {
            ...role,
            permissions: permissions || {
              roleId: role.id,
              manageUsers: 'false',
              viewUsers: 'false',
              banUsers: 'false',
              warnUsers: 'false',
              assignRoles: 'false',
              manageSeries: 'false',
              manageChapters: 'false',
              moderateComments: 'false',
              manageAds: 'false',
              viewAdAnalytics: 'false',
              viewAnalytics: 'false',
              viewDetailedAnalytics: 'false',
              configureRoles: 'false',
              manageSettings: 'false',
              viewLogs: 'false',
              handleDmca: 'false',
              manageSubscriptions: 'false',
              manageCurrency: 'false',
            } as any,
          };
        })
      );
      
      return rolesWithPermissions;
    } catch (error) {
      console.error("Error fetching roles with permissions:", error);
      throw error;
    }
  }

  async getRoleWithPermissions(roleId: string): Promise<(Role & { permissions: RolePermissions }) | undefined> {
    try {
      const [role] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
      if (!role) return undefined;
      
      const [permissions] = await db
        .select()
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, roleId))
        .limit(1);
      
      return {
        ...role,
        permissions: permissions || {
          roleId: role.id,
          manageUsers: 'false',
          viewUsers: 'false',
          banUsers: 'false',
          warnUsers: 'false',
          assignRoles: 'false',
          manageSeries: 'false',
          manageChapters: 'false',
          moderateComments: 'false',
          manageAds: 'false',
          viewAdAnalytics: 'false',
          viewAnalytics: 'false',
          viewDetailedAnalytics: 'false',
          configureRoles: 'false',
          manageSettings: 'false',
          viewLogs: 'false',
          handleDmca: 'false',
          manageSubscriptions: 'false',
          manageCurrency: 'false',
        } as any,
      };
    } catch (error) {
      console.error("Error fetching role with permissions:", error);
      throw error;
    }
  }

  async createRole(roleData: InsertRole): Promise<Role & { permissions: RolePermissions }> {
    try {
      // Create the role
      const [newRole] = await db.insert(roles).values(roleData).returning();
      
      // Create default permissions for the role (all false)
      const [permissions] = await db.insert(rolePermissions).values({
        roleId: newRole.id,
        manageUsers: 'false',
        viewUsers: 'false',
        banUsers: 'false',
        warnUsers: 'false',
        assignRoles: 'false',
        manageSeries: 'false',
        manageChapters: 'false',
        moderateComments: 'false',
        manageAds: 'false',
        viewAdAnalytics: 'false',
        viewAnalytics: 'false',
        viewDetailedAnalytics: 'false',
        configureRoles: 'false',
        manageSettings: 'false',
        viewLogs: 'false',
        handleDmca: 'false',
        manageSubscriptions: 'false',
        manageCurrency: 'false',
      }).returning();
      
      return {
        ...newRole,
        permissions,
      };
    } catch (error) {
      console.error("Error creating role:", error);
      throw error;
    }
  }

  async updateRole(roleId: string, roleData: Partial<InsertRole>): Promise<Role | undefined> {
    try {
      const [updatedRole] = await db
        .update(roles)
        .set({
          ...roleData,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(roles.id, roleId))
        .returning();
      
      return updatedRole;
    } catch (error) {
      console.error("Error updating role:", error);
      throw error;
    }
  }

  async deleteRole(roleId: string): Promise<boolean> {
    try {
      // Check if the role is a system role (cannot be deleted)
      const [role] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
      if (!role) return false;
      if (role.isSystem === 'true') {
        throw new Error("Cannot delete system roles");
      }
      
      // Check if any users have this role
      const usersWithRole = await db.select().from(users).where(eq(users.role, role.name)).limit(1);
      if (usersWithRole.length > 0) {
        throw new Error("Cannot delete role that is assigned to users");
      }
      
      // Delete the role (permissions will be cascade deleted)
      await db.delete(roles).where(eq(roles.id, roleId));
      
      return true;
    } catch (error) {
      console.error("Error deleting role:", error);
      throw error;
    }
  }

  async getRolePermissions(roleId: string): Promise<RolePermissions | undefined> {
    try {
      const [permissions] = await db
        .select()
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, roleId))
        .limit(1);
      
      return permissions;
    } catch (error) {
      console.error("Error fetching role permissions:", error);
      throw error;
    }
  }

  async updateRolePermissions(
    roleId: string,
    permissionsData: Partial<InsertRolePermissions>
  ): Promise<RolePermissions | undefined> {
    try {
      // Check if permissions exist for this role
      const existing = await this.getRolePermissions(roleId);
      
      if (!existing) {
        // Create new permissions if they don't exist
        const [newPermissions] = await db
          .insert(rolePermissions)
          .values({
            roleId,
            ...permissionsData,
          } as any)
          .returning();
        return newPermissions;
      } else {
        // Update existing permissions
        const [updatedPermissions] = await db
          .update(rolePermissions)
          .set({
            ...permissionsData,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(rolePermissions.roleId, roleId))
          .returning();
        
        return updatedPermissions;
      }
    } catch (error) {
      console.error("Error updating role permissions:", error);
      throw error;
    }
  }

  async assignUserRole(userId: string, roleName: string): Promise<User | undefined> {
    try {
      // Validate that the role exists
      const [role] = await db.select().from(roles).where(eq(roles.name, roleName)).limit(1);
      if (!role) {
        throw new Error(`Role '${roleName}' not found`);
      }
      
      // Update user's role
      const [updatedUser] = await db
        .update(users)
        .set({
          role: roleName.toLowerCase(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(users.id, userId))
        .returning();
      
      return updatedUser;
    } catch (error) {
      console.error("Error assigning user role:", error);
      throw error;
    }
  }

  async getUserPermissions(userId: string): Promise<RolePermissions | null> {
    try {
      // Get user
      const user = await this.getUser(userId);
      if (!user) return null;
      
      // Get role by name (roles are stored in lowercase in user.role)
      const [role] = await db
        .select()
        .from(roles)
        .where(sql`LOWER(${roles.name}) = ${user.role.toLowerCase()}`)
        .limit(1);
      
      if (!role) {
        // Return default permissions if role not found
        return {
          roleId: '',
          manageUsers: 'false',
          viewUsers: 'false',
          banUsers: 'false',
          warnUsers: 'false',
          assignRoles: 'false',
          manageSeries: 'false',
          manageChapters: 'false',
          moderateComments: 'false',
          manageAds: 'false',
          viewAdAnalytics: 'false',
          viewAnalytics: 'false',
          viewDetailedAnalytics: 'false',
          configureRoles: 'false',
          manageSettings: 'false',
          viewLogs: 'false',
          handleDmca: 'false',
          manageSubscriptions: 'false',
          manageCurrency: 'false',
        } as any;
      }
      
      // Get permissions for the role
      return await this.getRolePermissions(role.id) || {
        roleId: role.id,
        manageUsers: 'false',
        viewUsers: 'false',
        banUsers: 'false',
        warnUsers: 'false',
        assignRoles: 'false',
        manageSeries: 'false',
        manageChapters: 'false',
        moderateComments: 'false',
        manageAds: 'false',
        viewAdAnalytics: 'false',
        viewAnalytics: 'false',
        viewDetailedAnalytics: 'false',
        configureRoles: 'false',
        manageSettings: 'false',
        viewLogs: 'false',
        handleDmca: 'false',
        manageSubscriptions: 'false',
        manageCurrency: 'false',
      } as any;
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      return null;
    }
  }
}

export const storage = new DatabaseStorage();

// Helper function to create admin sentinel file
function createAdminSentinelFile(adminSentinelFile: string, adminUsername: string, adminEmail: string): void {
  try {
    const sentinelContent = `Admin user seeded on ${new Date().toISOString()}
Username: ${adminUsername}
Email: ${adminEmail}
Note: This file prevents re-creation of admin users. Delete this file only if you want to reset admin seeding.
`;
    writeFileSync(adminSentinelFile, sentinelContent, 'utf8');
    console.log('[init] 📄 Created admin sentinel file:', adminSentinelFile);
  } catch (sentinelError) {
    console.warn('[init] ⚠️  Failed to create admin sentinel file:', sentinelError);
  }
}

// Admin initialization functionality
export async function initializeAdminUser(): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';
  const adminSentinelFile = './data/.admin-seeded';
  
  try {
    console.log('[init] 🔍 Checking for existing admin users...');
    
    // Check sentinel file first - if admin was ever created, skip entirely
    if (existsSync(adminSentinelFile)) {
      console.log('[init] ✅ Admin already seeded (sentinel file exists) - skipping admin creation');
      return;
    }
    
    // Get admin credentials from environment variables with proper defaults
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@localhost.com';
    
    // Handle admin password with security for production
    let adminPassword: string;
    if (isProduction) {
      if (!process.env.ADMIN_PASSWORD) {
        // Generate a strong random password in production if not provided
        const randomPassword = randomBytes(16).toString('base64').slice(0, 16);
        adminPassword = randomPassword;
        console.log('[init] 🔐 GENERATED ADMIN PASSWORD (SAVE THIS):');
        console.log(`[init] 🔑 Password: ${randomPassword}`);
        console.log('[init] ⚠️  This password will only be shown once! Set ADMIN_PASSWORD environment variable for future use.');
      } else {
        adminPassword = process.env.ADMIN_PASSWORD;
      }
    } else {
      // Development environment can use weak defaults
      adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminEmail)) {
      throw new Error(`Invalid admin email format: ${adminEmail}`);
    }
    
    // Validate username (no special characters, reasonable length)
    if (adminUsername.length < 3 || adminUsername.length > 50) {
      throw new Error(`Invalid admin username length: ${adminUsername} (must be 3-50 characters)`);
    }
    
    // Validate password strength in production
    if (isProduction && adminPassword === 'change_me') {
      throw new Error('SECURITY ERROR: Cannot use default password "change_me" in production! Set ADMIN_PASSWORD environment variable.');
    }
    
    if (adminPassword.length < 6) {
      throw new Error(`Admin password too short: ${adminPassword.length} characters (minimum 6 required)`);
    }

    // Check if any admin user already exists (using isAdmin field or role)
    console.log('[init] 🔍 Searching for existing admin users...');
    const allUsers = await storage.getAllUsers();
    const existingAdmins = allUsers.filter(user => 
      user.isAdmin === 'true' || user.role === 'admin'
    );
    
    if (existingAdmins.length > 0) {
      console.log(`[init] ✅ Found ${existingAdmins.length} existing admin user(s):`);
      existingAdmins.forEach(admin => {
        console.log(`[init]    👤 Admin: ${admin.username || 'N/A'} (${admin.email || 'N/A'})`);
      });
      console.log('[init] ℹ️  Skipping admin creation - admins already exist');
      
      // Create sentinel file to mark that admin seeding has been completed
      createAdminSentinelFile(adminSentinelFile, adminUsername, adminEmail);
      return;
    }

    // Check for legacy admin users and upgrade them
    console.log('[init] 🔍 Checking for legacy admin users to upgrade...');
    const legacyAdminByUsername = await storage.getUserByUsername(adminUsername);
    const legacyAdminByEmail = adminEmail ? await storage.getUserByEmail(adminEmail) : null;
    
    // Upgrade legacy admin by username
    if (legacyAdminByUsername && legacyAdminByUsername.isAdmin !== 'true' && legacyAdminByUsername.role !== 'admin') {
      console.log(`[init] 🔧 Upgrading legacy user '${adminUsername}' to admin...`);
      await storage.updateUser(legacyAdminByUsername.id!, { 
        isAdmin: 'true', 
        role: 'admin',
        email: adminEmail // Update email if provided
      });
      console.log('[init] ✅ Successfully upgraded existing user to admin');
      console.log(`[init] 📧 Username: ${adminUsername}`);
      console.log(`[init] 📧 Email: ${adminEmail}`);
      console.log('[init] 🔐 Using existing password (unchanged)');
      createAdminSentinelFile(adminSentinelFile, adminUsername, adminEmail);
      return;
    }
    
    // Upgrade legacy admin by email (if different from username)
    if (legacyAdminByEmail && legacyAdminByEmail.id !== legacyAdminByUsername?.id && 
        legacyAdminByEmail.isAdmin !== 'true' && legacyAdminByEmail.role !== 'admin') {
      console.log(`[init] 🔧 Upgrading legacy user with email '${adminEmail}' to admin...`);
      await storage.updateUser(legacyAdminByEmail.id!, { 
        isAdmin: 'true', 
        role: 'admin',
        username: adminUsername // Update username if provided
      });
      console.log('[init] ✅ Successfully upgraded existing user to admin');
      console.log(`[init] 📧 Username: ${adminUsername}`);
      console.log(`[init] 📧 Email: ${adminEmail}`);
      console.log('[init] 🔐 Using existing password (unchanged)');
      createAdminSentinelFile(adminSentinelFile, adminUsername, adminEmail);
      return;
    }

    // Create new admin user
    console.log('[init] 🔧 Creating new admin user...');
    
    // Check for duplicate username/email before creating to prevent unique constraint errors
    console.log('[init] 🔍 Checking for duplicate username/email...');
    const existingUserByUsername = await storage.getUserByUsername(adminUsername);
    const existingUserByEmail = await storage.getUserByEmail(adminEmail);
    
    if (existingUserByUsername) {
      console.log(`[init] ⚠️  User with username '${adminUsername}' already exists but is not admin`);
      console.log('[init] 🔧 Upgrading existing user to admin role...');
      await storage.updateUser(existingUserByUsername.id!, { 
        isAdmin: 'true', 
        role: 'admin',
        email: adminEmail // Update email if provided
      });
      console.log('[init] ✅ Successfully upgraded existing user to admin');
      createAdminSentinelFile(adminSentinelFile, adminUsername, adminEmail);
      return;
    }
    
    if (existingUserByEmail) {
      console.log(`[init] ⚠️  User with email '${adminEmail}' already exists but is not admin`);
      console.log('[init] 🔧 Upgrading existing user to admin role...');
      await storage.updateUser(existingUserByEmail.id!, { 
        isAdmin: 'true', 
        role: 'admin',
        username: adminUsername // Update username if provided
      });
      console.log('[init] ✅ Successfully upgraded existing user to admin');
      createAdminSentinelFile(adminSentinelFile, adminUsername, adminEmail);
      return;
    }
    
    // Import bcrypt for password hashing
    const bcrypt = await import('bcryptjs');
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);

    let adminUser;
    try {
      adminUser = await storage.createUser({
        username: adminUsername,
        password: hashedPassword,
        email: adminEmail,
        isAdmin: 'true',
        profilePicture: null,
        country: null
      });
    } catch (createError: any) {
      // Handle unique constraint violations
      if (createError && typeof createError.message === 'string') {
        if (createError.message.includes('UNIQUE constraint failed: users.username') ||
            createError.message.includes('username') && createError.message.includes('unique')) {
          console.log(`[init] ⚠️  Username '${adminUsername}' constraint violation detected`);
          const existingUser = await storage.getUserByUsername(adminUsername);
          if (existingUser) {
            console.log('[init] 🔧 Upgrading conflicting user to admin...');
            await storage.updateUser(existingUser.id!, { 
              isAdmin: 'true', 
              role: 'admin',
              email: adminEmail
            });
            console.log('[init] ✅ Successfully resolved username conflict and upgraded to admin');
            createAdminSentinelFile(adminSentinelFile, adminUsername, adminEmail);
            return;
          }
        }
        
        if (createError.message.includes('UNIQUE constraint failed: users.email') ||
            createError.message.includes('email') && createError.message.includes('unique')) {
          console.log(`[init] ⚠️  Email '${adminEmail}' constraint violation detected`);
          const existingUser = await storage.getUserByEmail(adminEmail);
          if (existingUser) {
            console.log('[init] 🔧 Upgrading conflicting user to admin...');
            await storage.updateUser(existingUser.id!, { 
              isAdmin: 'true', 
              role: 'admin',
              username: adminUsername
            });
            console.log('[init] ✅ Successfully resolved email conflict and upgraded to admin');
            createAdminSentinelFile(adminSentinelFile, adminUsername, adminEmail);
            return;
          }
        }
      }
      
      // Re-throw if not a handled constraint violation
      throw createError;
    }

    console.log('[init] ✅ Admin user created successfully!');
    console.log(`[init] 👤 Username: ${adminUsername}`);
    console.log(`[init] 📧 Email: ${adminEmail}`);
    console.log(`[init] 🆔 User ID: ${adminUser.id}`);
    
    // Log password info safely (never expose actual password in production)
    if (isProduction) {
      if (process.env.ADMIN_PASSWORD) {
        console.log('[init] 🔐 Using configured admin password from environment');
      } else {
        console.log('[init] ⚠️  Using default password - CHANGE IMMEDIATELY!');
      }
    } else {
      // Development environment - show more details
      if (process.env.ADMIN_PASSWORD) {
        console.log('[init] 🔐 Using configured admin password from ADMIN_PASSWORD');
      } else {
        console.log('[init] 🔐 Using default password: change_me');
        console.log('[init] 💡 Set ADMIN_PASSWORD environment variable to use custom password');
      }
    }
    
    // Security reminders
    if (adminPassword === 'change_me') {
      console.log('[init] ⚠️  SECURITY REMINDER: Default password in use - change immediately!');
    }
    
    // Create sentinel file for successful admin creation
    createAdminSentinelFile(adminSentinelFile, adminUsername, adminEmail);
    
    console.log('[init] 🎉 Admin initialization completed successfully');

  } catch (error) {
    console.error('[init] ❌ Failed to initialize admin user:', error);
    
    // Provide helpful error context
    if (error instanceof Error) {
      console.error('[init] 💥 Error details:', error.message);
      if (error.stack) {
        console.error('[init] 📍 Stack trace:', error.stack);
      }
    }
    
    // In production, this should not crash the server, but log prominently
    if (isProduction) {
      console.error('[init] 🚨 CRITICAL: Admin user initialization failed in production!');
      console.error('[init] 🔧 Manual intervention may be required to create admin user');
    } else {
      console.error('[init] 🔧 Admin user creation failed - check database and try again');
    }
    
    // Don't throw error to prevent server startup failure, but make it very visible
    console.error('[init] ⚠️  Server will continue without admin user - this may cause issues!');
  }
}

// Roles initialization functionality
export async function initializeRoles(): Promise<void> {
  const rolesSentinelFile = './data/.roles-seeded';
  
  try {
    console.log('[roles-init] 🔍 Checking for existing roles...');
    
    // Check sentinel file first - if roles were ever created, skip entirely
    if (existsSync(rolesSentinelFile)) {
      console.log('[roles-init] ✅ Roles already seeded (sentinel file exists) - skipping role creation');
      return;
    }
    
    // Define default roles with their hierarchy and permissions
    const defaultRoles = [
      {
        name: 'Owner',
        description: 'Highest authority with full system access and control',
        hierarchyLevel: 100,
        color: '#ef4444',
        isSystem: 'true' as const,
        permissions: {
          manageUsers: 'true' as const,
          viewUsers: 'true' as const,
          banUsers: 'true' as const,
          warnUsers: 'true' as const,
          assignRoles: 'true' as const,
          manageSeries: 'true' as const,
          manageChapters: 'true' as const,
          moderateComments: 'true' as const,
          manageAds: 'true' as const,
          viewAdAnalytics: 'true' as const,
          viewAnalytics: 'true' as const,
          viewDetailedAnalytics: 'true' as const,
          configureRoles: 'true' as const,
          manageSettings: 'true' as const,
          viewLogs: 'true' as const,
          handleDmca: 'true' as const,
          manageSubscriptions: 'true' as const,
          manageCurrency: 'true' as const,
        },
      },
      {
        name: 'Admin',
        description: 'Administrator with broad management permissions',
        hierarchyLevel: 80,
        color: '#f59e0b',
        isSystem: 'true' as const,
        permissions: {
          manageUsers: 'true' as const,
          viewUsers: 'true' as const,
          banUsers: 'true' as const,
          warnUsers: 'true' as const,
          assignRoles: 'false' as const,
          manageSeries: 'true' as const,
          manageChapters: 'true' as const,
          moderateComments: 'true' as const,
          manageAds: 'true' as const,
          viewAdAnalytics: 'true' as const,
          viewAnalytics: 'true' as const,
          viewDetailedAnalytics: 'true' as const,
          configureRoles: 'false' as const,
          manageSettings: 'false' as const,
          viewLogs: 'true' as const,
          handleDmca: 'true' as const,
          manageSubscriptions: 'false' as const,
          manageCurrency: 'false' as const,
        },
      },
      {
        name: 'Staff',
        description: 'Staff member with content management permissions',
        hierarchyLevel: 60,
        color: '#10b981',
        isSystem: 'true' as const,
        permissions: {
          manageUsers: 'false' as const,
          viewUsers: 'true' as const,
          banUsers: 'false' as const,
          warnUsers: 'true' as const,
          assignRoles: 'false' as const,
          manageSeries: 'true' as const,
          manageChapters: 'true' as const,
          moderateComments: 'true' as const,
          manageAds: 'false' as const,
          viewAdAnalytics: 'false' as const,
          viewAnalytics: 'false' as const,
          viewDetailedAnalytics: 'false' as const,
          configureRoles: 'false' as const,
          manageSettings: 'false' as const,
          viewLogs: 'false' as const,
          handleDmca: 'false' as const,
          manageSubscriptions: 'false' as const,
          manageCurrency: 'false' as const,
        },
      },
      {
        name: 'VIP',
        description: 'VIP member with enhanced viewing privileges',
        hierarchyLevel: 40,
        color: '#8b5cf6',
        isSystem: 'true' as const,
        permissions: {
          manageUsers: 'false' as const,
          viewUsers: 'false' as const,
          banUsers: 'false' as const,
          warnUsers: 'false' as const,
          assignRoles: 'false' as const,
          manageSeries: 'false' as const,
          manageChapters: 'false' as const,
          moderateComments: 'false' as const,
          manageAds: 'false' as const,
          viewAdAnalytics: 'false' as const,
          viewAnalytics: 'false' as const,
          viewDetailedAnalytics: 'false' as const,
          configureRoles: 'false' as const,
          manageSettings: 'false' as const,
          viewLogs: 'false' as const,
          handleDmca: 'false' as const,
          manageSubscriptions: 'false' as const,
          manageCurrency: 'false' as const,
        },
      },
      {
        name: 'Premium',
        description: 'Premium subscriber with ad-free experience',
        hierarchyLevel: 20,
        color: '#3b82f6',
        isSystem: 'true' as const,
        permissions: {
          manageUsers: 'false' as const,
          viewUsers: 'false' as const,
          banUsers: 'false' as const,
          warnUsers: 'false' as const,
          assignRoles: 'false' as const,
          manageSeries: 'false' as const,
          manageChapters: 'false' as const,
          moderateComments: 'false' as const,
          manageAds: 'false' as const,
          viewAdAnalytics: 'false' as const,
          viewAnalytics: 'false' as const,
          viewDetailedAnalytics: 'false' as const,
          configureRoles: 'false' as const,
          manageSettings: 'false' as const,
          viewLogs: 'false' as const,
          handleDmca: 'false' as const,
          manageSubscriptions: 'false' as const,
          manageCurrency: 'false' as const,
        },
      },
      {
        name: 'Member',
        description: 'Regular member with standard access',
        hierarchyLevel: 0,
        color: '#6366f1',
        isSystem: 'true' as const,
        permissions: {
          manageUsers: 'false' as const,
          viewUsers: 'false' as const,
          banUsers: 'false' as const,
          warnUsers: 'false' as const,
          assignRoles: 'false' as const,
          manageSeries: 'false' as const,
          manageChapters: 'false' as const,
          moderateComments: 'false' as const,
          manageAds: 'false' as const,
          viewAdAnalytics: 'false' as const,
          viewAnalytics: 'false' as const,
          viewDetailedAnalytics: 'false' as const,
          configureRoles: 'false' as const,
          manageSettings: 'false' as const,
          viewLogs: 'false' as const,
          handleDmca: 'false' as const,
          manageSubscriptions: 'false' as const,
          manageCurrency: 'false' as const,
        },
      },
    ];
    
    console.log('[roles-init] 🔧 Creating default roles and permissions...');
    
    // Create roles and their permissions
    for (const roleData of defaultRoles) {
      const { permissions, ...roleInfo } = roleData;
      
      // Insert role
      const [createdRole] = await db.insert(roles).values(roleInfo).returning();
      console.log(`[roles-init] ✅ Created role: ${createdRole.name} (hierarchy level: ${createdRole.hierarchyLevel})`);
      
      // Insert role permissions
      await db.insert(rolePermissions).values({
        roleId: createdRole.id,
        ...permissions,
      });
      console.log(`[roles-init] ✅ Set permissions for role: ${createdRole.name}`);
    }
    
    // Create sentinel file to mark that roles seeding has been completed
    try {
      writeFileSync(rolesSentinelFile, JSON.stringify({
        seededAt: new Date().toISOString(),
        rolesCount: defaultRoles.length,
        message: 'Default roles and permissions have been seeded successfully'
      }, null, 2));
      console.log('[roles-init] ✅ Created roles sentinel file');
    } catch (sentinelError) {
      console.warn('[roles-init] ⚠️  Failed to create roles sentinel file:', sentinelError);
    }
    
    console.log('[roles-init] 🎉 Roles initialization completed successfully');
    console.log(`[roles-init] 📊 Created ${defaultRoles.length} default roles with permissions`);
    
  } catch (error) {
    console.error('[roles-init] ❌ Failed to initialize roles:', error);
    
    // Provide helpful error context
    if (error instanceof Error) {
      console.error('[roles-init] 💥 Error details:', error.message);
      if (error.stack) {
        console.error('[roles-init] 📍 Stack trace:', error.stack);
      }
    }
    
    // Don't throw error to prevent server startup failure, but make it very visible
    console.error('[roles-init] ⚠️  Server will continue without roles - role management may not work!');
  }
}
