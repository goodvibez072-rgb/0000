import { storage } from "../storage";
import type { Request } from "express";

/**
 * Security audit logger for comprehensive activity tracking
 * 
 * Logs:
 * - All admin actions (CRUD operations on users, content, settings)
 * - Authentication events (login, logout, password changes)
 * - Security events (rate limits, CSRF failures, unauthorized access)
 */

export enum AuditAction {
  // Authentication events
  LOGIN_SUCCESS = "auth:login_success",
  LOGIN_FAILED = "auth:login_failed",
  LOGOUT = "auth:logout",
  PASSWORD_CHANGED = "auth:password_changed",
  EMAIL_VERIFIED = "auth:email_verified",
  SIGNUP = "auth:signup",
  
  // User management
  USER_CREATED = "user:created",
  USER_UPDATED = "user:updated",
  USER_DELETED = "user:deleted",
  USER_BANNED = "user:banned",
  USER_UNBANNED = "user:unbanned",
  USER_ROLE_CHANGED = "user:role_changed",
  USER_WARNING_ISSUED = "user:warning_issued",
  USER_WARNING_DELETED = "user:warning_deleted",
  
  // Content management
  SERIES_CREATED = "content:series_created",
  SERIES_UPDATED = "content:series_updated",
  SERIES_DELETED = "content:series_deleted",
  CHAPTER_CREATED = "content:chapter_created",
  CHAPTER_UPDATED = "content:chapter_updated",
  CHAPTER_DELETED = "content:chapter_deleted",
  
  // Settings management
  SETTING_CREATED = "settings:created",
  SETTING_UPDATED = "settings:updated",
  SETTING_DELETED = "settings:deleted",
  
  // Ad management
  AD_CREATED = "ads:created",
  AD_UPDATED = "ads:updated",
  AD_DELETED = "ads:deleted",
  
  // Monetization
  PACKAGE_CREATED = "monetization:package_created",
  PACKAGE_UPDATED = "monetization:package_updated",
  PACKAGE_DELETED = "monetization:package_deleted",
  COUPON_CREATED = "monetization:coupon_created",
  COUPON_UPDATED = "monetization:coupon_updated",
  COUPON_DELETED = "monetization:coupon_deleted",
  
  // Security events
  RATE_LIMIT_HIT = "security:rate_limit_hit",
  CSRF_VALIDATION_FAILED = "security:csrf_failed",
  UNAUTHORIZED_ACCESS = "security:unauthorized_access",
  SUSPICIOUS_ACTIVITY = "security:suspicious_activity",
  SESSION_HIJACK_DETECTED = "security:session_hijack",
  BRUTE_FORCE_DETECTED = "security:brute_force",
}

export interface AuditLogData {
  action: AuditAction;
  adminId?: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  severity?: "low" | "medium" | "high" | "critical";
}

class AuditLogger {
  /**
   * Log an audit event
   */
  async log(data: AuditLogData): Promise<void> {
    try {
      await storage.createActivityLog({
        adminId: data.adminId || "system",
        action: data.action,
        targetType: data.targetType || "none",
        targetId: data.targetId,
        details: JSON.stringify({
          ...data.details,
          severity: data.severity
        }),
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      });
    } catch (error) {
      console.error("[AuditLogger] Failed to log event:", error);
    }
  }
  
  /**
   * Log from Express request context
   */
  async logFromRequest(req: Request, data: Omit<AuditLogData, "ipAddress" | "userAgent">): Promise<void> {
    const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";
    
    await this.log({
      ...data,
      ipAddress,
      userAgent,
    });
  }
  
  /**
   * Log authentication success
   */
  async logLoginSuccess(userId: string, req: Request): Promise<void> {
    await this.logFromRequest(req, {
      action: AuditAction.LOGIN_SUCCESS,
      adminId: userId,
      targetType: "auth",
      targetId: userId,
      details: { timestamp: new Date().toISOString() },
      severity: "low"
    });
  }
  
  /**
   * Log authentication failure
   */
  async logLoginFailure(username: string, reason: string, req: Request): Promise<void> {
    await this.logFromRequest(req, {
      action: AuditAction.LOGIN_FAILED,
      targetType: "auth",
      details: { username, reason, timestamp: new Date().toISOString() },
      severity: "medium"
    });
  }
  
  /**
   * Log logout
   */
  async logLogout(userId: string, req: Request): Promise<void> {
    await this.logFromRequest(req, {
      action: AuditAction.LOGOUT,
      adminId: userId,
      targetType: "auth",
      targetId: userId,
      details: { timestamp: new Date().toISOString() },
      severity: "low"
    });
  }
  
  /**
   * Log password change
   */
  async logPasswordChange(userId: string, req: Request): Promise<void> {
    await this.logFromRequest(req, {
      action: AuditAction.PASSWORD_CHANGED,
      adminId: userId,
      targetType: "auth",
      targetId: userId,
      details: { timestamp: new Date().toISOString() },
      severity: "medium"
    });
  }
  
  /**
   * Log rate limit hit
   */
  async logRateLimitHit(req: Request, endpoint: string): Promise<void> {
    await this.logFromRequest(req, {
      action: AuditAction.RATE_LIMIT_HIT,
      targetType: "security",
      details: { 
        endpoint,
        timestamp: new Date().toISOString(),
        url: req.url,
        method: req.method
      },
      severity: "medium"
    });
  }
  
  /**
   * Log CSRF validation failure
   */
  async logCSRFFailure(req: Request): Promise<void> {
    await this.logFromRequest(req, {
      action: AuditAction.CSRF_VALIDATION_FAILED,
      targetType: "security",
      details: { 
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString()
      },
      severity: "high"
    });
  }
  
  /**
   * Log unauthorized access attempt
   */
  async logUnauthorizedAccess(req: Request, resource: string): Promise<void> {
    await this.logFromRequest(req, {
      action: AuditAction.UNAUTHORIZED_ACCESS,
      targetType: "security",
      details: { 
        resource,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString()
      },
      severity: "high"
    });
  }
  
  /**
   * Log suspicious activity
   */
  async logSuspiciousActivity(req: Request, description: string, severity: "low" | "medium" | "high" | "critical" = "medium"): Promise<void> {
    await this.logFromRequest(req, {
      action: AuditAction.SUSPICIOUS_ACTIVITY,
      targetType: "security",
      details: { 
        description,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString()
      },
      severity
    });
  }
  
  /**
   * Log admin action
   */
  async logAdminAction(
    adminId: string,
    action: AuditAction,
    targetType: string,
    targetId: string,
    details: Record<string, any>,
    req: Request
  ): Promise<void> {
    await this.logFromRequest(req, {
      action,
      adminId,
      targetType,
      targetId,
      details,
      severity: "low"
    });
  }
}

export const auditLogger = new AuditLogger();
