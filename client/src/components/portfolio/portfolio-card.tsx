import {
	Copy,
	Download,
	Edit,
	GripVertical,
	MoreHorizontal,
	Trash,
} from "lucide-react";
import type React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import type { Portfolio as CodegenPortfolio } from "@/gql/graphql";
import { cn } from "@/lib/utils";

// This type was previously in use-portfolio-management but is more specific to component-level data shaping.
// It represents a single asset within a portfolio's context.
export type PortfolioPosition = {
	__typename?: "Position";
	id: string;
	quantity: number;
	ownershipPct: number;
	averagePurchasePrice: number;
	asset: {
		__typename?: "Asset";
		id: string;
		name: string;
		symbol?: string | null;
		currentValue: number;
	};
};

export type Portfolio = CodegenPortfolio & {
	// Add any client-side specific properties here
};

export interface PortfolioCardProps {
	portfolio: Portfolio;
	viewMode: ViewMode;
	isSelected: boolean;
	onSelect: (selected: boolean) => void;
	onAction: (action: PortfolioAction, portfolioId: string) => void;
	isDragging?: boolean;
	dragHandleProps?: Record<string, unknown>;
	className?: string;
	accessibilityProps?: React.HTMLProps<HTMLDivElement>;
	assets?: import("@/hooks/use-asset-management").Asset[];
}

export type PortfolioAction =
	| "edit"
	| "delete"
	| "duplicate"
	| "export"
	| "view";
export type ViewMode = "grid" | "list";

interface PortfolioAnalytics {
	totalValue: number;
	totalCost: number;
	totalGainLoss: number;
	totalGainLossPercent: number;
	assetCount: number;
}

export function PortfolioCard({
	portfolio,
	viewMode,
	isSelected,
	onSelect,
	onAction,
	isDragging = false,
	dragHandleProps,
	className,
	accessibilityProps = {},
}: PortfolioCardProps) {
	// Calculate analytics from portfolio assets if not provided
	const analytics =
		portfolio.analytics ||
		calculatePortfolioAnalytics(
			portfolio.assets as unknown as PortfolioPosition[],
		);

	// Find assets belonging to this portfolio
	const portfolioAssets =
		(portfolio.assets as unknown as PortfolioPosition[]) || [];

	const handleCardClick = (e: React.MouseEvent | React.KeyboardEvent) => {
		// Don't trigger card click if clicking on interactive elements
		const target = e.target as HTMLElement;
		if (
			target.closest('[data-slot="dropdown-menu-trigger"]') ||
			target.closest('[data-slot="checkbox"]') ||
			target.closest("[data-drag-handle]")
		) {
			return;
		}
		onSelect(!isSelected);
	};

	// Dummy handlers for missing functions (fix errors)
	const handleCheckboxChange = (checked: boolean) => {
		onSelect(checked);
	};
	const handleActionClick = (action: PortfolioAction) => {
		onAction(action, portfolio.id);
	};

	return (
		<li
			className={cn(
				"w-full list-none",
				isDragging && "opacity-50 rotate-2 shadow-lg",
				className,
			)}
		>
			<Card
				className={cn(
					"cursor-pointer transition-all hover:shadow-md w-full",
					isSelected && "ring-2 ring-primary",
					viewMode === "list" && "flex-row",
				)}
				onClick={handleCardClick}
				tabIndex={accessibilityProps?.tabIndex ?? 0}
				aria-label={accessibilityProps?.["aria-label"]}
				aria-posinset={accessibilityProps?.["aria-posinset"]}
				aria-setsize={accessibilityProps?.["aria-setsize"]}
				aria-selected={accessibilityProps?.["aria-selected"]}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						handleCardClick(e);
					}
				}}
				data-assets={portfolio.assets ? "true" : "false"}
			>
				<CardHeader
					className={cn(
						"flex flex-row items-center justify-between space-y-0 pb-2",
						viewMode === "list" && "flex-1",
					)}
				>
					<div className="flex items-center space-x-2 flex-1 min-w-0">
						<Checkbox
							checked={isSelected}
							onCheckedChange={handleCheckboxChange}
							onClick={(e) => e.stopPropagation()}
						/>

						<div
							{...dragHandleProps}
							data-drag-handle
							className="cursor-grab active:cursor-grabbing"
						>
							<GripVertical className="h-4 w-4 text-muted-foreground" />
						</div>

						<div className="flex-1 min-w-0">
							<CardTitle className="text-sm font-medium truncate">
								{portfolio.name}
							</CardTitle>
							{portfolio.description && viewMode === "grid" && (
								<CardDescription className="mt-1 line-clamp-2">
									{portfolio.description}
								</CardDescription>
							)}
						</div>
					</div>

					<DropdownMenu>
						<DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
							<Button variant="ghost" size="sm">
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={() => handleActionClick("edit")}>
								<Edit className="mr-2 h-4 w-4" />
								Edit
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => handleActionClick("duplicate")}>
								<Copy className="mr-2 h-4 w-4" />
								Duplicate
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => handleActionClick("export")}>
								<Download className="mr-2 h-4 w-4" />
								Export
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => handleActionClick("delete")}
								variant="destructive"
							>
								<Trash className="mr-2 h-4 w-4" />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</CardHeader>

				<CardContent
					className={cn(
						"pt-0",
						viewMode === "list" && "flex items-center space-x-6",
					)}
				>
					{viewMode === "list" && portfolio.description && (
						<div className="flex-1 min-w-0">
							<p className="text-sm text-muted-foreground truncate">
								{portfolio.description}
							</p>
						</div>
					)}

					<div
						className={cn(
							"space-y-2",
							viewMode === "list" && "flex items-center space-x-6 space-y-0",
						)}
					>
						<div
							className={cn(
								"flex justify-between items-center",
								viewMode === "list" && "flex-col items-end space-y-1",
							)}
						>
							<span className="text-sm text-muted-foreground">Total Value</span>
							<span className="font-semibold">
								{formatCurrency(analytics.totalValue)}
							</span>
						</div>

						<div
							className={cn(
								"flex justify-between items-center",
								viewMode === "list" && "flex-col items-end space-y-1",
							)}
						>
							<span className="text-sm text-muted-foreground">Performance</span>
							<div className="text-right">
								<Badge
									variant={getPerformanceVariant(
										analytics.totalGainLossPercent,
									)}
								>
									{formatPercentage(analytics.totalGainLossPercent)}
								</Badge>
								{viewMode === "grid" && (
									<div
										className={cn(
											"text-sm mt-1",
											getPerformanceColor(analytics.totalGainLoss),
										)}
									>
										{formatCurrency(analytics.totalGainLoss)}
									</div>
								)}
							</div>
						</div>

						{viewMode === "grid" && <Separator />}

						<div
							className={cn(
								"flex justify-between items-center",
								viewMode === "list" && "flex-col items-end space-y-1",
							)}
						>
							<span className="text-sm text-muted-foreground">Assets</span>
							<Badge variant="secondary">{portfolioAssets.length}</Badge>
						</div>
						{portfolioAssets.length > 0 && (
							<div className="mt-2 text-xs text-muted-foreground">
								{portfolioAssets.slice(0, 3).map((a) => (
									<span key={a.asset.id} className="mr-2">
										{a.asset.name}
									</span>
								))}
								{portfolioAssets.length > 3 && (
									<span>+{portfolioAssets.length - 3} more</span>
								)}
							</div>
						)}

						{viewMode === "grid" && (
							<div className="flex justify-between items-center text-xs text-muted-foreground">
								<span>Created</span>
								<span>{formatDate(portfolio.createdAt)}</span>
							</div>
						)}
					</div>
				</CardContent>
			</Card>
		</li>
	);
}

// Utility functions
function calculatePortfolioAnalytics(
	assets: PortfolioPosition[],
): PortfolioAnalytics {
	if (!assets || assets.length === 0) {
		return {
			totalValue: 0,
			totalCost: 0,
			totalGainLoss: 0,
			totalGainLossPercent: 0,
			assetCount: 0,
		};
	}

	let totalValue = 0;
	let totalCost = 0;

	assets.forEach((asset) => {
		const currentValue =
			asset.asset.currentValue * asset.quantity * (asset.ownershipPct / 100);
		const cost =
			asset.averagePurchasePrice * asset.quantity * (asset.ownershipPct / 100);

		totalValue += currentValue;
		totalCost += cost;
	});

	const totalGainLoss = totalValue - totalCost;
	const totalGainLossPercent =
		totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

	return {
		totalValue,
		totalCost,
		totalGainLoss,
		totalGainLossPercent,
		assetCount: assets.length,
	};
}

function formatCurrency(amount: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(amount);
}

function formatPercentage(percent: number): string {
	return `${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%`;
}

function formatDate(dateString: string): string {
	return new Date(dateString).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function getPerformanceColor(value: number): string {
	if (value > 0) return "text-green-600";
	if (value < 0) return "text-red-600";
	return "text-muted-foreground";
}

function getPerformanceVariant(
	percent: number,
): "default" | "secondary" | "destructive" {
	if (percent > 0) return "default"; // Green for positive
	if (percent < 0) return "destructive"; // Red for negative
	return "secondary"; // Gray for neutral
}
