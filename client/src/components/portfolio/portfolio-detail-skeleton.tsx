import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export function PortfolioDetailSkeleton() {
	return (
		<div className="flex flex-1 flex-col gap-3 sm:gap-4 p-3 sm:p-4 pt-0">
			{/* Header Section */}
			<div className="flex items-center gap-2 sm:gap-4">
				<Skeleton className="h-8 sm:h-9 w-24 sm:w-32" />
			</div>

			{/* Portfolio Header */}
			<div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div className="space-y-2 min-w-0 flex-1">
					<Skeleton className="h-7 sm:h-8 lg:h-9 w-48 sm:w-64 lg:w-80" />
					<Skeleton className="h-4 sm:h-5 w-64 sm:w-96 max-w-full" />
					<div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
						<Skeleton className="h-3 sm:h-4 w-20 sm:w-24" />
						<Separator orientation="vertical" className="h-4 hidden sm:block" />
						<Skeleton className="h-3 sm:h-4 w-24 sm:w-28" />
					</div>
				</div>

				{/* Action Buttons */}
				<div className="flex flex-col sm:flex-row gap-2 lg:flex-shrink-0">
					<div className="grid grid-cols-2 sm:flex gap-2">
						<Skeleton className="h-8 sm:h-9 w-16 sm:w-20" />
						<Skeleton className="h-8 sm:h-9 w-16 sm:w-24" />
						<Skeleton className="h-8 sm:h-9 w-16 sm:w-20" />
						<Skeleton className="h-8 sm:h-9 w-16 sm:w-20" />
					</div>
				</div>
			</div>

			{/* Portfolio Metrics */}
			<div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
				{Array.from({ length: 4 }).map((_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: unavoidable
					<Card key={`metric-skeleton-${i}`} className="touch-manipulation">
						<CardHeader className="pb-2">
							<Skeleton className="h-3 sm:h-4 w-16 sm:w-20" />
						</CardHeader>
						<CardContent>
							<Skeleton className="h-5 sm:h-6 lg:h-8 w-20 sm:w-24 lg:w-28" />
							{i === 2 && <Skeleton className="h-3 sm:h-4 w-12 sm:w-16 mt-1" />}
						</CardContent>
					</Card>
				))}
			</div>

			{/* Portfolio Assets */}
			<Card>
				<CardHeader>
					<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
						<div>
							<Skeleton className="h-5 sm:h-6 w-12 sm:w-16" />
							<Skeleton className="h-3 sm:h-4 w-24 sm:w-32 mt-1" />
						</div>
						<Skeleton className="h-8 sm:h-9 w-full sm:w-24" />
					</div>
				</CardHeader>
				<CardContent>
					<div className="space-y-3 sm:space-y-4">
						{Array.from({ length: 3 }).map((_, i) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: unavoidable
								key={`asset-skeleton-${i}`}
								className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 border rounded-lg"
							>
								<div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 min-w-0 flex-1">
									<div className="min-w-0 flex-1">
										<Skeleton className="h-4 sm:h-5 w-32 sm:w-40" />
										<Skeleton className="h-3 sm:h-4 w-16 sm:w-20 mt-1" />
									</div>
									<Skeleton className="h-5 sm:h-6 w-16 sm:w-20 self-start sm:self-center" />
								</div>
								<div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
									<div className="grid grid-cols-2 sm:block gap-2 sm:gap-0">
										<Skeleton className="h-3 sm:h-4 w-16 sm:w-20" />
										<Skeleton className="h-3 sm:h-4 w-20 sm:w-24" />
										<Skeleton className="h-3 sm:h-4 w-12 sm:w-16 col-span-2 sm:col-span-1" />
										<Skeleton className="h-3 sm:h-4 w-20 sm:w-24 col-span-2 sm:col-span-1" />
									</div>
									<Skeleton className="h-8 w-8 rounded" />
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

export function PortfolioDetailLoadingSkeleton() {
	return (
		<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
			{/* Loading indicator */}
			<div className="flex items-center justify-center py-8">
				<div className="flex items-center gap-2 text-muted-foreground">
					<div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
					<span className="text-sm">Loading portfolio details...</span>
				</div>
			</div>
		</div>
	);
}

export function PortfolioMetricsSkeleton() {
	return (
		<div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
			{Array.from({ length: 4 }).map((_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: unavoidable
				<Card key={`metric-skeleton-${i}`}>
					<CardHeader className="pb-2">
						<Skeleton className="h-4 w-20" />
					</CardHeader>
					<CardContent>
						<Skeleton className="h-8 w-24" />
						{i === 2 && <Skeleton className="h-4 w-16 mt-1" />}
					</CardContent>
				</Card>
			))}
		</div>
	);
}

export function PortfolioAssetsSkeleton({ count = 3 }: { count?: number }) {
	return (
		<div className="space-y-4">
			{Array.from({ length: count }).map((_, i) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: unavoidable
					key={`asset-skeleton-${i}`}
					className="flex items-center justify-between p-4 border rounded-lg"
				>
					<div className="flex items-center gap-4">
						<div>
							<Skeleton className="h-5 w-32" />
							<Skeleton className="h-4 w-16 mt-1" />
						</div>
						<Skeleton className="h-6 w-20" />
					</div>
					<div className="flex items-center gap-4">
						<div className="text-right space-y-1">
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-4 w-20" />
							<Skeleton className="h-4 w-28" />
						</div>
						<Skeleton className="h-8 w-8" />
					</div>
				</div>
			))}
		</div>
	);
}
