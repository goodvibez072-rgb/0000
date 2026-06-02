#!/usr/bin/env tsx

import { storage } from '../server/storage.js';

async function promoteUserToAdmin(username: string) {
  try {
    console.log(`Promoting user '${username}' to admin...`);
    
    const user = await storage.getUserByUsername(username);
    if (!user) {
      console.error(`User '${username}' not found`);
      process.exit(1);
    }
    
    const updatedUser = await storage.updateUser(user.id, {
      isAdmin: 'true',
      role: 'admin'
    });
    
    if (updatedUser) {
      console.log(`✅ Successfully promoted '${username}' to admin`);
      console.log(`User ID: ${updatedUser.id}`);
      console.log(`Role: ${updatedUser.role}`);
      console.log(`Is Admin: ${updatedUser.isAdmin}`);
    } else {
      console.error(`Failed to promote user '${username}'`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Error promoting user:', error);
    process.exit(1);
  }
}

const username = process.argv[2];
if (!username) {
  console.error('Usage: tsx promote-user.ts <username>');
  process.exit(1);
}

promoteUserToAdmin(username);