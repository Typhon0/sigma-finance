# Dashboard Performance Monitoring Implementation

This document describes the comprehensive monitoring and analytics system implemented for the dashboard-centric portfolio tracker architecture.

## Overview

The monitoring system provides real-time performance tracking, user engagement analytics, error monitoring, and market data quality assessment. It's designed to help optimize the dashboard experience and identify performance bottlenecks.

## Architecture

### Backend Components

#### 1. MonitoringService (`server/internal/service/monitoring_service.go`)
- **Purpose**: Core monitoring service that collects, aggregates, and stores metrics
- **Features**:
  - Real-time metric collection with configurable retention
  - Alert rule processing with customizable thresholds
  - Event processing pipeline for different event types
  - Metric aggregation (avg, min, max, percentiles)
  - Alert triggering with multiple action types (log, webhook, email)

#### 2. MarketDataMonitor (`server/internal/service/market_data_monitor.go`)
- **Purpose**: Specialized monitoring for market data quality and performance
- **Features**:
  - Data source reliability tracking
  - Price validation and outlier detection
  - Uptime monitoring for market data providers
  - Quality score calculation (0-100 scale)
  - Stale data detection and alerting

#### 3. Monitoring Middleware (`server/internal/handler/middleware/monitoring.go`)
- **Purpose**: HTTP and GraphQL request monitoring
- **Features**:
  - Request duration tracking
  - Error rate monitoring
  - Operation-specific metrics
  - User context tracking

#### 4. GraphQL Resolvers (`server/internal/handler/graphql/resolver/monitoring.go`)
- **Purpose**: API endpoints for monitoring data access
- **Features**:
  - Performance metrics queries
  - System health status
  - User engagement analytics
  - Real-time monitoring data subscriptions

### Frontend Components

#### 1. Performance Monitoring Hook (`client/src/hooks/use-performance-monitoring.ts`)
- **Purpose**: Core frontend monitoring functionality
- **Features**:
  - Browser performance API integration
  - Core Web Vitals tracking (LCP, FID, CLS)
  - Error tracking and reporting
  - Custom event recording
  - Real-time metrics streaming

#### 2. Dashboard Monitoring Hook (`client/src/hooks/use-dashboard-monitoring.ts`)
- **Purpose**: Dashboard-specific monitoring and analytics
- **Features**:
  - State transition tracking
  - User interaction monitoring
  - Data loading performance
  - Component render time tracking
  - Memory usage monitoring

#### 3. Monitoring Provider (`client/src/components/monitoring/monitoring-provider.tsx`)
- **Purpose**: React context provider for monitoring functionality
- **Features**:
  - Global error boundary integration
  - Performance observer setup
  - Network status monitoring
  - Page visibility tracking
  - Higher-order component for automatic monitoring

#### 4. Performance Dashboard (`client/src/components/monitoring/performance-dashboard.tsx`)
- **Purpose**: Administrative dashboard for monitoring data visualization
- **Features**:
  - Real-time performance metrics display
  - User engagement analytics
  - Error analysis and trends
  - Market data quality monitoring
  - Interactive charts and visualizations

## Key Metrics Tracked

### Performance Metrics
- **Dashboard State Transitions**: Time taken to switch between views
- **Data Loading Times**: API response times and data fetching performance
- **Component Render Times**: React component rendering performance
- **Memory Usage**: JavaScript heap size and memory consumption
- **Core Web Vitals**: LCP, FID, CLS for user experience measurement

### User Engagement Metrics
- **User Interactions**: Clicks, form submissions, navigation patterns
- **Session Duration**: Time spent in different dashboard views
- **Feature Usage**: Most used dashboard features and components
- **Navigation Patterns**: Common user flows and conversion rates
- **Device Breakdown**: Desktop vs mobile vs tablet usage

### Error Metrics
- **Error Rates**: JavaScript errors, API failures, component crashes
- **Error Distribution**: Errors by component and severity
- **Recovery Metrics**: Error recovery success rates
- **User Impact**: Errors affecting user workflows

### Market Data Quality
- **Update Frequency**: How often market data is refreshed
- **Data Staleness**: Age of market data and stale data detection
- **Source Reliability**: Uptime and success rates for data providers
- **Price Validation**: Outlier detection and data quality scores
- **Latency Metrics**: Market data API response times

## Alert System

### Alert Types
1. **Performance Alerts**
   - Slow dashboard transitions (>2s average)
   - High data loading times (>5s P95)
   - Memory usage spikes (>400MB)

2. **Error Alerts**
   - High error rates (>5% of requests)
   - Critical component failures
   - Market data update failures

3. **Quality Alerts**
   - Stale market data (>15 minutes old)
   - Low data quality scores (<80)
   - Market data source downtime

4. **Engagement Alerts**
   - Low user activity periods
   - High bounce rates
   - Feature usage anomalies

### Alert Actions
- **Logging**: Structured log entries for debugging
- **Webhooks**: HTTP notifications to external systems
- **Email**: Email notifications for critical issues
- **Slack**: Team notifications (configurable)

## Configuration

### Monitoring Configuration (`server/internal/config/monitoring.go`)
```go
type MonitoringConfig struct {
    Enabled                bool
    MetricsRetentionPeriod time.Duration
    AlertRules             []AlertRule
    MarketDataThresholds   MarketDataAlertThresholds
    PerformanceThresholds  PerformanceThresholds
    SamplingRates          SamplingRates
}
```

### Sampling Rates
- **User Interactions**: 10% (to reduce noise)
- **Performance Metrics**: 50% (balance between data and overhead)
- **Error Events**: 100% (capture all errors)
- **Market Data Updates**: 20% (high volume, sample for trends)
- **State Transitions**: 100% (critical for UX analysis)

## Usage Examples

### Frontend Integration

```typescript
// Basic monitoring setup
import { MonitoringProvider } from '@/components/monitoring/monitoring-provider';
import { useDashboardMonitoring } from '@/hooks/use-dashboard-monitoring';

function App() {
  return (
    <MonitoringProvider>
      <Dashboard />
    </MonitoringProvider>
  );
}

// Component-level monitoring
function MyComponent() {
  const { trackComponentRender, trackError } = useDashboardMonitoring();
  
  useEffect(() => {
    const startTime = Date.now();
    // Component logic
    trackComponentRender('MyComponent', Date.now() - startTime);
  }, []);
  
  const handleError = (error: Error) => {
    trackError(error, 'MyComponent', { context: 'user-action' });
  };
}

// Data loading monitoring
const { trackDataLoading } = useDashboardMonitoring();

const fetchData = async () => {
  return trackDataLoading(
    () => api.getPortfolioData(),
    'portfolio_data'
  );
};
```

### Backend Integration

```go
// Service setup
monitoringService := service.NewMonitoringService()
marketDataMonitor := service.NewMarketDataMonitor(monitoringService)

// Record market data update
marketDataMonitor.RecordMarketDataUpdate(service.MarketDataUpdate{
    Source:    "alpha_vantage",
    AssetID:   "AAPL",
    AssetType: "STOCK",
    Price:     decimal.NewFromFloat(150.25),
    Timestamp: time.Now(),
    Success:   true,
})

// Record custom metric
monitoringService.RecordMetric(
    "custom_operation_duration",
    operationTime.Seconds(),
    service.MetricTypeTiming,
    map[string]string{"operation": "portfolio_calculation"},
)
```

## Performance Optimizations

### Data Sampling
- Configurable sampling rates to balance data collection with performance
- Smart sampling based on user activity and error rates
- Batch processing for high-volume events

### Memory Management
- Automatic metric cleanup after retention period
- Circular buffers for real-time metrics
- Efficient data structures for aggregations

### Network Optimization
- Event batching to reduce HTTP requests
- Compression for large metric payloads
- Offline queuing with retry mechanisms

## Monitoring Dashboard Features

### Real-time Metrics
- Live performance indicators
- System health status
- Active user counts
- Error rates and trends

### Historical Analysis
- Performance trends over time
- User engagement patterns
- Error frequency analysis
- Market data quality trends

### Interactive Visualizations
- Time-series charts for performance metrics
- Pie charts for device and error breakdowns
- Heatmaps for user interaction patterns
- Comparison charts for A/B testing

### Export and Reporting
- CSV export for detailed analysis
- PDF reports for stakeholders
- API access for external tools
- Scheduled report generation

## Security and Privacy

### Data Protection
- User data anonymization options
- Configurable data retention periods
- GDPR compliance features
- Secure data transmission

### Access Control
- Role-based access to monitoring data
- API key authentication for external access
- Audit logging for monitoring access
- Data encryption at rest and in transit

## Testing

### Unit Tests
- Monitoring hook functionality
- Metric calculation accuracy
- Alert rule processing
- Error handling scenarios

### Integration Tests
- End-to-end monitoring flow
- GraphQL API functionality
- Real-time subscription testing
- Performance under load

### Performance Tests
- Monitoring overhead measurement
- High-volume event processing
- Memory usage validation
- Network impact assessment

## Deployment Considerations

### Infrastructure Requirements
- Redis for caching and real-time data
- PostgreSQL for persistent metric storage
- WebSocket support for real-time updates
- Sufficient memory for metric aggregation

### Scaling Strategies
- Horizontal scaling for high-volume deployments
- Database partitioning for large datasets
- CDN integration for dashboard assets
- Load balancing for monitoring endpoints

### Monitoring the Monitoring
- Self-monitoring capabilities
- Health checks for monitoring services
- Alerting for monitoring system failures
- Backup and recovery procedures

## Future Enhancements

### Planned Features
- Machine learning for anomaly detection
- Predictive performance analytics
- Advanced user behavior analysis
- Integration with external APM tools

### Potential Integrations
- Datadog/New Relic integration
- Slack/Teams notification channels
- Grafana dashboard support
- Prometheus metrics export

This monitoring implementation provides comprehensive visibility into the dashboard-centric portfolio tracker, enabling data-driven optimization and proactive issue resolution.