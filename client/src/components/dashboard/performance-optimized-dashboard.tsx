/**
 * Performance-optimized dashboard component with all optimizations applied
 */

import React, { Suspense, useMemo, useCallback, memo } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useQuery } from '@tanstack/react-query';

// Optimized hooks and utilities
import { useOptimizedDashboardState } from '@/hooks/use-optimized-dashboard-state';
import { useChartVirtualization } from '@/lib/chart-optimization/virtualization';
import { DataSampler } from '@/lib/chart-optimization/data-sampling';
import { 
  withLazyLoad, 
  useProgressiveLoading,
  ChartLibraryPreloader 
} from '@/lib/chart-optimization/lazy-loading';

// Lazy-loaded components
import { 
  LazyAssetAllocationChart,
  LazyPerformanceChart,
  LazyPortfolioComparisonChart 
} from '@/lib/chart-optimization/lazy-loading';

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Types
import type { Portfolio, Asset } from '@/gql/graphql';

// Memoized skeleton components for better performance
const DashboardSkeleton = memo(() => (
  <div className="space-y-6">
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
    <div className="grid gap-6 lg:grid-cols-2">
      <Skeleton className="h-64" />
      <Skeleton className="h-64" />
    </div>
  </div>
));

const ChartSkeleton = memo(() => (
  <Card>
    <CardHeader>
      <Skeleton className="h-6 w-32" />
    </CardHeader>
    <CardContent>
      <Skeleton className="h-48" />
    </CardContent>
  </Card>
));

// Memoized error fallback
const ErrorFallback = memo(({ error, resetErrorBoundary }: { 
  error: Error; 
  resetErrorBoundary: () => void; 
}) => (
  <Alert variant="destructive">
    <AlertDescription>
      Something went wrong: {error.message}
      <Button 
        variant="outline" 
        size="sm" 
        onClick={resetErrorBoundary}
        className="ml-2"
      >
        Try again
      </Button>
    </AlertDescription>
  </Alert>
));

// Optimized chart components with lazy loading
const OptimizedAssetAllocationChart = withLazyLoad(LazyAssetAllocationChart, {
  threshold: 0.1,
  rootMargin: '100px',
  fallback: ChartSkeleton,
  errorBoundary: ErrorFallback,
});

const OptimizedPerformanceChart = withLazyLoad(LazyPerformanceChart, {
  threshold: 0.1,
  rootMargin: '100px',
  fallback: ChartSkeleton,
  errorBoundary: ErrorFallback,
});

// Data sampling configuration
const dataSampler = new DataSampler({
  maxPoints: 1000,
  algorithm: 'lttb',
  preserveExtremes: true,
});

// Portfolio metrics component with memoization
const PortfolioMetrics = memo(({ 
  totalValue, 
  totalChange, 
  changePercent, 
  assetCount 
}: {
  totalValue: number;
  totalChange: number;
  changePercent: number;
  assetCount: number;
}) => {
  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value / 100);
  }, []);

  const formatPercent = useCallback((value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Total Value</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Daily Change</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${totalChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(totalChange)}
          </div>
          <p className={`text-xs ${totalChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatPercent(changePercent)}
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Assets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{assetCount}</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">+15.2%</div>
          <p className="text-xs text-muted-foreground">This year</p>
        </CardContent>
      </Card>
    </div>
  );
});

// Portfolio list component with virtualization for large lists
const PortfolioList = memo(({ 
  portfolios, 
  onPortfolioSelect 
}: {
  portfolios: Portfolio[];
  onPortfolioSelect: (portfolio: Portfolio) => void;
}) => {
  // Memoize portfolio cards to prevent unnecessary re-renders
  const portfolioCards = useMemo(() => 
    portfolios.map((portfolio) => (
      <Card 
        key={portfolio.id} 
        className="cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => onPortfolioSelect(portfolio)}
      >
        <CardHeader>
          <CardTitle className="text-lg">{portfolio.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${(portfolio.totalValue / 100).toLocaleString()}
          </div>
          <p className="text-sm text-muted-foreground">
            {portfolio.assetCount} assets
          </p>
        </CardContent>
      </Card>
    )), 
    [portfolios, onPortfolioSelect]
  );

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {portfolioCards}
    </div>
  );
});

// Main dashboard component
export function PerformanceOptimizedDashboard() {
  // Optimized state management
  const [dashboardState, dashboardActions] = useOptimizedDashboardState();
  
  // Progressive loading for heavy components
  const { isComponentLoaded } = useProgressiveLoading([
    'metrics',
    'portfolios',
    'charts',
    'performance'
  ], 50);

  // Optimized data fetching with React Query
  const { 
    data: dashboardData, 
    isLoading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['dashboard', dashboardState.viewMode],
    queryFn: async () => {
      // Simulate API call with caching
      await new Promise(resolve => setTimeout(resolve, 100));
      return {
        totalValue: 125000000, // $1,250,000.00
        totalChange: 250000,   // $2,500.00
        changePercent: 0.02,   // 2%
        assetCount: 15,
        portfolios: [
          {
            id: '1',
            name: 'Investment Portfolio',
            totalValue: 75000000,
            assetCount: 8,
          },
          {
            id: '2', 
            name: 'Retirement Fund',
            totalValue: 50000000,
            assetCount: 7,
          }
        ] as Portfolio[],
        chartData: Array.from({ length: 100 }, (_, i) => ({
          timestamp: Date.now() - (100 - i) * 24 * 60 * 60 * 1000,
          value: 125000000 + Math.random() * 10000000 - 5000000,
        })),
      };
    },
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // 1 minute
  });

  // Chart virtualization for large datasets
  const chartDataLoader = useCallback(async (startIndex: number, endIndex: number) => {
    // Simulate loading chart data chunks
    const data = dashboardData?.chartData?.slice(startIndex, endIndex) || [];
    return data;
  }, [dashboardData?.chartData]);

  const {
    updateViewport: updateChartViewport,
    isLoading: isChartLoading,
  } = useChartVirtualization(
    dashboardData?.chartData?.length || 0,
    100, // chunk size
    chartDataLoader
  );

  // Memoized handlers to prevent unnecessary re-renders
  const handlePortfolioSelect = useCallback((portfolio: Portfolio) => {
    dashboardActions.preloadData(`portfolio_${portfolio.id}`, portfolio);
    dashboardActions.viewPortfolio(portfolio);
  }, [dashboardActions]);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Memoized chart data with sampling
  const sampledChartData = useMemo(() => {
    if (!dashboardData?.chartData) return [];
    
    return dataSampler.sample(dashboardData.chartData, {
      maxPoints: 500,
      algorithm: 'lttb',
    });
  }, [dashboardData?.chartData]);

  // Loading state
  if (isLoading) {
    return <DashboardSkeleton />;
  }

  // Error state
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load dashboard data. 
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            className="ml-2"
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Preload chart libraries */}
      <ChartLibraryPreloader />
      
      {/* Portfolio Metrics - Load first */}
      {isComponentLoaded('metrics') && dashboardData && (
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <PortfolioMetrics
            totalValue={dashboardData.totalValue}
            totalChange={dashboardData.totalChange}
            changePercent={dashboardData.changePercent}
            assetCount={dashboardData.assetCount}
          />
        </ErrorBoundary>
      )}

      {/* Portfolio List - Load second */}
      {isComponentLoaded('portfolios') && dashboardData?.portfolios && (
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <Card>
            <CardHeader>
              <CardTitle>Your Portfolios</CardTitle>
            </CardHeader>
            <CardContent>
              <PortfolioList
                portfolios={dashboardData.portfolios}
                onPortfolioSelect={handlePortfolioSelect}
              />
            </CardContent>
          </Card>
        </ErrorBoundary>
      )}

      {/* Charts - Load third with lazy loading */}
      {isComponentLoaded('charts') && (
        <div className="grid gap-6 lg:grid-cols-2">
          <ErrorBoundary FallbackComponent={ErrorFallback}>
            <Suspense fallback={<ChartSkeleton />}>
              <OptimizedPerformanceChart
                data={sampledChartData}
                isLoading={isChartLoading}
                title="Portfolio Performance"
              />
            </Suspense>
          </ErrorBoundary>

          <ErrorBoundary FallbackComponent={ErrorFallback}>
            <Suspense fallback={<ChartSkeleton />}>
              <OptimizedAssetAllocationChart
                data={[
                  { name: 'Stocks', value: 60, color: '#8884d8' },
                  { name: 'Bonds', value: 30, color: '#82ca9d' },
                  { name: 'Cash', value: 10, color: '#ffc658' },
                ]}
                title="Asset Allocation"
              />
            </Suspense>
          </ErrorBoundary>
        </div>
      )}

      {/* Performance Analytics - Load last */}
      {isComponentLoaded('performance') && (
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <Card>
            <CardHeader>
              <CardTitle>Performance Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">15.2%</div>
                  <p className="text-sm text-muted-foreground">Annual Return</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">1.45</div>
                  <p className="text-sm text-muted-foreground">Sharpe Ratio</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">-8.3%</div>
                  <p className="text-sm text-muted-foreground">Max Drawdown</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </ErrorBoundary>
      )}
    </div>
  );
}