import { Link } from "@tanstack/react-router";
import {
	Calendar,
	Copy,
	DollarSign,
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
					className={`hover:shadow-md transition-shadow ${isDragging ? "opacity-50" : ""} ${isSelected ? "ring-2 ring-primary" : ""}`}
				>
					<CardContent className="p-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center space-x-4 flex-1">
								{onSelect && (
									<input
										type="checkbox"
										checked={isSelected}
										onChange={(e) => onSelect(e.target.checked)}
										className="rounded"
									/>
								)}
								<div className="flex-1">
									<Link
										to="/portfolios/$portfolioId"
										params={{ portfolioId: portfolio.id }}
										className="font-semibold text-lg hover:underline"
										onClick={() => onAction?.("view", portfolio.id)}
									>
										{portfolio.name}
									</Link>
									{portfolio.description && (
										<p className="text-sm text-muted-foreground mt-1">
											{portfolio.description}
										</p>
									)}
								</div>

								<div className="flex items-center space-x-6 text-sm">
									<div className="text-center">
										<p className="text-muted-foreground">Total Value</p>
										<p className="font-semibold">
											{formatCurrency(totalValue)}
										</p>
									</div>

									<div className="text-center">
										<p className="text-muted-foreground">Gain/Loss</p>
										<div
											className={`flex items-center gap-1 ${gainLossDisplay.color}`}
										>
											<GainLossIcon className="h-3 w-3" />
											<span className="font-semibold">
												{formatCurrency(totalGainLoss)} (
												{formatPercentage(totalGainLossPercent)})
											</span>
										</div>
									</div>

									<div className="text-center">
										<p className="text-muted-foreground">Assets</p>
										<p className="font-semibold">{assetCount}</p>
									</div>
								</div>
							</div>

							<PortfolioActions
								onDuplicate={handleDuplicate}
								onDelete={() => setShowDeleteDialog(true)}
								isLoading={isLoading}
							/>
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
				className={`hover:shadow-md transition-shadow ${isDragging ? "opacity-50" : ""} ${isSelected ? "ring-2 ring-primary" : ""}`}
			>
				<CardHeader className="pb-3">
					<div className="flex items-start justify-between">
						<div className="flex items-start space-x-2 flex-1">
							{onSelect && (
								<input
									type="checkbox"
									checked={isSelected}
									onChange={(e) => onSelect(e.target.checked)}
									className="rounded mt-1"
								/>
							)}
							<div className="flex-1">
								<CardTitle className="text-lg">
									<Link
										to="/portfolios/$portfolioId"
										params={{ portfolioId: portfolio.id }}
										className="hover:underline"
										onClick={() => onAction?.("view", portfolio.id)}
									>
										{portfolio.name}
									</Link>
								</CardTitle>
								{portfolio.description && (
									<p className="text-sm text-muted-foreground mt-1 line-clamp-2">
										{portfolio.description}
									</p>
								)}
							</div>
						</div>

						<PortfolioActions
							onDuplicate={handleDuplicate}
							onDelete={() => setShowDeleteDialog(true)}
							isLoading={isLoading}
						/>
					</div>
				</CardHeader>

				<CardContent className="pt-0">
					<div className="space-y-3">
						{/* Total Value */}
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<DollarSign className="h-4 w-4" />
								<span>Total Value</span>
							</div>
							<span className="font-semibold text-lg">
								{formatCurrency(totalValue)}
							</span>
						</div>

						{/* Gain/Loss */}
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<TrendingUp className="h-4 w-4" />
								<span>Gain/Loss</span>
							</div>
							<div
								className={`flex items-center gap-1 ${gainLossDisplay.color}`}
							>
								<GainLossIcon className="h-3 w-3" />
								<span className="font-semibold text-sm">
									{formatCurrency(totalGainLoss)}
								</span>
							</div>
						</div>

						{/* Performance Badge */}
						{totalGainLossPercent !== 0 && (
							<div className="flex justify-center">
								<Badge
									variant="secondary"
									className={`${gainLossDisplay.bgColor} ${gainLossDisplay.color} border-0`}
								>
									{formatPercentage(totalGainLossPercent)}
								</Badge>
							</div>
						)}

						{/* Asset Count and Created Date */}
						<div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
							<div className="flex items-center gap-1">
								<PieChart className="h-3 w-3" />
								<span>{assetCount} assets</span>
							</div>
							<div className="flex items-center gap-1">
								<Calendar className="h-3 w-3" />
								<span>
									{new Date(portfolio.createdAt).toLocaleDateString()}
								</span>
							</div>
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
	onDuplicate,
	onDelete,
	isLoading,
}: {
	onDuplicate: () => void;
	onDelete: () => void;
	isLoading: boolean;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" disabled={isLoading}>
					<MoreHorizontal className="h-4 w-4" />
					<span className="sr-only">Portfolio actions</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onClick={onDuplicate} disabled={isLoading}>
					<Copy className="mr-2 h-4 w-4" />
					Duplicate
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					onClick={onDelete}
					disabled={isLoading}
					className="text-destructive focus:text-destructive"
				>
					<Trash2 className="mr-2 h-4 w-4" />
					Delete
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
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Are you sure?</AlertDialogTitle>
					<AlertDialogDescription>
						This action cannot be undone. This will permanently delete the "
						{portfolioName}" portfolio and all its associated positions and
						data.
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
