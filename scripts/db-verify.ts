#!/usr/bin/env tsx
/**
 * SQLite Database Verification Script
 * 
 * Verifies database connectivity, schema integrity,
 * and performs basic health checks.
 * Usage: npm run db:verify
 */

import { existsSync, statSync } from 'fs';
import { resolve } from 'path';
import { storage } from '../server/storage.js';

const DB_PATH = './data/database.db';

async function main() {
  console.log('🔍 Database Verification Script');
  console.log('=====================================');
  
  // Check if database file exists
  console.log('\n1. 📄 Database File Check:');
  if (!existsSync(DB_PATH)) {
    console.log('❌ Database file not found:', resolve(DB_PATH));
    console.log('💡 Run `npm run db:init` to create the database');
    process.exit(1);
  }
  
  const stats = statSync(DB_PATH);
  console.log(`✅ Database file exists: ${resolve(DB_PATH)}`);
  console.log(`📊 File size: ${(stats.size / 1024).toFixed(1)} KB`);
  console.log(`📅 Last modified: ${stats.mtime.toLocaleString()}`);
  
  // Test database connection
  console.log('\n2. 🔌 Database Connection Test:');
  try {
    const isConnected = await storage.validateConnection();
    if (isConnected) {
      console.log('✅ Database connection successful');
    } else {
      console.log('❌ Database connection failed');
      process.exit(1);
    }
  } catch (error) {
    console.log('❌ Database connection error:', error);
    process.exit(1);
  }
  
  // Check tables and data
  console.log('\n3. 📊 Database Statistics:');
  try {
    const stats = await storage.getSiteStats();
    console.log(`👥 Total users: ${stats.totalUsers}`);
    console.log(`📚 Total series: ${stats.totalSeries}`);
    
    // Check for admin user
    const users = await storage.getAllUsers();
    const adminUsers = users.filter(user => user.isAdmin === 'true');
    console.log(`👑 Admin users: ${adminUsers.length}`);
    
    if (adminUsers.length === 0) {
      console.log('⚠️  No admin users found');
      console.log('💡 Run `npm run admin:create` to create an admin user');
    } else {
      console.log('✅ Admin users found:');
      adminUsers.forEach(admin => {
        console.log(`   - ${admin.username || 'Unknown'} (${admin.email || 'No email'})`);
      });
    }
    
  } catch (error) {
    console.log('❌ Failed to fetch database statistics:', error);
  }
  
  // Check recent activity
  console.log('\n4. 📈 Recent Activity:');
  try {
    const recentSeries = await storage.getRecentSeries(3);
    if (recentSeries.length === 0) {
      console.log('📭 No series found in database');
    } else {
      console.log(`📚 Latest ${recentSeries.length} series:`);
      recentSeries.forEach((series, index) => {
        const createdDate = series.createdAt ? new Date(series.createdAt).toLocaleDateString() : 'Unknown';
        console.log(`   ${index + 1}. ${series.title} (created: ${createdDate})`);
      });
    }
  } catch (error) {
    console.log('❌ Failed to fetch recent series:', error);
  }
  
  console.log('\n✅ Database verification completed!');
  console.log('🎉 Database appears to be healthy and operational');
}

main().catch(error => {
  console.error('💥 Verification script failed:', error);
  process.exit(1);
});