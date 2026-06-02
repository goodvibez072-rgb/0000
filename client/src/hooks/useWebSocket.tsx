import { useEffect, useRef, useState, useCallback } from 'react';
import { logger } from '@/lib/logger';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: number;
}

interface UseWebSocketOptions {
  // Enable/disable connection
  enabled?: boolean;
  
  // Auto-reconnect settings
  reconnect?: boolean;
  reconnectInterval?: number;
  reconnectAttempts?: number;
  
  // Connection settings
  heartbeatInterval?: number;
  
  // Callbacks
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  onMessage?: (message: WebSocketMessage) => void;
}

interface UseWebSocketReturn {
  connectionState: ConnectionState;
  isConnected: boolean;
  sendMessage: (type: string, payload: any) => void;
  subscribe: (eventType: string, callback: (payload: any) => void) => () => void;
  reconnect: () => void;
  disconnect: () => void;
}

/**
 * Custom hook for WebSocket connection management with auto-reconnect
 * 
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Event subscription system
 * - Connection state management
 * - Heartbeat mechanism
 * - Type-safe message handling
 */
export function useWebSocket(
  url: string,
  options: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const {
    enabled = true, // By default, connect
    reconnect = true,
    reconnectInterval = 1000,
    reconnectAttempts = Infinity,
    heartbeatInterval = 30000,
    onConnect,
    onDisconnect,
    onError,
    onMessage
  } = options;

  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectCountRef = useRef(0);
  const subscriptionsRef = useRef<Map<string, Set<(payload: any) => void>>>(new Map());
  const shouldConnectRef = useRef(true);

  // Calculate exponential backoff delay
  const getReconnectDelay = useCallback(() => {
    const exponentialDelay = reconnectInterval * Math.pow(2, reconnectCountRef.current);
    const maxDelay = 30000; // Max 30 seconds
    return Math.min(exponentialDelay, maxDelay);
  }, [reconnectInterval]);

  // Send heartbeat ping
  const sendHeartbeat = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'ping',
        timestamp: Date.now()
      }));
      
      // Schedule next heartbeat
      heartbeatTimeoutRef.current = setTimeout(sendHeartbeat, heartbeatInterval);
    }
  }, [heartbeatInterval]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    if (!shouldConnectRef.current) {
      return;
    }

    if (reconnectCountRef.current === 0) {
      logger.log('useWebSocket', `Connecting to ${url}...`);
    }
    setConnectionState('connecting');

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        logger.success('useWebSocket', 'Connected');
        setConnectionState('connected');
        reconnectCountRef.current = 0; // Reset reconnect counter on successful connection
        
        // Start heartbeat
        sendHeartbeat();
        
        onConnect?.();
      };

      ws.onclose = () => {
        setConnectionState('disconnected');
        
        // Clear heartbeat
        if (heartbeatTimeoutRef.current) {
          clearTimeout(heartbeatTimeoutRef.current);
        }
        
        onDisconnect?.();
        
        // Attempt reconnection if enabled
        if (reconnect && shouldConnectRef.current && reconnectCountRef.current < reconnectAttempts) {
          const delay = getReconnectDelay();
          if (reconnectCountRef.current < 3) {
            logger.log('useWebSocket', `Reconnecting in ${delay}ms (attempt ${reconnectCountRef.current + 1})`);
          }
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectCountRef.current++;
            connect();
          }, delay);
        } else if (reconnectCountRef.current >= reconnectAttempts) {
          logger.warn('useWebSocket', 'Max reconnection attempts reached. Real-time updates disabled.');
        }
      };

      ws.onerror = (error) => {
        logger.debug('useWebSocket', 'Connection error:', error);
        setConnectionState('error');
        
        // Provide user-friendly error context
        const errorContext = {
          message: 'WebSocket connection error. Real-time updates may be delayed.',
          timestamp: Date.now(),
          reconnectAttempt: reconnectCountRef.current
        };
        
        onError?.(error);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          // Call global message handler
          onMessage?.(message);
          
          // Trigger subscriptions for this event type
          const subscribers = subscriptionsRef.current.get(message.type);
          if (subscribers) {
            subscribers.forEach(callback => {
              try {
                callback(message.payload);
              } catch (error) {
                logger.debug('useWebSocket', `Error in subscriber for ${message.type}:`, error);
              }
            });
          }
        } catch (error) {
          logger.debug('useWebSocket', 'Error parsing message:', error);
        }
      };
    } catch (error) {
      logger.debug('useWebSocket', 'Connection error:', error);
      setConnectionState('error');
    }
  }, [url, reconnect, reconnectAttempts, getReconnectDelay, onConnect, onDisconnect, onError, onMessage, sendHeartbeat]);

  // Send message
  const sendMessage = useCallback((type: string, payload: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type,
        payload,
        timestamp: Date.now()
      }));
    } else {
      logger.warn('useWebSocket', 'Cannot send message - not connected');
    }
  }, []);

  // Subscribe to event type
  const subscribe = useCallback((eventType: string, callback: (payload: any) => void) => {
    // Initialize subscription set if needed
    if (!subscriptionsRef.current.has(eventType)) {
      subscriptionsRef.current.set(eventType, new Set());
    }
    
    // Add callback to subscribers
    const subscribers = subscriptionsRef.current.get(eventType)!;
    subscribers.add(callback);
    
    // Return unsubscribe function
    return () => {
      const subscribers = subscriptionsRef.current.get(eventType);
      if (subscribers) {
        subscribers.delete(callback);
        
        // Clean up empty subscription sets
        if (subscribers.size === 0) {
          subscriptionsRef.current.delete(eventType);
        }
      }
    };
  }, []);

  // Manual reconnect
  const reconnectManual = useCallback(() => {
    logger.log('useWebSocket', 'Manual reconnect triggered');
    reconnectCountRef.current = 0;
    connect();
  }, [connect]);

  // Manual disconnect
  const disconnect = useCallback(() => {
    logger.log('useWebSocket', 'Manual disconnect');
    shouldConnectRef.current = false;
    
    // Clear reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    // Clear heartbeat
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
    }
    
    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setConnectionState('disconnected');
  }, []);

  // Connect/disconnect based on enabled flag
  useEffect(() => {
    if (!enabled) {
      // Disconnect if disabled
      if (wsRef.current) {
        shouldConnectRef.current = false;
        // Clear reconnection timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        
        // Clear heartbeat
        if (heartbeatTimeoutRef.current) {
          clearTimeout(heartbeatTimeoutRef.current);
        }
        
        // Close WebSocket
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
        
        setConnectionState('disconnected');
      }
      return;
    }
    
    // Connect if enabled
    shouldConnectRef.current = true;
    connect();
    
    // Cleanup on unmount
    return () => {
      shouldConnectRef.current = false;
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
      }
      
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, url]);

  return {
    connectionState,
    isConnected: connectionState === 'connected',
    sendMessage,
    subscribe,
    reconnect: reconnectManual,
    disconnect
  };
}
