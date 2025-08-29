import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export function PortfolioDetailSkeleton() {
	return (
		<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
			{/* Header Section */}
			<div className="flex items-center gap-4">
				<Skeleton className="h-9 w-32" />
			</div>

			{/* Portfolio Header */}
			<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
				<div className="space-y-2">
					<Skeleton className="h-9 w-64" />
					<Skeleton className="h-5 w-96" />
					<div className="flex items-center gap-2">
						<Skeleton className="h-4 w-24" />
						<Separator orientation="vertical" className="h-4" />
						<Skeleton className="h-4 w-28" />
					</div>
				</div>

				{/* Action Buttons */}
				<div className="flex flex-wrap gap-2">
					<Skeleton className="h-9 w-16" />
					<Skeleton className="h-9 w-20" />
					<Skeleton className="h-9 w-18" />
					<Skeleton className="h-9 w-20" />
				</div>
			</div>

			{/* Portfolio Metrics */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<Card key={i}>
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

			{/* Portfolio Assets */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<Skeleton className="h-6 w-16" />
							<Skeleton className="h-4 w-32 mt-1" />
						</div>
						<Skeleton className="h-9 w-24" />
					</div>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{Array.from({ length: 3 }).map((_, i) => (
							<div
								key={i}
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
				</CardContent>
			</Card>
		</div>
	);
}
