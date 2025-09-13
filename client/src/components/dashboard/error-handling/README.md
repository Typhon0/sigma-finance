# Dashboard Error Handling System

This comprehensive error handling system provides robust error management, loading states, retry mechanisms, and offline support for the dashboard components.

## Overview

The error handling system consists of several interconnected components:

- **DashboardErrorBoundary**: Context-aware error boundaries with recovery options
- **DashboardErrorManager**: Centralized error state management and reporting
- **RetryMechanism**: Intelligent retry logic with exponential backoff
- **OfflineHandler**: Offline detection and graceful degradation
- **LoadingStates**: Enhanced skeleton components for better UX
- **ChartErrorFallback**: Specialized error handling for chart components

## Components

### DashboardErrorBoundary

Enhanced error boundary with context-specific error handling and recovery options.

```tsx
import { DashboardErrorBoundary } from '@/components/dashboard/error-handling';

<DashboardErrorBoundary
  context="chart"
  componentName="AssetAllocationChart"
  onNavigateBack={() => goBack()}
  onNavigateHome={() => goHome()}
>
  <AssetAllocationChart data={data} />
</DashboardErrorBoundary>
```

**Features:**
- Context-specific error messages (overview, portfolio-detail, asset-detail, chart, component)
- Auto-retry for network errors
- Navigation options for detail views
- Development error details
- Error severity classification

### DashboardErrorManager

Centralized error state management with reporting and recovery capabilities.

```tsx
import { 
  DashboardErrorManagerProvider, 
  useDashboardErrorManager 
} from '@/components/dashboard/error-handling';

// Wrap your app
<DashboardErrorManagerProvider>
  <YourApp />
</DashboardErrorManagerProvider>

// Use in components
const { actions, errorState } = useDashboardErrorManager();

// Report errors
actions.reportError(error, 'component', 'ComponentName');

// Handle view transitions
const { handleTransitionError } = useViewTransitionErrorHandler();
handleTransitionError(error, 'overview', 'portfolio-detail');
```

**Features:**
- Error tracking and categorization
- Critical error detection
- Auto-cleanup of resolved errors
- View transition error handling
- Error recovery workflows

### RetryMechanism

Intelligent retry system with exponential backoff and jitter.

```tsx
import { useRetryMechanism, RetryButton, AutoRetryWrapper } from '@/components/dashboard/error-handling';

// Manual retry control
const { retryState, retry } = useRetryMechanism(async () => {
  await fetchData();
});

// Auto-retry wrapper
<AutoRetryWrapper
  retryFn={async () => await refetch()}
  showStatus={true}
  showButton={true}
>
  <YourComponent />
</AutoRetryWrapper>
```

**Configuration:**
```tsx
const config = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true
};
```

### OfflineHandler

Offline detection with graceful degradation and cached data support.

```tsx
import { 
  useOfflineHandler, 
  OfflineIndicator, 
  OfflineFallback,
  useOfflineCache 
} from '@/components/dashboard/error-handling';

// Offline state management
const { offlineState } = useOfflineHandler();

// Offline indicator
<OfflineIndicator offlineState={offlineState} variant="minimal" />

// Offline fallback wrapper
<OfflineFallback
  offlineState={offlineState}
  hasData={!!data}
  onRefresh={() => refetch()}
>
  <YourComponent />
</OfflineFallback>

// Data caching
const { cachedData, cacheData } = useOfflineCache('dashboard-data');
```

### Loading States

Enhanced skeleton components for better loading experiences.

```tsx
import { 
  InlineChartSkeleton,
  InlinePortfolioDetailSkeleton,
  MetricCardsSkeleton,
  AssetListSkeleton,
  TransactionListSkeleton,
  ProgressiveLoader
} from '@/components/dashboard/error-handling';

// Chart skeleton
<InlineChartSkeleton height={300} title="Asset Allocation" />

// Progressive loading
<ProgressiveLoader
  isLoading={loading}
  hasData={!!data}
  error={error}
  skeleton={<InlineChartSkeleton />}
  emptyState={<EmptyState />}
  errorFallback={<ErrorFallback />}
>
  <YourComponent />
</ProgressiveLoader>
```

### ChartErrorFallback

Specialized error handling for chart components with fallback data support.

```tsx
import { ChartErrorFallback } from '@/components/dashboard/error-handling';

<ChartErrorFallback
  error={error}
  onRetry={() => retry()}
  chartType="pie"
  title="Asset Allocation"
  showFallbackData={true}
/>
```

## Usage Patterns

### Component-Level Error Handling

```tsx
import { useComponentErrorHandler } from '@/components/dashboard/error-handling';

function MyComponent() {
  const { handleErrorWithRetry, reportError } = useComponentErrorHandler('MyComponent', 'component');

  const handleAction = async () => {
    await handleErrorWithRetry(async () => {
      // Your async operation
      await performAction();
    });
  };

  return <button onClick={handleAction}>Action</button>;
}
```

### Dashboard Integration

```tsx
import { 
  DashboardErrorBoundary,
  OfflineFallback,
  AutoRetryWrapper 
} from '@/components/dashboard/error-handling';

function DashboardSection() {
  return (
    <DashboardErrorBoundary context="overview" componentName="DashboardSection">
      <OfflineFallback offlineState={offlineState} hasData={!!data}>
        <AutoRetryWrapper retryFn={refetch}>
          <YourDashboardContent />
        </AutoRetryWrapper>
      </OfflineFallback>
    </DashboardErrorBoundary>
  );
}
```

### Chart Components

```tsx
import { DashboardErrorBoundary, ChartErrorFallback } from '@/components/dashboard/error-handling';

function ChartComponent({ data, isLoading, error }) {
  if (error) {
    return (
      <ChartErrorFallback
        error={error}
        chartType="line"
        title="Performance Chart"
        onRetry={() => refetch()}
        showFallbackData={hasCachedData}
      />
    );
  }

  return (
    <DashboardErrorBoundary context="chart" componentName="ChartComponent">
      {/* Your chart implementation */}
    </DashboardErrorBoundary>
  );
}
```

## Error Context Types

- **overview**: Dashboard main view errors
- **portfolio-detail**: Portfolio detail view errors
- **asset-detail**: Asset detail view errors
- **chart**: Chart rendering errors
- **component**: General component errors

## Best Practices

### 1. Error Boundary Placement
- Place error boundaries at logical component boundaries
- Use context-specific boundaries for different dashboard sections
- Provide navigation options for detail views

### 2. Error Reporting
- Report errors with appropriate context and component names
- Use the error manager for centralized tracking
- Include relevant metadata for debugging

### 3. Retry Logic
- Use exponential backoff for network errors
- Limit retry attempts to prevent infinite loops
- Provide manual retry options for user control

### 4. Offline Handling
- Cache critical data for offline access
- Provide clear offline indicators
- Gracefully degrade functionality when offline

### 5. Loading States
- Use appropriate skeleton components for different content types
- Match skeleton structure to actual content layout
- Provide smooth transitions between loading and loaded states

## Testing

The error handling system includes comprehensive tests covering:

- Error boundary behavior
- Error manager functionality
- Retry mechanism logic
- Offline state handling
- Loading state rendering
- Error recovery workflows

Run tests with:
```bash
npm run test -- src/components/dashboard/error-handling
```

## Configuration

### Global Configuration

```tsx
// In your app root
<DashboardErrorManagerProvider
  onCriticalError={(error) => {
    // Handle critical errors
    console.error('Critical dashboard error:', error);
  }}
  onRecovery={() => {
    // Handle successful recovery
    console.log('Dashboard recovered from error');
  }}
>
  <App />
</DashboardErrorManagerProvider>
```

### Retry Configuration

```tsx
const retryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true
};

const { retryState, retry } = useRetryMechanism(retryFn, retryConfig);
```

## Monitoring and Analytics

The error handling system supports integration with monitoring services:

```tsx
// Error reporting integration
if (typeof window !== "undefined" && window.reportError) {
  window.reportError(error, {
    context: 'dashboard',
    componentName: 'ComponentName',
    retryCount: 2,
    userAgent: navigator.userAgent
  });
}
```

## Performance Considerations

- Error boundaries have minimal performance impact
- Retry mechanisms use efficient timers and cleanup
- Offline detection uses native browser APIs
- Loading skeletons are lightweight and optimized
- Error state management uses React's built-in optimization

## Browser Support

- Modern browsers with ES2018+ support
- Progressive enhancement for older browsers
- Graceful fallbacks for unsupported features
- Offline detection works in all modern browsers

## Migration Guide

### From Basic Error Boundaries

```tsx
// Before
<ErrorBoundary>
  <Component />
</ErrorBoundary>

// After
<DashboardErrorBoundary context="component" componentName="Component">
  <Component />
</DashboardErrorBoundary>
```

### Adding Retry Logic

```tsx
// Before
const handleClick = async () => {
  try {
    await action();
  } catch (error) {
    console.error(error);
  }
};

// After
const { handleErrorWithRetry } = useComponentErrorHandler('Component');

const handleClick = async () => {
  await handleErrorWithRetry(async () => {
    await action();
  });
};
```

This error handling system provides a robust foundation for managing errors, loading states, and offline scenarios in the dashboard application, ensuring a smooth user experience even when things go wrong.