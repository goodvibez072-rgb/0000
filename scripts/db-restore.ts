#!/usr/bin/env tsx
/**
 * SQLite Database Restore Script
 * 
 * Restores the SQLite database from a backup file.
 * Usage: npm run db:restore <backup-filename>
 */

import { existsSync, copyFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';
import readline from 'readline';

const DB_PATH = './data/database.db';
const BACKUP_DIR = './data/backups';

function listBackups() {
  if (!existsSync(BACKUP_DIR)) {
    console.log('📂 No backup directory found');
    return [];
  }
  
  const backups = readdirSync(BACKUP_DIR)
    .filter(file => file.endsWith('.db'))
    .map(file => {
      const stats = statSync(join(BACKUP_DIR, file));
      return {
        name: file,
        size: (stats.size / 1024).toFixed(1) + ' KB',
        date: stats.mtime.toLocaleDateString(),
        time: stats.mtime.toLocaleTimeString()
      };
    })
    .sort((a, b) => b.name.localeCompare(a.name)); // Newest first
  
  return backups;
}

function askQuestion(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const backupFilename = process.argv[2];
  
  if (!backupFilename) {
    console.log('📋 Available backups:');
    const backups = listBackups();
    
    if (backups.length === 0) {
      console.log('❌ No backups found in ./data/backups/');
      console.log('💡 Create a backup first with: npm run db:backup');
      process.exit(1);
    }
    
    backups.forEach((backup, index) => {
      console.log(`  ${index + 1}. ${backup.name} (${backup.size}, ${backup.date} ${backup.time})`);
    });
    
    console.log('\n📚 Usage: npm run db:restore <backup-filename>');
    console.log('📚 Example: npm run db:restore backup-2023-12-25T10-30-00-000Z.db');
    process.exit(0);
  }
  
  const backupPath = join(BACKUP_DIR, backupFilename);
  
  // Check if backup file exists
  if (!existsSync(backupPath)) {
    console.error('❌ Backup file not found:', backupPath);
    console.log('\n📋 Available backups:');
    
    const backups = listBackups();
    backups.forEach(backup => {
      console.log(`  📄 ${backup.name} (${backup.size}, ${backup.date})`);
    });
    
    process.exit(1);
  }
  
  // Warn about overwriting existing database
  if (existsSync(DB_PATH)) {
    console.log('⚠️  WARNING: This will overwrite the current database!');
    console.log(`📄 Current database: ${resolve(DB_PATH)}`);
    console.log(`💾 Restore from: ${resolve(backupPath)}`);
    
    const answer = await askQuestion('\n❓ Continue with restore? (y/N): ');
    
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log('🚫 Restore cancelled');
      process.exit(0);
    }
  }
  
  try {
    console.log('🔄 Restoring database...');
    console.log(`📄 Source: ${resolve(backupPath)}`);
    console.log(`💾 Target: ${resolve(DB_PATH)}`);
    
    copyFileSync(backupPath, DB_PATH);
    
    console.log('✅ Database restored successfully!');
    console.log('💡 You may want to restart the server to reload the database');
    
  } catch (error) {
    console.error('❌ Failed to restore database:', error);
    process.exit(1);
  }
}

main();