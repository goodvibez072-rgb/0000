/**
 * Currency Balance Integrity Fix Script
 * 
 * This script:
 * 1. Recalculates user currency balances from transaction history
 * 2. Fixes any discrepancies in the database
 * 3. Generates a report of corrections made
 * 
 * Run with: npx tsx scripts/fix-currency-balances.ts
 */

import Database from 'better-sqlite3';
import path from 'path';

interface User {
  id: string;
  username: string;
  currency_balance: number;
}

interface Transaction {
  amount: number;
}

interface BalanceReport {
  userId: string;
  username: string;
  storedBalance: number;
  calculatedBalance: number;
  difference: number;
  fixed: boolean;
}

const dbPath = path.join(process.cwd(), 'data', 'database.db');
const db = new Database(dbPath);

console.log('🔍 Starting currency balance integrity check...\n');

try {
  // Get all users
  const users = db.prepare('SELECT id, username, currency_balance FROM users').all() as User[];
  console.log(`📊 Checking ${users.length} user accounts...\n`);

  const report: BalanceReport[] = [];
  let fixedCount = 0;

  for (const user of users) {
    // Calculate correct balance from transactions
    const transactions = db.prepare(
      'SELECT amount FROM currency_transactions WHERE user_id = ? ORDER BY created_at ASC'
    ).all(user.id) as Transaction[];

    const calculatedBalance = transactions.reduce((sum, txn) => sum + txn.amount, 0);
    const storedBalance = user.currency_balance ?? 0;
    const difference = storedBalance - calculatedBalance;

    if (difference !== 0) {
      console.log(`⚠️  Discrepancy found for user: ${user.username}`);
      console.log(`   Stored balance: ${storedBalance}`);
      console.log(`   Calculated balance: ${calculatedBalance}`);
      console.log(`   Difference: ${difference}`);
      console.log(`   Transaction count: ${transactions.length}`);

      // Fix the balance
      db.prepare("UPDATE users SET currency_balance = ?, updated_at = datetime('now') WHERE id = ?")
        .run(calculatedBalance, user.id);

      console.log(`   ✅ Balance corrected to ${calculatedBalance}\n`);

      report.push({
        userId: user.id,
        username: user.username,
        storedBalance,
        calculatedBalance,
        difference,
        fixed: true,
      });

      fixedCount++;
    } else if (transactions.length > 0) {
      console.log(`✅ ${user.username}: Balance correct (${storedBalance})`);
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total users checked: ${users.length}`);
  console.log(`Balances corrected: ${fixedCount}`);
  console.log(`No issues found: ${users.length - fixedCount}`);

  if (report.length > 0) {
    console.log('\n📝 Detailed corrections:');
    report.forEach((item) => {
      console.log(`   ${item.username}: ${item.storedBalance} → ${item.calculatedBalance} (${item.difference > 0 ? '+' : ''}${item.difference})`);
    });
  }

  console.log('\n✅ Currency balance integrity check complete!');

} catch (error) {
  console.error('❌ Error during integrity check:', error);
  process.exit(1);
} finally {
  db.close();
}
