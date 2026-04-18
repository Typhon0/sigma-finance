import {
	ArrowLeft,
	Calendar,
	DollarSign,
	Edit,
	Trash2,
	TrendingDown,
	TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Portfolio } from "@/gql/graphql";
import type { Asset } from "@/hooks/use-dashboard-state";
import { formatCurrency, formatPercentage } from "@/lib/utils";
import { CompactStaleIndicator } from "./stale-data-indicator";

interface InlineAssetDetailProps {
	asset: Asset;
	portfolio: Portfolio | null;
	onBack: () => void;
}

interface AssetMetricProps {
	label: string;
	value: string;
	subValue?: string;
	icon?: React.ReactNode;
	trend?: "up" | "down" | "neutral";
}

function AssetMetric({
	label,
	value,
	subValue,
	icon,
	trend,
}: AssetMetricProps) {
	const getTrendColor = () => {
		switch (trend) {
			case "up":
				return "text-green-600";
			case "down":
				return "text-red-600";
			default:
				return "text-muted-foreground";
		}
	};

	const TrendIcon =
		trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : null;

	return (
		<div className="flex items-center justify-between p-4 border rounded-lg">
			<div className="flex items-center gap-3">
				{icon && <div className="text-muted-foreground">{icon}</div>}
				<div>
					<p className="text-sm font-medium text-muted-foreground">{label}</p>
					<p className="text-lg font-semibold">{value}</p>
					{subValue && (
						<p className={`text-sm ${getTrendColor()}`}>
							{TrendIcon && <TrendIcon className="inline h-3 w-3 mr-1" />}
							{subValue}
						</p>
					)}
				</div>
			</div>
		</div>
	);
}

interface TransactionHistoryProps {
	assetId: string;
}

function TransactionHistory({ _assetId }: TransactionHistoryProps) {
	// Mock transaction data - in real app this would come from GraphQL
	const transactions = [
		{
			id: "1",
			type: "BUY",
			quantity: 100,
			price: 150.0,
			date: "2024-01-15",
			total: 15000,
		},
		{
			id: "2",
			type: "BUY",
			quantity: 50,
			price: 145.0,
			date: "2024-02-01",
			total: 7250,
		},
	];

	return (
		<div className="space-y-3">
			{transactions.map((transaction) => (
				<div
					key={transaction.id}
					className="flex items-center justify-between p-3 border rounded-lg"
				>
					<div className="flex items-center gap-3">
						<Badge
							variant={transaction.type === "BUY" ? "default" : "destructive"}
						>
							{transaction.type}
						</Badge>
						<div>
							<p className="font-medium">
								{transaction.quantity.toLocaleString()} shares
							</p>
							<p className="text-sm text-muted-foreground">
								@ {formatCurrency(transaction.price)}
							</p>
						</div>
					</div>
					<div className="text-right">
						<p className="font-medium">{formatCurrency(transaction.total)}</p>
						<p className="text-sm text-muted-foreground">
							{new Date(transaction.date).toLocaleDateString()}
						</p>
					</div>
				</div>
			))}
		</div>
	);
}

export function InlineAssetDetail({
	asset,
	portfolio,
	onBack,
}: InlineAssetDetailProps) {
	// Mock asset data - in real app this would come from GraphQL
	const assetData = {
		currentPrice: 155.5,
		previousPrice: 152.3,
		quantity: 150,
		averageCost: 147.5,
		totalValue: 23325,
		totalCost: 22125,
		gainLoss: 1200,
		gainLossPercent: 5.42,
		marketCap: "2.8T",
		volume: "45.2M",
		lastUpdated: new Date().toISOString(),
	};

	const priceChange = assetData.currentPrice - assetData.previousPrice;
	const priceChangePercent = (priceChange / assetData.previousPrice) * 100;

	return (
		<div className="space-y-6">
			{/* Asset Header with Back Navigation */}
			<div className="flex items-center gap-4">
				<Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
					<ArrowLeft className="h-4 w-4" />
					Back to {portfolio?.name || "Portfolio"}
				</Button>
			</div>

			{/* Asset Title and Info */}
			<div className="flex items-start justify-between">
				<div>
					<div className="flex items-center gap-3 mb-2">
						<h1 className="text-3xl font-bold tracking-tight">{asset.name}</h1>
						{asset.symbol && (
							<Badge variant="outline" className="text-lg px-3 py-1">
								{asset.symbol}
							</Badge>
						)}
					</div>
					<div className="flex items-center gap-4 text-muted-foreground">
						<span className="text-sm">Type: {asset.type}</span>
						{portfolio && (
							<span className="text-sm">Portfolio: {portfolio.name}</span>
						)}
					</div>
				</div>

				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm">
						<Edit className="mr-2 h-4 w-4" />
						Edit Position
					</Button>
					<Button variant="outline" size="sm" className="text-destructive">
						<Trash2 className="mr-2 h-4 w-4" />
						Remove
					</Button>
				</div>
			</div>

			{/* Current Price and Change */}
			<Card>
				<CardContent className="p-6">
					<div className="flex items-center justify-between">
						<div>
							<div className="flex items-center gap-2">
								<p className="text-sm text-muted-foreground">Current Price</p>
								<CompactStaleIndicator lastUpdated={assetData.lastUpdated} />
							</div>
							<p className="text-4xl font-bold">
								{formatCurrency(assetData.currentPrice)}
							</p>
						</div>
						<div className="text-right">
							<div
								className={`flex items-center gap-2 ${priceChange >= 0 ? "text-green-600" : "text-red-600"}`}
							>
								{priceChange >= 0 ? (
									<TrendingUp className="h-5 w-5" />
								) : (
									<TrendingDown className="h-5 w-5" />
								)}
								<div>
									<p className="text-lg font-semibold">
										{priceChange >= 0 ? "+" : ""}
										{formatCurrency(priceChange)}
									</p>
									<p className="text-sm">
										({priceChange >= 0 ? "+" : ""}
										{formatPercentage(priceChangePercent)})
									</p>
								</div>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Position Metrics */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				<AssetMetric
					label="Position Value"
					value={formatCurrency(assetData.totalValue)}
					subValue={`${formatPercentage(assetData.gainLossPercent)} gain`}
					icon={<DollarSign className="h-4 w-4" />}
					trend={assetData.gainLoss >= 0 ? "up" : "down"}
				/>

				<AssetMetric
					label="Quantity Owned"
					value={assetData.quantity.toLocaleString()}
					subValue={`Avg cost: ${formatCurrency(assetData.averageCost)}`}
					icon={<TrendingUp className="h-4 w-4" />}
				/>

				<AssetMetric
					label="Total Gain/Loss"
					value={formatCurrency(assetData.gainLoss)}
					subValue={formatPercentage(assetData.gainLossPercent)}
					icon={<TrendingUp className="h-4 w-4" />}
					trend={assetData.gainLoss >= 0 ? "up" : "down"}
				/>
			</div>

			{/* Market Data (for tradeable assets) */}
			{(asset.type === "STOCK" || asset.type === "CRYPTO") && (
				<Card>
					<CardHeader>
						<CardTitle>Market Data</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid gap-4 md:grid-cols-2">
							<AssetMetric
								label="Market Cap"
								value={assetData.marketCap}
								icon={<DollarSign className="h-4 w-4" />}
							/>
							<AssetMetric
								label="Volume (24h)"
								value={assetData.volume}
								icon={<TrendingUp className="h-4 w-4" />}
							/>
						</div>
						<Separator className="my-4" />
						<div className="flex items-center justify-between">
							<p className="text-sm text-muted-foreground flex items-center gap-2">
								<Calendar className="h-4 w-4" />
								Last updated: {new Date(assetData.lastUpdated).toLocaleString()}
							</p>
							<CompactStaleIndicator lastUpdated={assetData.lastUpdated} />
						</div>
					</CardContent>
				</Card>
			)}

			{/* Price Chart Placeholder */}
			<Card>
				<CardHeader>
					<CardTitle>Price Chart</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="h-64 flex items-center justify-center bg-muted/30 rounded-lg">
						<p className="text-muted-foreground">
							{asset.type === "STOCK" || asset.type === "CRYPTO"
								? "Lightweight Charts™ integration will be implemented in task 14"
								: "Price history not available for this asset type"}
						</p>
					</div>
				</CardContent>
			</Card>

			{/* Transaction History */}
			<Card>
				<CardHeader>
					<div className="flex justify-between items-center">
						<CardTitle>Transaction History</CardTitle>
						<Button size="sm">Add Transaction</Button>
					</div>
				</CardHeader>
				<CardContent>
					<TransactionHistory assetId={asset.id} />
				</CardContent>
			</Card>
		</div>
	);
}
