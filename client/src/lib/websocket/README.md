# Real-Time WebSocket Integration

This module provides comprehensive real-time functionality for the portfolio tracker dashboard, including WebSocket connection management, real-time data synchronization, and optimistic UI updates.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    React Components                         │
├─────────────────────────────────────────────────────────────┤
│  RealTimeChart  │  RealTimePortfolio  │  AlertNotifications │
│  - Price Charts │  - Portfolio Values │  - Live Alerts     │
│  - Live Updates │  - Optimistic UI    │  - Notifications   │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                React Hooks & Context                        │
├─────────────────────────────────────────────────────────────┤
│  useWebSocket   │  usePriceUpdates    │  useAlertNotifications │
│  - Connection   │  - Asset Prices     │  - Real-time Alerts    │
│  - State Mgmt   │  - Subscriptions    │  - Acknowledgments     │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                WebSocket Manager                            │
├─────────────────────────────────────────────────────────────┤
│  Connection Management  │  Message Routing  │  Reconnection │
│  - Auto-reconnect      │  - Event Handlers │  - Exponential │
│  - Heartbeat          │  - Type Safety    │  - Backoff     │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    WebSocket Server                         │
├─────────────────────────────────────────────────────────────┤
│  Price Feeds    │  Portfolio Updates  │  Alert System     │
│  - Market Data  │  - Value Changes    │  - Notifications  │
│  - Real-time    │  - Performance      │  - Triggers       │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### WebSocket Manager (`websocket-manager.ts`)

The central WebSocket connection manager that handles:

- **Connection Management**: Automatic connection, reconnection with exponential backoff
- **Message Routing**: Type-safe message handling and event distribution
- **Heartbeat**: Keep-alive mechanism to detect connection issues
- **Error Handling**: Graceful error recovery and user feedback

```typescript
import { getWebSocketManager } from '@/lib/websocket/websocket-manager';

const wsManager = getWebSocketManager();

// Connect to WebSocket server
await wsManager.connect();

// Subscribe to events
const unsubscribe = wsManager.subscribe('PRICE_UPDATE', (message) => {
  console.log('Price update:', message.payload);
});

// Send messages
wsManager.send({
  type: 'SUBSCRIBE_PRICES',
  assetIds: ['asset-1', 'asset-2']
});
```

### React Hooks (`useWebSocket.ts`)

#### `useWebSocket()`
Manages WebSocket connection state and provides reconnection functionality.

```typescript
const { connected, connecting, error, reconnect } = useWebSocket();
```

#### `usePriceUpdates(assetIds)`
Subscribes to real-time price updates for specified assets.

```typescript
const { prices, getPriceForAsset } = usePriceUpdates(['AAPL', 'BTC']);
const applePrice = getPriceForAsset('AAPL');
```

#### `usePortfolioUpdates(portfolioIds)`
Subscribes to real-time portfolio value updates.

```typescript
const { portfolios, getPortfolioUpdate } = usePortfolioUpdates(['portfolio-1']);
```

#### `useAlertNotifications()`
Manages real-time alert notifications with acknowledgment support.

```typescript
const { alerts, unreadCount, acknowledgeAlert } = useAlertNotifications();
```

### Real-Time Dashboard Context (`RealTimeDashboardContext.tsx`)

Provides centralized state management for all real-time data with optimistic updates support.

```typescript
import { RealTimeDashboardProvider, useRealTimeDashboard } from '@/contexts/RealTimeDashboardContext';

function App() {
  return (
    <RealTimeDashboardProvider 
      trackedAssets={['asset-1', 'asset-2']}
      trackedPortfolios={['portfolio-1']}
    >
      <Dashboard />
    </RealTimeDashboardProvider>
  );
}

function Dashboard() {
  const { state, actions } = useRealTimeDashboard();
  
  // Get real-time data
  const assetPrice = actions.getAssetPrice('asset-1');
  const portfolioValue = actions.getPortfolioValue('portfolio-1');
  
  // Optimistic updates
  actions.addOptimisticUpdate('portfolio-1', { totalValue: 50000 });
}
```

## Real-Time Components

### `RealTimeChart`
Interactive charts with live price updates using Lightweight Charts™.

```typescript
<RealTimeChart
  assetId="asset-1"
  symbol="AAPL"
  chartType="line"
  height={300}
  showVolume={false}
/>
```

Features:
- Real-time price updates with smooth animations
- Connection status indicators
- Automatic chart scrolling to latest data
- Offline mode with cached data display

### `RealTimePortfolioValue`
Portfolio value display with optimistic updates and real-time synchronization.

```typescript
<RealTimePortfolioValue
  portfolioId="portfolio-1"
  portfolioName="Growth Portfolio"
  showDetailedMetrics={true}
/>
```

Features:
- Real-time value updates with visual indicators
- Optimistic UI for immediate feedback
- Gain/loss calculations with color coding
- Connection status and last update timestamps

### `RealTimeAlertNotifications`
Alert notification system with real-time delivery and acknowledgment.

```typescript
<RealTimeAlertNotifications 
  showInline={true}
  maxVisible={5}
/>

<FloatingAlertNotification />
```

Features:
- Real-time alert delivery
- Visual notification animations
- Acknowledgment system
- Floating notifications for immediate alerts

### `ConnectionStatus`
Connection status indicator with multiple display variants.

```typescript
<ConnectionStatus variant="badge" />
<ConnectionStatus variant="full" showReconnectButton={true} />
<GlobalConnectionStatus />
```

## Message Types

### Price Updates
```typescript
interface PriceUpdate {
  assetId: string;
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: number;
  volume?: number;
}
```

### Portfolio Updates
```typescript
interface PortfolioUpdate {
  portfolioId: string;
  totalValue: number;
  totalCost: number;
  gainLoss: number;
  gainLossPercent: number;
  timestamp: number;
}
```

### Alert Notifications
```typescript
interface AlertNotification {
  id: string;
  type: 'PRICE' | 'PERCENTAGE_CHANGE' | 'PORTFOLIO_VALUE';
  title: string;
  message: string;
  assetId?: string;
  portfolioId?: string;
  timestamp: number;
  acknowledged: boolean;
}
```

## Optimistic Updates

The system supports optimistic UI updates for immediate user feedback:

```typescript
const { updatePortfolioOptimistically } = useOptimisticPortfolioUpdate('portfolio-1');

// Show immediate UI feedback
updatePortfolioOptimistically({
  totalValue: 52000,
  gainLoss: 2000,
  gainLossPercent: 4.0
});

// Real update will override optimistic data when received
```

## Error Handling

### Connection Errors
- Automatic reconnection with exponential backoff
- Visual indicators for connection status
- Graceful degradation to cached data
- User-initiated reconnection options

### Data Errors
- Validation of incoming WebSocket messages
- Fallback to cached data on parse errors
- Error boundaries for component isolation
- User-friendly error messages

## Performance Optimizations

### Connection Management
- Single WebSocket connection per application
- Efficient message routing and subscription management
- Heartbeat mechanism for connection health monitoring
- Automatic cleanup of unused subscriptions

### Data Updates
- Debounced updates to prevent excessive re-renders
- Selective component updates based on data changes
- Efficient state management with React Context
- Memory management for large datasets

### Chart Performance
- Data sampling for large time series
- Smooth animations with requestAnimationFrame
- Lazy loading of chart libraries
- Chart recycling for memory efficiency

## Configuration

### Environment Variables
```bash
# WebSocket server URL
VITE_WS_URL=ws://localhost:8080/ws

# Reconnection settings
VITE_WS_MAX_RECONNECT_ATTEMPTS=5
VITE_WS_RECONNECT_DELAY=1000
```

### WebSocket Server Requirements

The backend WebSocket server should support:

1. **Connection Management**
   - WebSocket upgrade handling
   - Client authentication and authorization
   - Connection lifecycle management

2. **Message Types**
   - `SUBSCRIBE_PRICES` - Subscribe to asset price updates
   - `UNSUBSCRIBE_PRICES` - Unsubscribe from price updates
   - `SUBSCRIBE_PORTFOLIOS` - Subscribe to portfolio updates
   - `ACKNOWLEDGE_ALERT` - Acknowledge alert notifications
   - `PING/PONG` - Heartbeat messages

3. **Data Broadcasting**
   - Real-time price updates from market data feeds
   - Portfolio value recalculations on position changes
   - Alert notifications when conditions are met

## Usage Examples

### Basic Dashboard Integration

```typescript
import { RealTimeDashboardProvider } from '@/contexts/RealTimeDashboardContext';
import { RealTimePortfolioValue } from '@/components/dashboard/RealTimePortfolioValue';
import { RealTimeChart } from '@/components/charts/RealTimeChart';

function Dashboard() {
  const portfolioIds = ['portfolio-1', 'portfolio-2'];
  const assetIds = ['asset-1', 'asset-2', 'asset-3'];

  return (
    <RealTimeDashboardProvider 
      trackedAssets={assetIds}
      trackedPortfolios={portfolioIds}
    >
      <div className="dashboard">
        {portfolioIds.map(id => (
          <RealTimePortfolioValue key={id} portfolioId={id} />
        ))}
        
        {assetIds.map(id => (
          <RealTimeChart key={id} assetId={id} symbol="AAPL" />
        ))}
      </div>
    </RealTimeDashboardProvider>
  );
}
```

### Custom Real-Time Component

```typescript
import { useRealTimeDashboard } from '@/contexts/RealTimeDashboardContext';

function CustomRealTimeComponent({ assetId }: { assetId: string }) {
  const { state, actions } = useRealTimeDashboard();
  
  const priceData = actions.getAssetPrice(assetId);
  const isConnected = state.isConnected;
  
  return (
    <div>
      {isConnected ? (
        <span className="text-green-600">
          Live: ${priceData?.price.toFixed(2)}
        </span>
      ) : (
        <span className="text-gray-600">
          Cached: ${priceData?.price.toFixed(2)}
        </span>
      )}
    </div>
  );
}
```

## Testing

### Mock WebSocket for Testing

```typescript
// __mocks__/websocket-manager.ts
export class MockWebSocketManager {
  private eventHandlers = new Map();
  
  connect() {
    return Promise.resolve();
  }
  
  subscribe(eventType: string, handler: Function) {
    // Mock implementation
    return () => {}; // unsubscribe function
  }
  
  send(message: any) {
    // Mock message sending
  }
  
  // Simulate incoming messages for testing
  simulateMessage(type: string, payload: any) {
    const handlers = this.eventHandlers.get(type);
    handlers?.forEach(handler => handler({ type, payload, timestamp: Date.now() }));
  }
}
```

### Component Testing

```typescript
import { render, screen } from '@testing-library/react';
import { RealTimeDashboardProvider } from '@/contexts/RealTimeDashboardContext';
import { RealTimePortfolioValue } from '@/components/dashboard/RealTimePortfolioValue';

test('displays real-time portfolio value', async () => {
  render(
    <RealTimeDashboardProvider trackedPortfolios={['test-portfolio']}>
      <RealTimePortfolioValue 
        portfolioId="test-portfolio"
        portfolioName="Test Portfolio"
      />
    </RealTimeDashboardProvider>
  );
  
  // Test real-time updates
  // Mock WebSocket message simulation
});
```

## Troubleshooting

### Common Issues

1. **Connection Failures**
   - Check WebSocket server availability
   - Verify CORS settings for WebSocket connections
   - Check network connectivity and firewall settings

2. **Performance Issues**
   - Monitor WebSocket message frequency
   - Check for memory leaks in event handlers
   - Optimize component re-rendering with React.memo

3. **Data Synchronization**
   - Verify message format compatibility
   - Check timestamp handling for data ordering
   - Monitor optimistic update cleanup

### Debug Mode

Enable debug logging:

```typescript
// Set in development environment
localStorage.setItem('ws-debug', 'true');
```

This will log all WebSocket messages and connection events to the browser console.