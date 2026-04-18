import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Enhanced loading skeletons for inline charts and data-heavy components

export function InlineChartSkeleton({
	height = 300,
	title,
	className,
}: {
	height?: number;
	title?: string;
	className?: string;
}) {
	return (
		<Card className={className}>
			{title && (
				<CardHeader className="pb-3">
					<Skeleton className="h-6 w-48" />
				</CardHeader>
			)}
			<CardContent>
				<div className="space-y-4" style={{ height }}>
					{/* Chart area */}
					<div className="relative w-full h-full">
						<Skeleton className="w-full h-full rounded-lg" />
						{/* Overlay elements to simulate chart components */}
						<div className="absolute inset-4 space-y-2">
							<div className="flex justify-between items-start">
								<Skeleton className="h-4 w-24" />
								<Skeleton className="h-4 w-16" />
							</div>
							<div className="flex items-end justify-between h-32 gap-1">
								{Array.from({ length: 8 }).map((_, i) => (
									<Skeleton
										key={i}
										className="w-full"
										style={{ height: `${Math.random() * 80 + 20}%` }}
									/>
								))}
							</div>
							<div className="flex justify-center gap-4">
								<Skeleton className="h-3 w-16" />
								<Skeleton className="h-3 w-20" />
								<Skeleton className="h-3 w-14" />
							</div>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

export function InlinePortfolioDetailSkeleton() {
	return (
		<div className="space-y-6">
			{/* Header with back button */}
			<div className="flex items-center gap-4">
				<Skeleton className="h-9 w-32" />
			</div>

			{/* Portfolio metrics cards */}
			<div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<Card key={i}>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<Skeleton className="h-4 w-20" />
							<Skeleton className="h-4 w-4" />
						</CardHeader>
						<CardContent>
							<Skeleton className="h-8 w-24 mb-1" />
							<Skeleton className="h-3 w-16" />
						</CardContent>
					</Card>
				))}
			</div>

			{/* Asset list */}
			<Card>
				<CardHeader>
					<div className="flex justify-between items-center">
						<Skeleton className="h-6 w-16" />
						<Skeleton className="h-9 w-24" />
					</div>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{Array.from({ length: 5 }).map((_, i) => (
							<div
								key={i}
								className="flex items-center justify-between p-3 border rounded-lg"
							>
								<div className="flex items-center gap-3">
									<Skeleton className="h-10 w-10 rounded-full" />
									<div className="space-y-1">
										<Skeleton className="h-4 w-32" />
										<Skeleton className="h-3 w-20" />
									</div>
								</div>
								<div className="text-right space-y-1">
									<Skeleton className="h-4 w-20" />
									<Skeleton className="h-3 w-16" />
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			{/* Performance charts */}
			<div className="grid gap-6 lg:grid-cols-2">
				<InlineChartSkeleton height={250} title="Performance" />
				<InlineChartSkeleton height={250} title="Allocation" />
			</div>
		</div>
	);
}

export function InlineAssetDetailSkeleton() {
	return (
		<div className="space-y-6">
			{/* Header with back button */}
			<div className="flex items-center gap-4">
				<Skeleton className="h-9 w-40" />
			</div>

			{/* Asset info header */}
			<div className="flex items-start gap-4">
				<Skeleton className="h-16 w-16 rounded-lg" />
				<div className="flex-1 space-y-2">
					<Skeleton className="h-8 w-48" />
					<Skeleton className="h-4 w-32" />
					<div className="flex gap-2">
						<Skeleton className="h-6 w-20" />
						<Skeleton className="h-6 w-16" />
					</div>
				</div>
			</div>

			{/* Asset metrics */}
			<div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<Card key={i}>
						<CardContent className="p-4">
							<Skeleton className="h-4 w-20 mb-2" />
							<Skeleton className="h-6 w-24" />
						</CardContent>
					</Card>
				))}
			</div>

			{/* Price chart */}
			<InlineChartSkeleton height={400} title="Price History" />

			{/* Transaction history */}
			<Card>
				<CardHeader>
					<Skeleton className="h-6 w-40" />
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{Array.from({ length: 6 }).map((_, i) => (
							<div
								key={i}
								className="flex items-center justify-between p-3 border rounded-lg"
							>
								<div className="flex items-center gap-3">
									<Skeleton className="h-8 w-8 rounded-full" />
									<div className="space-y-1">
										<Skeleton className="h-4 w-24" />
										<Skeleton className="h-3 w-16" />
									</div>
								</div>
								<div className="text-right space-y-1">
									<Skeleton className="h-4 w-20" />
									<Skeleton className="h-3 w-12" />
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

export function DataTableSkeleton({
	rows = 5,
	columns = 4,
	showHeader = true,
	className,
}: {
	rows?: number;
	columns?: number;
	showHeader?: boolean;
	className?: string;
}) {
	return (
		<Card className={className}>
			<CardContent className="p-0">
				<div className="w-full">
					{showHeader && (
						<div className="flex items-center gap-4 p-4 border-b">
							{Array.from({ length: columns }).map((_, i) => (
								<Skeleton key={i} className="h-4 flex-1" />
							))}
						</div>
					)}
					<div className="space-y-0">
						{Array.from({ length: rows }).map((_, rowIndex) => (
							<div
								key={rowIndex}
								className="flex items-center gap-4 p-4 border-b last:border-b-0"
							>
								{Array.from({ length: columns }).map((_, colIndex) => (
									<Skeleton
										key={colIndex}
										className={cn(
											"h-4 flex-1",
											colIndex === 0 && "w-8 h-8 rounded-full flex-none", // First column as avatar
											colIndex === columns - 1 && "w-20 flex-none", // Last column as action
										)}
									/>
								))}
							</div>
						))}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

export function MetricCardsSkeleton({
	count = 4,
	className,
}: {
	count?: number;
	className?: string;
}) {
	return (
		<div className={cn("grid gap-4 grid-cols-2 lg:grid-cols-4", className)}>
			{Array.from({ length: count }).map((_, i) => (
				<Card key={i}>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-4 w-4" />
					</CardHeader>
					<CardContent>
						<Skeleton className="h-8 w-20 mb-1" />
						<Skeleton className="h-3 w-16" />
					</CardContent>
				</Card>
			))}
		</div>
	);
}

export function AssetListSkeleton({
	count = 5,
	showActions = true,
	className,
}: {
	count?: number;
	showActions?: boolean;
	className?: string;
}) {
	return (
		<div className={cn("space-y-3", className)}>
			{Array.from({ length: count }).map((_, i) => (
				<div
					key={i}
					className="flex items-center justify-between p-3 border rounded-lg"
				>
					<div className="flex items-center gap-3">
						<Skeleton className="h-10 w-10 rounded-full" />
						<div className="space-y-1">
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-3 w-20" />
						</div>
					</div>
					<div className="flex items-center gap-3">
						<div className="text-right space-y-1">
							<Skeleton className="h-4 w-20" />
							<Skeleton className="h-3 w-16" />
						</div>
						{showActions && <Skeleton className="h-8 w-8" />}
					</div>
				</div>
			))}
		</div>
	);
}

export function TransactionListSkeleton({
	count = 6,
	className,
}: {
	count?: number;
	className?: string;
}) {
	return (
		<div className={cn("space-y-3", className)}>
			{Array.from({ length: count }).map((_, i) => (
				<div
					key={i}
					className="flex items-center justify-between p-3 border rounded-lg"
				>
					<div className="flex items-center gap-3">
						<Skeleton className="h-8 w-8 rounded-full" />
						<div className="space-y-1">
							<Skeleton className="h-4 w-28" />
							<Skeleton className="h-3 w-20" />
						</div>
					</div>
					<div className="text-right space-y-1">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-3 w-16" />
					</div>
				</div>
			))}
		</div>
	);
}

// Shimmer effect for enhanced loading experience
export function ShimmerWrapper({
	children,
	isLoading,
	className,
}: {
	children: React.ReactNode;
	isLoading: boolean;
	className?: string;
}) {
	return (
		<div className={cn("relative", isLoading && "overflow-hidden", className)}>
			{children}
			{isLoading && (
				<div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
			)}
		</div>
	);
}

// Progressive loading component for data-heavy sections
export function ProgressiveLoader({
	isLoading,
	hasData,
	error,
	children,
	skeleton,
	emptyState,
	errorFallback,
}: {
	isLoading: boolean;
	hasData: boolean;
	error?: Error | null;
	children: React.ReactNode;
	skeleton: React.ReactNode;
	emptyState?: React.ReactNode;
	errorFallback?: React.ReactNode;
}) {
	if (error && errorFallback) {
		return <>{errorFallback}</>;
	}

	if (isLoading) {
		return <>{skeleton}</>;
	}

	if (!hasData && emptyState) {
		return <>{emptyState}</>;
	}

	return <>{children}</>;
}
