import { PortfolioSummarySkeleton } from "@/components/dashboard/portfolio-summary-cards";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Individual skeleton components for different dashboard sections

export function PortfolioOverviewSkeleton() {
	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			{Array.from({ length: 4 }).map((_, i) => (
				<Card key={`dashboard-metric-skeleton-${i}`}>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-6 w-6 rounded-full" />
					</CardHeader>
					<CardContent>
						<Skeleton className="h-8 w-48" />
						<Skeleton className="h-4 w-40 mt-1" />
					</CardContent>
				</Card>
			))}
		</div>
	);
}

export function DashboardSkeleton() {
	const metricSkeletons = Array.from({ length: 4 }, (_, i) => ({
		id: `dashboard-metric-skeleton-${i}`,
	}));
	const portfolioSummarySkeletons = Array.from({ length: 3 }, (_, i) => ({
		id: `portfolio-summary-skeleton-${i}`,
	}));
	const assetPerformanceSkeletons = Array.from({ length: 3 }, (_, i) => ({
		id: `asset-performance-skeleton-${i}`,
	}));
	const recentTransactionSkeletons = Array.from({ length: 5 }, (_, i) => ({
		id: `recent-transaction-skeleton-${i}`,
	}));
	const assetAllocationSkeletons = Array.from({ length: 4 }, (_, i) => ({
		id: `asset-allocation-skeleton-${i}`,
	}));
	const alertSkeletons = Array.from({ length: 3 }, (_, i) => ({
		id: `alert-skeleton-${i}`,
	}));

	return (
		<div className="space-y-8">
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				{metricSkeletons.map((item) => (
					<Card key={item.id}>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-6 w-6" />
						</CardHeader>
						<CardContent>
							<Skeleton className="h-8 w-48" />
							<Skeleton className="h-3 w-40 mt-1" />
						</CardContent>
					</Card>
				))}
			</div>

			<div className="grid gap-8 lg:grid-cols-3">
				<div className="lg:col-span-2 space-y-8">
					{/* Key Metrics Skeletons */}
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
						{metricSkeletons.map((item) => (
							<Card key={item.id}>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<Skeleton className="h-4 w-32" />
									<Skeleton className="h-6 w-6" />
								</CardHeader>
								<CardContent>
									<Skeleton className="h-8 w-24" />
								</CardContent>
							</Card>
						))}
					</div>

					{/* Portfolio Summaries Skeleton */}
					<div>
						<Skeleton className="h-6 w-48 mb-4" />
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
							{portfolioSummarySkeletons.map((item) => (
								<Card key={item.id}>
									<CardContent className="p-4">
										<div className="flex justify-between items-start mb-2">
											<Skeleton className="h-5 w-3/5" />
											<Skeleton className="h-4 w-1/5" />
										</div>
										<Skeleton className="h-7 w-1/2 mb-2" />
										<div className="flex items-center gap-2">
											<Skeleton className="h-4 w-16" />
											<Skeleton className="h-3 w-12" />
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					</div>
				</div>

				<div className="lg:col-span-1 space-y-8">
					{/* Asset Performance Skeleton */}
					<Card>
						<CardHeader>
							<Skeleton className="h-6 w-40" />
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								{assetPerformanceSkeletons.map((item) => (
									<div key={item.id} className="flex items-center justify-between">
										<div className="flex items-center gap-3">
											<Skeleton className="h-8 w-8 rounded-md" />
											<div className="space-y-1">
												<Skeleton className="h-4 w-24" />
												<Skeleton className="h-3 w-16" />
											</div>
										</div>
										<Skeleton className="h-4 w-20" />
									</div>
								))}
							</div>
						</CardContent>
					</Card>

					{/* Recent Transactions Skeleton */}
					<Card>
						<CardHeader>
							<Skeleton className="h-6 w-48" />
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								{recentTransactionSkeletons.map((item) => (
									<div key={item.id} className="flex items-center justify-between">
										<div className="flex items-center gap-3">
											<Skeleton className="h-8 w-8 rounded-full" />
											<div className="space-y-1">
												<Skeleton className="h-4 w-28" />
												<Skeleton className="h-3 w-20" />
											</div>
										</div>
										<div className="text-right">
											<Skeleton className="h-4 w-24" />
											<Skeleton className="h-3 w-16 mt-1" />
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				<div className="lg:col-span-1 space-y-8">
					{/* Asset Allocation Skeleton */}
					<Card>
						<CardHeader>
							<Skeleton className="h-6 w-40" />
						</CardHeader>
						<CardContent className="flex flex-col md:flex-row items-center gap-4">
							<Skeleton className="h-48 w-full md:w-1/2" />
							<div className="w-full md:w-1/2 space-y-2">
								{assetAllocationSkeletons.map((item) => (
									<div key={item.id} className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											<Skeleton className="h-4 w-4 rounded-full" />
											<Skeleton className="h-4 w-24" />
										</div>
										<Skeleton className="h-4 w-16" />
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Alerts Skeleton */}
				<Card>
					<CardHeader>
						<Skeleton className="h-6 w-24" />
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							{alertSkeletons.map((item) => (
								<div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border">
									<Skeleton className="h-6 w-6 rounded-full" />
									<div className="flex-1 space-y-2">
										<Skeleton className="h-4 w-3/4" />
										<Skeleton className="h-3 w-1/2" />
									</div>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

export function CompactDashboardSkeleton() {
	const portfolioSummarySkeletons = Array.from({ length: 3 }, (_, i) => ({
		id: `portfolio-summary-skeleton-card-${i}`,
	}));
	const compactAssetListSkeletons = Array.from({ length: 4 }, (_, i) => ({
		id: `compact-asset-list-skeleton-${i}`,
	}));

	return (
		<div className="space-y-6">
			<div>
				<Skeleton className="h-6 w-48 mb-4" />
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{portfolioSummarySkeletons.map((item) => (
						<Card key={item.id}>
							<CardContent className="p-4">
								<div className="flex justify-between items-start mb-2">
									<Skeleton className="h-5 w-3/5" />
									<Skeleton className="h-4 w-1/5" />
								</div>
								<Skeleton className="h-7 w-1/2 mb-2" />
								<div className="flex items-center gap-2">
									<Skeleton className="h-4 w-16" />
									<Skeleton className="h-3 w-12" />
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			</div>
			<Card>
				<CardHeader>
					<Skeleton className="h-6 w-40" />
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{compactAssetListSkeletons.map((item) => (
							<div key={item.id} className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									<Skeleton className="h-5 w-5 rounded-md" />
									<Skeleton className="h-4 w-24" />
								</div>
								<Skeleton className="h-4 w-16" />
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

export const DashboardSkeletons = {
	PortfolioOverview: PortfolioOverviewSkeleton,
	PortfolioSummary: PortfolioSummarySkeleton,
};
