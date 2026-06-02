#!/usr/bin/env tsx
/**
 * Create Admin User Script
 * 
 * Manually creates an admin user with custom credentials.
 * This is useful for creating additional admin users or when
 * automatic admin creation fails.
 * Usage: npm run admin:create
 */

import readline from 'readline';
import { storage } from '../server/storage.js';

function askQuestion(question: string, hideInput = false): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    if (hideInput) {
      // Hide password input
      const stdin = process.stdin;
      (stdin as any).setRawMode(true);
      rl.question(question, (answer) => {
        (stdin as any).setRawMode(false);
        rl.close();
        console.log(''); // New line after hidden input
        resolve(answer.trim());
      });
      
      process.stdin.on('keypress', (char, key) => {
        if (key && key.name === 'return') {
          return;
        }
        process.stdout.write('*');
      });
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  if (password.length > 100) {
    return { valid: false, message: 'Password must be less than 100 characters' };
  }
  return { valid: true };
}

async function main() {
  console.log('👑 Create Admin User');
  console.log('===================');
  console.log('This script will create a new admin user with custom credentials.\n');
  
  try {
    // Check database connection
    const isConnected = await storage.validateConnection();
    if (!isConnected) {
      console.error('❌ Cannot connect to database');
      console.log('💡 Run `npm run db:verify` to check database status');
      process.exit(1);
    }
    
    // Get username
    let username: string;
    while (true) {
      username = await askQuestion('👤 Enter username: ');
      if (!username) {
        console.log('❌ Username cannot be empty');
        continue;
      }
      if (username.length < 3) {
        console.log('❌ Username must be at least 3 characters');
        continue;
      }
      if (username.length > 30) {
        console.log('❌ Username must be less than 30 characters');
        continue;
      }
      
      // Check if username exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        console.log(`❌ Username '${username}' already exists`);
        continue;
      }
      
      break;
    }
    
    // Get email
    let email: string;
    while (true) {
      email = await askQuestion('📧 Enter email: ');
      if (!email) {
        console.log('❌ Email cannot be empty');
        continue;
      }
      if (!validateEmail(email)) {
        console.log('❌ Please enter a valid email address');
        continue;
      }
      break;
    }
    
    // Get password
    let password: string;
    while (true) {
      password = await askQuestion('🔐 Enter password: ', true);
      const validation = validatePassword(password);
      if (!validation.valid) {
        console.log(`❌ ${validation.message}`);
        continue;
      }
      
      const confirmPassword = await askQuestion('🔐 Confirm password: ', true);
      if (password !== confirmPassword) {
        console.log('❌ Passwords do not match');
        continue;
      }
      
      break;
    }
    
    // Get optional country
    const country = await askQuestion('🌍 Enter country (optional): ');
    
    // Confirm creation
    console.log('\n📋 Admin User Details:');
    console.log(`👤 Username: ${username}`);
    console.log(`📧 Email: ${email}`);
    console.log(`🌍 Country: ${country || 'Not specified'}`);
    
    const confirm = await askQuestion('\n❓ Create this admin user? (y/N): ');
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('🚫 Admin user creation cancelled');
      process.exit(0);
    }
    
    // Hash password and create user
    console.log('🔄 Creating admin user...');
    const bcrypt = await import('bcryptjs');
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    const adminUser = await storage.createUser({
      username,
      email,
      password: hashedPassword,
      country: country || undefined,
      isAdmin: 'true',
      role: 'admin'
    });
    
    console.log('✅ Admin user created successfully!');
    console.log(`👤 User ID: ${adminUser.id}`);
    console.log(`📧 Username: ${adminUser.username}`);
    console.log(`📧 Email: ${adminUser.email}`);
    console.log('👑 Admin privileges: Enabled');
    
    console.log('\n🎉 The admin user can now log in to the application!');
    
  } catch (error) {
    console.error('❌ Failed to create admin user:', error);
    process.exit(1);
  }
}

main();