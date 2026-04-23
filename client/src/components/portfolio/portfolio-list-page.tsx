import { AlertTriangle, Grid, List, PlusCircle, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { CreatePortfolioDialog } from "@/components/portfolio/create-portfolio-dialog";
import { PortfolioCard } from "@/components/portfolio/portfolio-card";
import { PortfolioListErrorBoundary } from "@/components/portfolio/portfolio-error-boundary";
import { PortfolioListLoadingSkeleton } from "@/components/portfolio/portfolio-list-skeleton";
import {
	AsyncOperationIndicator,
	LoadingIndicator,
	PortfolioOperationStatus,
} from "@/components/portfolio/portfolio-loading-indicators";
import { PortfolioSearch } from "@/components/portfolio/portfolio-search";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdvancedSearch } from "@/hooks/use-debounced-search";
import { usePortfolioManagement } from "@/hooks/use-portfolio-management";
import { usePortfolioRetry } from "@/hooks/use-retry-mechanism";

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

	// Enhanced search and filtering
	const searchablePortfolios = useMemo(() => {
		if (!portfolios) return [];

		// Add computed fields for filtering
		return portfolios.map((portfolio) => ({
			...portfolio,
			hasAssets: portfolio.assets && portfolio.assets.length > 0,
			totalValue: portfolio.analytics?.totalValue || 0,
		}));
	}, [portfolios]);

	const {
		searchTerm,
		setSearchTerm,
		filters,
		updateFilter,
		removeFilter: _removeFilter,
		clearAllFilters,
		sortConfig,
		setSortConfig,
		toggleSort: _toggleSort,
		filteredItems: filteredPortfolios,
		resultCount,
		hasResults,
		isSearching,
		hasActiveFilters,
	} = useAdvancedSearch(searchablePortfolios, ["name", "description"], {
		debounceDelay: 300,
		caseSensitive: false,
		exactMatch: false,
	});

	// Enhanced retry mechanism for portfolio operations
	const portfolioRetry = usePortfolioRetry({
		maxRetries: 3,
		onRetryAttempt: (_attempt) => {},
		onMaxRetriesReached: (_error) => {},
	});

	// Show loading skeleton on initial load
	if (loading && !portfolios) {
		return <PortfolioListLoadingSkeleton />;
	}

	// Show error state if there's an error and no cached data
	if (hasError && !portfolios) {
		return (
			<PortfolioListErrorBoundary
				onRetry={async () => {
					await portfolioRetry.executeWithRetry(async () => {
						await refetch();
					});
				}}
			>
				<div className={`container mx-auto p-4 md:p-6 ${className || ""}`}>
					<div className="flex items-center justify-between mb-6">
						<h1 className="text-2xl md:text-3xl font-bold">Your Portfolios</h1>
					</div>
					<ErrorState
						error={error}
						canRetry={canRetry && portfolioRetry.canRetry}
						onRetry={async () => {
							await portfolioRetry.executeWithRetry(async () => {
								await retry();
							});
						}}
						onClearError={clearError}
						onRefresh={refetch}
						isRetrying={portfolioRetry.isRetrying}
						retryCount={portfolioRetry.retryCount}
					/>
				</div>
			</PortfolioListErrorBoundary>
		);
	}

	const hasPortfolios = portfolios && portfolios.length > 0;

	return (
		<PortfolioListErrorBoundary
			onRetry={async () => {
				await portfolioRetry.executeWithRetry(async () => {
					await refetch();
				});
			}}
		>
			<div className={`container mx-auto p-3 sm:p-4 lg:p-6 ${className || ""}`}>
				{/* Header */}
				<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
					<h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Your Portfolios</h1>

					{hasPortfolios && (
						<div className="flex items-center gap-2 justify-end sm:justify-start">
							{/* View mode toggle - Hidden on mobile, shown on larger screens */}
							<div className="hidden sm:flex items-center gap-2">
								<Button
									variant={viewMode === "list" ? "secondary" : "outline"}
									size="icon"
									onClick={() => setViewMode("list")}
									disabled={loading}
									className="touch-manipulation"
								>
									<List className="h-4 w-4" />
								</Button>
								<Button
									variant={viewMode === "grid" ? "secondary" : "outline"}
									size="icon"
									onClick={() => setViewMode("grid")}
									disabled={loading}
									className="touch-manipulation"
								>
									<Grid className="h-4 w-4" />
								</Button>
							</div>

							{/* Create portfolio button */}
							<CreatePortfolioDialog>
								<Button disabled={isCreating} className="touch-manipulation">
									<PlusCircle className="mr-2 h-4 w-4" />
									<span className="hidden sm:inline">New Portfolio</span>
									<span className="sm:hidden">New</span>
								</Button>
							</CreatePortfolioDialog>
						</div>
					)}
				</div>

				{/* Search and Filter Controls */}
				{hasPortfolios && (
					<div className="mb-6">
						<PortfolioSearch
							searchTerm={searchTerm}
							onSearchChange={setSearchTerm}
							onFilterChange={updateFilter}
							onSortChange={
								setSortConfig as (
									config:
										| import("@/hooks/use-debounced-search").SortConfig<
												import("@/gql/graphql").Portfolio
										  >
										| null,
								) => void
							}
							filters={filters}
							sortConfig={
								sortConfig as
									| import("@/hooks/use-debounced-search").SortConfig<
											import("@/gql/graphql").Portfolio
									  >
									| null
							}
							resultCount={resultCount}
							totalCount={portfolios.length}
							isSearching={isSearching}
							onClearAll={clearAllFilters}
						/>
					</div>
				)}

				{/* Enhanced error banner (when there's cached data) */}
				{hasError && portfolios && (
					<AsyncOperationIndicator
						isLoading={portfolioRetry.isRetrying}
						error={error}
						errorMessage={error?.message || "Failed to sync with server"}
						onRetry={async () => {
							await portfolioRetry.executeWithRetry(async () => {
								await retry();
							});
						}}
						canRetry={canRetry && portfolioRetry.canRetry}
						className="mb-6"
					/>
				)}

				{/* Enhanced loading indicator for background operations */}
				<PortfolioOperationStatus
					operations={{
						create: isCreating,
						update: isUpdating,
						delete: isDeleting,
						duplicate: isDuplicating,
						loading: loading,
					}}
				/>

				{/* Retry status indicator */}
				{portfolioRetry.isRetrying && (
					<div className="mb-4">
						<LoadingIndicator
							message={`Retrying... (${portfolioRetry.retryCount}/${portfolioRetry.maxRetries})`}
							variant="dots"
						/>
					</div>
				)}

				{/* Results */}
				{!hasPortfolios ? (
					<EmptyPortfolioState />
				) : hasResults ? (
					/* Portfolio list */
					<div
						className={
							viewMode === "grid"
								? "grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-6"
								: "space-y-3 sm:space-y-4"
						}
					>
						{filteredPortfolios.map((portfolio) => (
							<PortfolioCard key={portfolio.id} portfolio={portfolio} viewMode={viewMode} />
						))}
					</div>
				) : hasActiveFilters ? (
					/* No results with active filters */
					<Card className="text-center py-8 sm:py-12 mx-2 sm:mx-0">
						<CardHeader className="px-4 sm:px-6">
							<CardTitle className="text-lg sm:text-xl">No portfolios found</CardTitle>
							<CardDescription className="text-sm sm:text-base">
								No portfolios match your current search and filter criteria.
							</CardDescription>
						</CardHeader>
						<CardContent className="px-4 sm:px-6">
							<Button variant="outline" onClick={clearAllFilters} className="touch-manipulation">
								Clear all filters
							</Button>
						</CardContent>
					</Card>
				) : (
					<EmptyPortfolioState />
				)}
			</div>
		</PortfolioListErrorBoundary>
	);
}

function EmptyPortfolioState() {
	return (
		<Card className="text-center py-8 sm:py-12 mx-2 sm:mx-0">
			<CardHeader className="px-4 sm:px-6">
				<CardTitle className="text-lg sm:text-xl">No portfolios found</CardTitle>
				<CardDescription className="text-sm sm:text-base">
					Get started by creating your first portfolio to organize and track your investments.
				</CardDescription>
			</CardHeader>
			<CardContent className="px-4 sm:px-6">
				<CreatePortfolioDialog>
					<Button size="lg" className="touch-manipulation w-full sm:w-auto">
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
	isRetrying = false,
	retryCount = 0,
}: {
	error: Error | null;
	canRetry: boolean;
	onRetry: () => Promise<void> | void;
	onClearError: () => void;
	onRefresh?: () => void;
	isRetrying?: boolean;
	retryCount?: number;
}) {
	return (
		<Card className="text-center py-8 sm:py-12 mx-2 sm:mx-0">
			<CardHeader className="px-4 sm:px-6">
				<CardTitle className="flex items-center justify-center gap-2 text-destructive text-lg sm:text-xl">
					<AlertTriangle className="h-5 w-5" />
					Error Loading Portfolios
				</CardTitle>
				<CardDescription className="text-sm sm:text-base">
					{error?.message || "Something went wrong while loading your portfolios."}
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4 px-4 sm:px-6">
				{retryCount > 0 && (
					<div className="text-sm text-muted-foreground text-center">
						Retry attempt: {retryCount}/3
					</div>
				)}

				{isRetrying && (
					<div className="flex justify-center">
						<LoadingIndicator message="Retrying..." size="sm" />
					</div>
				)}

				<div className="flex flex-col sm:flex-row justify-center gap-2">
					{canRetry && !isRetrying && (
						<Button onClick={onRetry} variant="outline" className="touch-manipulation">
							<RefreshCw className="mr-2 h-4 w-4" />
							Retry
						</Button>
					)}
					{onRefresh && !isRetrying && (
						<Button onClick={onRefresh} variant="outline" className="touch-manipulation">
							<RefreshCw className="mr-2 h-4 w-4" />
							Refresh
						</Button>
					)}
					<Button
						onClick={onClearError}
						variant="ghost"
						className="touch-manipulation"
						disabled={isRetrying}
					>
						Dismiss
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
