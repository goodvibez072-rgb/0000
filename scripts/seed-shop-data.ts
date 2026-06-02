import Database from "better-sqlite3";
import { randomBytes } from "crypto";

function generateId(): string {
  return randomBytes(16).toString('base64url');
}

const db = new Database("./data/database.db");

console.log("🌱 Seeding shop data...");

// Create VIP Subscription Packages
console.log("Creating VIP subscription packages...");
const insertVIP = db.prepare(`
  INSERT INTO subscription_packages (
    id, name, description, price_usd, billing_cycle, features, 
    coin_bonus, discount_percentage, is_ad_free, early_access, 
    exclusive_content, is_active, display_order, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
`);

const vipPackages = [
  {
    id: generateId(),
    name: 'Basic Plus',
    description: 'Essential VIP experience with ad-free reading',
    priceUSD: '4.99',
    billingCycle: 'monthly',
    features: JSON.stringify([
      'Ad-free reading experience',
      'Basic profile customization',
      '5% coin purchase bonus',
      'Priority support access'
    ]),
    coinBonus: 100,
    discountPercentage: 5,
    isAdFree: 'true',
    earlyAccess: 'false',
    exclusiveContent: 'false',
    isActive: 'true',
    displayOrder: 1
  },
  {
    id: generateId(),
    name: 'Premium VIP',
    description: 'Enhanced experience with early access',
    priceUSD: '9.99',
    billingCycle: 'monthly',
    features: JSON.stringify([
      'All Basic Plus features',
      'Early chapter access (24h)',
      '15% coin purchase bonus',
      'Exclusive Discord role',
      'Custom profile themes'
    ]),
    coinBonus: 250,
    discountPercentage: 15,
    isAdFree: 'true',
    earlyAccess: 'true',
    exclusiveContent: 'false',
    isActive: 'true',
    displayOrder: 2
  },
  {
    id: generateId(),
    name: 'Elite VIP',
    description: 'Ultimate premium experience',
    priceUSD: '19.99',
    billingCycle: 'monthly',
    features: JSON.stringify([
      'All Premium features',
      'Early chapter access (72h)',
      '25% coin purchase bonus',
      'Exclusive content access',
      'VIP badge & custom avatar frames',
      'Priority customer support',
      'Monthly exclusive rewards'
    ]),
    coinBonus: 500,
    discountPercentage: 25,
    isAdFree: 'true',
    earlyAccess: 'true',
    exclusiveContent: 'true',
    isActive: 'true',
    displayOrder: 3
  }
];

for (const pkg of vipPackages) {
  insertVIP.run(
    pkg.id, pkg.name, pkg.description, pkg.priceUSD, pkg.billingCycle,
    pkg.features, pkg.coinBonus, pkg.discountPercentage, pkg.isAdFree,
    pkg.earlyAccess, pkg.exclusiveContent, pkg.isActive, pkg.displayOrder
  );
  console.log(`✅ Created VIP package: ${pkg.name}`);
}

// Create Flash Sales
console.log("\nCreating flash sales...");
const insertFlashSale = db.prepare(`
  INSERT INTO flash_sales (
    id, name, description, type, target_id, discount_percentage,
    original_price, sale_price, start_time, end_time, max_purchases,
    current_purchases, is_active, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
`);

const now = new Date();
const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

const flashSales = [
  {
    id: generateId(),
    name: '⚡ Flash Coin Bundle',
    description: '1000 coins with 50% bonus - Limited time only!',
    type: 'coin_package',
    targetId: null,
    discountPercentage: 50,
    originalPrice: '9.99',
    salePrice: '4.99',
    startTime: now.toISOString(),
    endTime: tomorrow.toISOString(),
    maxPurchases: 100,
    currentPurchases: 23,
    isActive: 'true'
  },
  {
    id: generateId(),
    name: '🔥 Weekend VIP Deal',
    description: 'Premium VIP at 30% off - This weekend only!',
    type: 'subscription',
    targetId: null,
    discountPercentage: 30,
    originalPrice: '9.99',
    salePrice: '6.99',
    startTime: now.toISOString(),
    endTime: nextWeek.toISOString(),
    maxPurchases: 50,
    currentPurchases: 12,
    isActive: 'true'
  }
];

for (const sale of flashSales) {
  insertFlashSale.run(
    sale.id, sale.name, sale.description, sale.type, sale.targetId,
    sale.discountPercentage, sale.originalPrice, sale.salePrice,
    sale.startTime, sale.endTime, sale.maxPurchases, sale.currentPurchases,
    sale.isActive
  );
  console.log(`✅ Created flash sale: ${sale.name}`);
}

// Create Battle Pass Season
console.log("\nCreating battle pass season...");
const seasonId = generateId();
const seasonStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Started 1 week ago
const seasonEnd = new Date(now.getTime() + 83 * 24 * 60 * 60 * 1000); // Ends in ~3 months

const insertSeason = db.prepare(`
  INSERT INTO battle_pass_seasons (
    id, name, description, start_date, end_date, is_premium, price_usd, 
    is_active, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
`);

insertSeason.run(
  seasonId,
  '🎮 Season 1: Manga Masters',
  'Complete challenges, earn exclusive rewards, and unlock premium content!',
  seasonStart.toISOString(),
  seasonEnd.toISOString(),
  'false',
  '9.99',
  'true'
);
console.log('✅ Created battle pass season: Season 1: Manga Masters');

// Create some battle pass rewards
console.log("\nCreating battle pass rewards...");
const insertReward = db.prepare(`
  INSERT INTO battle_pass_rewards (
    id, season_id, tier, is_premium, reward_type, reward_value, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
`);

const rewards = [
  { tier: 1, isPremium: 'false', rewardType: 'coins', rewardValue: '50' },
  { tier: 1, isPremium: 'true', rewardType: 'coins', rewardValue: '150' },
  { tier: 5, isPremium: 'false', rewardType: 'coins', rewardValue: '100' },
  { tier: 5, isPremium: 'true', rewardType: 'badge', rewardValue: 'Bronze Reader' },
  { tier: 10, isPremium: 'false', rewardType: 'coins', rewardValue: '200' },
  { tier: 10, isPremium: 'true', rewardType: 'coins', rewardValue: '500' },
  { tier: 15, isPremium: 'false', rewardType: 'coins', rewardValue: '250' },
  { tier: 15, isPremium: 'true', rewardType: 'badge', rewardValue: 'Silver Reader' },
  { tier: 20, isPremium: 'false', rewardType: 'coins', rewardValue: '300' },
  { tier: 20, isPremium: 'true', rewardType: 'coins', rewardValue: '1000' }
];

for (const reward of rewards) {
  insertReward.run(
    generateId(),
    seasonId,
    reward.tier,
    reward.isPremium,
    reward.rewardType,
    reward.rewardValue
  );
}
console.log(`✅ Created ${rewards.length} battle pass rewards`);

// Create some achievements
console.log("\nCreating achievements...");
const insertAchievement = db.prepare(`
  INSERT INTO achievements (
    id, name, description, category, requirement, coin_reward, 
    badge_icon, is_hidden, display_order, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
`);

const achievements = [
  {
    id: generateId(),
    name: 'First Steps',
    description: 'Read your first chapter',
    category: 'reading',
    requirement: JSON.stringify({ type: 'chapters_read', count: 1 }),
    coinReward: 10,
    badgeIcon: '📖',
    isHidden: 'false',
    displayOrder: 1
  },
  {
    id: generateId(),
    name: 'Bookworm',
    description: 'Read 50 chapters',
    category: 'reading',
    requirement: JSON.stringify({ type: 'chapters_read', count: 50 }),
    coinReward: 100,
    badgeIcon: '🐛',
    isHidden: 'false',
    displayOrder: 2
  },
  {
    id: generateId(),
    name: 'Manga Master',
    description: 'Read 500 chapters',
    category: 'reading',
    requirement: JSON.stringify({ type: 'chapters_read', count: 500 }),
    coinReward: 1000,
    badgeIcon: '👑',
    isHidden: 'false',
    displayOrder: 3
  },
  {
    id: generateId(),
    name: 'Generous Soul',
    description: 'Make your first purchase',
    category: 'purchasing',
    requirement: JSON.stringify({ type: 'purchases_made', count: 1 }),
    coinReward: 50,
    badgeIcon: '💎',
    isHidden: 'false',
    displayOrder: 4
  },
  {
    id: generateId(),
    name: 'Social Butterfly',
    description: 'Post your first comment',
    category: 'social',
    requirement: JSON.stringify({ type: 'comments_posted', count: 1 }),
    coinReward: 25,
    badgeIcon: '💬',
    isHidden: 'false',
    displayOrder: 5
  },
  {
    id: generateId(),
    name: 'VIP Member',
    description: 'Subscribe to any VIP tier',
    category: 'purchasing',
    requirement: JSON.stringify({ type: 'vip_subscription', tier: 'any' }),
    coinReward: 200,
    badgeIcon: '⭐',
    isHidden: 'false',
    displayOrder: 6
  }
];

for (const achievement of achievements) {
  insertAchievement.run(
    achievement.id,
    achievement.name,
    achievement.description,
    achievement.category,
    achievement.requirement,
    achievement.coinReward,
    achievement.badgeIcon,
    achievement.isHidden,
    achievement.displayOrder
  );
  console.log(`✅ Created achievement: ${achievement.name}`);
}

db.close();
console.log("\n🎉 Shop data seeding complete!");
