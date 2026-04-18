import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface PortfolioListSkeletonProps {
	viewMode?: "grid" | "list";
	count?: number;
	showControls?: boolean;
}

export function PortfolioListSkeleton({
	viewMode = "grid",
	count = 6,
	showControls = true,
}: PortfolioListSkeletonProps) {
	return (
		<div className="space-y-4">
			{/* Controls Header Skeleton */}
			{showControls && (
				<div className="flex flex-col space-y-3 sm:space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
					{/* Selection Controls */}
					<div className="flex items-center space-x-2 sm:space-x-4">
						<Skeleton className="h-4 w-4" />
						<Skeleton className="h-4 w-16 sm:w-20" />
					</div>

					{/* View and Sort Controls */}
					<div className="flex items-center space-x-2 sm:space-x-3 justify-end">
						<Skeleton className="h-9 w-32 sm:w-40" />
						<Skeleton className="h-9 w-20 sm:w-24" />
					</div>
				</div>
			)}

			{/* Portfolio Grid/List Skeleton */}
			<div
				className={cn(
					"gap-3 sm:gap-4",
					viewMode === "grid"
						? "grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
						: "space-y-3 sm:space-y-4",
				)}
			>
				{Array.from({ length: count }).map((_, i) => (
					<PortfolioCardSkeleton
						key={`portfolio-skeleton-${i}`}
						viewMode={viewMode}
					/>
				))}
			</div>
		</div>
	);
}

interface PortfolioCardSkeletonProps {
	viewMode: "grid" | "list";
}

function PortfolioCardSkeleton({ viewMode }: PortfolioCardSkeletonProps) {
	if (viewMode === "list") {
		return (
			<Card className="touch-manipulation">
				<CardContent className="p-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-4 flex-1 min-w-0">
							<Skeleton className="h-4 w-4 flex-shrink-0" />
							<div className="flex-1 min-w-0 space-y-2">
								<Skeleton className="h-5 w-3/4" />
								<Skeleton className="h-4 w-1/2" />
							</div>
						</div>
						<div className="flex items-center gap-4">
							<div className="text-right space-y-1">
								<Skeleton className="h-4 w-20" />
								<Skeleton className="h-3 w-16" />
							</div>
							<Skeleton className="h-8 w-8" />
						</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="touch-manipulation">
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between">
					<div className="flex-1 min-w-0 space-y-2">
						<Skeleton className="h-5 w-3/4" />
						<Skeleton className="h-4 w-1/2" />
					</div>
					<Skeleton className="h-4 w-4 flex-shrink-0 ml-2" />
				</div>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="space-y-2">
					<Skeleton className="h-6 w-2/3" />
					<div className="flex items-center gap-2">
						<Skeleton className="h-4 w-16" />
						<Skeleton className="h-3 w-12" />
					</div>
				</div>
				<div className="flex items-center justify-between">
					<Skeleton className="h-6 w-16" />
					<Skeleton className="h-8 w-8" />
				</div>
			</CardContent>
		</Card>
	);
}

export function PortfolioListLoadingSkeleton() {
	return (
		<div className="container mx-auto p-4 md:p-6">
			<div className="flex items-center justify-between mb-6">
				<Skeleton className="h-8 w-48" />
				<div className="flex items-center gap-2">
					<Skeleton className="h-10 w-10" />
					<Skeleton className="h-10 w-10" />
					<Skeleton className="h-10 w-36" />
				</div>
			</div>
			<PortfolioListSkeleton count={6} showControls={false} />
		</div>
	);
}

export function EmptyPortfolioSkeleton() {
	return (
		<Card className="text-center py-8 sm:py-12">
			<CardHeader>
				<Skeleton className="h-6 w-48 mx-auto" />
				<Skeleton className="h-4 w-64 mx-auto mt-2" />
			</CardHeader>
			<CardContent>
				<Skeleton className="h-10 w-40 mx-auto" />
			</CardContent>
		</Card>
	);
}

export function PortfolioOperationSkeleton({
	operation,
}: {
	operation: string;
}) {
	return (
		<div className="flex items-center justify-center py-4">
			<div className="flex items-center gap-2 text-muted-foreground">
				<div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
				<span className="text-sm">{operation}...</span>
			</div>
		</div>
	);
}
