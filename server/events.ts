import { wsManager } from "./websocket";

// Define all possible event types for type safety
export enum BroadcastEventType {
  // Series events
  SERIES_CREATED = 'series:created',
  SERIES_UPDATED = 'series:updated',
  SERIES_DELETED = 'series:deleted',
  
  // Chapter events
  CHAPTER_CREATED = 'chapter:created',
  CHAPTER_UPDATED = 'chapter:updated',
  CHAPTER_DELETED = 'chapter:deleted',
  CHAPTER_PUBLISHED = 'chapter:published',
  
  // Ad management events
  AD_CREATED = 'ad:created',
  AD_UPDATED = 'ad:updated',
  AD_DELETED = 'ad:deleted',
  AD_ACTIVATED = 'ad:activated',
  AD_DEACTIVATED = 'ad:deactivated',
  AD_INTENSITY_CHANGED = 'ad:intensity_changed',
  AD_STATUS_CHANGED = 'ad:status_changed',
  
  // Settings events
  SETTINGS_UPDATED = 'settings:updated',
  SYSTEM_CONFIG_CHANGED = 'system:config_changed',
  
  // User management events
  USER_CREATED = 'user:created',
  USER_UPDATED = 'user:updated',
  USER_DELETED = 'user:deleted',
  USER_BANNED = 'user:banned',
  USER_UNBANNED = 'user:unbanned',
  USER_ROLE_CHANGED = 'user:role_changed',
  USER_WARNED = 'user:warned',
  
  // Role management events
  ROLE_CREATED = 'role:created',
  ROLE_UPDATED = 'role:updated',
  ROLE_DELETED = 'role:deleted',
  ROLE_PERMISSIONS_UPDATED = 'role:permissions_updated',
  
  // Monetization events
  PACKAGE_CREATED = 'package:created',
  PACKAGE_UPDATED = 'package:updated',
  PACKAGE_DELETED = 'package:deleted',
  COUPON_CREATED = 'coupon:created',
  COUPON_UPDATED = 'coupon:updated',
  COUPON_DELETED = 'coupon:deleted',
  SUBSCRIPTION_CREATED = 'subscription:created',
  SUBSCRIPTION_UPDATED = 'subscription:updated',
  SUBSCRIPTION_DELETED = 'subscription:deleted',
  SUBSCRIPTION_CANCELLED = 'subscription:cancelled',
  BATTLE_PASS_CREATED = 'battlepass:created',
  BATTLE_PASS_UPDATED = 'battlepass:updated',
  BATTLE_PASS_DELETED = 'battlepass:deleted',
  FLASH_SALE_CREATED = 'flashsale:created',
  FLASH_SALE_UPDATED = 'flashsale:updated',
  FLASH_SALE_DELETED = 'flashsale:deleted',
  BULK_OPERATION = 'bulk:operation',
  
  // Upload progress events
  UPLOAD_PROGRESS = 'upload:progress',
  UPLOAD_COMPLETE = 'upload:complete',
  UPLOAD_FAILED = 'upload:failed',
  
  // General notifications
  NOTIFICATION = 'notification',
  CACHE_INVALIDATE = 'cache:invalidate',
}

// Event payload interfaces for type safety
export interface SeriesEvent {
  seriesId: string;
  action: 'created' | 'updated' | 'deleted';
  data?: any;
}

export interface ChapterEvent {
  chapterId: string;
  seriesId: string;
  action: 'created' | 'updated' | 'deleted' | 'published';
  data?: any;
}

export interface AdEvent {
  adId: string;
  action: 'created' | 'updated' | 'deleted' | 'activated' | 'deactivated';
  data?: any;
}

export interface UserEvent {
  userId: string;
  action: 'created' | 'updated' | 'deleted' | 'banned' | 'unbanned' | 'role_changed' | 'warned';
  data?: any;
}

export interface RoleEvent {
  roleId: string;
  action: 'created' | 'updated' | 'deleted' | 'permissions_updated';
  data?: any;
}

export interface UploadProgressEvent {
  uploadId: string;
  status: 'processing' | 'complete' | 'failed';
  progress: number;
  message: string;
  details?: any;
}

export interface SettingsEvent {
  category: string;
  key: string;
  value: any;
  action: 'updated';
}

export interface CacheInvalidateEvent {
  keys: string[];
  pattern?: string;
}

export interface SubscriptionEvent {
  packageId: string;
  action: 'created' | 'updated' | 'deleted';
  data?: any;
}

export interface BattlePassEvent {
  seasonId: string;
  action: 'season_created' | 'season_updated' | 'season_deleted' | 'tier_created' | 'tier_updated';
  data?: any;
}

export interface FlashSaleEvent {
  saleId: string;
  action: 'created' | 'updated' | 'deleted';
  data?: any;
}

export interface BulkOperationEvent {
  operation: string;
  entityType: string;
  count: number;
  data?: any;
}

// Broadcast event wrapper with metadata
export interface BroadcastEvent {
  type: BroadcastEventType;
  payload: any;
  timestamp: number;
  userId?: string; // User who triggered the event (admin)
  metadata?: Record<string, any>;
}

/**
 * Broadcast system for real-time updates
 * Integrates with WebSocket manager to send events to connected clients
 */
class BroadcastService {
  /**
   * Broadcast a series-related event
   */
  broadcastSeriesEvent(event: SeriesEvent, userId?: string) {
    let eventType: BroadcastEventType;
    
    switch (event.action) {
      case 'created':
        eventType = BroadcastEventType.SERIES_CREATED;
        break;
      case 'updated':
        eventType = BroadcastEventType.SERIES_UPDATED;
        break;
      case 'deleted':
        eventType = BroadcastEventType.SERIES_DELETED;
        break;
    }

    this.broadcast({
      type: eventType,
      payload: event,
      timestamp: Date.now(),
      userId
    });

    // Also invalidate relevant caches
    this.broadcastCacheInvalidation(['series', `series:${event.seriesId}`]);
  }

  /**
   * Broadcast a chapter-related event
   */
  broadcastChapterEvent(event: ChapterEvent, userId?: string) {
    let eventType: BroadcastEventType;
    
    switch (event.action) {
      case 'created':
        eventType = BroadcastEventType.CHAPTER_CREATED;
        break;
      case 'updated':
        eventType = BroadcastEventType.CHAPTER_UPDATED;
        break;
      case 'deleted':
        eventType = BroadcastEventType.CHAPTER_DELETED;
        break;
      case 'published':
        eventType = BroadcastEventType.CHAPTER_PUBLISHED;
        break;
    }

    this.broadcast({
      type: eventType,
      payload: event,
      timestamp: Date.now(),
      userId
    });

    // Invalidate series and chapter caches
    this.broadcastCacheInvalidation([
      `series:${event.seriesId}:chapters`,
      `chapter:${event.chapterId}`
    ]);
  }

  /**
   * Broadcast an ad management event
   */
  broadcastAdEvent(event: AdEvent, userId?: string) {
    let eventType: BroadcastEventType;
    
    switch (event.action) {
      case 'created':
        eventType = BroadcastEventType.AD_CREATED;
        break;
      case 'updated':
        eventType = BroadcastEventType.AD_UPDATED;
        break;
      case 'deleted':
        eventType = BroadcastEventType.AD_DELETED;
        break;
      case 'activated':
        eventType = BroadcastEventType.AD_ACTIVATED;
        break;
      case 'deactivated':
        eventType = BroadcastEventType.AD_DEACTIVATED;
        break;
    }

    this.broadcast({
      type: eventType,
      payload: event,
      timestamp: Date.now(),
      userId
    });

    // Invalidate ad caches
    this.broadcastCacheInvalidation(['ads', 'ad-intensity']);
  }

  /**
   * Broadcast ad intensity/status change (high priority)
   */
  broadcastAdIntensityChange(level: number, enabled: boolean, userId?: string) {
    this.broadcast({
      type: BroadcastEventType.AD_INTENSITY_CHANGED,
      payload: { level, enabled },
      timestamp: Date.now(),
      userId,
      metadata: { priority: 'high' }
    });

    // Invalidate ad-related caches
    this.broadcastCacheInvalidation(['ad-intensity', 'ads']);
  }

  /**
   * Broadcast settings update
   */
  broadcastSettingsUpdate(event: SettingsEvent, userId?: string) {
    this.broadcast({
      type: BroadcastEventType.SETTINGS_UPDATED,
      payload: event,
      timestamp: Date.now(),
      userId
    });

    // Invalidate settings cache
    this.broadcastCacheInvalidation([`settings:${event.category}:${event.key}`]);
  }

  /**
   * Broadcast user management event
   */
  broadcastUserEvent(event: UserEvent, userId?: string) {
    let eventType: BroadcastEventType;
    
    switch (event.action) {
      case 'created':
        eventType = BroadcastEventType.USER_CREATED;
        break;
      case 'updated':
        eventType = BroadcastEventType.USER_UPDATED;
        break;
      case 'deleted':
        eventType = BroadcastEventType.USER_DELETED;
        break;
      case 'banned':
        eventType = BroadcastEventType.USER_BANNED;
        break;
      case 'unbanned':
        eventType = BroadcastEventType.USER_UNBANNED;
        break;
      case 'role_changed':
        eventType = BroadcastEventType.USER_ROLE_CHANGED;
        break;
      case 'warned':
        eventType = BroadcastEventType.USER_WARNED;
        break;
    }

    this.broadcast({
      type: eventType,
      payload: event,
      timestamp: Date.now(),
      userId
    });

    // Invalidate user cache
    this.broadcastCacheInvalidation([`user:${event.userId}`, 'users']);
  }

  /**
   * Broadcast role management event
   */
  broadcastRoleEvent(event: RoleEvent, userId?: string) {
    let eventType: BroadcastEventType;
    
    switch (event.action) {
      case 'created':
        eventType = BroadcastEventType.ROLE_CREATED;
        break;
      case 'updated':
        eventType = BroadcastEventType.ROLE_UPDATED;
        break;
      case 'deleted':
        eventType = BroadcastEventType.ROLE_DELETED;
        break;
      case 'permissions_updated':
        eventType = BroadcastEventType.ROLE_PERMISSIONS_UPDATED;
        break;
    }

    this.broadcast({
      type: eventType,
      payload: event,
      timestamp: Date.now(),
      userId
    });

    // Invalidate role cache
    this.broadcastCacheInvalidation([`role:${event.roleId}`, 'roles']);
  }

  /**
   * Broadcast upload progress (for real-time upload status)
   */
  broadcastUploadProgress(event: UploadProgressEvent) {
    let eventType: BroadcastEventType;
    
    switch (event.status) {
      case 'processing':
        eventType = BroadcastEventType.UPLOAD_PROGRESS;
        break;
      case 'complete':
        eventType = BroadcastEventType.UPLOAD_COMPLETE;
        break;
      case 'failed':
        eventType = BroadcastEventType.UPLOAD_FAILED;
        break;
    }

    this.broadcast({
      type: eventType,
      payload: event,
      timestamp: Date.now()
    });
  }

  /**
   * Broadcast subscription package event
   */
  broadcastSubscriptionEvent(event: SubscriptionEvent, userId?: string) {
    let eventType: BroadcastEventType;
    
    switch (event.action) {
      case 'created':
        eventType = BroadcastEventType.SUBSCRIPTION_CREATED;
        break;
      case 'updated':
        eventType = BroadcastEventType.SUBSCRIPTION_UPDATED;
        break;
      case 'deleted':
        eventType = BroadcastEventType.SUBSCRIPTION_DELETED;
        break;
    }

    this.broadcast({
      type: eventType,
      payload: event,
      timestamp: Date.now(),
      userId
    });

    this.broadcastCacheInvalidation(['subscriptions', `subscription:${event.packageId}`]);
  }

  /**
   * Broadcast battle pass event
   */
  broadcastBattlePassEvent(event: BattlePassEvent, userId?: string) {
    let eventType: BroadcastEventType;
    
    switch (event.action) {
      case 'season_created':
        eventType = BroadcastEventType.BATTLE_PASS_CREATED;
        break;
      case 'season_updated':
        eventType = BroadcastEventType.BATTLE_PASS_UPDATED;
        break;
      case 'season_deleted':
        eventType = BroadcastEventType.BATTLE_PASS_DELETED;
        break;
      default:
        eventType = BroadcastEventType.BATTLE_PASS_UPDATED;
    }

    this.broadcast({
      type: eventType,
      payload: event,
      timestamp: Date.now(),
      userId
    });

    this.broadcastCacheInvalidation(['battlepass', `battlepass:${event.seasonId}`]);
  }

  /**
   * Broadcast flash sale event
   */
  broadcastFlashSaleEvent(event: FlashSaleEvent, userId?: string) {
    let eventType: BroadcastEventType;
    
    switch (event.action) {
      case 'created':
        eventType = BroadcastEventType.FLASH_SALE_CREATED;
        break;
      case 'updated':
        eventType = BroadcastEventType.FLASH_SALE_UPDATED;
        break;
      case 'deleted':
        eventType = BroadcastEventType.FLASH_SALE_DELETED;
        break;
    }

    this.broadcast({
      type: eventType,
      payload: event,
      timestamp: Date.now(),
      userId
    });

    this.broadcastCacheInvalidation(['flashsales', `flashsale:${event.saleId}`]);
  }

  /**
   * Broadcast bulk operation event
   */
  broadcastBulkOperation(event: BulkOperationEvent, userId?: string) {
    this.broadcast({
      type: BroadcastEventType.BULK_OPERATION,
      payload: event,
      timestamp: Date.now(),
      userId
    });

    this.broadcastCacheInvalidation([event.entityType]);
  }

  /**
   * Broadcast coupon event
   */
  broadcastCouponEvent(couponId: string, action: 'created' | 'updated' | 'deleted', data?: any, userId?: string) {
    let eventType: BroadcastEventType;
    
    switch (action) {
      case 'created':
        eventType = BroadcastEventType.COUPON_CREATED;
        break;
      case 'updated':
        eventType = BroadcastEventType.COUPON_UPDATED;
        break;
      case 'deleted':
        eventType = BroadcastEventType.COUPON_DELETED;
        break;
    }

    this.broadcast({
      type: eventType,
      payload: { couponId, action, data },
      timestamp: Date.now(),
      userId
    });

    this.broadcastCacheInvalidation(['coupons', `coupon:${couponId}`]);
  }

  /**
   * Broadcast package/bundle event
   */
  broadcastPackageEvent(packageId: string, action: 'created' | 'updated' | 'deleted', data?: any, userId?: string) {
    let eventType: BroadcastEventType;
    
    switch (action) {
      case 'created':
        eventType = BroadcastEventType.PACKAGE_CREATED;
        break;
      case 'updated':
        eventType = BroadcastEventType.PACKAGE_UPDATED;
        break;
      case 'deleted':
        eventType = BroadcastEventType.PACKAGE_DELETED;
        break;
    }

    this.broadcast({
      type: eventType,
      payload: { packageId, action, data },
      timestamp: Date.now(),
      userId
    });

    this.broadcastCacheInvalidation(['packages', 'bundles', `package:${packageId}`]);
  }

  /**
   * Broadcast cache invalidation event
   */
  broadcastCacheInvalidation(keys: string[], pattern?: string) {
    this.broadcast({
      type: BroadcastEventType.CACHE_INVALIDATE,
      payload: { keys, pattern },
      timestamp: Date.now()
    });
  }

  /**
   * Send general notification
   */
  broadcastNotification(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', userId?: string) {
    this.broadcast({
      type: BroadcastEventType.NOTIFICATION,
      payload: { message, type },
      timestamp: Date.now(),
      userId
    });
  }

  /**
   * Low-level broadcast method
   */
  private broadcast(event: BroadcastEvent) {
    wsManager.broadcast({
      type: event.type,
      payload: event,
      timestamp: event.timestamp
    });
  }

  /**
   * Broadcast to specific authenticated users
   */
  broadcastToUsers(userIds: string[], event: BroadcastEvent) {
    wsManager.broadcastToUsers(userIds, {
      type: event.type,
      payload: event,
      timestamp: event.timestamp
    });
  }

  /**
   * Broadcast to all authenticated users only
   */
  broadcastToAuthenticated(event: BroadcastEvent) {
    wsManager.broadcastToAuthenticated({
      type: event.type,
      payload: event,
      timestamp: event.timestamp
    });
  }
}

// Export singleton instance
export const broadcastService = new BroadcastService();

// Export convenience functions for common use cases
export const broadcast = {
  series: (event: SeriesEvent, userId?: string) => 
    broadcastService.broadcastSeriesEvent(event, userId),
  
  chapter: (event: ChapterEvent, userId?: string) => 
    broadcastService.broadcastChapterEvent(event, userId),
  
  ad: (event: AdEvent, userId?: string) => 
    broadcastService.broadcastAdEvent(event, userId),
  
  adIntensity: (level: number, enabled: boolean, userId?: string) => 
    broadcastService.broadcastAdIntensityChange(level, enabled, userId),
  
  settings: (event: SettingsEvent, userId?: string) => 
    broadcastService.broadcastSettingsUpdate(event, userId),
  
  user: (event: UserEvent, userId?: string) => 
    broadcastService.broadcastUserEvent(event, userId),
  
  role: (event: RoleEvent, userId?: string) => 
    broadcastService.broadcastRoleEvent(event, userId),
  
  uploadProgress: (event: UploadProgressEvent) => 
    broadcastService.broadcastUploadProgress(event),
  
  subscription: (event: SubscriptionEvent, userId?: string) => 
    broadcastService.broadcastSubscriptionEvent(event, userId),
  
  battlePass: (event: BattlePassEvent, userId?: string) => 
    broadcastService.broadcastBattlePassEvent(event, userId),
  
  flashSale: (event: FlashSaleEvent, userId?: string) => 
    broadcastService.broadcastFlashSaleEvent(event, userId),
  
  bulkOperation: (event: BulkOperationEvent, userId?: string) => 
    broadcastService.broadcastBulkOperation(event, userId),
  
  coupon: (couponId: string, action: 'created' | 'updated' | 'deleted', data?: any, userId?: string) => 
    broadcastService.broadcastCouponEvent(couponId, action, data, userId),
  
  package: (packageId: string, action: 'created' | 'updated' | 'deleted', data?: any, userId?: string) => 
    broadcastService.broadcastPackageEvent(packageId, action, data, userId),
  
  notify: (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', userId?: string) => 
    broadcastService.broadcastNotification(message, type, userId),
  
  invalidateCache: (keys: string[], pattern?: string) => 
    broadcastService.broadcastCacheInvalidation(keys, pattern)
};
