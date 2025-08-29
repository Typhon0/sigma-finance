import {
	AlertTriangle,
	Grid,
	List,
	Loader2,
	PlusCircle,
	RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { CreatePortfolioDialog } from "@/components/portfolio/create-portfolio-dialog";
import { PortfolioCard } from "@/components/portfolio/portfolio-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortfolioManagement } from "@/hooks/use-portfolio-management";

interface PortfolioListPageProps {
	className?: string;
}

export function PortfolioListPage({ className }: PortfolioListPageProps) {
	const [viewMode, setViewMode] = useState<"list" | "grid">("grid");

	const {
		portfolios,
		loading,
		hasError,
		error,
		canRetry,
		retry,
		clearError,
		refetch,
		isCreating,
		isUpdating,
		isDeleting,
		isDuplicating,
	} = usePortfolioManagement();

	// Show loading skeleton on initial load
	if (loading && !portfolios) {
		return <PortfolioListSkeleton />;
	}

	// Show error state if there's an error and no cached data
	if (hasError && !portfolios) {
		return (
			<div className={`container mx-auto p-4 md:p-6 ${className || ""}`}>
				<div className="flex items-center justify-between mb-6">
					<h1 className="text-2xl md:text-3xl font-bold">Your Portfolios</h1>
				</div>
				<ErrorState
					error={error}
					canRetry={canRetry}
					onRetry={retry}
					onClearError={clearError}
					onRefresh={refetch}
				/>
			</div>
		);
	}

	const hasPortfolios = portfolios && portfolios.length > 0;

	return (
		<div className={`container mx-auto p-4 md:p-6 ${className || ""}`}>
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl md:text-3xl font-bold">Your Portfolios</h1>

				{hasPortfolios && (
					<div className="flex items-center gap-2">
						{/* View mode toggle */}
						<Button
							variant={viewMode === "list" ? "secondary" : "outline"}
							size="icon"
							onClick={() => setViewMode("list")}
							disabled={loading}
						>
							<List className="h-4 w-4" />
						</Button>
						<Button
							variant={viewMode === "grid" ? "secondary" : "outline"}
							size="icon"
							onClick={() => setViewMode("grid")}
							disabled={loading}
						>
							<Grid className="h-4 w-4" />
						</Button>

						{/* Create portfolio button */}
						<CreatePortfolioDialog>
							<Button disabled={isCreating}>
								<PlusCircle className="mr-2 h-4 w-4" />
								New Portfolio
							</Button>
						</CreatePortfolioDialog>
					</div>
				)}
			</div>

			{/* Error banner (when there's cached data) */}
			{hasError && portfolios && (
				<Alert variant="destructive" className="mb-6">
					<AlertTriangle className="h-4 w-4" />
					<AlertTitle>Connection Error</AlertTitle>
					<AlertDescription className="flex items-center justify-between">
						<span>{error?.message || "Failed to sync with server"}</span>
						<div className="flex gap-2">
							{canRetry && (
								<Button variant="outline" size="sm" onClick={retry}>
									<RefreshCw className="h-3 w-3 mr-1" />
									Retry
								</Button>
							)}
							<Button variant="ghost" size="sm" onClick={clearError}>
								Dismiss
							</Button>
						</div>
					</AlertDescription>
				</Alert>
			)}

			{/* Loading indicator for background operations */}
			{(loading || isCreating || isUpdating || isDeleting || isDuplicating) && (
				<div className="mb-4">
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<Loader2 className="h-4 w-4 animate-spin" />
						<span>
							{loading && "Loading portfolios..."}
							{isCreating && "Creating portfolio..."}
							{isUpdating && "Updating portfolio..."}
							{isDeleting && "Deleting portfolio..."}
							{isDuplicating && "Duplicating portfolio..."}
						</span>
					</div>
				</div>
			)}

			{/* Empty state */}
			{!hasPortfolios ? (
				<EmptyPortfolioState />
			) : (
				/* Portfolio list */
				<div
					className={
						viewMode === "grid"
							? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
							: "space-y-4"
					}
				>
					{portfolios.map((portfolio) => (
						<PortfolioCard
							key={portfolio.id}
							portfolio={portfolio}
							viewMode={viewMode}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function EmptyPortfolioState() {
	return (
		<Card className="text-center py-12">
			<CardHeader>
				<CardTitle>No portfolios found</CardTitle>
				<CardDescription>
					Get started by creating your first portfolio to organize and track
					your investments.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<CreatePortfolioDialog>
					<Button size="lg">
						<PlusCircle className="mr-2 h-5 w-5" />
						Create Portfolio
					</Button>
				</CreatePortfolioDialog>
			</CardContent>
		</Card>
	);
}

function ErrorState({
	error,
	canRetry,
	onRetry,
	onClearError,
	onRefresh,
}: {
	error: Error | null;
	canRetry: boolean;
	onRetry: () => void;
	onClearError: () => void;
	onRefresh?: () => void;
}) {
	return (
		<Card className="text-center py-12">
			<CardHeader>
				<CardTitle className="flex items-center justify-center gap-2 text-destructive">
					<AlertTriangle className="h-5 w-5" />
					Error Loading Portfolios
				</CardTitle>
				<CardDescription>
					{error?.message ||
						"Something went wrong while loading your portfolios."}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex justify-center gap-2">
				{canRetry && (
					<Button onClick={onRetry} variant="outline">
						<RefreshCw className="mr-2 h-4 w-4" />
						Retry
					</Button>
				)}
				{onRefresh && (
					<Button onClick={onRefresh} variant="outline">
						<RefreshCw className="mr-2 h-4 w-4" />
						Refresh
					</Button>
				)}
				<Button onClick={onClearError} variant="ghost">
					Dismiss
				</Button>
			</CardContent>
		</Card>
	);
}

function PortfolioListSkeleton() {
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
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{[...Array(6)].map((_, i) => (
					<Card key={i}>
						<CardHeader>
							<Skeleton className="h-6 w-3/4" />
							<Skeleton className="h-4 w-1/2" />
						</CardHeader>
						<CardContent>
							<div className="space-y-2">
								<Skeleton className="h-4 w-full" />
								<Skeleton className="h-4 w-2/3" />
								<Skeleton className="h-8 w-1/3" />
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}
