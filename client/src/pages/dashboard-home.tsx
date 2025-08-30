import { AlertTriangle, RefreshCw } from "lucide-react";
import { lazy, Suspense, useState, useEffect } from "react";
import { useSearch } from "@tanstack/react-router";
import { AppSidebar } from "@/components/app-sidebar";
import { AssetPerformance } from "@/components/dashboard/asset-performance";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { PortfolioOverview } from "@/components/dashboard/portfolio-overview";
import { PortfolioSummaryCards } from "@/components/dashboard/portfolio-summary-cards";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import {
	PortfolioBreadcrumb,
	portfolioBreadcrumbs,
} from "@/components/portfolio/portfolio-breadcrumb";
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
import { useAuth } from "@/lib/auth-context";
import type { Portfolio } from "@/gql/graphql";

const AssetAllocationChart = lazy(
	() => import("@/components/dashboard/asset-allocation-chart"),
);

// Dashboard view state management
interface DashboardViewState {
	viewMode: 'overview' | 'portfolio-detail';
	selectedPortfolio: Portfolio | null;
}

// Inline Portfolio Detail Component
function InlinePortfolioDetail({ 
	portfolio, 
	onBack 
}: { 
	portfolio: Portfolio; 
	onBack: () => void; 
}) {
	return (
		<div className="flex-1 space-y-6 p-4 md:p-6 lg:p-8">
			{/* Portfolio Header with Back Navigation */}
			<div className="flex items-center gap-4">
				<Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
					← Back to Dashboard
				</Button>
			</div>

			{/* Portfolio Details */}
			<div className="space-y-6">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">{portfolio.name}</h1>
					{portfolio.description && (
						<p className="text-muted-foreground mt-2">{portfolio.description}</p>
					)}
				</div>

				{/* Portfolio Metrics */}
				<div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
					<Card>
						<CardContent className="p-6">
							<div className="text-2xl font-bold">$0.00</div>
							<p className="text-xs text-muted-foreground">Total Value</p>
						</CardContent>
					</Card>
					<Card>
						<CardContent className="p-6">
							<div className="text-2xl font-bold">$0.00</div>
							<p className="text-xs text-muted-foreground">Total Cost</p>
						</CardContent>
					</Card>
					<Card>
						<CardContent className="p-6">
							<div className="text-2xl font-bold">$0.00</div>
							<p className="text-xs text-muted-foreground">Gain/Loss</p>
						</CardContent>
					</Card>
					<Card>
						<CardContent className="p-6">
							<div className="text-2xl font-bold">{portfolio.assets?.length || 0}</div>
							<p className="text-xs text-muted-foreground">Assets</p>
						</CardContent>
					</Card>
				</div>

				{/* Assets Section */}
				<Card>
					<CardContent className="p-6">
						<div className="flex justify-between items-center mb-4">
							<h3 className="text-lg font-semibold">Assets</h3>
							<Button size="sm">Add Asset</Button>
						</div>
						
						{portfolio.assets && portfolio.assets.length > 0 ? (
							<div className="space-y-4">
								{portfolio.assets.map((asset, index) => (
									<div key={asset.asset.id || index} className="flex items-center justify-between p-4 border rounded-lg">
										<div>
											<h4 className="font-medium">{asset.asset.name}</h4>
											{asset.asset.symbol && (
												<p className="text-sm text-muted-foreground">{asset.asset.symbol}</p>
											)}
										</div>
										<div className="text-right">
											<div className="font-medium">{asset.quantity.toLocaleString()}</div>
											<div className="text-sm text-muted-foreground">
												${asset.averagePurchasePrice?.toFixed(2) || '0.00'}
											</div>
										</div>
									</div>
								))}
							</div>
						) : (
							<div className="text-center py-8">
								<p className="text-muted-foreground mb-4">No assets in this portfolio yet.</p>
								<Button>Add Your First Asset</Button>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

// Main dashboard content component
function DashboardContent() {
	const { user, isLoading: authLoading } = useAuth();
	const { data, loading, error, refetch } = usePortfolioAnalytics(
		user?.id || "",
	);
	
	// Dashboard view state
	const [viewState, setViewState] = useState<DashboardViewState>({
		viewMode: 'overview',
		selectedPortfolio: null,
	});

	const handlePortfolioSelect = (portfolio: Portfolio) => {
		setViewState({
			viewMode: 'portfolio-detail',
			selectedPortfolio: portfolio,
		});
	};

	const handleBackToOverview = () => {
		setViewState({
			viewMode: 'overview',
			selectedPortfolio: null,
		});
	};

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

	// Show portfolio detail view if selected
	if (viewState.viewMode === 'portfolio-detail' && viewState.selectedPortfolio) {
		return (
			<InlinePortfolioDetail 
				portfolio={viewState.selectedPortfolio}
				onBack={handleBackToOverview}
			/>
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
		<div className="flex-1 space-y-6 p-4 md:p-6 lg:p-8">
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
			<PortfolioSummaryCards
				portfolios={data.portfolios as any}
				portfolioMetrics={{}}
				onPortfolioSelect={handlePortfolioSelect}
				onPortfolioDelete={() => {}}
			/>
			<div className="grid gap-6 lg:grid-cols-2">
				<AssetPerformance
					assets={topAssets}
					isLoading={loading}
					onAssetClick={() => {}}
				/>
				<QuickActions />
			</div>
			<div className="grid gap-6 lg:grid-cols-3">
				<div className="lg:col-span-2">
					<ErrorBoundary>
						<Suspense fallback={<DashboardSkeleton />}>
							<AssetAllocationChart allocationData={data.assetAllocation} />
						</Suspense>
					</ErrorBoundary>
				</div>
				<div className="lg:col-span-1">
					<RecentTransactions transactions={data.recentTransactions as any} />
				</div>
			</div>
		</div>
	);
}

// Main dashboard home page component
export default function DashboardHomePage() {
	// Get search parameters to handle portfolio ID from redirects
	const search = useSearch({ from: "/dashboard" }) as { portfolioId?: string };
	
	// Dashboard view state for breadcrumbs
	const [viewState, setViewState] = useState<DashboardViewState>({
		viewMode: 'overview',
		selectedPortfolio: null,
	});

	// Handle portfolio ID from search parameter (when redirected from /portfolios/:id)
	useEffect(() => {
		if (search.portfolioId && viewState.viewMode === 'overview') {
			// We'll need to find the portfolio by ID and set it as selected
			// This will be handled in the DashboardContentWithState component
			// where we have access to the portfolio data
		}
	}, [search.portfolioId, viewState.viewMode]);

	// Generate breadcrumbs based on current view
	const getBreadcrumbs = () => {
		if (viewState.viewMode === 'portfolio-detail' && viewState.selectedPortfolio) {
			return [
				{ 
					title: "Dashboard", 
					href: "#", 
					onClick: () => setViewState({ viewMode: 'overview', selectedPortfolio: null }) 
				},
				{ title: viewState.selectedPortfolio.name }
			];
		}
		return portfolioBreadcrumbs.dashboard;
	};

	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
					<div className="flex items-center gap-2 px-4">
						<SidebarTrigger className="-ml-1" />
						<Separator orientation="vertical" className="mr-2 h-4" />
						<PortfolioBreadcrumb items={getBreadcrumbs()} />
					</div>
				</header>

				<ErrorBoundary
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
					<DashboardContentWithState 
						viewState={viewState} 
						setViewState={setViewState} 
						portfolioIdFromSearch={search.portfolioId}
					/>
				</ErrorBoundary>
			</SidebarInset>
		</SidebarProvider>
	);
}

// Wrapper component to pass view state to DashboardContent
function DashboardContentWithState({ 
	viewState, 
	setViewState,
	portfolioIdFromSearch
}: { 
	viewState: DashboardViewState; 
	setViewState: (state: DashboardViewState) => void; 
	portfolioIdFromSearch?: string;
}) {
	const { user, isLoading: authLoading } = useAuth();
	const { data, loading, error, refetch } = usePortfolioAnalytics(
		user?.id || "",
	);

	const handlePortfolioSelect = (portfolio: Portfolio) => {
		setViewState({
			viewMode: 'portfolio-detail',
			selectedPortfolio: portfolio,
		});
	};

	const handleBackToOverview = () => {
		setViewState({
			viewMode: 'overview',
			selectedPortfolio: null,
		});
	};

	// Handle portfolio ID from search parameter (when redirected from /portfolios/:id)
	useEffect(() => {
		if (portfolioIdFromSearch && data?.portfolios && viewState.viewMode === 'overview') {
			const portfolio = data.portfolios.find(p => p.id === portfolioIdFromSearch);
			if (portfolio) {
				handlePortfolioSelect(portfolio);
			}
		}
	}, [portfolioIdFromSearch, data?.portfolios, viewState.viewMode]);

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

	// Show portfolio detail view if selected
	if (viewState.viewMode === 'portfolio-detail' && viewState.selectedPortfolio) {
		return (
			<InlinePortfolioDetail 
				portfolio={viewState.selectedPortfolio}
				onBack={handleBackToOverview}
			/>
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
		<div className="flex-1 space-y-6 p-4 md:p-6 lg:p-8">
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
			<PortfolioSummaryCards
				portfolios={data.portfolios as any}
				portfolioMetrics={{}}
				onPortfolioSelect={handlePortfolioSelect}
				onPortfolioDelete={() => {}}
			/>
			<div className="grid gap-6 lg:grid-cols-2">
				<AssetPerformance
					assets={topAssets}
					isLoading={loading}
					onAssetClick={() => {}}
				/>
				<QuickActions />
			</div>
			<div className="grid gap-6 lg:grid-cols-3">
				<div className="lg:col-span-2">
					<ErrorBoundary>
						<Suspense fallback={<DashboardSkeleton />}>
							<AssetAllocationChart allocationData={data.assetAllocation} />
						</Suspense>
					</ErrorBoundary>
				</div>
				<div className="lg:col-span-1">
					<RecentTransactions transactions={data.recentTransactions as any} />
				</div>
			</div>
		</div>
	);
}
