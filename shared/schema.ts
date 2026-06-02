import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Custom UUID generation function for SQLite
function generateId() {
  return crypto.randomUUID();
}

// User storage table - merging existing fields with Replit Auth requirements
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  // Existing fields (preserved for backward compatibility)
  username: text("username").unique(), // Made optional to support social auth
  email: text("email").unique(),
  password: text("password"), // Made optional to support social auth only users
  profilePicture: text("profile_picture"), // Legacy field name
  country: text("country"),
  // Admin authorization field - proper security model
  isAdmin: text("is_admin").notNull().default("false"), // "true" or "false" for security
  // User role system (new comprehensive roles)
  role: text("role").notNull().default("user"), // user, premium, staff, admin, owner
  // Replit Auth required fields
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"), // Replit Auth field
  // Email verification fields
  emailVerified: text("email_verified").notNull().default("false"), // "true" or "false"
  emailVerifiedAt: text("email_verified_at"), // Timestamp when email was verified
  // Virtual currency fields
  currencyBalance: integer("currency_balance").default(0), // User's coin/points balance
  // Stripe integration fields
  stripeCustomerId: text("stripe_customer_id"), // Stripe customer ID for subscriptions
  // Ban/Suspension fields
  isBanned: text("is_banned").notNull().default("false"), // "true" or "false"
  banReason: text("ban_reason"), // Reason for ban
  bannedBy: text("banned_by"), // Admin who issued the ban (user ID)
  bannedAt: text("banned_at"), // Timestamp when banned
  banExpiresAt: text("ban_expires_at"), // Timestamp when ban expires (null for permanent)
  // User activity tracking
  lastLoginAt: text("last_login_at"), // Last login timestamp
  loginCount: integer("login_count").default(0), // Total login count
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => ({
  roleIdx: index("users_role_idx").on(table.role),
  isBannedIdx: index("users_is_banned_idx").on(table.isBanned),
  stripeCustomerIdx: index("users_stripe_customer_idx").on(table.stripeCustomerId),
}));

// Manga/Manhwa Series table
export const series = sqliteTable("series", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  title: text("title").notNull(),
  description: text("description"),
  author: text("author"),
  artist: text("artist"),
  status: text("status").notNull().default("ongoing"), // ongoing, completed, hiatus, cancelled
  type: text("type").notNull().default("manga"), // manga, manhwa, manhua, webtoon
  genres: text("genres"), // JSON array stored as text in SQLite
  coverImageUrl: text("cover_image_url"),
  rating: text("rating"), // Stored as text to preserve decimal precision
  totalChapters: integer("total_chapters"),
  publishedYear: integer("published_year"),
  isAdult: text("is_adult").notNull().default("false"), // "true" or "false"
  // Section assignment flags for homepage control
  isFeatured: text("is_featured").notNull().default("false"), // For hero banner section
  isTrending: text("is_trending").notNull().default("false"), // For trending section
  isPopularToday: text("is_popular_today").notNull().default("false"), // For popular today section
  isLatestUpdate: text("is_latest_update").notNull().default("false"), // For latest updates section
  isPinned: text("is_pinned").notNull().default("false"), // For pinned section
  // SEO metadata fields
  metaTitle: text("meta_title"), // Custom SEO title (falls back to title if null)
  metaDescription: text("meta_description"), // Custom SEO description (falls back to description if null)
  canonicalUrl: text("canonical_url"), // Custom canonical URL (auto-generated if null)
  robotsNoindex: text("robots_noindex").notNull().default("false"), // "true" to prevent indexing
  seoKeywords: text("seo_keywords"), // Additional SEO keywords
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => ({
  statusIdx: index("series_status_idx").on(table.status),
  typeIdx: index("series_type_idx").on(table.type),
  isFeaturedIdx: index("series_is_featured_idx").on(table.isFeatured),
  isTrendingIdx: index("series_is_trending_idx").on(table.isTrending),
  isPopularTodayIdx: index("series_is_popular_today_idx").on(table.isPopularToday),
  isLatestUpdateIdx: index("series_is_latest_update_idx").on(table.isLatestUpdate),
  isPinnedIdx: index("series_is_pinned_idx").on(table.isPinned),
  robotsNoindexIdx: index("series_robots_noindex_idx").on(table.robotsNoindex),
}));

// Languages table for multi-language support
export const languages = sqliteTable("languages", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  code: text("code").notNull().unique(), // ISO 639-1 language code (en, es, ja, fr, etc.)
  name: text("name").notNull(), // Language name (English, Spanish, Japanese, French, etc.)
  nativeName: text("native_name").notNull(), // Native name (English, Español, 日本語, Français, etc.)
  isActive: text("is_active").notNull().default("true"), // "true" or "false"
  isDefault: text("is_default").notNull().default("false"), // "true" or "false"
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => ({
  codeIdx: uniqueIndex("language_code_idx").on(table.code),
}));

// Series Translations table for storing translated series metadata
export const seriesTranslations = sqliteTable("series_translations", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  seriesId: text("series_id").notNull().references(() => series.id, { onDelete: "cascade" }),
  languageId: text("language_id").notNull().references(() => languages.id, { onDelete: "cascade" }),
  title: text("title"), // Translated title
  description: text("description"), // Translated description
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => ({
  seriesLanguageIdx: index("series_language_idx").on(table.seriesId, table.languageId),
  uniqueSeriesLanguage: uniqueIndex("unique_series_language").on(table.seriesId, table.languageId),
}));

// Chapters table for storing individual chapters/episodes
export const chapters = sqliteTable("chapters", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  seriesId: text("series_id").notNull().references(() => series.id, { onDelete: "cascade" }),
  chapterNumber: text("chapter_number").notNull(), // Stored as text to support decimals like "1.5"
  title: text("title"), // Optional chapter title
  pages: text("pages").notNull(), // JSON array of image paths/URLs
  totalPages: integer("total_pages").notNull().default(0),
  coverImageUrl: text("cover_image_url"), // URL/path to the chapter cover image (first image)
  isPublished: text("is_published").notNull().default("true"), // "true" or "false"
  uploadedBy: text("uploaded_by").references(() => users.id),
  requiresManualReorder: text("requires_manual_reorder").notNull().default("false"), // "true" if natural sorting confidence is low
  naturalSortConfidence: text("natural_sort_confidence").default("1.0"), // Confidence score 0.0-1.0 stored as text
  // SEO metadata fields
  metaTitle: text("meta_title"), // Custom SEO title
  metaDescription: text("meta_description"), // Custom SEO description
  canonicalUrl: text("canonical_url"), // Custom canonical URL
  robotsNoindex: text("robots_noindex").notNull().default("false"), // "true" to prevent indexing
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => ({
  // Create compound index for efficient queries
  seriesChapterIdx: index("series_chapter_idx").on(table.seriesId, table.chapterNumber),
  // UNIQUE constraint to prevent race conditions during chapter uploads
  uniqueSeriesChapter: uniqueIndex("unique_series_chapter").on(table.seriesId, table.chapterNumber),
  uploadedByIdx: index("chapters_uploaded_by_idx").on(table.uploadedBy),
  isPublishedIdx: index("chapters_is_published_idx").on(table.isPublished),
  seriesPublishedIdx: index("chapters_series_published_idx").on(table.seriesId, table.isPublished),
}));

// Create SafeUser type without password for sessions and responses
export type SafeUser = Omit<User, 'password'>;

// Extended SafeUser type with admin flag for frontend
export type SafeUserWithAdmin = Omit<SafeUser, 'isAdmin'> & {
  isAdmin: boolean;
};

// User role types for the roles system
export type UserRole = "user" | "premium" | "staff" | "admin" | "owner";

// Extended SafeUser type with role information
export type SafeUserWithRole = SafeUser & {
  role: UserRole;
};

// Replit Auth upsert type
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// System Settings table for configuration management
export const settings = sqliteTable("settings", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  category: text("category").notNull(), // site, users, content, system
  key: text("key").notNull(),
  value: text("value").notNull(),
  type: text("type").notNull().default("string"), // string, number, boolean, json
  description: text("description"),
  isPublic: text("is_public").notNull().default("false"), // Whether setting can be read by non-admins
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => ({
  categoryKeyIdx: uniqueIndex("settings_category_key_idx").on(table.category, table.key),
  categoryIdx: index("settings_category_idx").on(table.category),
}));

// User Library table for bookmarking manga series
export const userLibrary = sqliteTable("user_library", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  seriesId: text("series_id").notNull().references(() => series.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("reading"), // reading, completed, plan_to_read, on_hold, dropped
  addedAt: text("added_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => ({
  userSeriesIdx: index("user_series_idx").on(table.userId, table.seriesId),
  uniqueUserSeries: uniqueIndex("unique_user_series").on(table.userId, table.seriesId),
}));

// User Follows table for subscribing to manga series
export const userFollows = sqliteTable("user_follows", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  seriesId: text("series_id").notNull().references(() => series.id, { onDelete: "cascade" }),
  followedAt: text("followed_at").default(sql`(datetime('now'))`),
  notificationsEnabled: text("notifications_enabled").notNull().default("true"), // "true" or "false"
}, (table) => ({
  userSeriesFollowIdx: index("user_series_follow_idx").on(table.userId, table.seriesId),
  uniqueUserSeriesFollow: uniqueIndex("unique_user_series_follow").on(table.userId, table.seriesId),
}));

// Comments table for series and chapter discussions
export const comments = sqliteTable("comments", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  seriesId: text("series_id").references(() => series.id, { onDelete: "cascade" }),
  chapterId: text("chapter_id").references(() => chapters.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => ({
  userIdx: index("comments_user_idx").on(table.userId),
  seriesIdx: index("comments_series_idx").on(table.seriesId),
  chapterIdx: index("comments_chapter_idx").on(table.chapterId),
}));

// Reading Progress table for tracking user's reading position
export const readingProgress = sqliteTable("reading_progress", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  seriesId: text("series_id").notNull().references(() => series.id, { onDelete: "cascade" }),
  chapterId: text("chapter_id").references(() => chapters.id, { onDelete: "set null" }),
  lastReadPage: integer("last_read_page").notNull().default(0),
  lastReadAt: text("last_read_at").default(sql`(datetime('now'))`),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => ({
  userSeriesProgressIdx: index("user_series_progress_idx").on(table.userId, table.seriesId),
  uniqueUserSeriesProgress: uniqueIndex("unique_user_series_progress").on(table.userId, table.seriesId),
}));

// Email Verification Tokens table for confirming user email addresses
export const emailVerificationTokens = sqliteTable("email_verification_tokens", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
}, (table) => ({
  userIdx: index("email_verification_user_idx").on(table.userId),
  tokenIdx: uniqueIndex("email_verification_token_idx").on(table.token),
}));

// Password Reset Tokens table for forgot password flow
export const passwordResetTokens = sqliteTable("password_reset_tokens", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  used: text("used").notNull().default("false"), // "true" or "false" - prevent token reuse
  createdAt: text("created_at").default(sql`(datetime('now'))`),
}, (table) => ({
  userIdx: index("password_reset_user_idx").on(table.userId),
  tokenIdx: uniqueIndex("password_reset_token_idx").on(table.token),
}));

// User Ratings table for series reviews
export const userRatings = sqliteTable("user_ratings", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  seriesId: text("series_id").notNull().references(() => series.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(), // 1-10 rating
  review: text("review"), // Optional text review
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => ({
  userSeriesIdx: index("user_ratings_user_series_idx").on(table.userId, table.seriesId),
  uniqueUserSeriesRating: uniqueIndex("unique_user_series_rating").on(table.userId, table.seriesId),
  seriesIdx: index("user_ratings_series_idx").on(table.seriesId),
}));

// User Follows table for following other users
export const userFollowsUsers = sqliteTable("user_follows_users", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  followerId: text("follower_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  followingId: text("following_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  followedAt: text("followed_at").default(sql`(datetime('now'))`),
}, (table) => ({
  followerIdx: index("user_follows_follower_idx").on(table.followerId),
  followingIdx: index("user_follows_following_idx").on(table.followingId),
  uniqueUserFollow: uniqueIndex("unique_user_follow").on(table.followerId, table.followingId),
}));

// Reading Lists table for custom user collections
export const readingLists = sqliteTable("reading_lists", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  visibility: text("visibility").notNull().default("private"), // private, public
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => ({
  userIdx: index("reading_lists_user_idx").on(table.userId),
}));

// Reading List Items table for series in lists
export const readingListItems = sqliteTable("reading_list_items", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  listId: text("list_id").notNull().references(() => readingLists.id, { onDelete: "cascade" }),
  seriesId: text("series_id").notNull().references(() => series.id, { onDelete: "cascade" }),
  addedAt: text("added_at").default(sql`(datetime('now'))`),
}, (table) => ({
  listSeriesIdx: index("reading_list_items_list_series_idx").on(table.listId, table.seriesId),
  uniqueListSeries: uniqueIndex("unique_list_series").on(table.listId, table.seriesId),
}));

// Reading Lists types
export type ReadingList = typeof readingLists.$inferSelect;
export type InsertReadingList = typeof readingLists.$inferInsert;

// Reading List Items types
export type ReadingListItem = typeof readingListItems.$inferSelect;
export type InsertReadingListItem = typeof readingListItems.$inferInsert;

// Currency Transactions table for tracking all currency movements
export const currencyTransactions = sqliteTable("currency_transactions", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(), // Positive for credit, negative for debit
  type: text("type").notNull(), // purchase, admin_grant, unlock_chapter, refund, bonus
  description: text("description").notNull(),
  relatedEntityId: text("related_entity_id"), // Chapter/series ID if applicable
  createdAt: text("created_at").default(sql`(datetime('now'))`),
}, (table) => ({
  userCreatedIdx: index("currency_transactions_user_created_idx").on(table.userId, table.createdAt),
  userIdx: index("currency_transactions_user_idx").on(table.userId),
}));

// Currency Packages table for shop items
export const currencyPackages = sqliteTable("currency_packages", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  name: text("name").notNull(), // Package name like "Starter Pack", "Premium Bundle"
  currencyAmount: integer("currency_amount").notNull(), // Coins/points in package
  priceUSD: text("price_usd").notNull(), // Price in USD, stored as text for precision like "4.99"
  bonusPercentage: integer("bonus_percentage").notNull().default(0), // Bonus coins percentage, 0-100
  isActive: text("is_active").notNull().default("true"), // "true" or "false" - can be enabled/disabled by admin
  displayOrder: integer("display_order").notNull().default(0), // Sort order in shop
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => ({
  activeDisplayIdx: index("currency_packages_active_display_idx").on(table.isActive, table.displayOrder),
}));

// User Purchases table for tracking currency purchases
export const userPurchases = sqliteTable("user_purchases", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  packageId: text("package_id").references(() => currencyPackages.id, { onDelete: "set null" }),
  amountPaid: text("amount_paid").notNull(), // Actual amount paid in USD
  currencyReceived: integer("currency_received").notNull(), // Coins/points received
  paymentProvider: text("payment_provider").notNull(), // stripe, paypal, admin_grant, etc.
  transactionId: text("transaction_id"), // Payment provider transaction ID
  status: text("status").notNull().default("pending"), // completed, pending, failed, refunded
  couponId: text("coupon_id"), // Reference to applied coupon (nullable)
  trialEndsAt: text("trial_ends_at"), // Trial expiration date if applicable
  isOffline: text("is_offline").notNull().default("false"), // "true" for offline/manual purchases
  createdAt: text("created_at").default(sql`(datetime('now'))`),
}, (table) => ({
  userStatusIdx: index("user_purchases_user_status_idx").on(table.userId, table.status),
  userIdx: index("user_purchases_user_idx").on(table.userId),
  transactionIdIdx: index("user_purchases_transaction_id_idx").on(table.transactionId),
}));

// Chapter Access Control table for premium/locked chapters
export const chapterAccessControl = sqliteTable("chapter_access_control", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  chapterId: text("chapter_id").notNull().references(() => chapters.id, { onDelete: "cascade" }),
  accessType: text("access_type").notNull(), // free, premium, locked, hot
  unlockCost: integer("unlock_cost").notNull().default(0), // Coins needed to unlock, 0 for free
  isActive: text("is_active").notNull().default("true"), // "true" or "false"
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => ({
  uniqueChapter: uniqueIndex("unique_chapter_access").on(table.chapterId),
}));

// User Chapter Unlocks table for tracking unlocked chapters
export const userChapterUnlocks = sqliteTable("user_chapter_unlocks", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  chapterId: text("chapter_id").notNull().references(() => chapters.id, { onDelete: "cascade" }),
  unlockedAt: text("unlocked_at").default(sql`(datetime('now'))`),
  costPaid: integer("cost_paid").notNull(), // Coins spent to unlock
  createdAt: text("created_at").default(sql`(datetime('now'))`),
}, (table) => ({
  uniqueUserChapter: uniqueIndex("unique_user_chapter_unlock").on(table.userId, table.chapterId),
  userIdx: index("user_chapter_unlocks_user_idx").on(table.userId),
}));

// Series types
export type Series = typeof series.$inferSelect;
export type InsertSeries = typeof series.$inferInsert;
export type UpsertSeries = typeof series.$inferInsert;

// Languages types
export type Language = typeof languages.$inferSelect;
export type InsertLanguage = typeof languages.$inferInsert;

// Series Translations types
export type SeriesTranslation = typeof seriesTranslations.$inferSelect;
export type InsertSeriesTranslation = typeof seriesTranslations.$inferInsert;

// Chapters types
export type Chapter = typeof chapters.$inferSelect;
export type InsertChapter = typeof chapters.$inferInsert;
export type UpsertChapter = typeof chapters.$inferInsert;

// Settings types
export type Setting = typeof settings.$inferSelect;
export type InsertSetting = typeof settings.$inferInsert;
export type UpsertSetting = typeof settings.$inferInsert;

// API response type with boolean isPublic for consistency
export type SettingResponse = Omit<Setting, 'isPublic'> & {
  isPublic: boolean;
};

// User Library types
export type UserLibrary = typeof userLibrary.$inferSelect;
export type InsertUserLibrary = typeof userLibrary.$inferInsert;
export type UpsertUserLibrary = typeof userLibrary.$inferInsert;

// User Follows types
export type UserFollow = typeof userFollows.$inferSelect;
export type InsertUserFollow = typeof userFollows.$inferInsert;

// Comments types
export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;
export type UpdateComment = typeof comments.$inferInsert;

// Comment with user info for API responses
export type CommentWithUser = Comment & {
  user: {
    id: string;
    username: string | null;
    profilePicture: string | null;
    profileImageUrl: string | null;
  };
};

// Reading Progress types
export type ReadingProgress = typeof readingProgress.$inferSelect;
export type InsertReadingProgress = typeof readingProgress.$inferInsert;

// Reading Progress with series info for API responses
export type ReadingProgressWithSeries = ReadingProgress & {
  series: Series;
  chapterNumber?: string | null;
};

// Email Verification Token types
export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type InsertEmailVerificationToken = typeof emailVerificationTokens.$inferInsert;

// Password Reset Token types
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

// User Rating types
export type UserRating = typeof userRatings.$inferSelect;
export type InsertUserRating = typeof userRatings.$inferInsert;

// User Rating with user info for API responses
export type UserRatingWithUser = UserRating & {
  user: {
    id: string;
    username: string | null;
    profilePicture: string | null;
    profileImageUrl: string | null;
  };
};

// User Follows Users types
export type UserFollowUser = typeof userFollowsUsers.$inferSelect;
export type InsertUserFollowUser = typeof userFollowsUsers.$inferInsert;

// Currency Transactions types
export type CurrencyTransaction = typeof currencyTransactions.$inferSelect;
export type InsertCurrencyTransaction = typeof currencyTransactions.$inferInsert;

// Currency Packages types
export type CurrencyPackage = typeof currencyPackages.$inferSelect;
export type InsertCurrencyPackage = typeof currencyPackages.$inferInsert;

// User Purchases types
export type UserPurchase = typeof userPurchases.$inferSelect;
export type InsertUserPurchase = typeof userPurchases.$inferInsert;

// Chapter Access Control types
export type ChapterAccessControl = typeof chapterAccessControl.$inferSelect;
export type InsertChapterAccessControl = typeof chapterAccessControl.$inferInsert;

// User Chapter Unlocks types
export type UserChapterUnlock = typeof userChapterUnlocks.$inferSelect;
export type InsertUserChapterUnlock = typeof userChapterUnlocks.$inferInsert;

// Subscription Packages table for VIP/Premium memberships
export const subscriptionPackages = sqliteTable("subscription_packages", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  name: text("name").notNull(), // "Basic VIP", "Premium VIP", "Elite VIP"
  description: text("description"),
  priceUSD: text("price_usd").notNull(), // Monthly price
  billingCycle: text("billing_cycle").notNull().default("monthly"), // monthly, yearly
  stripePriceId: text("stripe_price_id"), // Stripe recurring price ID
  features: text("features"), // JSON array of feature descriptions
  coinBonus: integer("coin_bonus").default(0), // Monthly coin bonus for subscribers
  discountPercentage: integer("discount_percentage").default(0), // Discount on coin purchases
  isAdFree: text("is_ad_free").notNull().default("false"), // "true" or "false"
  earlyAccess: text("early_access").notNull().default("false"), // "true" or "false" - early chapter access
  exclusiveContent: text("exclusive_content").notNull().default("false"), // "true" or "false"
  trialDays: integer("trial_days").notNull().default(0), // Free trial period in days
  isActive: text("is_active").notNull().default("true"), // "true" or "false"
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => ({
  activeDisplayIdx: index("subscription_packages_active_display_idx").on(table.isActive, table.displayOrder),
}));

// User Subscriptions table for tracking active memberships
export const userSubscriptions = sqliteTable("user_subscriptions", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  packageId: text("package_id").references(() => subscriptionPackages.id, { onDelete: "set null" }),
  stripeCustomerId: text("stripe_customer_id"), // Stripe customer ID
  stripeSubscriptionId: text("stripe_subscription_id"), // Stripe subscription ID
  status: text("status").notNull().default("active"), // active, cancelled, expired, past_due
  currentPeriodStart: text("current_period_start"),
  currentPeriodEnd: text("current_period_end"),
  cancelAtPeriodEnd: text("cancel_at_period_end").notNull().default("false"), // "true" or "false"
  trialStartDate: text("trial_start_date"), // When trial period started
  trialEndDate: text("trial_end_date"), // When trial period ends
  isTrialActive: text("is_trial_active").notNull().default("false"), // "true" if currently in trial
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => ({
  userStatusIdx: index("user_subscriptions_user_status_idx").on(table.userId, table.status),
  stripeSubscriptionIdx: uniqueIndex("stripe_subscription_idx").on(table.stripeSubscriptionId),
}));

// Daily Rewards table for daily login bonuses
export const dailyRewards = sqliteTable("daily_rewards", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  day: integer("day").notNull().unique(), // Day 1, 2, 3, etc.
  coinReward: integer("coin_reward").notNull(),
  bonusMultiplier: text("bonus_multiplier").default("1"), // e.g., "1.5" for 50% bonus on day 7
  isSpecial: text("is_special").notNull().default("false"), // "true" for milestone days
  specialDescription: text("special_description"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// User Daily Claims table for tracking daily reward claims
export const userDailyClaims = sqliteTable("user_daily_claims", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  claimDate: text("claim_date").notNull(), // YYYY-MM-DD format
  day: integer("day").notNull(), // Current streak day
  coinsEarned: integer("coins_earned").notNull(),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
}, (table) => ({
  userDateIdx: uniqueIndex("user_daily_claims_user_date_idx").on(table.userId, table.claimDate),
  userIdx: index("user_daily_claims_user_idx").on(table.userId),
}));

// Achievements table for gamification
export const achievements = sqliteTable("achievements", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(), // reading, social, purchasing, milestone
  requirement: text("requirement").notNull(), // JSON describing requirement
  coinReward: integer("coin_reward").default(0),
  badgeIcon: text("badge_icon"), // Icon URL or emoji
  isHidden: text("is_hidden").notNull().default("false"), // "true" for secret achievements
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// User Achievements table for tracking earned achievements
export const userAchievements = sqliteTable("user_achievements", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  achievementId: text("achievement_id").notNull().references(() => achievements.id, { onDelete: "cascade" }),
  earnedAt: text("earned_at").default(sql`(datetime('now'))`),
  progress: text("progress"), // JSON for tracking partial progress
}, (table) => ({
  uniqueUserAchievement: uniqueIndex("unique_user_achievement").on(table.userId, table.achievementId),
  userIdx: index("user_achievements_user_idx").on(table.userId),
}));

// Referral Codes table for referral system
export const referralCodes = sqliteTable("referral_codes", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  uses: integer("uses").notNull().default(0),
  maxUses: integer("max_uses"), // null for unlimited
  coinRewardReferrer: integer("coin_reward_referrer").default(100), // Coins for referrer
  coinRewardReferred: integer("coin_reward_referred").default(50), // Coins for new user
  expiresAt: text("expires_at"),
  isActive: text("is_active").notNull().default("true"), // "true" or "false"
  createdAt: text("created_at").default(sql`(datetime('now'))`),
}, (table) => ({
  userIdx: index("referral_codes_user_idx").on(table.userId),
  codeIdx: uniqueIndex("referral_codes_code_idx").on(table.code),
}));

// Referrals table for tracking successful referrals
export const referrals = sqliteTable("referrals", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  referrerId: text("referrer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  referredId: text("referred_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  codeId: text("code_id").references(() => referralCodes.id, { onDelete: "set null" }),
  referrerRewardAmount: integer("referrer_reward_amount").default(0),
  referredRewardAmount: integer("referred_reward_amount").default(0),
  status: text("status").notNull().default("completed"), // pending, completed
  createdAt: text("created_at").default(sql`(datetime('now'))`),
}, (table) => ({
  referrerIdx: index("referrals_referrer_idx").on(table.referrerId),
  referredIdx: index("referrals_referred_idx").on(table.referredId),
}));

// Flash Sales table for limited-time offers
export const flashSales = sqliteTable("flash_sales", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(), // coin_package, subscription, bundle
  targetId: text("target_id"), // ID of the package/subscription being discounted
  discountPercentage: integer("discount_percentage").notNull(),
  originalPrice: text("original_price").notNull(),
  salePrice: text("sale_price").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  maxPurchases: integer("max_purchases"), // null for unlimited
  currentPurchases: integer("current_purchases").default(0),
  isActive: text("is_active").notNull().default("true"), // "true" or "false"
  createdAt: text("created_at").default(sql`(datetime('now'))`),
}, (table) => ({
  activeTimeIdx: index("flash_sales_active_time_idx").on(table.isActive, table.startTime, table.endTime),
}));

// Gift Transactions table for sending coins/subscriptions
export const giftTransactions = sqliteTable("gift_transactions", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  senderId: text("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  recipientId: text("recipient_id").references(() => users.id, { onDelete: "set null" }),
  recipientEmail: text("recipient_email"), // For gifts to non-users
  giftType: text("gift_type").notNull(), // coins, subscription, package
  giftAmount: integer("gift_amount"), // For coins
  packageId: text("package_id"), // For subscription/package gifts
  message: text("message"),
  status: text("status").notNull().default("pending"), // pending, claimed, expired
  claimedAt: text("claimed_at"),
  expiresAt: text("expires_at"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
}, (table) => ({
  senderIdx: index("gift_transactions_sender_idx").on(table.senderId),
  recipientIdx: index("gift_transactions_recipient_idx").on(table.recipientId),
  statusIdx: index("gift_transactions_status_idx").on(table.status),
}));

// Loyalty Tiers table for loyalty program
export const loyaltyTiers = sqliteTable("loyalty_tiers", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  name: text("name").notNull(),
  minPoints: integer("min_points").notNull(),
  maxPoints: integer("max_points"),
  coinBonusPercentage: integer("coin_bonus_percentage").default(0), // Bonus on purchases
  discountPercentage: integer("discount_percentage").default(0),
  perks: text("perks"), // JSON array of tier benefits
  badgeColor: text("badge_color").default("#gray"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// User Loyalty table for tracking loyalty points
export const userLoyalty = sqliteTable("user_loyalty", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  points: integer("points").notNull().default(0),
  tierId: text("tier_id").references(() => loyaltyTiers.id, { onDelete: "set null" }),
  lifetimePoints: integer("lifetime_points").notNull().default(0),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => ({
  userIdx: uniqueIndex("user_loyalty_user_idx").on(table.userId),
}));

// Battle Pass Seasons table
export const battlePassSeasons = sqliteTable("battle_pass_seasons", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  name: text("name").notNull(),
  description: text("description"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  isPremium: text("is_premium").notNull().default("false"), // "true" or "false"
  priceUSD: text("price_usd"),
  isActive: text("is_active").notNull().default("true"), // "true" or "false"
  createdAt: text("created_at").default(sql`(datetime('now'))`),
}, (table) => ({
  isActiveIdx: index("battle_pass_seasons_is_active_idx").on(table.isActive),
  activeDatesIdx: index("battle_pass_seasons_active_dates_idx").on(table.isActive, table.startDate, table.endDate),
}));

// Battle Pass Rewards table
export const battlePassRewards = sqliteTable("battle_pass_rewards", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  seasonId: text("season_id").notNull().references(() => battlePassSeasons.id, { onDelete: "cascade" }),
  tier: integer("tier").notNull(),
  isPremium: text("is_premium").notNull().default("false"), // "true" or "false"
  rewardType: text("reward_type").notNull(), // coins, avatar, badge, unlock
  rewardValue: text("reward_value").notNull(), // JSON or amount
  createdAt: text("created_at").default(sql`(datetime('now'))`),
}, (table) => ({
  seasonTierIdx: index("battle_pass_rewards_season_tier_idx").on(table.seasonId, table.tier),
}));

// User Battle Pass Progress table
export const userBattlePassProgress = sqliteTable("user_battle_pass_progress", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  seasonId: text("season_id").notNull().references(() => battlePassSeasons.id, { onDelete: "cascade" }),
  currentTier: integer("current_tier").notNull().default(0),
  experience: integer("experience").notNull().default(0),
  isPremium: text("is_premium").notNull().default("false"), // "true" if user bought premium pass
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => ({
  uniqueUserSeason: uniqueIndex("unique_user_season").on(table.userId, table.seasonId),
}));

// Subscription Packages types
export type SubscriptionPackage = typeof subscriptionPackages.$inferSelect;
export type InsertSubscriptionPackage = typeof subscriptionPackages.$inferInsert;

// User Subscriptions types
export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertUserSubscription = typeof userSubscriptions.$inferInsert;

// Daily Rewards types
export type DailyReward = typeof dailyRewards.$inferSelect;
export type InsertDailyReward = typeof dailyRewards.$inferInsert;

// User Daily Claims types
export type UserDailyClaim = typeof userDailyClaims.$inferSelect;
export type InsertUserDailyClaim = typeof userDailyClaims.$inferInsert;

// Achievements types
export type Achievement = typeof achievements.$inferSelect;
export type InsertAchievement = typeof achievements.$inferInsert;

// User Achievements types
export type UserAchievement = typeof userAchievements.$inferSelect;
export type InsertUserAchievement = typeof userAchievements.$inferInsert;

// Referral Codes types
export type ReferralCode = typeof referralCodes.$inferSelect;
export type InsertReferralCode = typeof referralCodes.$inferInsert;

// Referrals types
export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = typeof referrals.$inferInsert;

// Flash Sales types
export type FlashSale = typeof flashSales.$inferSelect;
export type InsertFlashSale = typeof flashSales.$inferInsert;

// Gift Transactions types
export type GiftTransaction = typeof giftTransactions.$inferSelect;
export type InsertGiftTransaction = typeof giftTransactions.$inferInsert;

// Loyalty Tiers types
export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type InsertLoyaltyTier = typeof loyaltyTiers.$inferInsert;

// User Loyalty types
export type UserLoyalty = typeof userLoyalty.$inferSelect;
export type InsertUserLoyalty = typeof userLoyalty.$inferInsert;

// Battle Pass types
export type BattlePassSeason = typeof battlePassSeasons.$inferSelect;
export type InsertBattlePassSeason = typeof battlePassSeasons.$inferInsert;

export type BattlePassReward = typeof battlePassRewards.$inferSelect;
export type InsertBattlePassReward = typeof battlePassRewards.$inferInsert;

export type UserBattlePassProgress = typeof userBattlePassProgress.$inferSelect;
export type InsertUserBattlePassProgress = typeof userBattlePassProgress.$inferInsert;

// DMCA Notices table for copyright takedown requests
export const dmcaNotices = sqliteTable("dmca_notices", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  copyrightWork: text("copyright_work").notNull(),
  infringingUrl: text("infringing_url").notNull(),
  description: text("description"),
  signature: text("signature").notNull(),
  ipAddress: text("ip_address"), // Track IP for fraud prevention
  goodFaithDeclaration: text("good_faith_declaration").notNull(), // Required: "true" under 17 U.S.C. §512(c)(3)(A)(v)
  accuracyDeclaration: text("accuracy_declaration").notNull(), // Required: "true" under penalty of perjury 17 U.S.C. §512(c)(3)(A)(vi)
  status: text("status").notNull().default("pending"), // pending, under_review, completed, rejected
  reviewedBy: text("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewNotes: text("review_notes"),
  reviewedAt: text("reviewed_at"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => ({
  statusIdx: index("dmca_status_idx").on(table.status),
  emailIdx: index("dmca_email_idx").on(table.email),
  createdIdx: index("dmca_created_idx").on(table.createdAt),
}));

// DMCA Notices types
export type DmcaNotice = typeof dmcaNotices.$inferSelect;
export type InsertDmcaNotice = typeof dmcaNotices.$inferInsert;

// Coupons table for discount codes
export const coupons = sqliteTable("coupons", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  code: text("code").notNull().unique(), // Unique coupon code
  type: text("type").notNull(), // percentage, fixed
  value: text("value").notNull(), // Discount value (percentage or fixed amount)
  minPurchaseAmount: text("min_purchase_amount"), // Minimum purchase required (USD)
  maxUses: integer("max_uses"), // Maximum uses (null = unlimited)
  currentUses: integer("current_uses").notNull().default(0), // Current usage count
  expiresAt: text("expires_at"), // Expiration date (null = no expiration)
  isActive: text("is_active").notNull().default("true"), // "true" or "false"
  createdAt: text("created_at").default(sql`(datetime('now'))`),
}, (table) => ({
  codeIdx: uniqueIndex("coupons_code_idx").on(table.code),
  activeIdx: index("coupons_active_idx").on(table.isActive),
}));

// Coupon Redemptions table for tracking coupon usage
export const couponRedemptions = sqliteTable("coupon_redemptions", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  couponId: text("coupon_id").notNull().references(() => coupons.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  purchaseId: text("purchase_id").references(() => userPurchases.id, { onDelete: "set null" }),
  discountAmount: text("discount_amount").notNull(), // Actual discount applied (USD)
  createdAt: text("created_at").default(sql`(datetime('now'))`),
}, (table) => ({
  couponUserIdx: index("coupon_redemptions_coupon_user_idx").on(table.couponId, table.userId),
  purchaseIdx: index("coupon_redemptions_purchase_idx").on(table.purchaseId),
}));

// Package Bundles table for bundled offers
export const packageBundles = sqliteTable("package_bundles", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  name: text("name").notNull(), // Bundle name
  description: text("description"),
  bundleType: text("bundle_type").notNull(), // currency, subscription, chapter, mixed
  priceUSD: text("price_usd").notNull(), // Bundle price
  items: text("items").notNull(), // JSON array of bundle items with quantities
  isActive: text("is_active").notNull().default("true"), // "true" or "false"
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => ({
  activeDisplayIdx: index("package_bundles_active_display_idx").on(table.isActive, table.displayOrder),
}));

// Invoices table for purchase records
export const invoices = sqliteTable("invoices", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  purchaseId: text("purchase_id").references(() => userPurchases.id, { onDelete: "set null" }),
  invoiceNumber: text("invoice_number").notNull().unique(), // INV-20250101-0001 format
  totalAmount: text("total_amount").notNull(), // Total before tax/discount (USD)
  taxAmount: text("tax_amount").notNull().default("0.00"), // Tax amount (USD)
  discountAmount: text("discount_amount").notNull().default("0.00"), // Discount from coupon (USD)
  finalAmount: text("final_amount").notNull(), // Final amount charged (USD)
  status: text("status").notNull().default("draft"), // draft, issued, paid, voided
  pdfPath: text("pdf_path"), // Path to generated PDF invoice
  createdAt: text("created_at").default(sql`(datetime('now'))`),
}, (table) => ({
  userIdx: index("invoices_user_idx").on(table.userId),
  invoiceNumberIdx: uniqueIndex("invoices_number_idx").on(table.invoiceNumber),
  purchaseIdx: index("invoices_purchase_idx").on(table.purchaseId),
}));

// Invoice Items table for detailed line items
export const invoiceItems = sqliteTable("invoice_items", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  invoiceId: text("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  itemType: text("item_type").notNull(), // currency_package, subscription, bundle, chapter_unlock
  itemId: text("item_id"), // Reference to the actual item (package/subscription/etc)
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: text("unit_price").notNull(), // Price per unit (USD)
  totalPrice: text("total_price").notNull(), // Total for this line item (USD)
}, (table) => ({
  invoiceIdx: index("invoice_items_invoice_idx").on(table.invoiceId),
}));

// Manual Assignments table for admin-granted packages
export const manualAssignments = sqliteTable("manual_assignments", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  packageId: text("package_id").notNull(), // ID of package/subscription
  packageType: text("package_type").notNull(), // currency, subscription, bundle
  assignedBy: text("assigned_by").notNull().references(() => users.id, { onDelete: "set null" }),
  reason: text("reason").notNull(), // Admin reason for assignment
  expiresAt: text("expires_at"), // Expiration date (null = no expiration)
  isActive: text("is_active").notNull().default("true"), // "true" or "false"
  createdAt: text("created_at").default(sql`(datetime('now'))`),
}, (table) => ({
  userIdx: index("manual_assignments_user_idx").on(table.userId),
  assignedByIdx: index("manual_assignments_assigned_by_idx").on(table.assignedBy),
  activeIdx: index("manual_assignments_active_idx").on(table.isActive),
}));

// Coupons types
export type Coupon = typeof coupons.$inferSelect;
export type InsertCoupon = typeof coupons.$inferInsert;

// Coupon Redemptions types
export type CouponRedemption = typeof couponRedemptions.$inferSelect;
export type InsertCouponRedemption = typeof couponRedemptions.$inferInsert;

// Package Bundles types
export type PackageBundle = typeof packageBundles.$inferSelect;
export type InsertPackageBundle = typeof packageBundles.$inferInsert;

// Invoices types
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

// Invoice Items types
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type InsertInvoiceItem = typeof invoiceItems.$inferInsert;

// Manual Assignments types
export type ManualAssignment = typeof manualAssignments.$inferSelect;
export type InsertManualAssignment = typeof manualAssignments.$inferInsert;

// Advertisements table for ad management system
export const advertisements = sqliteTable("advertisements", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  title: text("title").notNull(), // Ad title/name
  description: text("description"), // Optional ad description
  imageUrl: text("image_url").notNull(), // URL/path to ad image
  linkUrl: text("link_url").notNull(), // Where ad navigates on click
  type: text("type").notNull(), // banner, sidebar, popup, inline
  placement: text("placement"), // Legacy field for backward compatibility (auto-generated from page_location)
  page: text("page").notNull(), // homepage, manga_detail, reader, search_results - which page to display on
  location: text("location").notNull(), // top_banner, bottom_banner, sidebar, in_content_1, in_content_2 - specific position on page
  isActive: text("is_active").notNull().default("true"), // "true" or "false" - enable/disable
  startDate: text("start_date"), // Scheduling start (nullable) - ISO datetime string
  endDate: text("end_date"), // Scheduling end (nullable) - ISO datetime string
  displayOrder: integer("display_order").notNull().default(0), // Priority ordering
  clickCount: integer("click_count").notNull().default(0), // Analytics: click tracking
  impressionCount: integer("impression_count").notNull().default(0), // Analytics: impression tracking
  variantGroup: text("variant_group"), // A/B testing: groups related ad variants together (nullable)
  variantName: text("variant_name"), // A/B testing: identifies specific variant (A, B, C, etc.) (nullable)
  // Advanced Targeting
  targetCountries: text("target_countries"), // JSON array of country codes (null = all countries)
  targetDeviceTypes: text("target_device_types"), // JSON array: ["mobile", "tablet", "desktop"] (null = all devices)
  targetUserRoles: text("target_user_roles"), // JSON array: ["user", "premium", "admin"] (null = all roles)
  targetLanguages: text("target_languages"), // JSON array of language codes (null = all languages)
  // Performance & Budget
  budget: text("budget"), // Max budget for paid ads (USD, stored as text for precision)
  costPerClick: text("cost_per_click"), // CPC for paid ads (USD)
  costPerImpression: text("cost_per_impression"), // CPM for paid ads (USD)
  conversionGoal: text("conversion_goal"), // click, signup, purchase, download
  conversionCount: integer("conversion_count").notNull().default(0), // Tracked conversions
  // Frequency & Delivery
  frequencyCap: integer("frequency_cap"), // Max impressions per user per day (null = unlimited)
  dailyBudget: text("daily_budget"), // Daily spending limit (USD)
  totalBudgetSpent: text("total_budget_spent").default("0.00"), // Total amount spent
  // Additional metadata
  tags: text("tags"), // JSON array of tags for organization
  notes: text("notes"), // Internal notes for admins
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => ({
  pageLocationActiveIdx: index("ads_page_location_active_idx").on(table.page, table.location, table.isActive),
  displayOrderIdx: index("ads_display_order_idx").on(table.displayOrder),
  activeIdx: index("ads_active_idx").on(table.isActive),
  variantGroupIdx: index("ads_variant_group_idx").on(table.variantGroup),
}));

// Advertisements types
export type Advertisement = typeof advertisements.$inferSelect;
export type InsertAdvertisement = typeof advertisements.$inferInsert;

// Ad Campaigns table for grouping advertisements
export const adCampaigns = sqliteTable("ad_campaigns", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  name: text("name").notNull(), // Campaign name
  description: text("description"), // Optional description
  status: text("status").notNull().default("draft"), // draft, active, paused, completed, archived
  budget: text("budget"), // Total budget in USD (stored as text for precision)
  spentAmount: text("spent_amount").notNull().default("0.00"), // Amount spent so far
  startDate: text("start_date"), // Campaign start date
  endDate: text("end_date"), // Campaign end date
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => ({
  statusIdx: index("ad_campaigns_status_idx").on(table.status),
  createdByIdx: index("ad_campaigns_created_by_idx").on(table.createdBy),
}));

// Ad Campaigns types
export type AdCampaign = typeof adCampaigns.$inferSelect;
export type InsertAdCampaign = typeof adCampaigns.$inferInsert;

// Update advertisements table reference to campaign
export const advertisementsWithCampaign = sqliteTable("advertisements_v2", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  campaignId: text("campaign_id").references(() => adCampaigns.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url").notNull(),
  linkUrl: text("link_url").notNull(),
  type: text("type").notNull(),
  placement: text("placement"), // Made nullable for backward compatibility with page + location system
  isActive: text("is_active").notNull().default("true"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  displayOrder: integer("display_order").notNull().default(0),
  clickCount: integer("click_count").notNull().default(0),
  impressionCount: integer("impression_count").notNull().default(0),
  status: text("status").notNull().default("approved"), // draft, pending, approved, rejected
  reviewedBy: text("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewNotes: text("review_notes"),
  reviewedAt: text("reviewed_at"),
  weight: integer("weight").notNull().default(1), // Rotation weight (higher = more frequent)
  frequencyCap: integer("frequency_cap"), // Max impressions per user per day (nullable = unlimited)
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => ({
  campaignIdx: index("ads_v2_campaign_idx").on(table.campaignId),
  placementActiveIdx: index("ads_v2_placement_active_idx").on(table.placement, table.isActive),
  statusIdx: index("ads_v2_status_idx").on(table.status),
}));

// Ad Performance History table for tracking metrics over time
export const adPerformanceHistory = sqliteTable("ad_performance_history", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  adId: text("ad_id").notNull().references(() => advertisements.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // Date in YYYY-MM-DD format
  impressions: integer("impressions").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  ctr: text("ctr"), // Click-through rate (stored as text for precision)
  conversionCount: integer("conversion_count").notNull().default(0), // Conversions tracked
  spend: text("spend"), // Amount spent this day (for paid campaigns)
  variantName: text("variant_name"), // A/B testing: track which variant generated the performance (nullable)
  createdAt: text("created_at").default(sql`(datetime('now'))`),
}, (table) => ({
  adDateIdx: uniqueIndex("ad_performance_ad_date_idx").on(table.adId, table.date),
  adIdx: index("ad_performance_ad_idx").on(table.adId),
  dateIdx: index("ad_performance_date_idx").on(table.date),
  variantNameIdx: index("ad_performance_variant_name_idx").on(table.variantName),
}));

// Ad Performance History types
export type AdPerformanceHistory = typeof adPerformanceHistory.$inferSelect;
export type InsertAdPerformanceHistory = typeof adPerformanceHistory.$inferInsert;

// Ad Assets table for multi-device responsive images
export const adAssets = sqliteTable("ad_assets", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  adId: text("ad_id").notNull().references(() => advertisements.id, { onDelete: "cascade" }),
  deviceType: text("device_type").notNull(), // mobile, tablet, desktop, all
  imageUrl: text("image_url").notNull(), // Path to device-specific image
  width: integer("width"), // Image width in pixels
  height: integer("height"), // Image height in pixels
  fileSize: integer("file_size"), // File size in bytes
  isPrimary: text("is_primary").notNull().default("false"), // "true" for primary asset
  createdAt: text("created_at").default(sql`(datetime('now'))`),
}, (table) => ({
  adDeviceIdx: index("ad_assets_ad_device_idx").on(table.adId, table.deviceType),
  adIdx: index("ad_assets_ad_idx").on(table.adId),
}));

// Ad Assets types
export type AdAsset = typeof adAssets.$inferSelect;
export type InsertAdAsset = typeof adAssets.$inferInsert;

// Ad Compliance table for content moderation and policy checks
export const adCompliance = sqliteTable("ad_compliance", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  adId: text("ad_id").notNull().references(() => advertisements.id, { onDelete: "cascade" }),
  checkType: text("check_type").notNull(), // content_policy, brand_safety, prohibited_content, manual_review
  status: text("status").notNull().default("pending"), // pending, approved, flagged, rejected
  flagReason: text("flag_reason"), // Reason if flagged/rejected
  checkedBy: text("checked_by").references(() => users.id, { onDelete: "set null" }), // Admin who reviewed
  autoCheckResult: text("auto_check_result"), // JSON result from automated checks
  checkedAt: text("checked_at").default(sql`(datetime('now'))`),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
}, (table) => ({
  adStatusIdx: index("ad_compliance_ad_status_idx").on(table.adId, table.status),
  adIdx: index("ad_compliance_ad_idx").on(table.adId),
}));

// Ad Compliance types
export type AdCompliance = typeof adCompliance.$inferSelect;
export type InsertAdCompliance = typeof adCompliance.$inferInsert;

// Ad User Impressions table for frequency capping
export const adUserImpressions = sqliteTable("ad_user_impressions", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  adId: text("ad_id").notNull().references(() => advertisements.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }), // Nullable for anonymous users
  sessionId: text("session_id"), // For anonymous tracking
  impressionDate: text("impression_date").notNull(), // Date in YYYY-MM-DD format
  impressionCount: integer("impression_count").notNull().default(1),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => ({
  adUserDateIdx: uniqueIndex("ad_user_impressions_ad_user_date_idx").on(table.adId, table.userId, table.impressionDate),
  adSessionDateIdx: index("ad_user_impressions_ad_session_date_idx").on(table.adId, table.sessionId, table.impressionDate),
}));

// Ad User Impressions types
export type AdUserImpression = typeof adUserImpressions.$inferSelect;
export type InsertAdUserImpression = typeof adUserImpressions.$inferInsert;

// Ad Alerts table for monitoring and notifications
export const adAlerts = sqliteTable("ad_alerts", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  adId: text("ad_id").references(() => advertisements.id, { onDelete: "cascade" }),
  campaignId: text("campaign_id").references(() => adCampaigns.id, { onDelete: "cascade" }),
  alertType: text("alert_type").notNull(), // low_performance, budget_warning, compliance_flag, expiring_soon
  severity: text("severity").notNull().default("info"), // info, warning, critical
  message: text("message").notNull(),
  isRead: text("is_read").notNull().default("false"),
  isResolved: text("is_resolved").notNull().default("false"),
  resolvedBy: text("resolved_by").references(() => users.id, { onDelete: "set null" }),
  resolvedAt: text("resolved_at"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
}, (table) => ({
  adIdx: index("ad_alerts_ad_idx").on(table.adId),
  campaignIdx: index("ad_alerts_campaign_idx").on(table.campaignId),
  severityIdx: index("ad_alerts_severity_idx").on(table.severity),
  isResolvedIdx: index("ad_alerts_is_resolved_idx").on(table.isResolved),
}));

// Ad Alerts types
export type AdAlert = typeof adAlerts.$inferSelect;
export type InsertAdAlert = typeof adAlerts.$inferInsert;

// Ad Templates table for pre-built ad templates
export const adTemplates = sqliteTable("ad_templates", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  name: text("name").notNull(), // Template name
  description: text("description"),
  type: text("type").notNull(), // banner, sidebar, popup, inline
  category: text("category").notNull(), // manga_promotion, sponsor, announcement, partner
  thumbnailUrl: text("thumbnail_url"), // Preview image
  defaultConfig: text("default_config"), // JSON with default settings
  isActive: text("is_active").notNull().default("true"),
  usageCount: integer("usage_count").notNull().default(0),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
}, (table) => ({
  typeIdx: index("ad_templates_type_idx").on(table.type),
  categoryIdx: index("ad_templates_category_idx").on(table.category),
}));

// Ad Templates types
export type AdTemplate = typeof adTemplates.$inferSelect;
export type InsertAdTemplate = typeof adTemplates.$inferInsert;

// Legacy schemas for backward compatibility
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
  profilePicture: true,
  country: true,
  isAdmin: true,
});

export const loginUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

// Modern signup schema with email and profile picture
export const signupUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(30, "Username must be less than 30 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(100, "Password too long"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
  country: z.string().optional(),
  profilePicture: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export type InsertUser = z.infer<typeof insertUserSchema>;

export const safeUserSchema = insertUserSchema.pick({ 
  username: true,
  email: true,
  profilePicture: true,
  country: true 
}).extend({
  id: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  profileImageUrl: z.string().optional(),
  role: z.enum(["user", "premium", "staff", "admin", "owner"]).default("user"),
  createdAt: z.string().optional(), // Stored as TEXT in SQLite
  updatedAt: z.string().optional(), // Stored as TEXT in SQLite
});

// User update schema with role management (admin/owner only)
export const updateUserRoleSchema = z.object({
  role: z.enum(["user", "premium", "staff", "admin", "owner"]),
});

// Series validation schemas
export const insertSeriesSchema = createInsertSchema(series, {
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().max(2000, "Description too long").optional(),
  author: z.string().max(100, "Author name too long").optional(),
  artist: z.string().max(100, "Artist name too long").optional(),
  status: z.enum(["ongoing", "completed", "hiatus", "cancelled"]).default("ongoing"),
  type: z.enum(["manga", "manhwa", "manhua", "webtoon"]).default("manga"),
  genres: z.array(z.string()).optional().transform(val => val ? JSON.stringify(val) : undefined), // Convert array to JSON string for SQLite storage
  coverImageUrl: z.string().refine(
    (val) => val === undefined || val.startsWith('/uploads/') || val.startsWith('/api/chapters/image/') || /^https?:\/\//.test(val),
    "Cover image must be a valid URL or upload path"
  ).optional(),
  rating: z.coerce.number().min(0, "Rating must be at least 0").max(10, "Rating cannot exceed 10").optional(),
  totalChapters: z.coerce.number().int().min(0).optional(),
  publishedYear: z.coerce.number().int().min(1900).max(new Date().getFullYear() + 5).optional(),
  isAdult: z.enum(["true", "false"]).default("false"),
  // Section assignment fields
  isFeatured: z.enum(["true", "false"]).default("false"),
  isTrending: z.enum(["true", "false"]).default("false"),
  isPopularToday: z.enum(["true", "false"]).default("false"),
  isLatestUpdate: z.enum(["true", "false"]).default("false"),
  isPinned: z.enum(["true", "false"]).default("false"),
});

// Create update schema without the transform to avoid double-serialization
export const updateSeriesSchema = insertSeriesSchema.omit({ genres: true }).partial().extend({
  genres: z.array(z.string()).optional(), // Don't transform here - let storage layer handle serialization
});

// Languages validation schemas
export const insertLanguageSchema = createInsertSchema(languages, {
  code: z.string().min(2, "Language code must be at least 2 characters").max(5, "Language code too long").regex(/^[a-z]{2}(-[A-Z]{2})?$/, "Invalid language code format (e.g., en, es, ja, en-US)"),
  name: z.string().min(1, "Language name is required").max(100, "Language name too long"),
  nativeName: z.string().min(1, "Native name is required").max(100, "Native name too long"),
  isActive: z.enum(["true", "false"]).default("true"),
  isDefault: z.enum(["true", "false"]).default("false"),
});

export const updateLanguageSchema = insertLanguageSchema.partial();

// Series Translations validation schemas
export const insertSeriesTranslationSchema = createInsertSchema(seriesTranslations, {
  seriesId: z.string().min(1, "Series ID is required"),
  languageId: z.string().min(1, "Language ID is required"),
  title: z.string().min(1, "Translated title is required").max(200, "Title too long").optional(),
  description: z.string().max(2000, "Description too long").optional(),
});

export const updateSeriesTranslationSchema = insertSeriesTranslationSchema.partial().omit({ seriesId: true, languageId: true });

// Chapters validation schemas
export const insertChapterSchema = createInsertSchema(chapters, {
  seriesId: z.string().min(1, "Series ID is required"),
  chapterNumber: z.string().min(1, "Chapter number is required").max(20, "Chapter number too long"),
  title: z.string().max(200, "Chapter title too long").optional(),
  pages: z.array(z.string()).min(1, "At least one page is required").transform(val => JSON.stringify(val)), // Convert array to JSON string
  totalPages: z.coerce.number().int().min(1, "Must have at least 1 page").optional(), // Optional - computed by storage
  coverImageUrl: z.string().refine(
    (val) => val === undefined || val.startsWith('/uploads/') || val.startsWith('/api/chapters/image/') || /^https?:\/\//.test(val),
    "Cover image must be a valid URL or upload path"
  ).optional(),
  isPublished: z.enum(["true", "false"]).default("true"),
  uploadedBy: z.string().optional(),
  requiresManualReorder: z.enum(["true", "false"]).default("false"),
  naturalSortConfidence: z.string().refine(
    (val) => val === undefined || (/^\d*\.?\d+$/.test(val) && parseFloat(val) >= 0.0 && parseFloat(val) <= 1.0),
    { message: "Natural sort confidence must be a number between 0.0 and 1.0" }
  ).default("1.0"),
});

export const updateChapterSchema = insertChapterSchema.partial();

// Settings validation schema
export const insertSettingSchema = createInsertSchema(settings, {
  category: z.enum(["site", "users", "content", "system"]),
  key: z.string().min(1, "Key is required").max(100, "Key too long"),
  value: z.string().min(0, "Value is required"),
  type: z.enum(["string", "number", "boolean", "json"]).default("string"),
  description: z.string().max(500, "Description too long").optional(),
  isPublic: z.boolean().default(false).transform(val => val ? "true" : "false"),
});

export const updateSettingSchema = insertSettingSchema.partial();

// Settings value validation schema for different types
export const settingValueSchema = z.object({
  category: z.enum(["site", "users", "content", "system"]),
  key: z.string().min(1),
  value: z.any(), // Will be validated based on type in the API endpoint
  type: z.enum(["string", "number", "boolean", "json"]).default("string"),
  description: z.string().optional(),
  isPublic: z.boolean().default(false).transform(val => val ? "true" : "false"),
});

// User Library validation schemas
export const insertUserLibrarySchema = createInsertSchema(userLibrary, {
  userId: z.string().min(1, "User ID is required"),
  seriesId: z.string().min(1, "Series ID is required"),
  status: z.enum(["reading", "completed", "plan_to_read", "on_hold", "dropped"]).default("reading"),
});

export const updateUserLibrarySchema = z.object({
  status: z.enum(["reading", "completed", "plan_to_read", "on_hold", "dropped"]),
});

// Comments validation schemas
export const insertCommentSchema = createInsertSchema(comments, {
  userId: z.string().min(1, "User ID is required"),
  seriesId: z.string().optional(),
  chapterId: z.string().optional(),
  content: z.string().min(1, "Comment cannot be empty").max(1000, "Comment cannot exceed 1000 characters"),
}).refine((data) => data.seriesId || data.chapterId, {
  message: "Comment must be for either a series or a chapter",
  path: ["seriesId"],
}).refine((data) => !(data.seriesId && data.chapterId), {
  message: "Comment cannot be for both a series and a chapter",
  path: ["seriesId"],
});

export const updateCommentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(1000, "Comment cannot exceed 1000 characters"),
});

// Reading Progress validation schemas
export const insertReadingProgressSchema = createInsertSchema(readingProgress, {
  userId: z.string().min(1, "User ID is required"),
  seriesId: z.string().min(1, "Series ID is required"),
  chapterId: z.string().optional(),
  lastReadPage: z.coerce.number().int().min(0, "Page number must be at least 0").default(0),
});

export const updateReadingProgressSchema = z.object({
  chapterId: z.string().optional(),
  lastReadPage: z.coerce.number().int().min(0, "Page number must be at least 0"),
});

// User Rating validation schemas
export const insertUserRatingSchema = createInsertSchema(userRatings, {
  userId: z.string().min(1, "User ID is required"),
  seriesId: z.string().min(1, "Series ID is required"),
  rating: z.coerce.number().int().min(1, "Rating must be at least 1").max(10, "Rating cannot exceed 10"),
  review: z.string().max(2000, "Review cannot exceed 2000 characters").optional(),
});

export const updateUserRatingSchema = z.object({
  rating: z.coerce.number().int().min(1, "Rating must be at least 1").max(10, "Rating cannot exceed 10").optional(),
  review: z.string().max(2000, "Review cannot exceed 2000 characters").optional(),
});

// Currency Transactions validation schemas
export const insertCurrencyTransactionSchema = createInsertSchema(currencyTransactions, {
  userId: z.string().min(1, "User ID is required"),
  amount: z.coerce.number().int().refine((val) => val !== 0, "Amount cannot be zero"),
  type: z.enum(["purchase", "admin_grant", "unlock_chapter", "refund", "bonus"]),
  description: z.string().min(1, "Description is required").max(500, "Description too long"),
  relatedEntityId: z.string().optional(),
});

export const selectCurrencyTransactionSchema = createSelectSchema(currencyTransactions);

// Currency Packages validation schemas
export const insertCurrencyPackageSchema = createInsertSchema(currencyPackages, {
  name: z.string().min(1, "Package name is required").max(100, "Package name too long"),
  currencyAmount: z.coerce.number().int().min(1, "Currency amount must be at least 1"),
  priceUSD: z.string().regex(/^\d+(\.\d{1,2})?$/, "Price must be a valid USD amount (e.g., 4.99)"),
  bonusPercentage: z.coerce.number().int().min(0, "Bonus percentage cannot be negative").max(100, "Bonus percentage cannot exceed 100").default(0),
  isActive: z.enum(["true", "false"]).default("true"),
  displayOrder: z.coerce.number().int().min(0, "Display order must be at least 0").default(0),
});

export const selectCurrencyPackageSchema = createSelectSchema(currencyPackages);

export const updateCurrencyPackageSchema = insertCurrencyPackageSchema.partial();

// User Purchases validation schemas
export const insertUserPurchaseSchema = createInsertSchema(userPurchases, {
  userId: z.string().min(1, "User ID is required"),
  packageId: z.string().optional(),
  amountPaid: z.string().regex(/^\d+(\.\d{1,2})?$/, "Amount must be a valid USD amount (e.g., 4.99)"),
  currencyReceived: z.coerce.number().int().min(0, "Currency received must be at least 0"),
  paymentProvider: z.string().min(1, "Payment provider is required"),
  transactionId: z.string().optional(),
  status: z.enum(["completed", "pending", "failed", "refunded"]).default("pending"),
});

export const selectUserPurchaseSchema = createSelectSchema(userPurchases);

export const updateUserPurchaseSchema = z.object({
  status: z.enum(["completed", "pending", "failed", "refunded"]),
});

// Chapter Access Control validation schemas
export const insertChapterAccessControlSchema = createInsertSchema(chapterAccessControl, {
  chapterId: z.string().min(1, "Chapter ID is required"),
  accessType: z.enum(["free", "premium", "locked"]),
  unlockCost: z.coerce.number().int().min(0, "Unlock cost cannot be negative").default(0),
  isActive: z.enum(["true", "false"]).default("true"),
});

export const selectChapterAccessControlSchema = createSelectSchema(chapterAccessControl);

export const updateChapterAccessControlSchema = insertChapterAccessControlSchema.partial().omit({ chapterId: true });

// User Chapter Unlocks validation schemas
export const insertUserChapterUnlockSchema = createInsertSchema(userChapterUnlocks, {
  userId: z.string().min(1, "User ID is required"),
  chapterId: z.string().min(1, "Chapter ID is required"),
  costPaid: z.coerce.number().int().min(0, "Cost paid cannot be negative"),
});

export const selectUserChapterUnlockSchema = createSelectSchema(userChapterUnlocks);

// Currency admin operation schemas
export const adminAddCurrencySchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  amount: z.coerce.number().int().min(1, "Amount must be at least 1"),
  description: z.string().min(1, "Description is required").max(500, "Description too long"),
  relatedEntityId: z.string().optional(),
});

export const adminDeductCurrencySchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  amount: z.coerce.number().int().min(1, "Amount must be at least 1"),
  description: z.string().min(1, "Description is required").max(500, "Description too long"),
  relatedEntityId: z.string().optional(),
});

// Reading Lists validation schemas
export const insertReadingListSchema = createInsertSchema(readingLists, {
  name: z.string().min(1, "List name is required").max(100, "Name too long"),
  description: z.string().max(500, "Description too long").optional(),
  visibility: z.enum(["private", "public"]).default("private"),
});

export const selectReadingListSchema = createSelectSchema(readingLists);
export const updateReadingListSchema = insertReadingListSchema.partial().omit({ userId: true });

export const insertReadingListItemSchema = createInsertSchema(readingListItems, {
  listId: z.string().min(1, "List ID is required"),
  seriesId: z.string().min(1, "Series ID is required"),
});

export const selectReadingListItemSchema = createSelectSchema(readingListItems);

// Advertisements enum constants - centralized for validation and parsing
export const AD_PAGES = ["homepage", "manga_detail", "reader", "search_results"] as const;
export const AD_LOCATIONS = ["top_banner", "bottom_banner", "sidebar", "in_content_1", "in_content_2"] as const;
export const AD_TYPES = ["banner", "sidebar", "popup", "inline"] as const;

// Advertisements validation schemas
export const insertAdvertisementSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().max(1000, "Description too long").optional(),
  imageUrl: z.string().url("Invalid image URL").or(z.string().startsWith("/uploads/", { message: "Image URL must be a valid URL or upload path" })),
  linkUrl: z.string().url("Invalid link URL"),
  type: z.enum(AD_TYPES, { errorMap: () => ({ message: "Invalid ad type" }) }),
  placement: z.string().optional(), // Legacy field - can be provided instead of page + location
  page: z.enum(AD_PAGES, { errorMap: () => ({ message: "Invalid page" }) }).optional(),
  location: z.enum(AD_LOCATIONS, { errorMap: () => ({ message: "Invalid location" }) }).optional(),
  isActive: z.enum(["true", "false"]).default("true"),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  displayOrder: z.coerce.number().int().min(0, "Display order must be at least 0").default(0),
  // Advanced Targeting (all optional)
  targetCountries: z.string().optional().nullable(), // JSON string array
  targetDeviceTypes: z.string().optional().nullable(), // JSON string array
  targetUserRoles: z.string().optional().nullable(), // JSON string array
  targetLanguages: z.string().optional().nullable(), // JSON string array
  // Performance & Budget (all optional)
  budget: z.string().optional().nullable(),
  costPerClick: z.string().optional().nullable(),
  costPerImpression: z.string().optional().nullable(),
  conversionGoal: z.enum(["click", "signup", "purchase", "download"]).optional().nullable(),
  frequencyCap: z.coerce.number().int().min(1).optional().nullable(),
  dailyBudget: z.string().optional().nullable(),
  // Metadata (all optional)
  tags: z.string().optional().nullable(), // JSON string array
  notes: z.string().max(5000).optional().nullable(),
}).refine((data) => {
  if (data.startDate && data.endDate) {
    return new Date(data.startDate) < new Date(data.endDate);
  }
  return true;
}, {
  message: "Start date must be before end date",
  path: ["endDate"],
}).refine((data) => {
  // Must provide either (page AND location) OR placement for backward compatibility
  const hasPageLocation = data.page && data.location;
  const hasPlacement = data.placement;
  return hasPageLocation || hasPlacement;
}, {
  message: "Must provide either (page and location) or placement",
  path: ["page"],
});

export const selectAdvertisementSchema = createSelectSchema(advertisements);

export const updateAdvertisementSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long").optional(),
  description: z.string().max(1000, "Description too long").optional(),
  imageUrl: z.string().url("Invalid image URL").or(z.string().startsWith("/uploads/", { message: "Image URL must be a valid URL or upload path" })).optional(),
  linkUrl: z.string().url("Invalid link URL").optional(),
  type: z.enum(AD_TYPES, { errorMap: () => ({ message: "Invalid ad type" }) }).optional(),
  placement: z.string().optional(), // Optional for backward compatibility (auto-generated from page_location)
  page: z.enum(AD_PAGES, { errorMap: () => ({ message: "Invalid page" }) }).optional(),
  location: z.enum(AD_LOCATIONS, { errorMap: () => ({ message: "Invalid location" }) }).optional(),
  isActive: z.enum(["true", "false"]).optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  displayOrder: z.coerce.number().int().min(0, "Display order must be at least 0").optional(),
  // Advanced Targeting (all optional)
  targetCountries: z.string().optional().nullable(),
  targetDeviceTypes: z.string().optional().nullable(),
  targetUserRoles: z.string().optional().nullable(),
  targetLanguages: z.string().optional().nullable(),
  // Performance & Budget (all optional)
  budget: z.string().optional().nullable(),
  costPerClick: z.string().optional().nullable(),
  costPerImpression: z.string().optional().nullable(),
  conversionGoal: z.enum(["click", "signup", "purchase", "download"]).optional().nullable(),
  frequencyCap: z.coerce.number().int().min(1).optional().nullable(),
  dailyBudget: z.string().optional().nullable(),
  // Metadata (all optional)
  tags: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
}).refine((data) => {
  if (data.startDate && data.endDate) {
    return new Date(data.startDate) < new Date(data.endDate);
  }
  return true;
}, {
  message: "Start date must be before end date",
  path: ["endDate"],
});

export type InsertSeriesData = z.infer<typeof insertSeriesSchema>;
export type InsertChapterData = z.infer<typeof insertChapterSchema>;

// Ad Campaigns validation schemas
const adCampaignBaseSchema = z.object({
  name: z.string().min(1, "Campaign name is required").max(200, "Campaign name too long"),
  description: z.string().max(1000, "Description too long").optional(),
  status: z.enum(["draft", "active", "paused", "completed", "archived"]).default("draft"),
  budget: z.string().regex(/^\d+(\.\d{1,2})?$/, "Budget must be a valid USD amount").optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
});

export const insertAdCampaignSchema = adCampaignBaseSchema.refine((data) => {
  if (data.startDate && data.endDate) {
    return new Date(data.startDate) < new Date(data.endDate);
  }
  return true;
}, {
  message: "Start date must be before end date",
  path: ["endDate"],
});

export const updateAdCampaignSchema = adCampaignBaseSchema.partial().refine((data) => {
  if (data.startDate && data.endDate) {
    return new Date(data.startDate) < new Date(data.endDate);
  }
  return true;
}, {
  message: "Start date must be before end date",
  path: ["endDate"],
});

// Ad Performance History validation schemas
export const insertAdPerformanceHistorySchema = z.object({
  adId: z.string().min(1, "Ad ID is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  impressions: z.coerce.number().int().min(0).default(0),
  clicks: z.coerce.number().int().min(0).default(0),
  conversionCount: z.coerce.number().int().min(0).default(0),
  spend: z.string().regex(/^\d+(\.\d{1,2})?$/, "Spend must be a valid USD amount").optional().nullable(),
});

// Ad Assets validation schemas
export const insertAdAssetSchema = z.object({
  adId: z.string().min(1, "Ad ID is required"),
  deviceType: z.enum(["mobile", "tablet", "desktop", "all"]),
  imageUrl: z.string().url("Invalid image URL").or(z.string().startsWith("/uploads/", { message: "Image URL must be a valid URL or upload path" })),
  width: z.coerce.number().int().min(1).optional().nullable(),
  height: z.coerce.number().int().min(1).optional().nullable(),
  fileSize: z.coerce.number().int().min(0).optional().nullable(),
  isPrimary: z.enum(["true", "false"]).default("false"),
});

// Ad Compliance validation schemas
export const insertAdComplianceSchema = z.object({
  adId: z.string().min(1, "Ad ID is required"),
  checkType: z.enum(["content_policy", "brand_safety", "prohibited_content", "manual_review"]),
  status: z.enum(["pending", "approved", "flagged", "rejected"]).default("pending"),
  flagReason: z.string().max(500, "Flag reason too long").optional(),
  autoCheckResult: z.string().optional(), // JSON string
});

export const updateAdComplianceSchema = z.object({
  status: z.enum(["pending", "approved", "flagged", "rejected"]),
  flagReason: z.string().max(500, "Flag reason too long").optional(),
});

// Ad Templates validation schemas
export const insertAdTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required").max(200, "Template name too long"),
  description: z.string().max(1000, "Description too long").optional(),
  type: z.enum(["banner", "sidebar", "popup", "inline"]),
  category: z.enum(["manga_promotion", "sponsor", "announcement", "partner"]),
  thumbnailUrl: z.string().url("Invalid thumbnail URL").or(z.string().startsWith("/uploads/")).optional(),
  defaultConfig: z.string().optional(), // JSON string
  isActive: z.enum(["true", "false"]).default("true"),
});

export const updateAdTemplateSchema = insertAdTemplateSchema.partial();

// Enhanced advertisement schema with approval workflow
export const insertAdvertisementWithApprovalSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().max(1000, "Description too long").optional(),
  imageUrl: z.string().url("Invalid image URL").or(z.string().startsWith("/uploads/", { message: "Image URL must be a valid URL or upload path" })),
  linkUrl: z.string().url("Invalid link URL"),
  type: z.enum(["banner", "sidebar", "popup", "inline"], { errorMap: () => ({ message: "Invalid ad type" }) }),
  page: z.enum(["homepage", "manga_detail", "reader", "search_results"], { errorMap: () => ({ message: "Invalid page" }) }),
  location: z.enum(["top_banner", "bottom_banner", "sidebar", "in_content_1", "in_content_2"], { errorMap: () => ({ message: "Invalid location" }) }),
  isActive: z.enum(["true", "false"]).default("true"),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  displayOrder: z.coerce.number().int().min(0, "Display order must be at least 0").default(0),
  campaignId: z.string().optional().nullable(),
  status: z.enum(["draft", "pending", "approved", "rejected"]).default("draft"),
  weight: z.coerce.number().int().min(1, "Weight must be at least 1").default(1),
  frequencyCap: z.coerce.number().int().min(1).optional().nullable(),
}).refine((data) => {
  if (data.startDate && data.endDate) {
    return new Date(data.startDate) < new Date(data.endDate);
  }
  return true;
}, {
  message: "Start date must be before end date",
  path: ["endDate"],
});

export const updateAdvertisementWithApprovalSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long").optional(),
  description: z.string().max(1000, "Description too long").optional(),
  imageUrl: z.string().url("Invalid image URL").or(z.string().startsWith("/uploads/", { message: "Image URL must be a valid URL or upload path" })).optional(),
  linkUrl: z.string().url("Invalid link URL").optional(),
  type: z.enum(["banner", "sidebar", "popup", "inline"], { errorMap: () => ({ message: "Invalid ad type" }) }).optional(),
  placement: z.enum(["homepage", "manga-page", "chapter-reader", "browse", "all"], { errorMap: () => ({ message: "Invalid placement" }) }).optional(),
  isActive: z.enum(["true", "false"]).optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  displayOrder: z.coerce.number().int().min(0, "Display order must be at least 0").optional(),
  campaignId: z.string().optional().nullable(),
  status: z.enum(["draft", "pending", "approved", "rejected"]).optional(),
  weight: z.coerce.number().int().min(1, "Weight must be at least 1").optional(),
  frequencyCap: z.coerce.number().int().min(1).optional().nullable(),
}).refine((data) => {
  if (data.startDate && data.endDate) {
    return new Date(data.startDate) < new Date(data.endDate);
  }
  return true;
}, {
  message: "Start date must be before end date",
  path: ["endDate"],
});

// Ad approval action schemas
export const approveAdSchema = z.object({
  reviewNotes: z.string().max(1000, "Review notes too long").optional(),
});

export const rejectAdSchema = z.object({
  reviewNotes: z.string().min(1, "Rejection reason is required").max(1000, "Review notes too long"),
});

// Coupons validation schemas
export const insertCouponSchema = z.object({
  code: z.string().min(1, "Coupon code is required").max(50, "Code too long").regex(/^[A-Z0-9_-]+$/i, "Code must contain only letters, numbers, dashes, and underscores"),
  type: z.enum(["percentage", "fixed"], { errorMap: () => ({ message: "Type must be 'percentage' or 'fixed'" }) }),
  value: z.string().regex(/^\d+(\.\d{1,2})?$/, "Value must be a valid number"),
  minPurchaseAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Minimum purchase must be a valid amount").optional().nullable(),
  maxUses: z.coerce.number().int().min(1).optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  isActive: z.enum(["true", "false"]).default("true"),
});

export const updateCouponSchema = insertCouponSchema.partial();

// Package Bundles validation schemas
export const insertPackageBundleSchema = z.object({
  name: z.string().min(1, "Bundle name is required").max(200, "Name too long"),
  description: z.string().max(1000, "Description too long").optional(),
  bundleType: z.enum(["currency", "subscription", "chapter", "mixed"]),
  priceUSD: z.string().regex(/^\d+(\.\d{1,2})?$/, "Price must be a valid USD amount"),
  items: z.string(), // JSON string
  isActive: z.enum(["true", "false"]).default("true"),
  displayOrder: z.coerce.number().int().min(0).default(0),
});

export const updatePackageBundleSchema = insertPackageBundleSchema.partial();

// Invoices validation schemas
export const insertInvoiceSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  purchaseId: z.string().optional().nullable(),
  invoiceNumber: z.string().min(1, "Invoice number is required").regex(/^INV-\d{8}-\d{4}$/, "Invalid invoice number format"),
  totalAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Total must be a valid USD amount"),
  taxAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Tax must be a valid USD amount").default("0.00"),
  discountAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Discount must be a valid USD amount").default("0.00"),
  finalAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Final amount must be a valid USD amount"),
  status: z.enum(["draft", "issued", "paid", "voided"]).default("draft"),
  pdfPath: z.string().optional().nullable(),
});

export const updateInvoiceSchema = insertInvoiceSchema.partial();

// Invoice Items validation schemas
export const insertInvoiceItemSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required"),
  itemType: z.enum(["currency_package", "subscription", "bundle", "chapter_unlock"]),
  itemId: z.string().optional().nullable(),
  description: z.string().min(1, "Description is required").max(500, "Description too long"),
  quantity: z.coerce.number().int().min(1).default(1),
  unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, "Unit price must be a valid USD amount"),
  totalPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, "Total price must be a valid USD amount"),
});

// Manual Assignments validation schemas
export const insertManualAssignmentSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  packageId: z.string().min(1, "Package ID is required"),
  packageType: z.enum(["currency", "subscription", "bundle"]),
  assignedBy: z.string().min(1, "Assigner ID is required"),
  reason: z.string().min(1, "Reason is required").max(500, "Reason too long"),
  expiresAt: z.string().datetime().optional().nullable(),
  isActive: z.enum(["true", "false"]).default("true"),
});

export const updateManualAssignmentSchema = insertManualAssignmentSchema.partial();

// User Warnings table for moderation system
export const userWarnings = sqliteTable("user_warnings", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  issuedBy: text("issued_by").notNull().references(() => users.id, { onDelete: "cascade" }), // Admin who issued the warning
  reason: text("reason").notNull(), // Reason for the warning
  severity: text("severity").notNull().default("low"), // low, medium, high, critical
  notes: text("notes"), // Additional notes from the admin
  isActive: text("is_active").notNull().default("true"), // "true" or "false" (can be dismissed)
  createdAt: text("created_at").default(sql`(datetime('now'))`),
}, (table) => ({
  userIdx: index("user_warnings_user_idx").on(table.userId),
  issuedByIdx: index("user_warnings_issued_by_idx").on(table.issuedBy),
  severityIdx: index("user_warnings_severity_idx").on(table.severity),
}));

// Admin Activity Logs table for tracking all admin actions
export const adminActivityLogs = sqliteTable("admin_activity_logs", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  adminId: text("admin_id").references(() => users.id, { onDelete: "cascade" }), // Admin who performed the action (nullable for unauthenticated events)
  action: text("action").notNull(), // Type of action: user_edit, role_change, user_delete, user_ban, user_unban, warning_issued, etc.
  targetType: text("target_type").notNull(), // Type of target: user, series, setting, etc.
  targetId: text("target_id"), // ID of the affected entity
  details: text("details"), // JSON string with action details
  ipAddress: text("ip_address"), // IP address of the admin
  userAgent: text("user_agent"), // Browser/device info
  createdAt: text("created_at").default(sql`(datetime('now'))`),
}, (table) => ({
  adminIdx: index("admin_activity_logs_admin_idx").on(table.adminId),
  actionIdx: index("admin_activity_logs_action_idx").on(table.action),
  targetIdx: index("admin_activity_logs_target_idx").on(table.targetType, table.targetId),
  createdIdx: index("admin_activity_logs_created_idx").on(table.createdAt),
}));

// Roles table for Discord-style role authority management
export const roles = sqliteTable("roles", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  name: text("name").notNull().unique(), // Role name (Owner, Admin, Staff, VIP, Premium, Member)
  description: text("description"), // Description of the role
  hierarchyLevel: integer("hierarchy_level").notNull().default(0), // Higher number = higher authority (Owner=100, Admin=80, etc.)
  color: text("color").default("#6366f1"), // Hex color for role display
  isSystem: text("is_system").notNull().default("false"), // "true" for default system roles (cannot be deleted)
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => ({
  hierarchyIdx: index("roles_hierarchy_idx").on(table.hierarchyLevel),
  nameIdx: uniqueIndex("roles_name_idx").on(table.name),
}));

// Role Permissions table for storing granular permissions per role
export const rolePermissions = sqliteTable("role_permissions", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  roleId: text("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  // User Management Permissions
  manageUsers: text("manage_users").notNull().default("false"), // Create, edit, delete users
  viewUsers: text("view_users").notNull().default("false"), // View user list and details
  banUsers: text("ban_users").notNull().default("false"), // Ban/unban users
  warnUsers: text("warn_users").notNull().default("false"), // Issue warnings to users
  assignRoles: text("assign_roles").notNull().default("false"), // Assign roles to users
  // Content Management Permissions
  manageSeries: text("manage_series").notNull().default("false"), // Create, edit, delete manga/manhwa
  manageChapters: text("manage_chapters").notNull().default("false"), // Upload, edit, delete chapters
  moderateComments: text("moderate_comments").notNull().default("false"), // Delete and moderate comments
  // Advertisement Permissions
  manageAds: text("manage_ads").notNull().default("false"), // Create, edit, delete ads
  viewAdAnalytics: text("view_ad_analytics").notNull().default("false"), // View ad performance metrics
  // Analytics Permissions
  viewAnalytics: text("view_analytics").notNull().default("false"), // View analytics dashboard
  viewDetailedAnalytics: text("view_detailed_analytics").notNull().default("false"), // View detailed analytics
  // System Configuration Permissions
  configureRoles: text("configure_roles").notNull().default("false"), // Create, edit, delete roles and permissions
  manageSettings: text("manage_settings").notNull().default("false"), // Change system settings
  viewLogs: text("view_logs").notNull().default("false"), // View admin activity logs
  // DMCA & Legal Permissions
  handleDmca: text("handle_dmca").notNull().default("false"), // Handle DMCA notices
  // Subscription & Currency Permissions
  manageSubscriptions: text("manage_subscriptions").notNull().default("false"), // Manage subscription plans
  manageCurrency: text("manage_currency").notNull().default("false"), // Adjust user currency balances
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => ({
  roleIdx: index("role_permissions_role_idx").on(table.roleId),
  uniqueRolePermissions: uniqueIndex("unique_role_permissions").on(table.roleId),
}));

// User Warnings types
export type UserWarning = typeof userWarnings.$inferSelect;
export type InsertUserWarning = typeof userWarnings.$inferInsert;

// Admin Activity Logs types
export type AdminActivityLog = typeof adminActivityLogs.$inferSelect;
export type InsertAdminActivityLog = typeof adminActivityLogs.$inferInsert;

// Roles types
export type Role = typeof roles.$inferSelect;
export type InsertRole = typeof roles.$inferInsert;

// Role Permissions types
export type RolePermissions = typeof rolePermissions.$inferSelect;
export type InsertRolePermissions = typeof rolePermissions.$inferInsert;

// User Warnings validation schemas
export const insertUserWarningSchema = createInsertSchema(userWarnings).omit({
  id: true,
  createdAt: true,
}).extend({
  reason: z.string().min(1, "Reason is required").max(500, "Reason too long"),
  severity: z.enum(["low", "medium", "high", "critical"]).default("low"),
  notes: z.string().max(1000, "Notes too long").optional(),
});

// Admin Activity Logs validation schemas
export const insertAdminActivityLogSchema = createInsertSchema(adminActivityLogs).omit({
  id: true,
  createdAt: true,
}).extend({
  action: z.string().min(1, "Action is required"),
  targetType: z.string().min(1, "Target type is required"),
  details: z.string().optional(),
});

// Roles validation schemas
export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(1, "Role name is required").max(50, "Role name too long"),
  description: z.string().max(200, "Description too long").optional(),
  hierarchyLevel: z.number().int().min(0).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format").optional(),
});

export const updateRoleSchema = insertRoleSchema.partial();

// Role Permissions validation schemas
export const insertRolePermissionsSchema = createInsertSchema(rolePermissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateRolePermissionsSchema = insertRolePermissionsSchema.partial().required({ roleId: true });
