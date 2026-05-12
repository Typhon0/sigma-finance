import { Minus, MoreVertical, Plus, TrendingDown, TrendingUp } from "lucide-react";
import type React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Asset } from "@/hooks/use-dashboard-state";
import { useResponsiveDashboard } from "@/hooks/use-responsive-dashboard";
import { cn, formatCurrency } from "@/lib/utils";

interface AssetPosition {
	asset: {
		id: string;
		name: string;
		symbol?: string;
		type: string;
	};
	quantity?: number;
	averagePurchasePrice?: number;
	currentValue?: number;
	change?: number;
	changePercent?: number;
}

interface ResponsiveAssetListProps {
	assets: AssetPosition[];
	onAssetClick?: (asset: Asset) => void;
	onEditAsset?: (assetId: string) => void;
	onDeleteAsset?: (assetId: string) => void;
	showInlineActions?: boolean;
	emptyMessage?: string;
	emptyAction?: React.ReactNode;
}

export function ResponsiveAssetList({
	assets,
	onAssetClick,
	onEditAsset,
	onDeleteAsset,
	showInlineActions = true,
	emptyMessage = "No assets in this portfolio yet.",
	emptyAction,
}: ResponsiveAssetListProps) {
	const [responsiveState] = useResponsiveDashboard();

	if (!assets || assets.length === 0) {
		return (
			<div className="text-center py-8">
				<p className="text-muted-foreground mb-4">{emptyMessage}</p>
				{emptyAction || (
					<Button className={cn("touch-manipulation", responsiveState.isMobile && "h-11")}>
						<Plus className="mr-2 h-4 w-4" />
						Add Your First Asset
					</Button>
				)}
			</div>
		);
	}

	const getChangeIcon = (change?: number) => {
		if (!change || change === 0) return <Minus className="h-3 w-3 text-gray-500" />;
		return change > 0 ? (
			<TrendingUp className="h-3 w-3 text-green-500" />
		) : (
			<TrendingDown className="h-3 w-3 text-red-500" />
		);
	};

	const getChangeColor = (change?: number) => {
		if (!change || change === 0) return "text-gray-600";
		return change > 0 ? "text-green-600" : "text-red-600";
	};

	// Mobile card layout
	if (responsiveState.isMobile) {
		return (
			<div className="space-y-3">
				{assets.map((position, index) => {
					const asset = position.asset;
					const quantity = position.quantity || 0;
					const averagePrice = position.averagePurchasePrice || 0;
					const currentValue = position.currentValue || quantity * averagePrice;
					const change = position.change || 0;
					const changePercent = position.changePercent || 0;

					return (
						<Card
							key={asset.id || index}
							className={cn(
								"transition-colors touch-manipulation",
								onAssetClick && "cursor-pointer hover:bg-muted/50 active:bg-muted",
							)}
							onClick={() => {
								if (onAssetClick) {
									// biome-ignore lint/suspicious/noExplicitAny: unavoidable
									onAssetClick(asset as any);
								}
							}}
						>
							<CardContent className="p-4">
								<div className="flex items-start justify-between">
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2 mb-1">
											<h4 className="font-medium truncate">{asset.name}</h4>
											{asset.type && (
												<Badge variant="outline" className="text-xs shrink-0">
													{asset.type}
												</Badge>
											)}
										</div>

										{asset.symbol && (
											<p className="text-sm text-muted-foreground font-mono mb-2">{asset.symbol}</p>
										)}

										<div className="text-sm text-muted-foreground">
											{quantity.toLocaleString()} @ {formatCurrency(averagePrice)}
										</div>
									</div>

									<div className="text-right shrink-0 ml-3">
										<div className="font-medium text-lg mb-1">{formatCurrency(currentValue)}</div>

										{(change !== 0 || changePercent !== 0) && (
											<div
												className={cn("flex items-center gap-1 text-sm", getChangeColor(change))}
											>
												{getChangeIcon(change)}
												<span>
													{changePercent >= 0 ? "+" : ""}
													{changePercent.toFixed(2)}%
												</span>
											</div>
										)}

										{showInlineActions && (onEditAsset || onDeleteAsset) && (
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button
														variant="ghost"
														size="sm"
														className="h-8 w-8 p-0 mt-2 touch-manipulation"
														onClick={(e) => e.stopPropagation()}
													>
														<MoreVertical className="h-4 w-4" />
														<span className="sr-only">Open menu</span>
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													{onEditAsset && (
														<DropdownMenuItem onClick={() => onEditAsset(asset.id)}>
															Edit Asset
														</DropdownMenuItem>
													)}
													{onDeleteAsset && (
														<DropdownMenuItem
															onClick={() => onDeleteAsset(asset.id)}
															className="text-destructive"
														>
															Remove Asset
														</DropdownMenuItem>
													)}
												</DropdownMenuContent>
											</DropdownMenu>
										)}
									</div>
								</div>
							</CardContent>
						</Card>
					);
				})}
			</div>
		);
	}

	// Desktop/tablet list layout
	return (
		<div className="space-y-3">
			{assets.map((position, index) => {
				const asset = position.asset;
				const quantity = position.quantity || 0;
				const averagePrice = position.averagePurchasePrice || 0;
				const currentValue = position.currentValue || quantity * averagePrice;
				const change = position.change || 0;
				const changePercent = position.changePercent || 0;

				return (
					// biome-ignore lint/a11y/noStaticElementInteractions: unavoidable
					// biome-ignore lint/a11y/useKeyWithClickEvents: unavoidable
					<div
						key={asset.id || index}
						className={cn(
							"flex items-center justify-between p-4 border rounded-lg transition-colors",
							onAssetClick && "hover:bg-muted/50 cursor-pointer",
						)}
						onClick={() => {
							if (onAssetClick) {
								// biome-ignore lint/suspicious/noExplicitAny: unavoidable
								onAssetClick(asset as any);
							}
						}}
					>
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-3">
								<div className="min-w-0 flex-1">
									<h4 className="font-medium truncate">{asset.name}</h4>
									<div className="flex items-center gap-2 text-sm text-muted-foreground">
										{asset.symbol && <span className="font-mono">{asset.symbol}</span>}
										{asset.type && (
											<Badge variant="outline" className="text-xs">
												{asset.type}
											</Badge>
										)}
									</div>
								</div>
							</div>
						</div>

						<div className="flex items-center gap-4">
							<div className="text-right">
								<div className="font-medium">{formatCurrency(currentValue)}</div>
								<div className="text-sm text-muted-foreground">
									{quantity.toLocaleString()} @ {formatCurrency(averagePrice)}
								</div>
							</div>

							{(change !== 0 || changePercent !== 0) && (
								<div
									className={cn(
										"flex items-center gap-1 text-sm min-w-[80px] justify-end",
										getChangeColor(change),
									)}
								>
									{getChangeIcon(change)}
									<span>
										{changePercent >= 0 ? "+" : ""}
										{changePercent.toFixed(2)}%
									</span>
								</div>
							)}

							{showInlineActions && (onEditAsset || onDeleteAsset) && (
								<div className="flex items-center gap-2">
									{onEditAsset && (
										<Button
											variant="ghost"
											size="sm"
											onClick={(e) => {
												e.stopPropagation();
												onEditAsset(asset.id);
											}}
										>
											Edit
										</Button>
									)}
									{onDeleteAsset && (
										<Button
											variant="ghost"
											size="sm"
											className="text-destructive hover:text-destructive"
											onClick={(e) => {
												e.stopPropagation();
												onDeleteAsset(asset.id);
											}}
										>
											Remove
										</Button>
									)}
								</div>
							)}
						</div>
					</div>
				);
			})}
		</div>
	);
}
