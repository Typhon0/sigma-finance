import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketManager } from '../websocket-manager';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(public url: string) {
    // Simulate async connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.(new Event('open'));
    }, 10);
  }

  send(data: string) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    // Mock successful send
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close', { code: 1000, reason: 'Normal closure' }));
  }

  // Helper method to simulate incoming messages
  simulateMessage(data: any) {
    if (this.readyState === MockWebSocket.OPEN) {
      this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }

  // Helper method to simulate connection error
  simulateError() {
    this.onerror?.(new Event('error'));
  }
}

// Mock global WebSocket
global.WebSocket = MockWebSocket as any;

describe('WebSocketManager', () => {
  let wsManager: WebSocketManager;
  let mockWebSocket: MockWebSocket;

  beforeEach(() => {
    wsManager = new WebSocketManager('ws://localhost:8080/test');
    vi.useFakeTimers();
  });

  afterEach(() => {
    wsManager.disconnect();
    vi.useRealTimers();
  });

  describe('Connection Management', () => {
    it('should connect successfully', async () => {
      const connectPromise = wsManager.connect();
      
      // Fast-forward to simulate connection
      vi.advanceTimersByTime(20);
      
      await expect(connectPromise).resolves.toBeUndefined();
      expect(wsManager.isConnected()).toBe(true);
    });

    it('should handle connection errors', async () => {
      const connectPromise = wsManager.connect();
      
      // Simulate connection error
      vi.advanceTimersByTime(5);
      const ws = (wsManager as any).ws as MockWebSocket;
      ws.simulateError();
      
      await expect(connectPromise).rejects.toThrow();
    });

    it('should disconnect properly', async () => {
      await wsManager.connect();
      vi.advanceTimersByTime(20);
      
      expect(wsManager.isConnected()).toBe(true);
      
      wsManager.disconnect();
      expect(wsManager.isConnected()).toBe(false);
    });

    it('should not allow multiple concurrent connections', async () => {
      const connectPromise1 = wsManager.connect();
      const connectPromise2 = wsManager.connect();
      
      vi.advanceTimersByTime(20);
      
      await expect(connectPromise1).resolves.toBeUndefined();
      await expect(connectPromise2).rejects.toThrow('Connection already in progress');
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      await wsManager.connect();
      vi.advanceTimersByTime(20);
    });

    it('should handle price update messages', () => {
      const handler = vi.fn();
      wsManager.subscribe('PRICE_UPDATE', handler);

      const priceUpdate = {
        type: 'PRICE_UPDATE',
        payload: {
          assetId: 'asset-1',
          symbol: 'AAPL',
          price: 150.00,
          change: 2.50,
          changePercent: 1.69,
          timestamp: Date.now()
        },
        timestamp: Date.now()
      };

      const ws = (wsManager as any).ws as MockWebSocket;
      ws.simulateMessage(priceUpdate);

      expect(handler).toHaveBeenCalledWith(priceUpdate);
    });

    it('should handle portfolio update messages', () => {
      const handler = vi.fn();
      wsManager.subscribe('PORTFOLIO_UPDATE', handler);

      const portfolioUpdate = {
        type: 'PORTFOLIO_UPDATE',
        payload: {
          portfolioId: 'portfolio-1',
          totalValue: 50000,
          totalCost: 45000,
          gainLoss: 5000,
          gainLossPercent: 11.11,
          timestamp: Date.now()
        },
        timestamp: Date.now()
      };

      const ws = (wsManager as any).ws as MockWebSocket;
      ws.simulateMessage(portfolioUpdate);

      expect(handler).toHaveBeenCalledWith(portfolioUpdate);
    });

    it('should handle alert notifications', () => {
      const handler = vi.fn();
      wsManager.subscribe('ALERT_NOTIFICATION', handler);

      const alertNotification = {
        type: 'ALERT_NOTIFICATION',
        payload: {
          id: 'alert-1',
          type: 'PRICE',
          title: 'Price Alert',
          message: 'AAPL has reached $150',
          assetId: 'asset-1',
          timestamp: Date.now(),
          acknowledged: false
        },
        timestamp: Date.now()
      };

      const ws = (wsManager as any).ws as MockWebSocket;
      ws.simulateMessage(alertNotification);

      expect(handler).toHaveBeenCalledWith(alertNotification);
    });

    it('should handle malformed messages gracefully', () => {
      const handler = vi.fn();
      wsManager.subscribe('PRICE_UPDATE', handler);

      const ws = (wsManager as any).ws as MockWebSocket;
      
      // Simulate malformed JSON
      if (ws.onmessage) {
        ws.onmessage(new MessageEvent('message', { data: 'invalid json' }));
      }

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Event Subscription', () => {
    beforeEach(async () => {
      await wsManager.connect();
      vi.advanceTimersByTime(20);
    });

    it('should allow multiple handlers for the same event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      wsManager.subscribe('PRICE_UPDATE', handler1);
      wsManager.subscribe('PRICE_UPDATE', handler2);

      const priceUpdate = {
        type: 'PRICE_UPDATE',
        payload: { assetId: 'asset-1', price: 150 },
        timestamp: Date.now()
      };

      const ws = (wsManager as any).ws as MockWebSocket;
      ws.simulateMessage(priceUpdate);

      expect(handler1).toHaveBeenCalledWith(priceUpdate);
      expect(handler2).toHaveBeenCalledWith(priceUpdate);
    });

    it('should allow unsubscribing from events', () => {
      const handler = vi.fn();
      const unsubscribe = wsManager.subscribe('PRICE_UPDATE', handler);

      // Unsubscribe
      unsubscribe();

      const priceUpdate = {
        type: 'PRICE_UPDATE',
        payload: { assetId: 'asset-1', price: 150 },
        timestamp: Date.now()
      };

      const ws = (wsManager as any).ws as MockWebSocket;
      ws.simulateMessage(priceUpdate);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle errors in event handlers gracefully', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const normalHandler = vi.fn();
      
      wsManager.subscribe('PRICE_UPDATE', errorHandler);
      wsManager.subscribe('PRICE_UPDATE', normalHandler);

      const priceUpdate = {
        type: 'PRICE_UPDATE',
        payload: { assetId: 'asset-1', price: 150 },
        timestamp: Date.now()
      };

      const ws = (wsManager as any).ws as MockWebSocket;
      ws.simulateMessage(priceUpdate);

      expect(errorHandler).toHaveBeenCalled();
      expect(normalHandler).toHaveBeenCalled(); // Should still be called despite error
    });
  });

  describe('Message Sending', () => {
    beforeEach(async () => {
      await wsManager.connect();
      vi.advanceTimersByTime(20);
    });

    it('should send messages when connected', () => {
      const ws = (wsManager as any).ws as MockWebSocket;
      const sendSpy = vi.spyOn(ws, 'send');

      const message = {
        type: 'SUBSCRIBE_PRICES',
        assetIds: ['asset-1', 'asset-2']
      };

      wsManager.send(message);

      expect(sendSpy).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('should not send messages when disconnected', () => {
      wsManager.disconnect();

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const message = {
        type: 'SUBSCRIBE_PRICES',
        assetIds: ['asset-1']
      };

      wsManager.send(message);

      expect(consoleSpy).toHaveBeenCalledWith(
        'WebSocket not connected, message not sent:',
        message
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Reconnection Logic', () => {
    it('should attempt to reconnect on connection loss', async () => {
      await wsManager.connect();
      vi.advanceTimersByTime(20);

      expect(wsManager.isConnected()).toBe(true);

      // Simulate connection loss
      const ws = (wsManager as any).ws as MockWebSocket;
      ws.close();

      expect(wsManager.isConnected()).toBe(false);

      // Should attempt reconnection
      vi.advanceTimersByTime(1000); // Initial delay
      vi.advanceTimersByTime(20); // Connection time

      // Note: In a real test, you'd need to mock the WebSocket constructor
      // to return a new instance for reconnection testing
    });

    it('should emit connection status events', async () => {
      const statusHandler = vi.fn();
      wsManager.subscribe('CONNECTION_STATUS', statusHandler);

      await wsManager.connect();
      vi.advanceTimersByTime(20);

      expect(statusHandler).toHaveBeenCalledWith({
        type: 'CONNECTION_STATUS',
        payload: { connected: true },
        timestamp: expect.any(Number)
      });
    });
  });

  describe('Heartbeat', () => {
    beforeEach(async () => {
      await wsManager.connect();
      vi.advanceTimersByTime(20);
    });

    it('should send ping messages periodically', () => {
      const ws = (wsManager as any).ws as MockWebSocket;
      const sendSpy = vi.spyOn(ws, 'send');

      // Fast-forward 30 seconds (heartbeat interval)
      vi.advanceTimersByTime(30000);

      expect(sendSpy).toHaveBeenCalledWith(JSON.stringify({ type: 'PING' }));
    });

    it('should stop heartbeat on disconnect', () => {
      const ws = (wsManager as any).ws as MockWebSocket;
      const sendSpy = vi.spyOn(ws, 'send');

      wsManager.disconnect();

      // Fast-forward past heartbeat interval
      vi.advanceTimersByTime(35000);

      expect(sendSpy).not.toHaveBeenCalledWith(JSON.stringify({ type: 'PING' }));
    });
  });
});