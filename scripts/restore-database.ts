#!/usr/bin/env npx tsx
/**
 * Database Restore Utility for MangaVerse
 * Restores database from a backup file
 * CAUTION: This will overwrite the current database!
 */

import { copyFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';
import * as readline from 'readline';

const DB_PATH = './data/database.db';
const BACKUP_DIR = './backups';

interface BackupInfo {
  filename: string;
  path: string;
  timestamp: Date;
  size: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(date: Date): string {
  return date.toLocaleString();
}

function getAvailableBackups(): BackupInfo[] {
  if (!existsSync(BACKUP_DIR)) {
    console.error(`❌ Backup directory not found: ${BACKUP_DIR}`);
    return [];
  }
  
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

function createBackupBeforeRestore(): string {
  console.log('\n📦 Creating safety backup of current database...');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safetyBackupPath = join(BACKUP_DIR, `database_before_restore_${timestamp}.db`);
  
  try {
    copyFileSync(DB_PATH, safetyBackupPath);
    console.log(`  ✅ Safety backup created: ${safetyBackupPath}`);
    return safetyBackupPath;
  } catch (error) {
    console.error('  ❌ Failed to create safety backup:', error);
    throw error;
  }
}

async function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

async function restoreDatabase() {
  console.log('♻️  MangaVerse Database Restore\n');
  console.log('='.repeat(60));
  
  // Get available backups
  const backups = getAvailableBackups();
  
  if (backups.length === 0) {
    console.error('❌ No backups found in:', BACKUP_DIR);
    console.log('\n💡 Create a backup first using: npm run backup:db');
    process.exit(1);
  }
  
  // Display available backups
  console.log(`\n📋 Available Backups (${backups.length}):\n`);
  backups.forEach((backup, index) => {
    console.log(`  ${index + 1}. ${backup.filename}`);
    console.log(`     Created: ${formatDate(backup.timestamp)}`);
    console.log(`     Size: ${formatBytes(backup.size)}`);
    console.log();
  });
  
  // Get backup selection from command line argument or prompt
  let selectedIndex: number;
  const argIndex = process.argv[2];
  
  if (argIndex) {
    selectedIndex = parseInt(argIndex) - 1;
    if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= backups.length) {
      console.error(`❌ Invalid backup number: ${argIndex}`);
      console.log(`   Valid range: 1-${backups.length}`);
      process.exit(1);
    }
  } else {
    const answer = await promptUser('Select backup to restore (1-' + backups.length + '): ');
    selectedIndex = parseInt(answer) - 1;
    
    if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= backups.length) {
      console.error('❌ Invalid selection');
      process.exit(1);
    }
  }
  
  const selectedBackup = backups[selectedIndex];
  console.log(`\n✅ Selected: ${selectedBackup.filename}`);
  
  // Verify backup integrity
  console.log('\n🔍 Verifying backup integrity...');
  if (!verifyDatabaseIntegrity(selectedBackup.path)) {
    console.error('❌ Backup file is corrupted. Restore aborted.');
    process.exit(1);
  }
  console.log('  ✅ Backup integrity: OK');
  
  // Warning and confirmation
  console.log('\n⚠️  WARNING: This will OVERWRITE the current database!');
  console.log('   Current database: ' + DB_PATH);
  
  if (existsSync(DB_PATH)) {
    const currentStats = statSync(DB_PATH);
    console.log('   Current size: ' + formatBytes(currentStats.size));
  }
  
  const confirm = await promptUser('\nType "YES" to confirm restore: ');
  
  if (confirm !== 'YES') {
    console.log('❌ Restore cancelled');
    process.exit(0);
  }
  
  try {
    // Create safety backup
    createBackupBeforeRestore();
    
    // Perform restore
    console.log('\n♻️  Restoring database...');
    console.log(`  Source: ${selectedBackup.path}`);
    console.log(`  Destination: ${DB_PATH}`);
    
    const startTime = Date.now();
    copyFileSync(selectedBackup.path, DB_PATH);
    const duration = Date.now() - startTime;
    
    // Verify restored database
    console.log('\n🔍 Verifying restored database...');
    if (!verifyDatabaseIntegrity(DB_PATH)) {
      console.error('❌ Restored database verification failed!');
      console.log('   Safety backup is available in backups directory');
      process.exit(1);
    }
    
    console.log('  ✅ Database verified successfully');
    console.log(`  Duration: ${duration}ms`);
    
    console.log('\n✅ Database restored successfully!');
    console.log('='.repeat(60));
    console.log('\n💡 Restart the server to use the restored database');
    
  } catch (error) {
    console.error('\n❌ Restore failed:', error);
    console.log('   Safety backup is available in backups directory');
    process.exit(1);
  }
}

// Run restore
restoreDatabase().catch(console.error);
