import { BarChart3, Plus, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Asset, AssetType, PortfolioAsset } from "./index";
import {
	AssetManagementDialog,
	AssetSearch,
	AssetTypeSelector,
	CompactAllocationChart,
	CompactPerformanceChart,
	CompactPriceChart,
	PositionList,
} from "./index";

// Mock data for demonstration
const _mockAssetTypes: AssetType[] = [
	{ id: "1", name: "STOCK" },
	{ id: "2", name: "CRYPTO" },
	{ id: "3", name: "BANK_ACCOUNT" },
	{ id: "4", name: "REAL_ESTATE" },
	{ id: "5", name: "WATCH" },
];

const mockPositions: PortfolioAsset[] = [
	{
		asset: {
			id: "1",
			name: "Apple Inc.",
			symbol: "AAPL",
			assetType: { __typename: "AssetType", id: "1", name: "STOCK" },
			currentValue: 150,
			purchaseDate: null,
			purchasePrice: 120,
			tags: [],
			positions: [],
		},
		quantity: 100,
		averagePurchasePrice: 120,
		currentValue: 150,
		ownershipPct: 100,
	},
	{
		asset: {
			id: "2",
			name: "Bitcoin",
			symbol: "BTC",
			assetType: { __typename: "AssetType", id: "2", name: "CRYPTO" },
			currentValue: 45000,
			purchaseDate: null,
			purchasePrice: 40000,
			tags: [],
			positions: [],
		},
		quantity: 0.5,
		averagePurchasePrice: 40000,
		currentValue: 45000,
		ownershipPct: 100,
	},
];

const mockPerformanceData = [
	{ date: "2024-01-01", value: 100000 },
	{ date: "2024-01-02", value: 102000 },
	{ date: "2024-01-03", value: 98000 },
	{ date: "2024-01-04", value: 105000 },
	{ date: "2024-01-05", value: 107000 },
];

const mockAllocationData = [
	{ assetType: "STOCK", value: 15000, percentage: 60, count: 1 },
	{ assetType: "CRYPTO", value: 22500, percentage: 40, count: 1 },
];

const mockPriceData = [
	{ timestamp: "2024-01-01", open: 148, high: 152, low: 147, close: 150 },
	{ timestamp: "2024-01-02", open: 150, high: 155, low: 149, close: 153 },
	{ timestamp: "2024-01-03", open: 153, high: 157, low: 151, close: 155 },
];

interface AssetManagementExampleProps {
	portfolioId?: string;
	portfolioName?: string;
}

export function AssetManagementExample({
	portfolioId = "demo-portfolio",
	portfolioName = "Demo Portfolio",
}: AssetManagementExampleProps) {
	const [selectedAssetType, setSelectedAssetType] = useState<AssetType | null>(
		null,
	);
	const [selectedAssets, setSelectedAssets] = useState<Asset[]>([]);
	const [showAssetDialog, setShowAssetDialog] = useState(false);
	const [activeTab, setActiveTab] = useState("positions");

	const handleAssetSelect = (asset: Asset) => {
		setSelectedAssets((prev) => [...prev, asset]);
	};

	const handlePositionClick = (position: PortfolioAsset) => {
		console.log("Position clicked:", position);
	};

	const handleEditPosition = (position: PortfolioAsset) => {
		console.log("Edit position:", position);
	};

	const handleDeletePosition = (positionId: string) => {
		console.log("Delete position:", positionId);
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold">Asset Management</h2>
					<p className="text-muted-foreground">
						Manage assets for {portfolioName}
					</p>
				</div>
				<Button onClick={() => setShowAssetDialog(true)}>
					<Plus className="mr-2 h-4 w-4" />
					Add Asset
				</Button>
			</div>

			{/* Main Content */}
			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList className="grid w-full grid-cols-4">
					<TabsTrigger value="positions">Positions</TabsTrigger>
					<TabsTrigger value="search">Asset Search</TabsTrigger>
					<TabsTrigger value="charts">Charts</TabsTrigger>
					<TabsTrigger value="selector">Type Selector</TabsTrigger>
				</TabsList>

				<TabsContent value="positions" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Portfolio Positions</CardTitle>
						</CardHeader>
						<CardContent>
							<PositionList
								positions={mockPositions}
								onPositionClick={handlePositionClick}
								onEditPosition={handleEditPosition}
								onDeletePosition={handleDeletePosition}
								groupBy="type"
								showActions={true}
							/>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="search" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Search className="h-5 w-5" />
								Asset Search & Filtering
							</CardTitle>
						</CardHeader>
						<CardContent>
							<AssetSearch
								onAssetSelect={handleAssetSelect}
								selectedAssets={selectedAssets}
								showFilters={true}
								placeholder="Search for assets to add..."
							/>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="charts" className="space-y-4">
					<div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
						<CompactPerformanceChart
							data={mockPerformanceData}
							title="Portfolio Performance"
							currentValue={107000}
							previousValue={100000}
						/>

						<CompactAllocationChart
							data={mockAllocationData}
							title="Asset Allocation"
							totalValue={37500}
						/>
					</div>

					<div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
						<CompactPriceChart
							data={mockPriceData}
							symbol="AAPL"
							currentPrice={155}
							previousClose={148}
						/>

						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<BarChart3 className="h-5 w-5" />
									Chart Integration
								</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="text-muted-foreground mb-4">
									These compact charts are optimized for inline dashboard
									display:
								</p>
								<ul className="text-sm space-y-2">
									<li>• Performance charts show portfolio value over time</li>
									<li>• Allocation charts display asset type distribution</li>
									<li>
										• Price charts show candlestick data for tradeable assets
									</li>
									<li>• All charts are responsive and mobile-friendly</li>
								</ul>
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				<TabsContent value="selector" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Asset Type Selection</CardTitle>
						</CardHeader>
						<CardContent>
							<AssetTypeSelector
								selectedType={selectedAssetType}
								onTypeSelect={setSelectedAssetType}
							/>

							{selectedAssetType && (
								<div className="mt-4 p-4 bg-muted rounded-lg">
									<p className="text-sm">
										Selected:{" "}
										<strong>{selectedAssetType.name.replace("_", " ")}</strong>
									</p>
									<p className="text-xs text-muted-foreground mt-1">
										This would show the appropriate form for adding this asset
										type.
									</p>
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>

			{/* Asset Management Dialog */}
			<AssetManagementDialog
				open={showAssetDialog}
				onOpenChange={setShowAssetDialog}
				portfolioId={portfolioId}
				portfolioName={portfolioName}
				onSuccess={() => {
					console.log("Asset added successfully");
					// Refresh positions data here
				}}
			/>
		</div>
	);
}
