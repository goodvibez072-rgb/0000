import { WebSocket, WebSocketServer } from 'ws';
import { type Server } from 'http';
import { nanoid } from 'nanoid';
import cookie from 'cookie';
import signature from 'cookie-signature';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: number;
}

interface WebSocketClient {
  id: string;
  ws: WebSocket;
  userId?: string;
  isAdmin: boolean;
  isAlive: boolean;
  lastPing: number;
  messageCount: number;
  lastMessageTime: number;
  ip: string;
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WebSocketClient> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private readonly PING_INTERVAL = 30000; // 30 seconds
  private readonly PING_TIMEOUT = 5000; // 5 seconds
  private sessionSecret: string | null = null;
  private sessionsDb: Database.Database | null = null;
  
  // SECURITY: Rate limiting configuration
  private connectionRateLimits: Map<string, RateLimitRecord> = new Map();
  private readonly MAX_CONNECTIONS_PER_IP_PER_MINUTE = 10;
  private readonly MAX_MESSAGES_PER_CLIENT_PER_MINUTE = 60;
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute in ms
  private rateLimitCleanupInterval: NodeJS.Timeout | null = null;

  initialize(server: Server) {
    // Load and cache session secret once at initialization
    try {
      this.sessionSecret = readFileSync('./data/session-secret.key', 'utf8').trim();
      console.log('[websocket] Session secret loaded successfully');
    } catch (error) {
      console.error('[websocket] CRITICAL: Failed to load session secret - authentication will fail:', error);
      this.sessionSecret = null;
    }

    // Open and cache sessions database connection for better performance
    try {
      this.sessionsDb = new Database('./data/sessions.db', { readonly: true });
      console.log('[websocket] Sessions database connection established');
    } catch (error) {
      console.error('[websocket] CRITICAL: Failed to open sessions database - authentication will fail:', error);
      this.sessionsDb = null;
    }

    this.wss = new WebSocketServer({ 
      server,
      path: '/ws'
    });

    console.log('[websocket] WebSocket server initialized on /ws');

    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientId = nanoid();
      
      // SECURITY: Extract client IP address (handle proxy headers)
      const ip = this.getClientIP(req);
      
      // SECURITY: Check connection rate limit
      if (!this.checkConnectionRateLimit(ip)) {
        console.log(`[websocket] Connection rejected: rate limit exceeded for IP ${ip}`);
        ws.close(1008, 'Rate limit exceeded');
        return;
      }
      
      // SECURITY FIX: Validate session from HTTP cookie
      const { userId, isAdmin } = this.validateSession(req);
      
      const client: WebSocketClient = {
        id: clientId,
        ws,
        userId,
        isAdmin,
        isAlive: true,
        lastPing: Date.now(),
        messageCount: 0,
        lastMessageTime: Date.now(),
        ip
      };

      this.clients.set(clientId, client);
      console.log(`[websocket] Client connected: ${clientId} (userId: ${userId || 'anonymous'}, IP: ${ip}, admin: ${isAdmin}, total: ${this.clients.size})`);

      // Send welcome message with authenticated user info
      this.sendToClient(clientId, {
        type: 'connection',
        payload: { 
          clientId, 
          message: 'Connected to AmourScans WebSocket',
          authenticated: !!userId,
          isAdmin
        },
        timestamp: Date.now()
      });

      // Handle incoming messages
      ws.on('message', (data: Buffer) => {
        try {
          // SECURITY: Check message rate limit
          if (!this.checkMessageRateLimit(clientId)) {
            console.log(`[websocket] Message rejected: rate limit exceeded for client ${clientId}`);
            this.sendToClient(clientId, {
              type: 'error',
              payload: { message: 'Rate limit exceeded. Please slow down.' },
              timestamp: Date.now()
            });
            return;
          }
          
          const message = JSON.parse(data.toString());
          this.handleMessage(clientId, message);
        } catch (error) {
          console.error(`[websocket] Error parsing message from ${clientId}:`, error);
        }
      });

      // Handle pong responses
      ws.on('pong', () => {
        const client = this.clients.get(clientId);
        if (client) {
          client.isAlive = true;
          client.lastPing = Date.now();
        }
      });

      // Handle disconnection
      ws.on('close', () => {
        this.clients.delete(clientId);
        console.log(`[websocket] Client disconnected: ${clientId} (total: ${this.clients.size})`);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error(`[websocket] Client ${clientId} error:`, error);
        this.clients.delete(clientId);
      });
    });

    // Start heartbeat mechanism
    this.startHeartbeat();
    
    // Start rate limit cleanup
    this.startRateLimitCleanup();
  }
  
  /**
   * SECURITY: Get client IP address from request, handling proxy headers
   * Only trusts X-Forwarded-For when request comes from trusted proxy
   * With trust proxy: 1, we trust the last hop (Replit proxy) which adds the real client IP
   */
  private getClientIP(req: any): string {
    const remoteAddr = req.socket?.remoteAddress || 'unknown';
    
    // Only trust X-Forwarded-For if connection is from a trusted proxy
    const isTrustedProxy = this.isTrustedProxyAddress(remoteAddr);
    
    if (isTrustedProxy) {
      const forwardedFor = req.headers['x-forwarded-for'];
      if (forwardedFor) {
        // X-Forwarded-For format: "original_client, proxy1, proxy2, ..., proxN"
        // Each proxy APPENDS the IP of the client that connected to it
        // With trust proxy: 1, our trusted proxy (Replit) appends the real client IP
        // So the LAST (rightmost) IP is the real client IP added by our trusted proxy
        const ips = forwardedFor.split(',').map((ip: string) => ip.trim()).filter(Boolean);
        
        if (ips.length > 0) {
          // Take the LAST IP - this is the one added by our trusted proxy
          const clientIP = ips[ips.length - 1];
          
          // Validate the IP format to prevent injection
          if (clientIP && /^[a-f0-9:.]+$/i.test(clientIP)) {
            return clientIP;
          }
        }
      }
    }
    
    // Use actual remote address if not from trusted proxy or no valid forwarded header
    return remoteAddr;
  }
  
  /**
   * SECURITY: Check if address is from a trusted proxy
   * Trusted proxies: loopback, link-local, and private network ranges
   * Handles both IPv4 and IPv6 (including IPv6-mapped IPv4)
   */
  private isTrustedProxyAddress(addr: string): boolean {
    if (!addr || addr === 'unknown') {
      return false;
    }
    
    // Normalize IPv6-mapped IPv4 addresses (::ffff:x.x.x.x -> x.x.x.x)
    let normalizedAddr = addr;
    if (addr.startsWith('::ffff:')) {
      // Extract the IPv4 portion
      normalizedAddr = addr.substring(7);
    }
    
    // IPv6 loopback (::1)
    if (addr === '::1') {
      return true;
    }
    
    // IPv6 link-local (fe80::/10)
    if (addr.toLowerCase().startsWith('fe80:')) {
      return true;
    }
    
    // IPv6 unique local (fc00::/7) - private IPv6
    if (addr.toLowerCase().startsWith('fc') || addr.toLowerCase().startsWith('fd')) {
      return true;
    }
    
    // Check IPv4 addresses (either plain or extracted from IPv6-mapped)
    // IPv4 loopback (127.0.0.0/8)
    if (normalizedAddr.startsWith('127.')) {
      return true;
    }
    
    // IPv4 link-local (169.254.0.0/16)
    if (normalizedAddr.startsWith('169.254.')) {
      return true;
    }
    
    // Private IPv4 ranges - for internal reverse proxies
    // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
    if (normalizedAddr.startsWith('10.') || 
        normalizedAddr.startsWith('192.168.') ||
        /^172\.(1[6-9]|2[0-9]|3[01])\./.test(normalizedAddr)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * SECURITY: Check connection rate limit for IP address
   * Returns true if connection is allowed, false if rate limit exceeded
   */
  private checkConnectionRateLimit(ip: string): boolean {
    const now = Date.now();
    const rateLimit = this.connectionRateLimits.get(ip);
    
    if (!rateLimit || now > rateLimit.resetTime) {
      // New window - allow connection and start tracking
      this.connectionRateLimits.set(ip, {
        count: 1,
        resetTime: now + this.RATE_LIMIT_WINDOW
      });
      return true;
    }
    
    // Within window - check count
    if (rateLimit.count >= this.MAX_CONNECTIONS_PER_IP_PER_MINUTE) {
      return false;
    }
    
    // Increment count
    rateLimit.count++;
    return true;
  }
  
  /**
   * SECURITY: Check message rate limit for client
   * Returns true if message is allowed, false if rate limit exceeded
   */
  private checkMessageRateLimit(clientId: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }
    
    const now = Date.now();
    const timeSinceLastReset = now - client.lastMessageTime;
    
    // Reset counter if window has passed
    if (timeSinceLastReset >= this.RATE_LIMIT_WINDOW) {
      client.messageCount = 1;
      client.lastMessageTime = now;
      return true;
    }
    
    // Check if limit exceeded
    if (client.messageCount >= this.MAX_MESSAGES_PER_CLIENT_PER_MINUTE) {
      return false;
    }
    
    // Increment counter
    client.messageCount++;
    return true;
  }
  
  /**
   * SECURITY: Periodically cleanup expired rate limit records
   */
  private startRateLimitCleanup() {
    this.rateLimitCleanupInterval = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;
      
      // Clean up expired connection rate limits
      this.connectionRateLimits.forEach((rateLimit, ip) => {
        if (now > rateLimit.resetTime) {
          this.connectionRateLimits.delete(ip);
          cleaned++;
        }
      });
      
      if (cleaned > 0) {
        console.log(`[websocket] Cleaned up ${cleaned} expired rate limit records`);
      }
    }, 60000); // Run every minute
  }

  private startHeartbeat() {
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      
      this.clients.forEach((client, clientId) => {
        // Check if client responded to last ping
        if (!client.isAlive) {
          console.log(`[websocket] Terminating inactive client: ${clientId}`);
          client.ws.terminate();
          this.clients.delete(clientId);
          return;
        }

        // Mark as not alive and send ping
        client.isAlive = false;
        client.ws.ping();
      });
    }, this.PING_INTERVAL);
  }

  private handleMessage(clientId: string, message: any) {
    // Handle client messages (subscriptions, etc.)
    // Note: Authentication is now handled server-side during WebSocket upgrade
    switch (message.type) {
      case 'subscribe':
        this.handleSubscribe(clientId, message.payload);
        break;
      case 'ping':
        this.sendToClient(clientId, {
          type: 'pong',
          payload: {},
          timestamp: Date.now()
        });
        break;
      default:
        console.log(`[websocket] Unknown message type from ${clientId}:`, message.type);
    }
  }

  /**
   * SECURITY: Validate session from HTTP cookie during WebSocket upgrade
   * This prevents clients from spoofing userId by validating against the session database
   */
  private validateSession(req: any): { userId: string | undefined, isAdmin: boolean } {
    try {
      // Parse cookies from request
      const cookies = req.headers.cookie ? cookie.parse(req.headers.cookie) : {};
      const signedSessionCookie = cookies['auth.sid'];
      
      if (!signedSessionCookie) {
        return { userId: undefined, isAdmin: false };
      }

      // Use cached session secret (loaded at initialization)
      if (!this.sessionSecret) {
        console.error('[websocket] Session secret not available - authentication disabled');
        return { userId: undefined, isAdmin: false };
      }

      // Use cached sessions database connection (opened at initialization)
      if (!this.sessionsDb) {
        console.error('[websocket] Sessions database not available - authentication disabled');
        return { userId: undefined, isAdmin: false };
      }

      // Express-session uses format "s:SID.signature"
      // Strip the "s:" prefix before unsigning
      let cookieValue = signedSessionCookie;
      if (cookieValue.startsWith('s:')) {
        cookieValue = cookieValue.slice(2);
      }
      
      const unsignedSessionId = signature.unsign(cookieValue, this.sessionSecret);
      
      if (unsignedSessionId === false) {
        console.log('[websocket] Invalid session signature');
        return { userId: undefined, isAdmin: false };
      }
      
      // Query session with unsigned session ID using cached database connection
      const session = this.sessionsDb.prepare('SELECT sess FROM sessions WHERE sid = ?').get(unsignedSessionId) as any;
      
      if (!session || !session.sess) {
        return { userId: undefined, isAdmin: false };
      }

      // Parse session data
      const sessionData = JSON.parse(session.sess);
      const userId = sessionData.userId;
      const isAdmin = sessionData.user?.isAdmin === 'true' || 
                      sessionData.user?.role === 'admin' ||
                      sessionData.user?.role === 'owner';
      
      if (userId) {
        console.log(`[websocket] Validated session for user ${userId} (admin: ${isAdmin})`);
        return { userId, isAdmin };
      }
      
      return { userId: undefined, isAdmin: false };
    } catch (error) {
      console.error('[websocket] Error validating session:', error);
      return { userId: undefined, isAdmin: false };
    }
  }

  private handleSubscribe(clientId: string, payload: { channels: string[] }) {
    // Future: Implement channel-based subscriptions for targeted updates
    console.log(`[websocket] Client ${clientId} subscribed to channels:`, payload.channels);
  }

  // Send message to specific client
  private sendToClient(clientId: string, message: WebSocketMessage) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  // Broadcast to all connected clients
  broadcast(message: WebSocketMessage) {
    const payload = JSON.stringify(message);
    let sent = 0;

    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
        sent++;
      }
    });

    console.log(`[websocket] Broadcast '${message.type}' to ${sent} clients`);
  }

  // Broadcast to specific users
  broadcastToUsers(userIds: string[], message: WebSocketMessage) {
    const payload = JSON.stringify(message);
    let sent = 0;

    this.clients.forEach((client) => {
      if (client.userId && userIds.includes(client.userId) && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
        sent++;
      }
    });

    console.log(`[websocket] Broadcast '${message.type}' to ${sent} users`);
  }

  // Broadcast to authenticated users only
  broadcastToAuthenticated(message: WebSocketMessage) {
    const payload = JSON.stringify(message);
    let sent = 0;

    this.clients.forEach((client) => {
      if (client.userId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
        sent++;
      }
    });

    console.log(`[websocket] Broadcast '${message.type}' to ${sent} authenticated users`);
  }

  // Get connection statistics
  getStats() {
    const total = this.clients.size;
    const authenticated = Array.from(this.clients.values()).filter(c => c.userId).length;
    const alive = Array.from(this.clients.values()).filter(c => c.isAlive).length;

    return {
      total,
      authenticated,
      alive,
      inactive: total - alive
    };
  }

  // Cleanup
  shutdown() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    if (this.rateLimitCleanupInterval) {
      clearInterval(this.rateLimitCleanupInterval);
    }

    this.clients.forEach((client) => {
      client.ws.close();
    });

    this.clients.clear();
    this.connectionRateLimits.clear();
    
    if (this.wss) {
      this.wss.close();
    }

    // Close cached sessions database connection
    if (this.sessionsDb) {
      this.sessionsDb.close();
      this.sessionsDb = null;
      console.log('[websocket] Sessions database connection closed');
    }

    console.log('[websocket] WebSocket server shut down');
  }
}

// Export singleton instance
export const wsManager = new WebSocketManager();
