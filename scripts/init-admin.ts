#!/usr/bin/env tsx
/**
 * Initialize Admin User Script
 * 
 * This script initializes the admin user for the application.
 * It's called as part of the `db:init` process.
 */

import { initializeAdminUser } from '../server/storage.js';

async function main() {
  console.log('🚀 Initializing admin user...');
  
  try {
    await initializeAdminUser();
    console.log('✅ Admin user initialization completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to initialize admin user:', error);
    process.exit(1);
  }
}

main();