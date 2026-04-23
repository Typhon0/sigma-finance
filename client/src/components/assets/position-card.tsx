import {
	Building2,
	Coins,
	CreditCard,
	Edit,
	Home,
	Minus,
	MoreHorizontal,
	Package,
	Shield,
	Trash2,
	TrendingDown,
	TrendingUp,
	Watch,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PortfolioAsset } from "@/gql/graphql";
import { formatCurrency, formatPercentage } from "@/lib/utils";

interface PositionCardProps {
	position: PortfolioAsset;
	onClick?: (position: PortfolioAsset) => void;
	onEdit?: (position: PortfolioAsset) => void;
	onDelete?: (positionId: string) => void;
	showActions?: boolean;
	viewMode?: "grid" | "list";
	className?: string;
}

const ASSET_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
	STOCK: Building2,
	CRYPTO: Coins,
	BANK_ACCOUNT: CreditCard,
	REAL_ESTATE: Home,
	LIFE_INSURANCE: Shield,
	WATCH: Watch,
	OTHER_VALUABLE: Package,
};

const ASSET_TYPE_COLORS: Record<string, string> = {
	STOCK: "bg-green-100 text-green-800 border-green-200",
	CRYPTO: "bg-amber-100 text-amber-800 border-amber-200",
	BANK_ACCOUNT: "bg-blue-100 text-blue-800 border-blue-200",
	REAL_ESTATE: "bg-purple-100 text-purple-800 border-purple-200",
	LIFE_INSURANCE: "bg-indigo-100 text-indigo-800 border-indigo-200",
	WATCH: "bg-pink-100 text-pink-800 border-pink-200",
	OTHER_VALUABLE: "bg-gray-100 text-gray-800 border-gray-200",
};

export function PositionCard({
	position,
	onClick,
	onEdit,
	onDelete,
	showActions = true,
	viewMode = "grid",
	className,
}: PositionCardProps) {
	const Icon = ASSET_TYPE_ICONS[position.asset.assetType.name] || Package;
	const assetTypeColor =
		ASSET_TYPE_COLORS[position.asset.assetType.name] || ASSET_TYPE_COLORS.OTHER_VALUABLE;

	// Calculate performance metrics
	const currentValue = position.currentValue || 0;
	const purchasePrice = position.averagePurchasePrice || 0;
	const quantity = position.quantity || 0;
	const ownershipPct = position.ownershipPct || 100;

	const totalCost = purchasePrice * quantity;
	const totalValue = currentValue * quantity;
	const gainLoss = totalValue - totalCost;
	const gainLossPercent = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0;

	const getPerformanceIcon = () => {
		if (gainLossPercent > 0) return TrendingUp;
		if (gainLossPercent < 0) return TrendingDown;
		return Minus;
	};

	const getPerformanceColor = () => {
		if (gainLossPercent > 0) return "text-green-600";
		if (gainLossPercent < 0) return "text-red-600";
		return "text-gray-600";
	};

	const PerformanceIcon = getPerformanceIcon();
	const performanceColor = getPerformanceColor();

	const handleCardClick = () => {
		if (onClick) {
			onClick(position);
		}
	};

	const handleEdit = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (onEdit) {
			onEdit(position);
		}
	};

	const handleDelete = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (onDelete) {
			onDelete(position.asset.id);
		}
	};

	if (viewMode === "list") {
		return (
			<Card
				className={`cursor-pointer hover:shadow-md transition-shadow ${className}`}
				onClick={handleCardClick}
			>
				<CardContent className="p-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3 flex-1">
							<Icon className="h-8 w-8 text-muted-foreground" />

							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2 mb-1">
									<h3 className="font-semibold truncate">{position.asset.name}</h3>
									{position.asset.symbol && (
										<Badge variant="outline" className="text-xs">
											{position.asset.symbol}
										</Badge>
									)}
								</div>
								<div className="flex items-center gap-2">
									<Badge className={`text-xs ${assetTypeColor}`}>
										{position.asset.assetType.name.replace("_", " ")}
									</Badge>
									<span className="text-sm text-muted-foreground">
										{quantity} {quantity === 1 ? "unit" : "units"}
									</span>
									{ownershipPct < 100 && (
										<span className="text-sm text-muted-foreground">({ownershipPct}% owned)</span>
									)}
								</div>
							</div>
						</div>

						<div className="flex items-center gap-4">
							<div className="text-right">
								<div className="font-semibold">{formatCurrency(totalValue)}</div>
								<div className={`text-sm flex items-center gap-1 ${performanceColor}`}>
									<PerformanceIcon className="h-3 w-3" />
									{formatCurrency(gainLoss)} ({formatPercentage(gainLossPercent)})
								</div>
							</div>

							{showActions && (
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
											<MoreHorizontal className="h-4 w-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem onClick={handleEdit}>
											<Edit className="mr-2 h-4 w-4" />
											Edit Position
										</DropdownMenuItem>
										<DropdownMenuItem onClick={handleDelete} className="text-red-600">
											<Trash2 className="mr-2 h-4 w-4" />
											Remove Position
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							)}
						</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card
			className={`cursor-pointer hover:shadow-md transition-shadow ${className}`}
			onClick={handleCardClick}
		>
			<CardHeader className="pb-2">
				<div className="flex items-start justify-between">
					<div className="flex items-center gap-2">
						<Icon className="h-5 w-5 text-muted-foreground" />
						<Badge className={`text-xs ${assetTypeColor}`}>
							{position.asset.assetType.name.replace("_", " ")}
						</Badge>
					</div>

					{showActions && (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
									<MoreHorizontal className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={handleEdit}>
									<Edit className="mr-2 h-4 w-4" />
									Edit Position
								</DropdownMenuItem>
								<DropdownMenuItem onClick={handleDelete} className="text-red-600">
									<Trash2 className="mr-2 h-4 w-4" />
									Remove Position
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					)}
				</div>
			</CardHeader>

			<CardContent className="space-y-3">
				<div>
					<h3 className="font-semibold text-lg leading-tight mb-1">{position.asset.name}</h3>
					{position.asset.symbol && (
						<Badge variant="outline" className="text-xs">
							{position.asset.symbol}
						</Badge>
					)}
				</div>

				<div className="space-y-2">
					<div className="flex justify-between items-center">
						<span className="text-sm text-muted-foreground">Quantity</span>
						<span className="text-sm font-medium">
							{quantity} {quantity === 1 ? "unit" : "units"}
						</span>
					</div>

					{ownershipPct < 100 && (
						<div className="flex justify-between items-center">
							<span className="text-sm text-muted-foreground">Ownership</span>
							<span className="text-sm font-medium">{ownershipPct}%</span>
						</div>
					)}

					<div className="flex justify-between items-center">
						<span className="text-sm text-muted-foreground">Current Value</span>
						<span className="text-sm font-semibold">{formatCurrency(totalValue)}</span>
					</div>

					{purchasePrice > 0 && (
						<>
							<div className="flex justify-between items-center">
								<span className="text-sm text-muted-foreground">Cost Basis</span>
								<span className="text-sm">{formatCurrency(totalCost)}</span>
							</div>

							<div className="flex justify-between items-center">
								<span className="text-sm text-muted-foreground">Gain/Loss</span>
								<div className={`text-sm font-medium flex items-center gap-1 ${performanceColor}`}>
									<PerformanceIcon className="h-3 w-3" />
									{formatCurrency(gainLoss)}
								</div>
							</div>

							<div className="flex justify-between items-center">
								<span className="text-sm text-muted-foreground">Return</span>
								<span className={`text-sm font-medium ${performanceColor}`}>
									{formatPercentage(gainLossPercent)}
								</span>
							</div>
						</>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
