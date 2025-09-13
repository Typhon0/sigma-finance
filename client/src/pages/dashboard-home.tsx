import { AlertTriangle, RefreshCw } from "lucide-react";
import { lazy, Suspense, useEffect } from "react";
import { useSearch } from "@tanstack/react-router";
import { AppSidebar } from "@/components/app-sidebar";
import { AssetPerformance } from "@/components/dashboard/asset-performance";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb";
import { DashboardTransition, BreadcrumbTransition } from "@/components/dashboard/dashboard-transitions";
import { InlinePortfolioDetail } from "@/components/dashboard/inline-portfolio-detail";
import { InlineAssetDetail } from "@/components/dashboard/inline-asset-detail";
import { PortfolioOverview } from "@/components/dashboard/portfolio-overview";
import { PortfolioSummaryCards } from "@/components/dashboard/portfolio-summary-cards";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import ErrorBoundary from "@/components/ui/error-boundary";
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { usePortfolioAnalytics } from "@/hooks/use-portfolio-analytics";
import { useDashboardState } from "@/hooks/use-dashboard-state";
import { useOptimizedDashboardState } from "@/hooks/use-optimized-dashboard-state";
import { useResponsiveDashboard, useTouchGestures } from "@/hooks/use-responsive-dashboard";
import { useDashboardMonitoring } from "@/hooks/use-dashboard-monitoring";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import type { Portfolio } from "@/gql/graphql";

// Enhanced error handling imports
import {
	DashboardErrorBoundary,
	DashboardErrorManagerProvider,
	useDashboardErrorManager,
	useViewTransitionErrorHandler,
	useOfflineHandler,
	OfflineIndicator,
	OfflineFallback,
	AutoRetryWrapper,
	InlinePortfolioDetailSkeleton,
	InlineAssetDetailSkeleton,
} from "@/components/dashboard/error-handling";
import React from "react";

const AssetAllocationChart = lazy(
	() => import("@/components/dashboard/asset-allocation-chart"),
);

// Main dashboard content component
function DashboardContent() {
	const { user, isLoading: authLoading } = useAuth();
	const { data, loading, error, refetch: originalRefetch } = usePortfolioAnalytics(
		user?.id || "",
	);
	
	// Wrap refetch with monitoring
	const refetch = React.useCallback(async () => {
		if (originalRefetch) {
			return trackDataLoading(
				() => originalRefetch(),
				'portfolio_analytics',
				{ user_id: user?.id, view_mode: viewState.viewMode }
			);
		}
	}, [originalRefetch, trackDataLoading, user?.id, viewState.viewMode]);
	
	// Dashboard view state using the new hook
	const [viewState, actions] = useDashboardState();
	
	// Dashboard monitoring
	const {
		trackDashboardStateChange,
		trackPortfolioSelection,
		trackAssetSelection,
		trackReturnToOverview,
		trackDataLoading,
		trackError,
	} = useDashboardMonitoring();

	// Enhanced error handling
	const { actions: errorActions, offlineState } = useDashboardErrorManager();
	const { handleTransitionError } = useViewTransitionErrorHandler();

	// Get search parameters to handle portfolio ID from redirects
	const search = useSearch({ from: "/dashboard" }) as { portfolioId?: string };

	// Handle portfolio ID from search parameter (when redirected from /portfolios/:id)
	useEffect(() => {
		if (search.portfolioId && data?.portfolios && viewState.viewMode === 'overview') {
			const portfolio = data.portfolios.find(p => p.id === search.portfolioId);
			if (portfolio) {
				try {
					actions.viewPortfolio(portfolio);
					trackPortfolioSelection(portfolio.id, 'navigation');
				} catch (error) {
					handleTransitionError(error as Error, 'overview', 'portfolio-detail');
					trackError(error as Error, 'dashboard-navigation');
				}
			}
		}
	}, [search.portfolioId, data?.portfolios, viewState.viewMode, actions, handleTransitionError, trackPortfolioSelection, trackError]);

	// Report errors to error manager and monitoring
	useEffect(() => {
		if (error) {
			errorActions.reportError(error, 'overview', 'DashboardContent');
			trackError(error, 'dashboard-data-loading', {
				user_id: user?.id,
				view_mode: viewState.viewMode,
			});
		}
	}, [error, errorActions, trackError, user?.id, viewState.viewMode]);

	// Don't render anything if still checking authentication
	if (authLoading) {
		return <DashboardSkeleton />;
	}

	// Don't render if no user (should be handled by ProtectedRoute, but extra safety)
	if (!user) {
		return <DashboardSkeleton />;
	}

	// Show skeleton loading state while data is being fetched
	if (loading) {
		return <DashboardSkeleton />;
	}

	// Show error state with retry option
	if (error) {
		return (
			<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
				<Card className="border-destructive">
					<CardContent className="flex flex-col items-center justify-center p-8">
						<AlertTriangle className="h-12 w-12 text-destructive mb-4" />
						<h2 className="text-xl font-semibold text-destructive mb-2">
							Failed to load dashboard
						</h2>
						<p className="text-muted-foreground mb-6 text-center max-w-md">
							{error.message}
						</p>
						<Button onClick={() => refetch?.()} className="gap-2">
							<RefreshCw className="h-4 w-4" />
							Try Again
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (!data) {
		return (
			<div className="flex items-center justify-center h-full">
				<p>No data available.</p>
			</div>
		);
	}

	// Show asset detail view if selected
	if (viewState.viewMode === 'asset-detail' && viewState.selectedAsset) {
		return (
			<DashboardTransition 
				viewMode={viewState.viewMode} 
				className={cn(
					"flex-1 space-y-4 sm:space-y-6",
					"p-3 sm:p-4 md:p-6 lg:p-8",
					// Ensure proper spacing on mobile
					"pb-safe-area-inset-bottom"
				)}
			>
				<DashboardErrorBoundary
					context="asset-detail"
					componentName="InlineAssetDetail"
					onNavigateBack={() => viewState.selectedPortfolio && actions.backToPortfolio(viewState.selectedPortfolio)}
					onNavigateHome={actions.backToOverview}
				>
					<Suspense fallback={<InlineAssetDetailSkeleton />}>
						<OfflineFallback
							offlineState={offlineState}
							hasData={!!viewState.selectedAsset}
							onRefresh={() => refetch?.()}
						>
							<InlineAssetDetail 
								asset={viewState.selectedAsset}
								portfolio={viewState.selectedPortfolio}
								onBack={() => {
									if (viewState.selectedPortfolio) {
										actions.backToPortfolio(viewState.selectedPortfolio);
										trackDashboardStateChange({
											viewMode: 'portfolio-detail',
											selectedPortfolio: viewState.selectedPortfolio.id,
											selectedAsset: null,
										});
									}
								}}
							/>
						</OfflineFallback>
					</Suspense>
				</DashboardErrorBoundary>
			</DashboardTransition>
		);
	}

	// Show portfolio detail view if selected
	if (viewState.viewMode === 'portfolio-detail' && viewState.selectedPortfolio) {
		return (
			<DashboardTransition 
				viewMode={viewState.viewMode} 
				className={cn(
					"flex-1 space-y-4 sm:space-y-6",
					"p-3 sm:p-4 md:p-6 lg:p-8",
					// Ensure proper spacing on mobile
					"pb-safe-area-inset-bottom"
				)}
			>
				<DashboardErrorBoundary
					context="portfolio-detail"
					componentName="InlinePortfolioDetail"
					onNavigateBack={actions.backToOverview}
					onNavigateHome={actions.backToOverview}
				>
					<Suspense fallback={<InlinePortfolioDetailSkeleton />}>
						<OfflineFallback
							offlineState={offlineState}
							hasData={!!viewState.selectedPortfolio}
							onRefresh={() => refetch?.()}
						>
							<InlinePortfolioDetail 
								portfolio={viewState.selectedPortfolio}
								onBack={() => {
									actions.backToOverview();
									trackReturnToOverview('back-button');
								}}
								onAssetSelect={(asset) => {
									try {
										actions.viewAsset(asset, viewState.selectedPortfolio!);
										trackAssetSelection(asset.id, viewState.selectedPortfolio!.id, 'click');
									} catch (error) {
										handleTransitionError(error as Error, 'portfolio-detail', 'asset-detail');
										trackError(error as Error, 'asset-selection');
									}
								}}
							/>
						</OfflineFallback>
					</Suspense>
				</DashboardErrorBoundary>
			</DashboardTransition>
		);
	}

	// Show dashboard overview
	const topAssets = data.topPerformingAssets.map((asset) => ({
		asset: {
			id: asset.asset.id,
			name: asset.asset.name,
			symbol: asset.asset.symbol,
		},
		performance: {
			change: asset.changeAmount,
			changePercent: asset.changePercent,
			history: [],
		},
	}));

	return (
		<DashboardTransition 
			viewMode={viewState.viewMode} 
			className={cn(
				"flex-1 space-y-4 sm:space-y-6",
				"p-3 sm:p-4 md:p-6 lg:p-8",
				// Ensure proper spacing on mobile
				"pb-safe-area-inset-bottom"
			)}
		>
			<OfflineFallback
				offlineState={offlineState}
				hasData={!!data}
				onRefresh={() => refetch?.()}
			>
				<AutoRetryWrapper
					retryFn={async () => {
						if (refetch) {
							await refetch();
						}
					}}
					showStatus={true}
					showButton={true}
				>
					<DashboardErrorBoundary
						context="overview"
						componentName="PortfolioOverview"
					>
						<PortfolioOverview
							title="Dashboard"
							subtitle="Welcome back!"
							totalValue={data.totalValue}
							change={data.totalChange}
							changePercentage={data.totalChangePercent}
							timeframe="24h"
							onRefresh={() => refetch?.()}
							isRefreshing={loading}
						/>
					</DashboardErrorBoundary>

					<DashboardErrorBoundary
						context="overview"
						componentName="PortfolioSummaryCards"
					>
						<PortfolioSummaryCards
							portfolios={data.portfolios as any}
							portfolioMetrics={{}}
							onPortfolioSelect={(portfolio) => {
								try {
									actions.viewPortfolio(portfolio);
									trackPortfolioSelection(portfolio.id, 'click');
								} catch (error) {
									handleTransitionError(error as Error, 'overview', 'portfolio-detail');
									trackError(error as Error, 'portfolio-selection');
								}
							}}
							onPortfolioDelete={() => {}}
						/>
					</DashboardErrorBoundary>

					<div className={cn(
						"grid gap-4 sm:gap-6",
						// Responsive grid: single column on mobile, two columns on larger screens
						"grid-cols-1 lg:grid-cols-2"
					)}>
						<DashboardErrorBoundary
							context="component"
							componentName="AssetPerformance"
						>
							<AssetPerformance
								assets={topAssets}
								isLoading={loading}
								onAssetClick={() => {}}
							/>
						</DashboardErrorBoundary>

						<DashboardErrorBoundary
							context="component"
							componentName="QuickActions"
						>
							<QuickActions />
						</DashboardErrorBoundary>
					</div>

					<div className={cn(
						"grid gap-4 sm:gap-6",
						// Responsive grid: single column on mobile/tablet, three columns on desktop
						"grid-cols-1 xl:grid-cols-3"
					)}>
						<div className="xl:col-span-2">
							<DashboardErrorBoundary
								context="chart"
								componentName="AssetAllocationChart"
							>
								<Suspense fallback={<DashboardSkeleton />}>
									<AssetAllocationChart allocationData={data.assetAllocation} />
								</Suspense>
							</DashboardErrorBoundary>
						</div>
						<div className="xl:col-span-1">
							<DashboardErrorBoundary
								context="component"
								componentName="RecentTransactions"
							>
								<RecentTransactions transactions={data.recentTransactions as any} />
							</DashboardErrorBoundary>
						</div>
					</div>
				</AutoRetryWrapper>
			</OfflineFallback>
		</DashboardTransition>
	);
}

// Main dashboard home page component
export default function DashboardHomePage() {
	// Dashboard view state for breadcrumbs
	const [viewState] = useDashboardState();
	const [responsiveState, responsiveActions] = useResponsiveDashboard();
	const { offlineState } = useOfflineHandler();

	// Add touch gesture support for mobile sidebar
	useTouchGestures(responsiveActions.handleSwipeGesture);

	return (
		<DashboardErrorManagerProvider>
			<SidebarProvider 
				open={!responsiveState.sidebarCollapsed}
				onOpenChange={responsiveActions.setSidebarCollapsed}
			>
				<AppSidebar />
				<SidebarInset>
					<header className={cn(
						"flex shrink-0 items-center gap-2 transition-[width,height] ease-linear",
						"h-14 sm:h-16", // Smaller header on mobile
						"group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12"
					)}>
						<div className="flex items-center gap-2 px-3 sm:px-4 w-full">
							<SidebarTrigger className={cn(
								"-ml-1 touch-manipulation",
								// Larger touch target on mobile
								responsiveState.isMobile && "h-10 w-10 p-2"
							)} />
							<Separator orientation="vertical" className="mr-2 h-4" />
							<div className="flex-1 min-w-0">
								<BreadcrumbTransition>
									<DashboardBreadcrumb items={viewState.breadcrumbPath} />
								</BreadcrumbTransition>
							</div>
							{/* Offline indicator in header */}
							<OfflineIndicator 
								offlineState={offlineState} 
								variant="minimal"
							/>
						</div>
					</header>

					<DashboardErrorBoundary
						context="overview"
						componentName="DashboardHomePage"
						fallback={({ resetErrorBoundary: retry }) => (
							<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
								<Card className="border-destructive">
									<CardContent className="flex flex-col items-center justify-center p-8">
										<AlertTriangle className="h-12 w-12 text-destructive mb-4" />
										<h2 className="text-xl font-semibold text-destructive mb-2">
											Dashboard Error
										</h2>
										<p className="text-muted-foreground mb-6 text-center max-w-md">
											Something went wrong while loading the dashboard. Please try
											refreshing the page.
										</p>
										<Button onClick={retry} className="gap-2">
											<RefreshCw className="h-4 w-4" />
											Reload Dashboard
										</Button>
									</CardContent>
								</Card>
							</div>
						)}
					>
						<DashboardContent />
					</DashboardErrorBoundary>
				</SidebarInset>
			</SidebarProvider>
		</DashboardErrorManagerProvider>
	);
}