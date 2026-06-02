#!/usr/bin/env tsx
/**
 * SQLite Database Backup Script
 * 
 * Creates a timestamped backup of the SQLite database file.
 * Usage: npm run db:backup [backup-name]
 */

import { existsSync, mkdirSync, copyFileSync } from 'fs';
import { resolve, join } from 'path';

const DB_PATH = './data/database.db';
const BACKUP_DIR = './data/backups';

async function main() {
  const backupName = process.argv[2];
  
  // Ensure backup directory exists
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
  }
  
  // Check if database exists
  if (!existsSync(DB_PATH)) {
    console.error('❌ Database file not found at:', DB_PATH);
    console.log('💡 Run `npm run db:init` to create the database first');
    process.exit(1);
  }
  
  // Generate backup filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = backupName 
    ? `${backupName}-${timestamp}.db`
    : `backup-${timestamp}.db`;
  
  const backupPath = join(BACKUP_DIR, filename);
  
  try {
    console.log('📁 Creating database backup...');
    console.log(`📄 Source: ${resolve(DB_PATH)}`);
    console.log(`💾 Backup: ${resolve(backupPath)}`);
    
    copyFileSync(DB_PATH, backupPath);
    
    console.log('✅ Database backup created successfully!');
    console.log(`📁 Backup saved as: ${filename}`);
    
    // Show backup directory listing
    const { readdirSync, statSync } = await import('fs');
    const backups = readdirSync(BACKUP_DIR)
      .filter(file => file.endsWith('.db'))
      .map(file => {
        const stats = statSync(join(BACKUP_DIR, file));
        return {
          name: file,
          size: (stats.size / 1024).toFixed(1) + ' KB',
          date: stats.mtime.toISOString().split('T')[0]
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    
    console.log('\n📋 Available backups:');
    backups.forEach(backup => {
      console.log(`  📄 ${backup.name} (${backup.size}, ${backup.date})`);
    });
    
  } catch (error) {
    console.error('❌ Failed to create backup:', error);
    process.exit(1);
  }
}

main();