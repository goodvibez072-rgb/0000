/**
 * Shared TypeScript interfaces for admin components
 * Improves type safety and reduces code duplication
 */

// ========== Chapter Types ==========
export interface Chapter {
  id: string;
  seriesId: string;
  chapterNumber: string;
  title: string | null;
  uploadedAt: string;
  uploadedBy: string;
  pages?: number;
  isLocked?: boolean | string;
  requiredLevel?: number | string;
  unlockCost?: number;
  status?: string;
}

// ========== Series Types ==========
export interface Series {
  id: string;
  title: string;
  description?: string;
  author?: string;
  artist?: string;
  status: string;
  type: string;
  coverImageUrl?: string;
  genres?: string[];
  rating?: string;
  totalChapters?: number;
  publishedYear?: number;
  createdAt?: string;
  updatedAt?: string;
}

// ========== Monetization Package Types ==========
export interface CurrencyPackage {
  id: string;
  name: string;
  currencyAmount: number;
  priceUSD: string;
  bonusPercentage?: number;
  isActive?: string | boolean;
  stripePriceId?: string | null;
  displayOrder?: number;
  description?: string;
  imageUrl?: string;
}

export interface SubscriptionPackage {
  id: string;
  name: string;
  description: string | null;
  priceUSD: string;
  billingCycle: 'monthly' | 'yearly';
  features: string; // JSON string
  coinBonus: number;
  discountPercentage: number;
  isAdFree?: string | boolean;
  earlyAccess?: string | boolean;
  exclusiveContent?: string | boolean;
  trialDays?: number;
  isActive?: string | boolean;
  displayOrder?: number;
  stripePriceId?: string | null;
}

export interface Bundle {
  id: string;
  name: string;
  description?: string | null;
  items: string; // JSON string of bundle items
  originalPrice: string;
  bundlePrice: string;
  discountPercentage: number;
  isActive?: string | boolean;
  validUntil?: string | null;
  maxPurchases?: number;
  currentPurchases?: number;
  stripePriceId?: string | null;
}

export interface PackageData {
  currency: CurrencyPackage[];
  subscriptions: SubscriptionPackage[];
  bundles: Bundle[];
}

// ========== Advertisement Types ==========
export interface Advertisement {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  linkUrl: string;
  type: string;
  page: string;
  location: string;
  isActive: string;
  startDate?: string;
  endDate?: string;
  displayOrder: number;
  clickCount: number;
  impressionCount: number;
  variantGroup?: string;
  variantName?: string;
  targetCountries?: string;
  targetDeviceTypes?: string;
  targetUserRoles?: string;
  targetLanguages?: string;
  budget?: string;
  costPerClick?: string;
  costPerImpression?: string;
  conversionGoal?: string;
  frequencyCap?: number;
  dailyBudget?: string;
  tags?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ========== User Types ==========
export interface User {
  id: string;
  username: string;
  email?: string | null;
  role: string;
  isAdmin: boolean;
  isBanned?: boolean | string;
  currencyBalance?: number;
  subscription?: UserSubscription | null;
  createdAt?: string;
  lastLogin?: string;
}

export interface UserSubscription {
  packageId: string;
  packageName: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

// ========== Analytics Types ==========
export interface SiteStats {
  totalSeries: number;
  totalChapters: number;
  totalUsers: number;
  activeAds: number;
  totalRevenue?: number;
  monthlyActiveUsers?: number;
}

// ========== Role/Permission Types ==========
export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string; // JSON string
  level: number;
  isActive?: boolean | string;
  createdAt?: string;
}

export interface Permission {
  id: string;
  name: string;
  description?: string;
  category?: string;
}
