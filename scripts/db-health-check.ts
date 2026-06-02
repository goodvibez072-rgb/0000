#!/usr/bin/env npx tsx
/**
 * Database Health Check Script
 * Verifies SQLite database integrity and provides health metrics
 */

import Database from "better-sqlite3";
import { existsSync } from "fs";

const dbPath = "./data/database.db";

if (!existsSync(dbPath)) {
  console.error("❌ Database file not found:", dbPath);
  process.exit(1);
}

console.log("🔍 MangaVerse Database Health Check\n");
console.log("=" .repeat(50));

const db = new Database(dbPath, { readonly: true });

try {
  // 1. Integrity Check
  console.log("\n📋 Running PRAGMA integrity_check...");
  const integrityResult: any = db.prepare("PRAGMA integrity_check").get();
  if (integrityResult?.integrity_check === "ok") {
    console.log("✅ Database integrity: OK");
  } else {
    console.log("⚠️  Database integrity:", JSON.stringify(integrityResult));
  }

  // 2. Database Stats
  console.log("\n📊 Database Statistics:");
  const pageCount: any = db.prepare("PRAGMA page_count").get();
  const pageSize: any = db.prepare("PRAGMA page_size").get();
  const freePages: any = db.prepare("PRAGMA freelist_count").get();
  
  const totalSize = (pageCount.page_count * pageSize.page_size) / (1024 * 1024);
  const freeSize = (freePages.freelist_count * pageSize.page_size) / (1024 * 1024);
  const usedSize = totalSize - freeSize;
  
  console.log(`  Total size: ${totalSize.toFixed(2)} MB`);
  console.log(`  Used size: ${usedSize.toFixed(2)} MB`);
  console.log(`  Free space: ${freeSize.toFixed(2)} MB`);
  console.log(`  Page size: ${(pageSize.page_size / 1024).toFixed(0)} KB`);

  // 3. Performance Settings
  console.log("\n⚙️  Performance Configuration:");
  const journalMode: any = db.prepare("PRAGMA journal_mode").get();
  const synchronous: any = db.prepare("PRAGMA synchronous").get();
  const cacheSize: any = db.prepare("PRAGMA cache_size").get();
  const mmapSize: any = db.prepare("PRAGMA mmap_size").get();
  
  console.log(`  Journal mode: ${journalMode.journal_mode}`);
  console.log(`  Synchronous: ${synchronous.synchronous}`);
  console.log(`  Cache size: ${Math.abs(cacheSize.cache_size / 1000).toFixed(0)} MB`);
  console.log(`  Memory-mapped I/O: ${(mmapSize.mmap_size / (1024 * 1024)).toFixed(0)} MB`);

  // 4. Table Counts
  console.log("\n📂 Table Statistics:");
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%_fts%'
    ORDER BY name
  `).all() as Array<{ name: string }>;
  
  for (const table of tables) {
    try {
      const count: any = db.prepare(`SELECT COUNT(*) as count FROM "${table.name}"`).get();
      console.log(`  ${table.name}: ${count.count.toLocaleString()} rows`);
    } catch (err) {
      console.log(`  ${table.name}: [error reading count]`);
    }
  }

  // 5. Index Analysis
  console.log("\n🔍 Index Analysis:");
  const indexes = db.prepare(`
    SELECT name, tbl_name FROM sqlite_master 
    WHERE type='index' AND name NOT LIKE 'sqlite_%'
    ORDER BY tbl_name, name
  `).all() as Array<{ name: string; tbl_name: string }>;
  
  const indexesByTable = indexes.reduce((acc: any, idx) => {
    if (!acc[idx.tbl_name]) acc[idx.tbl_name] = [];
    acc[idx.tbl_name].push(idx.name);
    return acc;
  }, {});
  
  console.log(`  Total indexes: ${indexes.length}`);
  for (const [table, idxList] of Object.entries(indexesByTable) as any) {
    console.log(`  ${table}: ${idxList.length} index(es)`);
  }

  // 6. Quick Stats Analysis
  console.log("\n📈 Quick Stats:");
  console.log(`  ${tables.length} tables`);
  console.log(`  ${indexes.length} indexes`);
  console.log(`  Database file: ${dbPath}`);

  console.log("\n" + "=".repeat(50));
  console.log("✅ Database health check completed successfully\n");
  
} catch (error) {
  console.error("❌ Health check failed:", error);
  process.exit(1);
} finally {
  db.close();
}
