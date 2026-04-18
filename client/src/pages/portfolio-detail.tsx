import { useParams } from "@tanstack/react-router";
import {
	ArrowLeft,
	Copy,
	Download,
	Edit,
	Minus,
	MoreHorizontal,
	Plus,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { AddAssetDialog } from "@/components/portfolio/add-asset-dialog";
import { EditPortfolioDialog } from "@/components/portfolio/edit-portfolio-dialog";
import {
	PortfolioBreadcrumb,
	portfolioBreadcrumbs,
} from "@/components/portfolio/portfolio-breadcrumb";
import { PortfolioDeleteDialog } from "@/components/portfolio/portfolio-delete-dialog";
import { PortfolioDetailSkeleton } from "@/components/portfolio/portfolio-detail-skeleton";
import { PortfolioDetailErrorBoundary } from "@/components/portfolio/portfolio-error-boundary";
import { PortfolioErrorDisplay } from "@/components/portfolio/portfolio-error-display";
import {
	AsyncOperationIndicator,
	InlineLoading,
	LoadingIndicator,
} from "@/components/portfolio/portfolio-loading-indicators";
import { RemoveAssetDialog } from "@/components/portfolio/remove-asset-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import type { PortfolioAsset } from "@/gql/graphql";
import { usePortfolioDetail } from "@/hooks/use-portfolio-detail";
import { usePortfolioRetry } from "@/hooks/use-retry-mechanism";

export default function PortfolioDetailPage() {
	const { portfolioId } = useParams({ from: "/portfolios/$portfolioId" });
	const { portfolio, loading, error, isUnauthorized, navigateToList, retry } =
		usePortfolioDetail({ portfolioId });

	// Enhanced retry mechanism for portfolio detail operations
	const portfolioRetry = usePortfolioRetry({
		maxRetries: 3,
		onRetryAttempt: (attempt) => {
			console.log(`Portfolio detail retry attempt ${attempt}`);
		},
	});

	return (
		<PortfolioDetailErrorBoundary
			onRetry={async () => {
				await portfolioRetry.executeWithRetry(async () => {
					await retry();
				});
			}}
		>
			<SidebarProvider>
				<AppSidebar />
				<SidebarInset>
					<header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
						<div className="flex items-center gap-2 px-4">
							<SidebarTrigger className="-ml-1" />
							<Separator orientation="vertical" className="mr-2 h-4" />
							<InlineLoading
								isLoading={loading && !portfolio}
								loadingText="Loading..."
							>
								<PortfolioBreadcrumb
									items={portfolioBreadcrumbs.portfolioDetail(
										portfolio?.name || "Portfolio Details",
									)}
								/>
							</InlineLoading>
						</div>
					</header>

					{/* Enhanced loading state */}
					{loading && !portfolio && <PortfolioDetailSkeleton />}

					{/* Enhanced error display with retry functionality */}
					{(error || isUnauthorized) && (
						<div className="space-y-4">
							{portfolioRetry.isRetrying && (
								<div className="p-4">
									<LoadingIndicator
										message={`Retrying... (${portfolioRetry.retryCount}/${portfolioRetry.maxRetries})`}
										variant="dots"
									/>
								</div>
							)}
							<PortfolioErrorDisplay
								error={error || null}
								portfolioId={portfolioId}
								isUnauthorized={isUnauthorized || false}
								onRetry={async () => {
									await portfolioRetry.executeWithRetry(async () => {
										await retry();
									});
								}}
								onNavigateBack={navigateToList}
								loading={loading || portfolioRetry.isRetrying}
							/>
						</div>
					)}

					{/* Portfolio content with loading overlay */}
					{!error && !isUnauthorized && (
						<>
							{loading && portfolio && (
								<div className="p-4">
									<AsyncOperationIndicator
										isLoading={true}
										loadingMessage="Refreshing portfolio data..."
									/>
								</div>
							)}
							{portfolio && (
								<PortfolioDetailContent portfolioId={portfolioId} />
							)}
						</>
					)}
				</SidebarInset>
			</SidebarProvider>
		</PortfolioDetailErrorBoundary>
	);
}

function PortfolioDetailContent({ portfolioId }: { portfolioId: string }) {
	const {
		portfolio,
		loading,
		error,
		isUnauthorized,
		showDeleteDialog,
		isDeleting,
		_navigateToEdit,
		navigateToList,
		handleDeleteClick,
		handleDeleteCancel,
		handleDeleteConfirm,
		handleExport,
		handleDuplicate,
		refetch,
	} = usePortfolioDetail({ portfolioId });

	// Dialog states for asset management
	const [showAddAssetDialog, setShowAddAssetDialog] = useState(false);
	const [showRemoveAssetDialog, setShowRemoveAssetDialog] = useState(false);
	const [selectedAsset, setSelectedAsset] = useState<PortfolioAsset | null>(
		null,
	);

	const handleAddAsset = () => {
		setShowAddAssetDialog(true);
	};

	const handleRemoveAsset = (asset: PortfolioAsset) => {
		setSelectedAsset(asset);
		setShowRemoveAssetDialog(true);
	};

	const handleAssetSuccess = () => {
		// Refetch portfolio data to get updated assets
		refetch();
	};

	// Early returns are handled in the parent component
	if (loading || error || isUnauthorized || !portfolio) {
		return null;
	}

	// Mock analytics data
	const mockAnalytics = {
		totalValue: 125000,
		totalCost: 112500,
		totalGainLoss: 12500,
		totalGainLossPercent: 11.11,
		assetCount: portfolio.assets?.length || 0,
	};

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
		}).format(amount);
	};

	const formatPercentage = (percent: number) => {
		return `${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%`;
	};

	const getPerformanceColor = (percent: number) => {
		if (percent > 0) return "text-green-600";
		if (percent < 0) return "text-red-600";
		return "text-muted-foreground";
	};

	return (
		<div className="flex flex-1 flex-col gap-3 sm:gap-4 p-3 sm:p-4 pt-0">
			{/* Header Section */}
			<div className="flex items-center gap-2 sm:gap-4">
				<Button
					variant="ghost"
					size="sm"
					onClick={navigateToList}
					className="gap-2 touch-manipulation"
				>
					<ArrowLeft className="h-4 w-4" />
					<span className="hidden sm:inline">Back to Portfolios</span>
					<span className="sm:hidden">Back</span>
				</Button>
			</div>

			{/* Portfolio Header */}
			<div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div className="space-y-2 min-w-0 flex-1">
					<h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight break-words">
						{portfolio.name}
					</h1>
					{portfolio.description && (
						<p className="text-muted-foreground text-sm sm:text-base max-w-2xl">
							{portfolio.description}
						</p>
					)}
					<div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
						<span>
							Created {new Date(portfolio.createdAt).toLocaleDateString()}
						</span>
						<Separator orientation="vertical" className="h-4 hidden sm:block" />
						<span>
							Last updated {new Date(portfolio.updatedAt).toLocaleDateString()}
						</span>
					</div>
				</div>

				{/* Action Buttons */}
				<div className="flex flex-col sm:flex-row gap-2 sm:gap-2 lg:flex-shrink-0">
					<div className="grid grid-cols-2 sm:flex gap-2">
						<EditPortfolioDialog
							portfolioId={portfolioId}
							onSuccess={() => {
								// Refetch portfolio data to show updated information
								refetch();
							}}
						>
							<Button
								variant="outline"
								size="sm"
								className="touch-manipulation"
							>
								<Edit className="mr-2 h-4 w-4" />
								<span className="hidden sm:inline">Edit</span>
								<span className="sm:hidden">Edit</span>
							</Button>
						</EditPortfolioDialog>
						<Button
							variant="outline"
							size="sm"
							onClick={handleDuplicate}
							className="touch-manipulation"
						>
							<Copy className="mr-2 h-4 w-4" />
							<span className="hidden sm:inline">Duplicate</span>
							<span className="sm:hidden">Copy</span>
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={handleExport}
							className="touch-manipulation"
						>
							<Download className="mr-2 h-4 w-4" />
							<span className="hidden sm:inline">Export</span>
							<span className="sm:hidden">Export</span>
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={handleDeleteClick}
							className="text-destructive hover:text-destructive touch-manipulation"
							disabled={isDeleting}
						>
							<Trash2 className="mr-2 h-4 w-4" />
							{isDeleting ? (
								<span className="hidden sm:inline">Deleting...</span>
							) : (
								<>
									<span className="hidden sm:inline">Delete</span>
									<span className="sm:hidden">Delete</span>
								</>
							)}
						</Button>
					</div>
				</div>
			</div>

			{/* Portfolio Metrics */}
			<div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
				<Card className="touch-manipulation">
					<CardHeader className="pb-2">
						<CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
							Total Value
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-lg sm:text-xl lg:text-2xl font-bold">
							{formatCurrency(mockAnalytics.totalValue)}
						</div>
					</CardContent>
				</Card>

				<Card className="touch-manipulation">
					<CardHeader className="pb-2">
						<CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
							Total Cost
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-lg sm:text-xl lg:text-2xl font-bold">
							{formatCurrency(mockAnalytics.totalCost)}
						</div>
					</CardContent>
				</Card>

				<Card className="touch-manipulation">
					<CardHeader className="pb-2">
						<CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
							Gain/Loss
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div
							className={`text-lg sm:text-xl lg:text-2xl font-bold ${getPerformanceColor(mockAnalytics.totalGainLoss)}`}
						>
							{formatCurrency(mockAnalytics.totalGainLoss)}
						</div>
						<div
							className={`text-xs sm:text-sm ${getPerformanceColor(mockAnalytics.totalGainLossPercent)}`}
						>
							{formatPercentage(mockAnalytics.totalGainLossPercent)}
						</div>
					</CardContent>
				</Card>

				<Card className="touch-manipulation">
					<CardHeader className="pb-2">
						<CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
							Assets
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-lg sm:text-xl lg:text-2xl font-bold">
							{mockAnalytics.assetCount}
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Portfolio Assets */}
			<Card>
				<CardHeader>
					<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
						<div>
							<CardTitle className="text-lg sm:text-xl">Assets</CardTitle>
							<CardDescription className="text-sm">
								Assets in this portfolio
							</CardDescription>
						</div>
						<Button
							onClick={handleAddAsset}
							className="touch-manipulation w-full sm:w-auto"
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Asset
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					{portfolio.assets && portfolio.assets.length > 0 ? (
						<div className="space-y-3 sm:space-y-4">
							{portfolio.assets.map((asset, index) => (
								<div
									key={asset.asset.id || index}
									className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 border rounded-lg hover:bg-muted/50 transition-colors"
								>
									<div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 min-w-0 flex-1">
										<div className="min-w-0 flex-1">
											<h4 className="font-medium text-sm sm:text-base truncate">
												{asset.asset.name}
											</h4>
											{asset.asset.symbol && (
												<p className="text-xs sm:text-sm text-muted-foreground">
													{asset.asset.symbol}
												</p>
											)}
										</div>
										<Badge
											variant="secondary"
											className="text-xs self-start sm:self-center"
										>
											{asset.asset.assetType.name}
										</Badge>
									</div>
									<div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
										<div className="grid grid-cols-2 sm:block sm:text-right gap-2 sm:gap-0">
											<div className="text-xs sm:text-sm">
												<span className="text-muted-foreground sm:hidden">
													Qty:{" "}
												</span>
												<span className="font-medium">
													{asset.quantity.toLocaleString()}
												</span>
											</div>
											<div className="text-xs sm:text-sm text-muted-foreground">
												<span className="sm:hidden">Avg: </span>
												{formatCurrency(asset.averagePurchasePrice || 0)}
											</div>
											{(asset.ownershipPct || 0) < 100 && (
												<div className="text-xs sm:text-sm text-muted-foreground col-span-2 sm:col-span-1">
													<span className="sm:hidden">Own: </span>
													{asset.ownershipPct || 0}%
												</div>
											)}
											{asset.asset.currentValue && (
												<div className="text-xs sm:text-sm font-medium col-span-2 sm:col-span-1">
													<span className="text-muted-foreground sm:hidden">
														Current:{" "}
													</span>
													{formatCurrency(
														asset.asset.currentValue * asset.quantity,
													)}
												</div>
											)}
										</div>
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button
													variant="ghost"
													size="sm"
													className="touch-manipulation"
												>
													<MoreHorizontal className="h-4 w-4" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end" className="w-48">
												<DropdownMenuItem
													onClick={() =>
														console.log("Edit asset:", asset.asset.id)
													}
													className="touch-manipulation py-3"
												>
													<Edit className="mr-2 h-4 w-4" />
													Edit Position
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem
													onClick={() => handleRemoveAsset(asset)}
													className="text-destructive touch-manipulation py-3"
												>
													<Minus className="mr-2 h-4 w-4" />
													Remove Asset
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="text-center py-6 sm:py-8">
							<p className="text-muted-foreground mb-4 text-sm sm:text-base">
								No assets in this portfolio yet.
							</p>
							<Button
								onClick={handleAddAsset}
								className="touch-manipulation w-full sm:w-auto"
							>
								<Plus className="mr-2 h-4 w-4" />
								Add Your First Asset
							</Button>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Asset Management Dialogs */}
			{portfolio && (
				<>
					<AddAssetDialog
						open={showAddAssetDialog}
						onOpenChange={setShowAddAssetDialog}
						portfolioID={portfolio.id}
						portfolioName={portfolio.name}
						onSuccess={handleAssetSuccess}
					/>
					<RemoveAssetDialog
						open={showRemoveAssetDialog}
						onOpenChange={setShowRemoveAssetDialog}
						portfolioID={portfolio.id}
						portfolioName={portfolio.name}
						asset={selectedAsset}
						onSuccess={handleAssetSuccess}
					/>
					<PortfolioDeleteDialog
						open={showDeleteDialog}
						onOpenChange={handleDeleteCancel}
						portfolio={portfolio}
						onConfirm={handleDeleteConfirm}
						isDeleting={isDeleting}
					/>
				</>
			)}
		</div>
	);
}
