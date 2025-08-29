import { Link } from "@tanstack/react-router";
import {
	AlertTriangle,
	Calendar,
	Copy,
	DollarSign,
	Edit,
	Minus,
	MoreHorizontal,
	PieChart,
	Trash2,
	TrendingDown,
	TrendingUp,
} from "lucide-react";
import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import type { GetPortfoliosWithAnalyticsQuery } from "@/gql/graphql";
import { usePortfolioOperations } from "@/hooks/use-portfolio-management";
import { EditPortfolioDialog } from "./edit-portfolio-dialog";

type Portfolio = GetPortfoliosWithAnalyticsQuery["portfolios"][0];

export type ViewMode = "list" | "grid";
export type PortfolioAction = "edit" | "delete" | "duplicate" | "view";

export interface PortfolioCardProps {
	portfolio: Portfolio;
	viewMode: ViewMode;
	isSelected?: boolean;
	onSelect?: (selected: boolean) => void;
	onAction?: (action: PortfolioAction, portfolioId: string) => void;
	isDragging?: boolean;
	assets?: any[];
}

export function PortfolioCard({
	portfolio,
	viewMode,
	isSelected = false,
	onSelect,
	onAction,
	isDragging = false,
	assets: _assets,
}: PortfolioCardProps) {
	const { toast } = useToast();
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);

	const { deletePortfolio, duplicatePortfolio, isLoading } =
		usePortfolioOperations(portfolio.id);

	const handleDelete = async () => {
		if (onAction) {
			onAction("delete", portfolio.id);
			setShowDeleteDialog(false);
		} else {
			try {
				await deletePortfolio();
				toast("Portfolio Deleted", {
					description: `"${portfolio.name}" has been successfully deleted.`,
				});
				setShowDeleteDialog(false);
			} catch (error) {
				toast.error("Error Deleting Portfolio", {
					description:
						error instanceof Error
							? error.message
							: "Failed to delete portfolio",
				});
			}
		}
	};

	const handleDuplicate = async () => {
		if (onAction) {
			onAction("duplicate", portfolio.id);
		} else {
			const newName = `${portfolio.name} (Copy)`;
			try {
				await duplicatePortfolio(newName, { copyAssets: true });
				toast("Portfolio Duplicated", {
					description: `A copy of "${portfolio.name}" has been created.`,
				});
			} catch (error) {
				toast.error("Error Duplicating Portfolio", {
					description:
						error instanceof Error
							? error.message
							: "Failed to duplicate portfolio",
				});
			}
		}
	};

	// Calculate portfolio metrics
	const totalValue = portfolio.analytics?.totalValue || 0;
	const totalGainLoss = portfolio.analytics?.totalGainLoss || 0;
	const totalGainLossPercent = portfolio.analytics?.totalGainLossPercent || 0;
	const assetCount = portfolio.assets?.length || 0;

	// Format currency values
	const formatCurrency = (value: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(value);
	};

	// Format percentage
	const formatPercentage = (value: number) => {
		return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
	};

	// Get gain/loss color and icon
	const getGainLossDisplay = () => {
		if (totalGainLoss > 0) {
			return {
				color: "text-green-600",
				bgColor: "bg-green-50",
				icon: TrendingUp,
			};
		} else if (totalGainLoss < 0) {
			return {
				color: "text-red-600",
				bgColor: "bg-red-50",
				icon: TrendingDown,
			};
		} else {
			return {
				color: "text-gray-600",
				bgColor: "bg-gray-50",
				icon: Minus,
			};
		}
	};

	const gainLossDisplay = getGainLossDisplay();
	const GainLossIcon = gainLossDisplay.icon;

	if (viewMode === "list") {
		return (
			<>
				<Card
					className={`hover:shadow-md transition-shadow touch-manipulation ${isDragging ? "opacity-50" : ""} ${isSelected ? "ring-2 ring-primary" : ""}`}
				>
					<CardContent className="p-3 sm:p-4">
						<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
							<div className="flex items-start sm:items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
								{onSelect && (
									<input
										type="checkbox"
										checked={isSelected}
										onChange={(e) => onSelect(e.target.checked)}
										className="rounded touch-manipulation mt-1 sm:mt-0 flex-shrink-0"
									/>
								)}
								<div className="flex-1 min-w-0">
									<Link
										to="/portfolios/$portfolioId"
										params={{ portfolioId: portfolio.id }}
										className="font-semibold text-base sm:text-lg hover:underline block truncate"
										onClick={() => onAction?.("view", portfolio.id)}
									>
										{portfolio.name}
									</Link>
									{portfolio.description && (
										<p className="text-sm text-muted-foreground mt-1 line-clamp-2 sm:line-clamp-1">
											{portfolio.description}
										</p>
									)}
								</div>
							</div>

							{/* Mobile: Stack metrics vertically */}
							<div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 text-sm">
								<div className="grid grid-cols-3 gap-4 sm:contents">
									<div className="text-center sm:text-left">
										<p className="text-muted-foreground text-xs sm:text-sm">
											Total Value
										</p>
										<p className="font-semibold text-sm sm:text-base">
											{formatCurrency(totalValue)}
										</p>
									</div>

									<div className="text-center sm:text-left">
										<p className="text-muted-foreground text-xs sm:text-sm">
											Gain/Loss
										</p>
										<div
											className={`flex items-center justify-center sm:justify-start gap-1 ${gainLossDisplay.color}`}
										>
											<GainLossIcon className="h-3 w-3" />
											<span className="font-semibold text-xs sm:text-sm">
												{formatCurrency(totalGainLoss)}
											</span>
										</div>
										<div
											className={`text-xs ${gainLossDisplay.color} sm:hidden`}
										>
											{formatPercentage(totalGainLossPercent)}
										</div>
									</div>

									<div className="text-center sm:text-left">
										<p className="text-muted-foreground text-xs sm:text-sm">
											Assets
										</p>
										<p className="font-semibold text-sm sm:text-base">
											{assetCount}
										</p>
									</div>
								</div>

								{/* Desktop: Show percentage inline */}
								<div className="hidden sm:block text-center">
									<p className="text-muted-foreground text-xs sm:text-sm">
										Performance
									</p>
									<div
										className={`font-semibold text-sm ${gainLossDisplay.color}`}
									>
										{formatPercentage(totalGainLossPercent)}
									</div>
								</div>
							</div>

							<div className="flex justify-end sm:block">
								<PortfolioActions
									portfolioId={portfolio.id}
									onDuplicate={handleDuplicate}
									onDelete={() => setShowDeleteDialog(true)}
									isLoading={isLoading}
								/>
							</div>
						</div>
					</CardContent>
				</Card>

				<DeleteConfirmationDialog
					open={showDeleteDialog}
					onOpenChange={setShowDeleteDialog}
					portfolioName={portfolio.name}
					onConfirm={handleDelete}
					isLoading={isLoading}
				/>
			</>
		);
	}

	// Grid view
	return (
		<>
			<Card
				className={`hover:shadow-md transition-shadow touch-manipulation ${isDragging ? "opacity-50" : ""} ${isSelected ? "ring-2 ring-primary" : ""} h-full flex flex-col`}
			>
				<CardHeader className="pb-2 sm:pb-3 flex-shrink-0">
					<div className="flex items-start justify-between gap-2">
						<div className="flex items-start space-x-2 flex-1 min-w-0">
							{onSelect && (
								<input
									type="checkbox"
									checked={isSelected}
									onChange={(e) => onSelect(e.target.checked)}
									className="rounded mt-1 touch-manipulation flex-shrink-0"
								/>
							)}
							<div className="flex-1 min-w-0">
								<CardTitle className="text-base sm:text-lg leading-tight">
									<Link
										to="/portfolios/$portfolioId"
										params={{ portfolioId: portfolio.id }}
										className="hover:underline block"
										onClick={() => onAction?.("view", portfolio.id)}
									>
										<span className="line-clamp-2">{portfolio.name}</span>
									</Link>
								</CardTitle>
								{portfolio.description && (
									<p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">
										{portfolio.description}
									</p>
								)}
							</div>
						</div>

						<div className="flex-shrink-0">
							<PortfolioActions
								portfolioId={portfolio.id}
								onDuplicate={handleDuplicate}
								onDelete={() => setShowDeleteDialog(true)}
								isLoading={isLoading}
							/>
						</div>
					</div>
				</CardHeader>

				<CardContent className="pt-0 flex-1 flex flex-col justify-between">
					<div className="space-y-2 sm:space-y-3">
						{/* Total Value */}
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
								<DollarSign className="h-3 w-3 sm:h-4 sm:w-4" />
								<span>Total Value</span>
							</div>
							<span className="font-semibold text-sm sm:text-lg">
								{formatCurrency(totalValue)}
							</span>
						</div>

						{/* Gain/Loss */}
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
								<TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" />
								<span>Gain/Loss</span>
							</div>
							<div
								className={`flex items-center gap-1 ${gainLossDisplay.color}`}
							>
								<GainLossIcon className="h-3 w-3" />
								<span className="font-semibold text-xs sm:text-sm">
									{formatCurrency(totalGainLoss)}
								</span>
							</div>
						</div>

						{/* Performance Badge */}
						{totalGainLossPercent !== 0 && (
							<div className="flex justify-center py-1">
								<Badge
									variant="secondary"
									className={`${gainLossDisplay.bgColor} ${gainLossDisplay.color} border-0 text-xs`}
								>
									{formatPercentage(totalGainLossPercent)}
								</Badge>
							</div>
						)}
					</div>

					{/* Asset Count and Created Date */}
					<div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t mt-2 sm:mt-3">
						<div className="flex items-center gap-1">
							<PieChart className="h-3 w-3" />
							<span>{assetCount} assets</span>
						</div>
						<div className="flex items-center gap-1">
							<Calendar className="h-3 w-3" />
							<span className="hidden sm:inline">
								{new Date(portfolio.createdAt).toLocaleDateString()}
							</span>
							<span className="sm:hidden">
								{new Date(portfolio.createdAt).toLocaleDateString("en-US", {
									month: "short",
									day: "numeric",
								})}
							</span>
						</div>
					</div>
				</CardContent>
			</Card>

			<DeleteConfirmationDialog
				open={showDeleteDialog}
				onOpenChange={setShowDeleteDialog}
				portfolioName={portfolio.name}
				onConfirm={handleDelete}
				isLoading={isLoading}
			/>
		</>
	);
}

function PortfolioActions({
	portfolioId,
	onDuplicate,
	onDelete,
	isLoading,
}: {
	portfolioId: string;
	onDuplicate: () => void;
	onDelete: () => void;
	isLoading: boolean;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					disabled={isLoading}
					className="touch-manipulation h-8 w-8 sm:h-10 sm:w-10"
				>
					<MoreHorizontal className="h-4 w-4" />
					<span className="sr-only">Portfolio actions</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-48">
				<EditPortfolioDialog portfolioId={portfolioId}>
					<DropdownMenuItem
						onSelect={(e) => e.preventDefault()}
						disabled={isLoading}
						className="touch-manipulation py-3"
					>
						<Edit className="mr-2 h-4 w-4" />
						Edit Portfolio
					</DropdownMenuItem>
				</EditPortfolioDialog>
				<DropdownMenuItem
					onClick={onDuplicate}
					disabled={isLoading}
					className="touch-manipulation py-3"
				>
					<Copy className="mr-2 h-4 w-4" />
					Duplicate
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					onClick={onDelete}
					disabled={isLoading}
					className="text-destructive focus:text-destructive touch-manipulation py-3"
				>
					<Trash2 className="mr-2 h-4 w-4" />
					Delete Portfolio
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function DeleteConfirmationDialog({
	open,
	onOpenChange,
	portfolioName,
	onConfirm,
	isLoading,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	portfolioName: string;
	onConfirm: () => void;
	isLoading: boolean;
}) {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent className="max-w-md">
				<AlertDialogHeader>
					<AlertDialogTitle className="flex items-center gap-2 text-destructive">
						<AlertTriangle className="h-5 w-5" />
						Delete Portfolio
					</AlertDialogTitle>
					<AlertDialogDescription asChild>
						<div className="space-y-4">
							<p>
								Are you sure you want to delete{" "}
								<span className="font-semibold">"{portfolioName}"</span>?
							</p>

							<div className="rounded-lg border border-muted bg-muted/30 p-3">
								<div className="text-sm font-medium mb-2">
									This will permanently delete:
								</div>
								<ul className="text-sm space-y-1 text-muted-foreground">
									<li>• Portfolio "{portfolioName}"</li>
									<li>• All asset positions</li>
									<li>• All transaction records</li>
									<li>• Performance analytics and historical data</li>
								</ul>
							</div>

							<p className="text-sm font-medium text-destructive">
								This action cannot be undone.
							</p>
						</div>
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={onConfirm}
						disabled={isLoading}
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
					>
						{isLoading ? "Deleting..." : "Delete Portfolio"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
