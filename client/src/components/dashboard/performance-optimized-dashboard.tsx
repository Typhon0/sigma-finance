/**
 * Performance-optimized dashboard component with all optimizations applied
 */

import { memo, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
// UI Components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
// Types
import { useCurrency } from "@/hooks/use-currency";
// Optimized hooks and utilities
import { useOptimizedDashboardState } from "@/hooks/use-optimized-dashboard-state";
import { DataSampler } from "@/lib/chart-optimization/data-sampling";
// Lazy-loaded components
import {
	LazyAssetAllocationChart,
	LazyPerformanceChart,
	withLazyLoad,
} from "@/lib/chart-optimization/lazy-loading";
import { useChartVirtualization } from "@/lib/chart-optimization/virtualization";

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

// Memoized error fallback - matches FallbackProps { error: Error; retry: () => void }
const ErrorFallback = ({
	error,
	resetErrorBoundary,
}: {
	error: Error;
	resetErrorBoundary: () => void;
}) => (
	<Alert variant="destructive">
		<AlertDescription>
			Something went wrong: {error.message}
			<Button variant="outline" size="sm" onClick={resetErrorBoundary} className="ml-2">
				Try again
			</Button>
		</AlertDescription>
	</Alert>
);

// Optimized chart components with lazy loading
const OptimizedAssetAllocationChart = withLazyLoad(LazyAssetAllocationChart, {
	threshold: 0.1,
	rootMargin: "100px",
	fallback: ChartSkeleton,
});

const OptimizedPerformanceChart = withLazyLoad(LazyPerformanceChart, {
	threshold: 0.1,
	rootMargin: "100px",
	fallback: ChartSkeleton,
});

// Data sampling configuration
const dataSampler = new DataSampler({
	maxPoints: 1000,
	algorithm: "lttb",
	preserveExtremes: true,
});

// Portfolio metrics component with memoization
const PortfolioMetrics = memo(
	({
		totalValue,
		totalChange,
		changePercent,
		assetCount,
	}: {
		totalValue: number;
		totalChange: number;
		changePercent: number;
		assetCount: number;
	}) => {
		const { formatCurrency: fmtCurrency } = useCurrency();
		const formatCurrency = useCallback((value: number) => fmtCurrency(value / 100), [fmtCurrency]);

		const formatPercent = useCallback((value: number) => {
			return new Intl.NumberFormat("en-US", {
				style: "percent",
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
						<div
							className={`text-2xl font-bold ${totalChange >= 0 ? "text-green-600" : "text-red-600"}`}
						>
							{formatCurrency(totalChange)}
						</div>
						<p className={`text-xs ${totalChange >= 0 ? "text-green-600" : "text-red-600"}`}>
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
	},
);

// Portfolio list component with virtualization for large lists
interface DashboardPortfolio {
	id: string;
	name: string;
	totalValue: number;
	assetCount: number;
}

const PortfolioList = memo(
	({
		portfolios,
		onPortfolioSelect,
	}: {
		portfolios: DashboardPortfolio[];
		onPortfolioSelect: (portfolio: DashboardPortfolio) => void;
	}) => {
		// Memoize portfolio cards to prevent unnecessary re-renders
		const portfolioCards = useMemo(
			() =>
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
							<p className="text-sm text-muted-foreground">{portfolio.assetCount} assets</p>
						</CardContent>
					</Card>
				)),
			[portfolios, onPortfolioSelect],
		);

		return <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{portfolioCards}</div>;
	},
);

// Main dashboard component
export function PerformanceOptimizedDashboard() {
	// Optimized state management
	const [_dashboardState, dashboardActions] = useOptimizedDashboardState();

	// Progressive loading for heavy components
	const [loadedComponents, setLoadedComponents] = useState<Set<string>>(new Set());
	useEffect(() => {
		const components = ["metrics", "portfolios", "charts", "performance"];
		components.forEach((comp, i) => {
			setTimeout(
				() => {
					setLoadedComponents((prev) => new Set([...prev, comp]));
				},
				(i + 1) * 50,
			);
		});
	}, []);
	const isComponentLoaded = useCallback(
		(name: string) => loadedComponents.has(name),
		[loadedComponents],
	);

	// Optimized data fetching (simulated)
	const [dashboardData, setDashboardData] = useState<{
		totalValue: number;
		totalChange: number;
		changePercent: number;
		assetCount: number;
		portfolios: DashboardPortfolio[];
		chartData: { timestamp: number; value: number }[];
	} | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				await new Promise((resolve) => setTimeout(resolve, 100));
				if (cancelled) return;
				setDashboardData({
					totalValue: 125000000,
					totalChange: 250000,
					changePercent: 0.02,
					assetCount: 15,
					portfolios: [
						{
							id: "1",
							name: "Investment Portfolio",
							totalValue: 75000000,
							assetCount: 8,
						},
						{
							id: "2",
							name: "Retirement Fund",
							totalValue: 50000000,
							assetCount: 7,
						},
					] as unknown as DashboardPortfolio[],
					chartData: Array.from({ length: 100 }, (_, i) => ({
						timestamp: Date.now() - (100 - i) * 24 * 60 * 60 * 1000,
						value: 125000000 + Math.random() * 10000000 - 5000000,
					})),
				});
			} catch (err) {
				if (!cancelled) setError(err as Error);
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	// Chart virtualization for large datasets
	const chartDataLoader = useCallback(
		async (startIndex: number, endIndex: number) => {
			// Simulate loading chart data chunks
			const data = dashboardData?.chartData?.slice(startIndex, endIndex) || [];
			return data;
		},
		[dashboardData?.chartData],
	);

	const refetch = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		// Simulate refetch
		await new Promise((resolve) => setTimeout(resolve, 100));
		setIsLoading(false);
	}, []);

	const { updateViewport: _updateChartViewport, isLoading: isChartLoading } =
		useChartVirtualization(
			dashboardData?.chartData?.length || 0,
			100, // chunk size
			chartDataLoader,
		);

	// Memoized handlers to prevent unnecessary re-renders
	const handlePortfolioSelect = useCallback(
		(portfolio: DashboardPortfolio) => {
			dashboardActions.preloadData(`portfolio_${portfolio.id}`, portfolio as any);
			dashboardActions.viewPortfolio(portfolio as any);
		},
		[dashboardActions],
	);

	const handleRefresh = useCallback(() => {
		refetch();
	}, [refetch]);

	// Memoized chart data with sampling
	const sampledChartData = useMemo(() => {
		if (!dashboardData?.chartData) return [];

		return dataSampler.sample(dashboardData.chartData, {
			maxPoints: 500,
			algorithm: "lttb",
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
					<Button variant="outline" size="sm" onClick={handleRefresh} className="ml-2">
						Retry
					</Button>
				</AlertDescription>
			</Alert>
		);
	}

	return (
		<div className="space-y-6">
			{/* Preload chart libraries */}

			{/* Portfolio Metrics - Load first */}
			{isComponentLoaded("metrics") && dashboardData && (
				<ErrorBoundary
					fallbackRender={({ error, resetErrorBoundary }) => (
						<ErrorFallback error={error as Error} resetErrorBoundary={resetErrorBoundary} />
					)}
				>
					<PortfolioMetrics
						totalValue={dashboardData.totalValue}
						totalChange={dashboardData.totalChange}
						changePercent={dashboardData.changePercent}
						assetCount={dashboardData.assetCount}
					/>
				</ErrorBoundary>
			)}

			{/* Portfolio List - Load second */}
			{isComponentLoaded("portfolios") && dashboardData?.portfolios && (
				<ErrorBoundary
					fallbackRender={({ error, resetErrorBoundary }) => (
						<ErrorFallback error={error as Error} resetErrorBoundary={resetErrorBoundary} />
					)}
				>
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
			{isComponentLoaded("charts") && (
				<div className="grid gap-6 lg:grid-cols-2">
					<ErrorBoundary
						fallbackRender={({ error, resetErrorBoundary }) => (
							<ErrorFallback error={error as Error} resetErrorBoundary={resetErrorBoundary} />
						)}
					>
						<Suspense fallback={<ChartSkeleton />}>
							<OptimizedPerformanceChart
								data={sampledChartData}
								isLoading={isChartLoading}
								title="Portfolio Performance"
							/>
						</Suspense>
					</ErrorBoundary>

					<ErrorBoundary
						fallbackRender={({ error, resetErrorBoundary }) => (
							<ErrorFallback error={error as Error} resetErrorBoundary={resetErrorBoundary} />
						)}
					>
						<Suspense fallback={<ChartSkeleton />}>
							<OptimizedAssetAllocationChart
								data={[
									{ name: "Stocks", value: 60, color: "#8884d8" },
									{ name: "Bonds", value: 30, color: "#82ca9d" },
									{ name: "Cash", value: 10, color: "#ffc658" },
								]}
								title="Asset Allocation"
							/>
						</Suspense>
					</ErrorBoundary>
				</div>
			)}

			{/* Performance Analytics - Load last */}
			{isComponentLoaded("performance") && (
				<ErrorBoundary
					fallbackRender={({ error, resetErrorBoundary }) => (
						<ErrorFallback error={error as Error} resetErrorBoundary={resetErrorBoundary} />
					)}
				>
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
