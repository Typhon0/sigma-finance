import { AlertTriangle, RefreshCw } from "lucide-react";
import { lazy, Suspense } from "react";
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

const AssetAllocationChart = lazy(
	() => import("@/components/dashboard/asset-allocation-chart"),
);

// Main dashboard content component
function DashboardContent() {
	const { user } = useAuth();
	const { data, loading, error, refetch } = usePortfolioAnalytics(
		user?.id || "",
	);

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
	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
					<div className="flex items-center gap-2 px-4">
						<SidebarTrigger className="-ml-1" />
						<Separator orientation="vertical" className="mr-2 h-4" />
						<PortfolioBreadcrumb items={portfolioBreadcrumbs.dashboard} />
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
					<DashboardContent />
				</ErrorBoundary>
			</SidebarInset>
		</SidebarProvider>
	);
}
