import ReactECharts from "echarts-for-react";
import {
	Activity,
	ArrowUpDown,
	Package,
	Plus,
	TrendingUp,
	Upload,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { usePortfolio } from "@/components/PortfolioProvider";
import { useCurrency } from "@/hooks/use-currency";
import { AddStockForm } from "./AddStockForm";
import { PieChartWithCenter } from "./PieChartWithCenter";
import { StocksFundsPositions } from "./StocksFundsPositions";
import { StocksFundsTransactions } from "./StocksFundsTransactions";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Tabs, TabsContent } from "./ui/tabs";

interface StocksFundsModuleProps {
	onBack?: () => void;
	onNavigateToTransactions?: () => void;
	onSelectAccount?: (accountName: string) => void;
	onSelectAsset?: (symbol: string) => void;
}

export function StocksFundsModule({
	onNavigateToTransactions,
	onSelectAccount,
	onSelectAsset,
}: StocksFundsModuleProps) {
	const [activeTab, setActiveTab] = useState("positions");
	const { assets, addAsset, selectedPortfolio, addingAsset } = usePortfolio();

	const [isAddOpen, setIsAddOpen] = useState(false);

	// Get stocks and funds from portfolio
	const stocksAndFunds = assets.filter(
		(asset) => asset.type === "stock" || asset.type === "fund",
	);

	// Calculate total value
	const totalValue = stocksAndFunds.reduce(
		(sum, asset) => sum + (asset.currentValue || 0),
		0,
	);
	const totalCost = stocksAndFunds.reduce(
		(sum, asset) => sum + (asset.purchasePrice || 0) * (asset.quantity || 1),
		0,
	);
	const totalGain = totalValue - totalCost;
	const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

	// Calculate daily change from portfolio analytics if available
	const performanceHistory =
		selectedPortfolio?.analytics?.performanceHistory ?? [];
	const previousValue =
		performanceHistory.length > 1
			? performanceHistory[performanceHistory.length - 2]?.value
			: totalValue * 0.99;
	const dailyChange = totalValue - previousValue;
	const dailyChangePercent =
		previousValue > 0 ? (dailyChange / previousValue) * 100 : 0;

	const { formatCurrencyCompact: formatCurrency } = useCurrency();

	const handleAddPosition = async (formData: {
		instrumentID?: string;
		name: string;
		symbol: string;
		type: "stock" | "fund" | "etf";
		quantity: number;
		purchasePrice: number;
		currentPrice?: number;
		purchaseDate?: string;
		account?: string;
		sector?: string;
		quoteCurrency?: string;
		unitPriceCurrency?: string;
	}) => {
		try {
			await addAsset({
				name: formData.name || formData.symbol,
				instrumentID: formData.instrumentID,
				type: formData.type === "etf" ? "stock" : formData.type,
				symbol: formData.symbol.toUpperCase(),
				quantity: formData.quantity,
				purchasePrice: formData.purchasePrice,
				purchaseDate: formData.purchaseDate,
				sector: formData.sector,
				quoteCurrency: formData.quoteCurrency,
				unitPriceCurrency: formData.unitPriceCurrency,
				currentPrice: formData.currentPrice,
			});
			setIsAddOpen(false);
			toast.success(`Added ${formData.symbol} to portfolio`);
		} catch (error) {
			toast.error("Failed to add position. Please try again.");
			console.error("Error adding asset:", error);
		}
	};

	// Use real performance history from selectedPortfolio
	const historicalData =
		performanceHistory.length > 0
			? performanceHistory.map((p: any) => ({
					date: new Date(p.date).toLocaleDateString("en-US", {
						month: "short",
						year: "2-digit",
					}),
					value: p.value,
				}))
			: [{ date: "Now", value: totalValue }];

	// Compute top and worst performers from actual asset data
	const performers = stocksAndFunds
		.map((asset) => {
			const currentVal = asset.currentValue || 0;
			const purchaseVal = (asset.purchasePrice || 0) * (asset.quantity || 1);
			const gainPercent =
				purchaseVal > 0 ? ((currentVal - purchaseVal) / purchaseVal) * 100 : 0;
			return {
				symbol: asset.symbol || asset.name.substring(0, 4),
				gainPercent,
			};
		})
		.sort((a, b) => b.gainPercent - a.gainPercent);
	const topPerformers = performers.slice(0, 3);
	const worstPerformer =
		performers.length > 0 ? performers[performers.length - 1] : null;

	// Prepare data for distribution chart
	const distributionData: { [key: string]: number } = {};
	stocksAndFunds.forEach((asset) => {
		const sector = (asset as any).sector || "Other";
		distributionData[sector] =
			(distributionData[sector] || 0) + (asset.currentValue || 0);
	});

	const pieChartData = Object.entries(distributionData).map(
		([name, value]) => ({
			name,
			value,
		}),
	);

	// Line chart configuration
	const lineChartOption = {
		tooltip: {
			trigger: "axis",
			backgroundColor: "rgba(0,0,0,0.8)",
			borderColor: "#333",
			textStyle: { color: "#fff", fontFamily: "monospace", fontSize: 12 },
			formatter: (params: any) => {
				const data = params[0];
				return `<div class="font-mono text-xs">
          <div class="text-muted-foreground mb-1">${data.name}</div>
          <div class="font-bold text-emerald-500">${formatCurrency(data.value)}</div>
        </div>`;
			},
		},
		grid: {
			left: "0%",
			right: "0%",
			bottom: "0%",
			top: "10%",
			containLabel: false,
		},
		xAxis: {
			type: "category",
			data: historicalData.map((d) => d.date),
			boundaryGap: false,
			show: false,
		},
		yAxis: {
			type: "value",
			show: false,
			min: (value: number) => value * 0.95,
		},
		series: [
			{
				name: "Portfolio Value",
				type: "line",
				smooth: true,
				showSymbol: false,
				data: historicalData.map((d) => d.value),
				areaStyle: {
					color: {
						type: "linear",
						x: 0,
						y: 0,
						x2: 0,
						y2: 1,
						colorStops: [
							{ offset: 0, color: "rgba(16, 185, 129, 0.2)" },
							{ offset: 1, color: "rgba(16, 185, 129, 0.0)" },
						],
					},
				},
				lineStyle: {
					color: "#10b981",
					width: 2,
				},
			},
		],
	};

	return (
		<div className="flex flex-col h-full space-y-4 animate-in fade-in duration-500">
			{/* 1. Module Header & Controls */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
				<div className="flex items-center gap-3">
					<div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
						<Activity className="h-5 w-5 text-emerald-500" />
					</div>
					<div>
						<h1 className="text-xl font-bold tracking-tight">Stocks & Funds</h1>
						<div className="flex items-center gap-2 text-xs text-muted-foreground">
							<span className="flex items-center gap-1">
								<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
								Market Open
							</span>
							<span>•</span>
							<span>Last updated: Just now</span>
						</div>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<div className="hidden md:flex bg-secondary/50 rounded-lg p-1 border">
						<Button
							variant={activeTab === "positions" ? "secondary" : "ghost"}
							size="sm"
							onClick={() => setActiveTab("positions")}
							className="h-7 text-xs"
						>
							<Package className="h-3.5 w-3.5 mr-2" />
							Positions
						</Button>
						<Button
							variant={activeTab === "transactions" ? "secondary" : "ghost"}
							size="sm"
							onClick={() => setActiveTab("transactions")}
							className="h-7 text-xs"
						>
							<ArrowUpDown className="h-3.5 w-3.5 mr-2" />
							Ledger
						</Button>
					</div>

					<div className="h-6 w-px bg-border mx-2 hidden md:block" />

					<Button variant="outline" size="sm" className="h-9">
						<Upload className="h-3.5 w-3.5 mr-2" />
						Import
					</Button>

					<Button
						size="sm"
						className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white border-0"
						onClick={() => setIsAddOpen(true)}
						disabled={addingAsset}
					>
						<Plus className="h-3.5 w-3.5 mr-2" />
						{addingAsset ? "Adding..." : "Add Position"}
					</Button>

					<AddStockForm
						open={isAddOpen}
						onClose={() => setIsAddOpen(false)}
						onSubmit={handleAddPosition}
					/>
				</div>
			</div>

			{/* 2. High-Density Stats Grid */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				{/* Total Value & Mini Chart */}
				<Card className="col-span-1 md:col-span-2 overflow-hidden relative">
					<CardContent className="p-5 relative z-10">
						<div className="flex justify-between items-start">
							<div>
								<p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
									Total Equity
								</p>
								<h2 className="text-3xl font-bold font-mono tracking-tighter">
									{formatCurrency(totalValue)}
								</h2>
							</div>
							<div className="text-right">
								<div className="flex items-center justify-end gap-1 text-emerald-500 font-mono font-medium">
									<TrendingUp className="h-4 w-4" />
									{formatCurrency(totalGain)}
								</div>
								<p className="text-xs text-emerald-500/80 font-mono">
									+{totalGainPercent.toFixed(2)}% All Time
								</p>
							</div>
						</div>
						<div className="mt-6 flex gap-6">
							<div>
								<p className="text-[10px] text-muted-foreground uppercase mb-0.5">
									Day Change
								</p>
								<p className="text-sm font-mono font-medium text-emerald-500">
									+{formatCurrency(dailyChange)}{" "}
									<span className="text-xs opacity-70">
										({dailyChangePercent}%)
									</span>
								</p>
							</div>
							<div>
								<p className="text-[10px] text-muted-foreground uppercase mb-0.5">
									Cost Basis
								</p>
								<p className="text-sm font-mono font-medium text-foreground">
									{formatCurrency(totalCost)}
								</p>
							</div>
							<div>
								<p className="text-[10px] text-muted-foreground uppercase mb-0.5">
									Cash Drag
								</p>
								<p className="text-sm font-mono font-medium text-foreground">
									N/A
								</p>
							</div>
						</div>
					</CardContent>
					{/* Background Chart */}
					<div className="absolute inset-0 pointer-events-none opacity-20 mt-10">
						<ReactECharts
							option={lineChartOption}
							style={{ height: "100%", width: "100%" }}
							opts={{ renderer: "svg" }}
						/>
					</div>
				</Card>

				{/* Allocation */}
				<Card className="col-span-1">
					<CardHeader className="p-4 pb-2">
						<CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
							Sector Allocation
						</CardTitle>
					</CardHeader>
					<CardContent className="p-4 pt-0 h-[120px]">
						<PieChartWithCenter
							data={pieChartData}
							centerLabel=""
							formatValue={() => ""}
							height="120px"
						/>
					</CardContent>
				</Card>

				{/* Performance Metrics */}
				<Card className="col-span-1">
					<CardHeader className="p-4 pb-2">
						<CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
							Top Performers
						</CardTitle>
					</CardHeader>
					<CardContent className="p-4 pt-2 space-y-3">
						{topPerformers.length > 0 ? (
							topPerformers.map((item, i) => (
								<div
									key={i}
									className="flex items-center justify-between text-sm"
								>
									<div className="flex items-center gap-2">
										<span className="font-bold text-xs bg-secondary px-1.5 py-0.5 rounded">
											{item.symbol}
										</span>
									</div>
									<span
										className={`font-mono ${item.gainPercent >= 0 ? "text-emerald-500" : "text-red-500"}`}
									>
										{item.gainPercent >= 0 ? "+" : ""}
										{item.gainPercent.toFixed(2)}%
									</span>
								</div>
							))
						) : (
							<div className="text-xs text-muted-foreground">
								No stock data available
							</div>
						)}
						{worstPerformer && performers.length > 1 && (
							<div className="pt-1 border-t flex items-center justify-between text-xs text-muted-foreground">
								<span>Worst: {worstPerformer.symbol}</span>
								<span
									className={`font-mono ${worstPerformer.gainPercent >= 0 ? "text-emerald-500" : "text-red-500"}`}
								>
									{worstPerformer.gainPercent >= 0 ? "+" : ""}
									{worstPerformer.gainPercent.toFixed(2)}%
								</span>
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			{/* 3. Main Content Area */}
			<div className="flex-1 min-h-[500px]">
				<Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
					<TabsContent
						value="positions"
						className="h-full mt-0 focus-visible:outline-none"
					>
						<StocksFundsPositions
							onSelectAccount={onSelectAccount}
							onSelectAsset={onSelectAsset}
						/>
					</TabsContent>
					<TabsContent
						value="transactions"
						className="h-full mt-0 focus-visible:outline-none"
					>
						<StocksFundsTransactions
							onNavigateToFullView={onNavigateToTransactions}
						/>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
