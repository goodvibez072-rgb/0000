#!/usr/bin/env tsx
/**
 * SQLite Database Reset Script
 * 
 * Resets the database by removing the existing file,
 * running migrations, and recreating the admin user.
 * Usage: npm run db:reset
 */

import { existsSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';
import { resolve } from 'path';
import readline from 'readline';

const DB_PATH = './data/database.db';

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
  console.log('🔄 Database Reset Script');
  console.log('This will completely reset your database and recreate it from scratch.');
  
  if (existsSync(DB_PATH)) {
    console.log(`📄 Current database: ${resolve(DB_PATH)}`);
    console.log('⚠️  WARNING: All data will be permanently lost!');
    
    const answer = await askQuestion('\n❓ Are you sure you want to reset the database? (y/N): ');
    
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log('🚫 Database reset cancelled');
      process.exit(0);
    }
    
    // Create automatic backup before reset
    try {
      console.log('📁 Creating automatic backup before reset...');
      execSync('npm run db:backup reset-backup', { stdio: 'inherit' });
    } catch (error) {
      console.log('⚠️  Failed to create backup, continuing with reset...');
    }
  }
  
  try {
    // Remove existing database
    if (existsSync(DB_PATH)) {
      console.log('🗑️  Removing existing database...');
      unlinkSync(DB_PATH);
    }
    
    // Run database initialization
    console.log('🚀 Initializing fresh database...');
    console.log('📄 Running drizzle-kit push...');
    execSync('drizzle-kit push', { stdio: 'inherit' });
    
    // Initialize admin user
    console.log('👤 Creating admin user...');
    execSync('tsx scripts/init-admin.ts', { stdio: 'inherit' });
    
    console.log('\n✅ Database reset completed successfully!');
    console.log('🎉 Fresh database with admin user is ready');
    console.log('💡 You can now start the server with: npm run dev');
    
  } catch (error) {
    console.error('❌ Failed to reset database:', error);
    console.log('💡 You may need to manually delete the database file and run db:init');
    process.exit(1);
  }
}

main();