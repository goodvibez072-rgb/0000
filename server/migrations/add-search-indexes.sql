-- Database Index Optimizations for Search Performance
-- These indexes improve query performance for commonly accessed data

-- Series search optimization
-- Improves search queries that filter by title, author, and status
CREATE INDEX IF NOT EXISTS "series_title_idx" ON "series" ("title");
CREATE INDEX IF NOT EXISTS "series_author_idx" ON "series" ("author");
CREATE INDEX IF NOT EXISTS "series_status_idx" ON "series" ("status");
CREATE INDEX IF NOT EXISTS "series_type_idx" ON "series" ("type");

-- Section queries optimization
-- Improves queries that fetch series by section (featured, trending, etc.)
CREATE INDEX IF NOT EXISTS "series_featured_idx" ON "series" ("is_featured");
CREATE INDEX IF NOT EXISTS "series_trending_idx" ON "series" ("is_trending");
CREATE INDEX IF NOT EXISTS "series_popular_today_idx" ON "series" ("is_popular_today");
CREATE INDEX IF NOT EXISTS "series_latest_update_idx" ON "series" ("is_latest_update");
CREATE INDEX IF NOT EXISTS "series_pinned_idx" ON "series" ("is_pinned");

-- Ad variant optimization
-- Improves queries that filter ads by variant group
CREATE INDEX IF NOT EXISTS "ads_variant_group_idx" ON "advertisements" ("variant_group");

-- Timestamp-based query optimization
-- Improves analytics and date-range queries
CREATE INDEX IF NOT EXISTS "purchases_created_at_idx" ON "purchases" ("created_at");
CREATE INDEX IF NOT EXISTS "subscriptions_created_at_idx" ON "user_subscriptions" ("created_at");
CREATE INDEX IF NOT EXISTS "series_updated_at_idx" ON "series" ("updated_at");

-- Foreign key optimization
-- Improves join performance for common queries
CREATE INDEX IF NOT EXISTS "reading_progress_chapter_idx" ON "reading_progress" ("chapter_id");
CREATE INDEX IF NOT EXISTS "user_library_added_at_idx" ON "user_library" ("added_at");

-- Performance notes:
-- 1. These indexes improve read performance but slightly slow down writes
-- 2. SQLite automatically uses indexes for ORDER BY, WHERE, and JOIN clauses
-- 3. Composite indexes (multiple columns) are already handled by existing indexes
-- 4. Regular VACUUM and ANALYZE operations keep statistics up-to-date
