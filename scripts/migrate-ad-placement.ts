import Database from "better-sqlite3";
import { join } from "path";

const dbPath = join(process.cwd(), "data", "database.db");
const db = new Database(dbPath);

console.log("[migration] Starting ad placement schema migration...");

try {
  // Check if columns already exist
  const tableInfo = db.pragma("table_info(advertisements)");
  const hasPageColumn = tableInfo.some((col: any) => col.name === "page");
  const hasLocationColumn = tableInfo.some((col: any) => col.name === "location");
  const hasPlacementColumn = tableInfo.some((col: any) => col.name === "placement");

  if (hasPageColumn && hasLocationColumn) {
    console.log("[migration] ✓ Columns 'page' and 'location' already exist. Migration complete.");
    process.exit(0);
  }

  // Start transaction
  db.exec("BEGIN TRANSACTION");

  // Add new columns if they don't exist
  if (!hasPageColumn) {
    console.log("[migration] Adding 'page' column...");
    db.exec("ALTER TABLE advertisements ADD COLUMN page TEXT NOT NULL DEFAULT 'homepage'");
  }

  if (!hasLocationColumn) {
    console.log("[migration] Adding 'location' column...");
    db.exec("ALTER TABLE advertisements ADD COLUMN location TEXT NOT NULL DEFAULT 'top_banner'");
  }

  // Migrate data from placement to page/location if placement exists
  if (hasPlacementColumn) {
    console.log("[migration] Migrating data from 'placement' to 'page' and 'location'...");
    
    // Map old placement values to new page values
    const placementMap: { [key: string]: { page: string; location: string } } = {
      'homepage': { page: 'homepage', location: 'top_banner' },
      'manga-page': { page: 'manga_detail', location: 'top_banner' },
      'chapter-reader': { page: 'reader', location: 'top_banner' },
      'browse': { page: 'search_results', location: 'top_banner' },
      'all': { page: 'homepage', location: 'top_banner' }
    };

    // Get all ads with placement values
    const ads = db.prepare("SELECT id, placement FROM advertisements WHERE placement IS NOT NULL").all();
    
    const updateStmt = db.prepare("UPDATE advertisements SET page = ?, location = ? WHERE id = ?");
    
    for (const ad: any of ads) {
      const mapping = placementMap[ad.placement] || { page: 'homepage', location: 'top_banner' };
      updateStmt.run(mapping.page, mapping.location, ad.id);
      console.log(`[migration] Updated ad ${ad.id}: ${ad.placement} → ${mapping.page}/${mapping.location}`);
    }
  }

  // Commit transaction
  db.exec("COMMIT");
  
  console.log("[migration] ✓ Schema migration completed successfully!");
  console.log("[migration] New columns 'page' and 'location' added to advertisements table");
  
} catch (error) {
  console.error("[migration] ✗ Migration failed:", error);
  db.exec("ROLLBACK");
  process.exit(1);
} finally {
  db.close();
}
