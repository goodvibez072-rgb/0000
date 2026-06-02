#!/usr/bin/env npx tsx
/**
 * Database Backup Utility for MangaVerse
 * Creates timestamped backups of the SQLite database
 * Run regularly or before major operations
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';

const DB_PATH = './data/database.db';
const BACKUP_DIR = './backups';
const MAX_BACKUPS = 10; // Keep last 10 backups

interface BackupInfo {
  filename: string;
  path: string;
  timestamp: Date;
  size: number;
}

function ensureBackupDir() {
  if (!existsSync(BACKUP_DIR)) {
    console.log(`📁 Creating backup directory: ${BACKUP_DIR}`);
    mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

function getExistingBackups(): BackupInfo[] {
  if (!existsSync(BACKUP_DIR)) return [];
  
  const files = readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('database_') && f.endsWith('.db'))
    .map(f => {
      const path = join(BACKUP_DIR, f);
      const stats = statSync(path);
      return {
        filename: f,
        path,
        timestamp: stats.mtime,
        size: stats.size
      };
    })
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  
  return files;
}

function cleanupOldBackups() {
  const backups = getExistingBackups();
  
  if (backups.length <= MAX_BACKUPS) return;
  
  const toDelete = backups.slice(MAX_BACKUPS);
  console.log(`\n🧹 Cleaning up ${toDelete.length} old backup(s)...`);
  
  toDelete.forEach(backup => {
    console.log(`  Deleting: ${backup.filename}`);
    unlinkSync(backup.path);
  });
}

function verifyDatabaseIntegrity(dbPath: string): boolean {
  try {
    const db = new Database(dbPath, { readonly: true });
    const result = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
    db.close();
    return result.integrity_check === 'ok';
  } catch (error) {
    console.error('  ❌ Integrity check failed:', error);
    return false;
  }
}

async function createBackup() {
  console.log('💾 MangaVerse Database Backup\n');
  console.log('='.repeat(60));
  
  // Check if database exists
  if (!existsSync(DB_PATH)) {
    console.error(`❌ Database not found: ${DB_PATH}`);
    process.exit(1);
  }
  
  // Verify database integrity before backup
  console.log('\n🔍 Verifying database integrity...');
  if (!verifyDatabaseIntegrity(DB_PATH)) {
    console.error('❌ Database integrity check failed. Backup aborted.');
    process.exit(1);
  }
  console.log('  ✅ Database integrity: OK');
  
  // Get database size
  const dbStats = statSync(DB_PATH);
  console.log(`  Database size: ${formatBytes(dbStats.size)}`);
  
  // Ensure backup directory exists
  ensureBackupDir();
  
  // Create timestamped backup filename
  const timestamp = formatDate(new Date());
  const backupFilename = `database_${timestamp}.db`;
  const backupPath = join(BACKUP_DIR, backupFilename);
  
  console.log(`\n📦 Creating backup...`);
  console.log(`  Source: ${DB_PATH}`);
  console.log(`  Destination: ${backupPath}`);
  
  try {
    // Create backup using VACUUM INTO (proper WAL-safe method)
    const startTime = Date.now();
    const db = new Database(DB_PATH);
    db.prepare(`VACUUM INTO '${backupPath}'`).run();
    db.close();
    const duration = Date.now() - startTime;
    
    // Verify backup
    console.log('\n🔍 Verifying backup...');
    if (!verifyDatabaseIntegrity(backupPath)) {
      console.error('❌ Backup verification failed. Deleting corrupted backup.');
      unlinkSync(backupPath);
      process.exit(1);
    }
    
    const backupStats = statSync(backupPath);
    console.log(`  ✅ Backup verified successfully`);
    console.log(`  Backup size: ${formatBytes(backupStats.size)}`);
    console.log(`  Duration: ${duration}ms`);
    
    // Cleanup old backups
    cleanupOldBackups();
    
    // Show backup summary
    const backups = getExistingBackups();
    console.log(`\n📊 Backup Summary:`);
    console.log(`  Current backups: ${backups.length}/${MAX_BACKUPS}`);
    console.log(`  Total backup size: ${formatBytes(backups.reduce((sum, b) => sum + b.size, 0))}`);
    console.log(`  Latest backup: ${backupFilename}`);
    
    console.log('\n✅ Backup completed successfully!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ Backup failed:', error);
    process.exit(1);
  }
}

// Run backup
createBackup().catch(console.error);
