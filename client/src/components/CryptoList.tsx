import ReactECharts from "echarts-for-react";
import {
	Building2,
	Coins,
	Download,
	Edit,
	Eye,
	HardDrive,
	LayoutGrid,
	MoreVertical,
	PieChart,
	Plus,
	Trash2,
	TrendingDown,
	TrendingUp,
	Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { usePortfolio } from "@/components/PortfolioProvider";
import { SearchInput } from "@/components/ui/search-input";
import { useCurrency } from "@/hooks/use-currency";
import { AddCryptoForm } from "./AddCryptoForm";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

/** Crypto holding derived from portfolio asset data */
interface CryptoHolding {
	id: string;
	cryptoId: string;
	cryptoName: string;
	symbol: string;
	quantity: number;
	averageBuyPrice: number;
	currentPrice: number;
	value: number;
	cost: number;
	profitLoss: number;
	profitLossPercent: number;
	change24h: number;
	change7d: number;
	exchange: string;
	accountType: "CEX" | "Wallet";
	icon: string;
	color: string;
}

/** Well-known crypto brand colours */
const CRYPTO_COLORS: Record<string, string> = {
	BTC: "#F7931A",
	ETH: "#627EEA",
	BNB: "#F3BA2F",
	SOL: "#9945FF",
	XRP: "#23292F",
	ADA: "#0033AD",
	DOGE: "#C2A633",
	DOT: "#E6007A",
	MATIC: "#8247E5",
	LINK: "#2A5ADA",
	AVAX: "#E84142",
	UNI: "#FF007A",
	ATOM: "#2E3148",
	LTC: "#345D9D",
	NEAR: "#000000",
	AAVE: "#B6509E",
	FIL: "#0090FF",
	APT: "#2DD8A3",
	ARB: "#28A0F0",
	OP: "#FF0420",
	MKR: "#1AAB9B",
	USDT: "#26A17B",
	USDC: "#2775CA",
	TRX: "#FF0013",
	ETC: "#328332",
	XLM: "#000000",
	ALGO: "#000000",
	VET: "#15BDFF",
	SAND: "#04AD8E",
	MANA: "#FF5F2E",
	AXS: "#0055D5",
	FTM: "#1969FF",
	IMX: "#00C3CD",
};

interface CryptoListProps {
	onSelectCrypto: (cryptoId: string) => void;
	onSelectAccount?: (accountId: string) => void;
}

type GroupByMode = "account" | "asset";

export function CryptoList({ onSelectCrypto, onSelectAccount }: CryptoListProps) {
	const { assets, loading, addCrypto, currentPortfolio } = usePortfolio();
	const [showAddForm, setShowAddForm] = useState(false);
	const [_viewMode, _setViewMode] = useState<"list" | "grid">("list");
	const [groupBy, setGroupBy] = useState<GroupByMode>("account");
	const [searchQuery, setSearchQuery] = useState("");
	const [sortBy, setSortBy] = useState("value-desc");
	const [filterExchange, setFilterExchange] = useState("all");
	const [distributionChartType, setDistributionChartType] = useState<"pie" | "treemap">("pie");
	const [timePeriod, setTimePeriod] = useState("1Y");

	// Derive crypto holdings from real portfolio data
	const cryptoHoldings = useMemo((): CryptoHolding[] => {
		return assets
			.filter((a) => a.type === "crypto")
			.map((a) => {
				const cost = a.purchasePrice * a.quantity;
				const profitLoss = a.currentValue - cost;
				const profitLossPercent = cost > 0 ? (profitLoss / cost) * 100 : 0;
				return {
					id: a.id,
					cryptoId: a.symbol?.toLowerCase() || a.id,
					cryptoName: a.name,
					symbol: a.symbol || "?",
					quantity: a.quantity,
					averageBuyPrice: a.purchasePrice,
					currentPrice: a.currentPrice,
					value: a.currentValue,
					cost,
					profitLoss,
					profitLossPercent,
					change24h: a.dayChangePercent ?? 0,
					change7d: 0, // TODO: needs backend support for 7d change
					exchange: a.institution || a.exchange || "Unknown",
					accountType: "CEX" as const,
					icon: (a.symbol || "?").charAt(0).toUpperCase(),
					color: CRYPTO_COLORS[a.symbol?.toUpperCase()] || "#627EEA",
				};
			});
	}, [assets]);

	const { formatCurrencyCompact: formatCurrency, currencySymbol } = useCurrency();

	const formatNumber = (num: number, decimals: number = 2) => {
		return num.toLocaleString("en-US", {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals,
		});
	};

	// Calculate metrics
	const totalValue = cryptoHoldings.reduce((sum, h) => sum + h.value, 0);
	const totalCost = cryptoHoldings.reduce((sum, h) => sum + h.cost, 0);
	const totalProfitLoss = totalValue - totalCost;
	const totalProfitLossPercent = totalCost > 0 ? (totalProfitLoss / totalCost) * 100 : 0;
	const numberOfHoldings = cryptoHoldings.length;

	// Best/Worst performers (may be undefined when no holdings)
	const bestPerformer =
		cryptoHoldings.length > 0
			? [...cryptoHoldings].sort((a, b) => b.profitLossPercent - a.profitLossPercent)[0]
			: null;
	const worstPerformer =
		cryptoHoldings.length > 0
			? [...cryptoHoldings].sort((a, b) => a.profitLossPercent - b.profitLossPercent)[0]
			: null;

	// Filter and sort
	const filteredHoldings = cryptoHoldings.filter((h) => {
		if (filterExchange !== "all" && h.exchange !== filterExchange) return false;
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			return (
				h.cryptoName.toLowerCase().includes(query) ||
				h.symbol.toLowerCase().includes(query) ||
				h.exchange.toLowerCase().includes(query)
			);
		}
		return true;
	});

	// Sort
	if (sortBy === "value-desc") filteredHoldings.sort((a, b) => b.value - a.value);
	else if (sortBy === "value-asc") filteredHoldings.sort((a, b) => a.value - b.value);
	else if (sortBy === "profit-desc") filteredHoldings.sort((a, b) => b.profitLoss - a.profitLoss);
	else if (sortBy === "profit-asc") filteredHoldings.sort((a, b) => a.profitLoss - b.profitLoss);
	else if (sortBy === "name-asc")
		filteredHoldings.sort((a, b) => a.cryptoName.localeCompare(b.cryptoName));

	// Get unique exchanges
	const uniqueExchanges = [...new Set(cryptoHoldings.map((h) => h.exchange))];

	// Group by account
	const groupByAccount = () => {
		const grouped: { [key: string]: typeof cryptoHoldings } = {};
		filteredHoldings.forEach((holding) => {
			if (!grouped[holding.exchange]) {
				grouped[holding.exchange] = [];
			}
			grouped[holding.exchange].push(holding);
		});
		return grouped;
	};

	// Group by asset (crypto)
	const _groupByAsset = () => {
		const grouped: { [key: string]: typeof cryptoHoldings } = {};
		filteredHoldings.forEach((holding) => {
			if (!grouped[holding.symbol]) {
				grouped[holding.symbol] = [];
			}
			grouped[holding.symbol].push(holding);
		});
		return grouped;
	};

	// Aggregate by asset
	const aggregateByAsset = () => {
		const aggregated: { [key: string]: any } = {};

		filteredHoldings.forEach((holding) => {
			if (!aggregated[holding.symbol]) {
				aggregated[holding.symbol] = {
					cryptoId: holding.cryptoId,
					cryptoName: holding.cryptoName,
					symbol: holding.symbol,
					quantity: 0,
					value: 0,
					cost: 0,
					profitLoss: 0,
					currentPrice: holding.currentPrice,
					change24h: holding.change24h,
					change7d: holding.change7d,
					icon: holding.icon,
					color: holding.color,
					accounts: [] as string[],
				};
			}

			aggregated[holding.symbol].quantity += holding.quantity;
			aggregated[holding.symbol].value += holding.value;
			aggregated[holding.symbol].cost += holding.cost;
			aggregated[holding.symbol].profitLoss += holding.profitLoss;
			aggregated[holding.symbol].accounts.push(holding.exchange);
		});

		// Calculate average profit loss percent
		Object.values(aggregated).forEach((asset: any) => {
			asset.profitLossPercent = (asset.profitLoss / asset.cost) * 100;
		});

		return Object.values(aggregated).sort((a: any, b: any) => b.value - a.value);
	};

	// TODO: Replace with real historical price data from market data service
	// Generate portfolio value history (placeholder based on current values)
	const portfolioHistory = useMemo(() => {
		if (cryptoHoldings.length === 0) return [];
		const data: { date: string; value: number }[] = [];
		let days = 365;

		switch (timePeriod) {
			case "1M":
				days = 30;
				break;
			case "3M":
				days = 90;
				break;
			case "6M":
				days = 180;
				break;
			case "1Y":
				days = 365;
				break;
			case "ALL":
				days = 730;
				break;
		}

		let value = totalCost;
		for (let i = days; i >= 0; i--) {
			const date = new Date();
			date.setDate(date.getDate() - i);
			value += (Math.random() - 0.48) * (totalValue / 100);
			data.push({
				date: date.toISOString().split("T")[0],
				value: Math.max(value, totalCost * 0.5),
			});
		}

		return data;
	}, [cryptoHoldings.length, timePeriod, totalCost, totalValue]);

	// Distribution data
	const distributionData = filteredHoldings.map((h) => ({
		name: h.symbol,
		value: h.value,
		itemStyle: { color: h.color },
	}));

	// Charts
	const performanceChartOption = {
		tooltip: {
			trigger: "axis",
			axisPointer: { type: "cross" },
		},
		grid: { left: 60, right: 40, top: 40, bottom: 40 },
		xAxis: {
			type: "category",
			data: portfolioHistory.map((d) => d.date),
			boundaryGap: false,
		},
		yAxis: {
			type: "value",
			axisLabel: {
				formatter: (value: number) => `${currencySymbol}${(value / 1000).toFixed(0)}k`,
			},
		},
		series: [
			{
				name: "Portfolio Value",
				type: "line",
				data: portfolioHistory.map((d) => d.value),
				smooth: true,
				lineStyle: { width: 2, color: "#26a69a" },
				areaStyle: {
					color: {
						type: "linear",
						x: 0,
						y: 0,
						x2: 0,
						y2: 1,
						colorStops: [
							{ offset: 0, color: "rgba(38, 166, 154, 0.3)" },
							{ offset: 1, color: "rgba(38, 166, 154, 0.05)" },
						],
					},
				},
				showSymbol: false,
			},
		],
	};

	const [hoveredCryptoData, setHoveredCryptoData] = useState<{
		name: string;
		value: number;
		percent: number;
	} | null>(null);

	const totalCryptoValue = cryptoHoldings.reduce((sum, crypto) => sum + crypto.value, 0);

	const distributionChartOption =
		distributionChartType === "pie"
			? {
					tooltip: {
						show: false,
					},
					legend: {
						show: false,
					},
					graphic: {
						type: "group",
						left: "center",
						top: "center",
						children: [
							{
								type: "text",
								z: 100,
								left: "center",
								top: "middle",
								style: {
									text: hoveredCryptoData
										? hoveredCryptoData.name
										: `${totalCryptoValue.toLocaleString()}`,
									textAlign: "center",
									fill: document.documentElement.classList.contains("dark") ? "#fafafa" : "#0a0a0a",
									fontSize: hoveredCryptoData ? 18 : 28,
									fontWeight: "600",
									lineHeight: 1.2,
								},
							},
							{
								type: "text",
								z: 100,
								left: "center",
								top: "middle",
								style: {
									text: hoveredCryptoData ? `${hoveredCryptoData.value.toLocaleString()}` : "Total",
									textAlign: "center",
									fill: document.documentElement.classList.contains("dark") ? "#a3a3a3" : "#737373",
									fontSize: hoveredCryptoData ? 16 : 13,
									fontWeight: hoveredCryptoData ? "500" : "400",
									y: hoveredCryptoData ? 26 : 38,
								},
							},
							{
								type: "text",
								z: 100,
								left: "center",
								top: "middle",
								style: {
									text: hoveredCryptoData ? `${hoveredCryptoData.percent.toFixed(1)}%` : "",
									textAlign: "center",
									fill: document.documentElement.classList.contains("dark") ? "#737373" : "#a3a3a3",
									fontSize: 13,
									fontWeight: "400",
									y: 48,
								},
							},
						],
					},
					series: [
						{
							type: "pie",
							radius: ["60%", "85%"],
							avoidLabelOverlap: false,
							itemStyle: {
								borderRadius: 4,
								borderColor: document.documentElement.classList.contains("dark")
									? "#0a0a0a"
									: "#fafafa",
								borderWidth: 3,
							},
							label: {
								show: false,
							},
							emphasis: {
								scale: false,
								itemStyle: {
									shadowBlur: 0,
								},
							},
							data: distributionData,
						},
					],
				}
			: {
					tooltip: {
						formatter: "{b}: {c}",
					},
					series: [
						{
							type: "treemap",
							data: distributionData,
							width: "100%",
							height: "100%",
							roam: false,
							nodeClick: false,
							breadcrumb: { show: false },
							label: {
								show: true,
								formatter: "{b}\n{c}",
							},
							upperLabel: {
								show: true,
								height: 30,
							},
							itemStyle: {
								borderColor: "#fff",
								borderWidth: 2,
								gapWidth: 2,
							},
							levels: [
								{
									itemStyle: {
										borderWidth: 0,
										gapWidth: 5,
									},
								},
								{
									itemStyle: {
										gapWidth: 1,
									},
								},
							],
						},
					],
				};

	const AccountIcon = ({ type }: { type: string }) => {
		if (type === "CEX") return <Building2 className="h-4 w-4" />;
		if (type === "Wallet") return <HardDrive className="h-4 w-4" />;
		return <Wallet className="h-4 w-4" />;
	};

	// Loading state
	if (loading) {
		return (
			<div className="space-y-6">
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					{[1, 2, 3, 4].map((i) => (
						<Card key={i}>
							<CardHeader className="pb-3">
								<div className="h-4 w-24 bg-muted animate-pulse rounded" />
								<div className="h-7 w-32 bg-muted animate-pulse rounded mt-2" />
							</CardHeader>
							<CardContent>
								<div className="h-4 w-20 bg-muted animate-pulse rounded" />
							</CardContent>
						</Card>
					))}
				</div>
				<Card>
					<CardContent className="py-12">
						<div className="h-64 bg-muted animate-pulse rounded" />
					</CardContent>
				</Card>
			</div>
		);
	}

	// Empty state — no crypto assets yet
	if (cryptoHoldings.length === 0) {
		return (
			<div className="space-y-6">
				<div className="text-center py-16">
					<Coins className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
					<h2 className="text-2xl font-bold mb-2">No Crypto Holdings</h2>
					<p className="text-muted-foreground mb-6 max-w-md mx-auto">
						You don't have any cryptocurrency positions yet. Add your first crypto to start
						tracking.
					</p>
					<Button onClick={() => setShowAddForm(true)}>
						<Plus className="h-4 w-4 mr-2" />
						Add Crypto
					</Button>
				</div>
				<AddCryptoForm
					open={showAddForm}
					onClose={() => setShowAddForm(false)}
					onSubmit={async (data) => {
						if (!currentPortfolio) {
							toast.error("No portfolio selected. Please select a portfolio first.");
							throw new Error("No portfolio selected");
						}
						try {
							const result = await addCrypto({
								name: data.cryptoName || data.symbol,
								instrumentID: data.instrumentID || data.cryptoId || undefined,
								assetTypeID: "2",
								quantity: data.quantity || 0,
								purchasePrice: data.averageBuyPrice || 0,
								currentValue: data.currentPrice * data.quantity || undefined,
								purchaseDate: data.purchaseDate,
								walletAddress: data.walletAddress || undefined,
								blockchainNetwork: undefined,
								quoteCurrency: data.quoteCurrency,
							});

							if (result.asset || result.portfolioAsset) {
								toast.success(`Added ${data.quantity} ${data.symbol} to your portfolio!`);
								setShowAddForm(false);
							} else {
								throw new Error("createCryptoAsset returned no asset");
							}
						} catch (error) {
							toast.error("Failed to add crypto. Please try again.");
							throw error;
						}
					}}
				/>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* KPIs */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<Card>
					<CardHeader className="pb-3">
						<CardDescription>Total Value</CardDescription>
						<CardTitle className="text-2xl font-mono">{formatCurrency(totalValue)}</CardTitle>
					</CardHeader>
					<CardContent>
						<div
							className={`flex items-center gap-2 text-sm ${totalProfitLoss >= 0 ? "text-green-600" : "text-red-600"}`}
						>
							{totalProfitLoss >= 0 ? (
								<TrendingUp className="h-4 w-4" />
							) : (
								<TrendingDown className="h-4 w-4" />
							)}
							<span className="font-mono">
								{formatCurrency(totalProfitLoss)} ({totalProfitLoss >= 0 ? "+" : ""}
								{totalProfitLossPercent.toFixed(2)}%)
							</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-3">
						<CardDescription>Total Cost</CardDescription>
						<CardTitle className="text-2xl font-mono">{formatCurrency(totalCost)}</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground">{numberOfHoldings} positions</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-3">
						<CardDescription>Best Performer</CardDescription>
						<CardTitle className="text-xl font-mono text-green-600">
							{bestPerformer?.symbol ?? "—"}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm font-mono">
							{bestPerformer ? `+${bestPerformer.profitLossPercent.toFixed(2)}%` : "—"}
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-3">
						<CardDescription>Worst Performer</CardDescription>
						<CardTitle className="text-xl font-mono text-red-600">
							{worstPerformer?.symbol ?? "—"}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm font-mono">
							{worstPerformer ? `${worstPerformer.profitLossPercent.toFixed(2)}%` : "—"}
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Performance Chart */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle>Portfolio Performance</CardTitle>
							<CardDescription>Total value over time</CardDescription>
						</div>
						<div className="flex gap-2">
							{["1M", "3M", "6M", "1Y", "ALL"].map((period) => (
								<Button
									key={period}
									variant={timePeriod === period ? "default" : "outline"}
									size="sm"
									onClick={() => setTimePeriod(period)}
								>
									{period}
								</Button>
							))}
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<ReactECharts
						option={performanceChartOption}
						style={{ height: "300px" }}
						opts={{ renderer: "svg" }}
					/>
				</CardContent>
			</Card>

			{/* Distribution Chart */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle>Portfolio Distribution</CardTitle>
							<CardDescription>Allocation by cryptocurrency</CardDescription>
						</div>
						<div className="flex gap-2">
							<Button
								variant={distributionChartType === "pie" ? "default" : "outline"}
								size="sm"
								onClick={() => setDistributionChartType("pie")}
							>
								<PieChart className="h-4 w-4 mr-2" />
								Pie Chart
							</Button>
							<Button
								variant={distributionChartType === "treemap" ? "default" : "outline"}
								size="sm"
								onClick={() => setDistributionChartType("treemap")}
							>
								<LayoutGrid className="h-4 w-4 mr-2" />
								Treemap
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<ReactECharts
						option={distributionChartOption}
						style={{ height: "350px" }}
						opts={{ renderer: "svg" }}
						onEvents={{
							mouseover: (params: any) => {
								if (params.componentType === "series" && params.seriesType === "pie") {
									setHoveredCryptoData({
										name: params.name,
										value: params.value,
										percent: params.percent,
									});
								}
							},
							mouseout: () => {
								setHoveredCryptoData(null);
							},
						}}
					/>
				</CardContent>
			</Card>

			{/* Holdings Table */}
			<Card>
				<CardHeader>
					<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
						<div>
							<CardTitle>Crypto Holdings</CardTitle>
							<CardDescription>Manage your cryptocurrency positions</CardDescription>
						</div>
						<div className="flex gap-2">
							<Button onClick={() => setShowAddForm(true)}>
								<Plus className="h-4 w-4 mr-2" />
								Add Crypto
							</Button>
							<Button variant="outline">
								<Download className="h-4 w-4 mr-2" />
								Export
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{/* Filters & View Mode Toggle */}
						<div className="flex flex-col sm:flex-row gap-3">
							<SearchInput
								placeholder="Search crypto..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								onClear={() => setSearchQuery("")}
								containerClassName="flex-1"
							/>

							<Select value={filterExchange} onValueChange={setFilterExchange}>
								<SelectTrigger className="w-[180px]">
									<SelectValue placeholder="Filter by account" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Accounts</SelectItem>
									{uniqueExchanges.map((ex) => (
										<SelectItem key={ex} value={ex}>
											{ex}
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							<Select value={sortBy} onValueChange={setSortBy}>
								<SelectTrigger className="w-[150px]">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="value-desc">Value (High)</SelectItem>
									<SelectItem value="value-asc">Value (Low)</SelectItem>
									<SelectItem value="profit-desc">Profit (High)</SelectItem>
									<SelectItem value="profit-asc">Profit (Low)</SelectItem>
									<SelectItem value="name-asc">Name (A-Z)</SelectItem>
								</SelectContent>
							</Select>

							{/* Group By Toggle */}
							<div className="flex border rounded-lg">
								<Button
									variant={groupBy === "account" ? "default" : "ghost"}
									size="sm"
									onClick={() => setGroupBy("account")}
									className="rounded-r-none"
								>
									<Wallet className="h-4 w-4 mr-2" />
									By Account
								</Button>
								<Button
									variant={groupBy === "asset" ? "default" : "ghost"}
									size="sm"
									onClick={() => setGroupBy("asset")}
									className="rounded-l-none"
								>
									<Coins className="h-4 w-4 mr-2" />
									By Asset
								</Button>
							</div>
						</div>

						{/* Results count */}
						<div className="flex items-center justify-between text-sm text-muted-foreground">
							<span>{filteredHoldings.length} positions</span>
							<Badge variant="outline">{formatCurrency(totalValue)} total value</Badge>
						</div>

						{/* Group By Account View - Using Accordions for scalability */}
						{groupBy === "account" && (
							<Accordion type="multiple" className="space-y-3">
								{Object.entries(groupByAccount()).map(([account, holdings], _index) => {
									const accountValue = holdings.reduce((sum, h) => sum + h.value, 0);
									const accountPl = holdings.reduce((sum, h) => sum + h.profitLoss, 0);
									const accountPlPercent = (accountPl / (accountValue - accountPl)) * 100;
									const accountType = holdings[0].accountType;

									return (
										<AccordionItem
											key={account}
											value={account}
											className="border rounded-lg overflow-hidden"
										>
											<AccordionTrigger className="px-4 py-3 hover:bg-muted/50 hover:no-underline">
												<div className="flex items-center justify-between w-full pr-2">
													<div className="flex items-center gap-3">
														<div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
															<AccountIcon type={accountType} />
														</div>
														<div className="text-left">
															<span
																onClick={(e) => {
																	e.stopPropagation();
																	onSelectAccount?.(account);
																}}
																className="font-medium hover:text-primary transition-colors text-left cursor-pointer"
															>
																{account}
															</span>
															<p className="text-xs text-muted-foreground">
																{holdings.length} {holdings.length === 1 ? "asset" : "assets"}
															</p>
														</div>
													</div>
													<div className="text-right flex items-center gap-6">
														<div>
															<p className="font-mono">{formatCurrency(accountValue)}</p>
															<p
																className={`text-sm font-mono ${accountPl >= 0 ? "text-green-600" : "text-red-600"}`}
															>
																{accountPl >= 0 ? "+" : ""}
																{formatCurrency(accountPl)} ({accountPl >= 0 ? "+" : ""}
																{accountPlPercent.toFixed(2)}%)
															</p>
														</div>
													</div>
												</div>
											</AccordionTrigger>
											<AccordionContent className="px-0 pb-0">
												<div className="border-t">
													<Table>
														<TableHeader>
															<TableRow>
																<TableHead>Asset</TableHead>
																<TableHead className="text-right">Quantity</TableHead>
																<TableHead className="text-right">Avg Price</TableHead>
																<TableHead className="text-right">Current Price</TableHead>
																<TableHead className="text-right">Value</TableHead>
																<TableHead className="text-right">P&L</TableHead>
																<TableHead className="text-right">24h</TableHead>
																<TableHead className="text-right">Actions</TableHead>
															</TableRow>
														</TableHeader>
														<TableBody>
															{holdings.map((holding) => (
																<TableRow
																	key={holding.id}
																	className="cursor-pointer hover:bg-muted/50"
																	onClick={() => onSelectCrypto(holding.cryptoId)}
																>
																	<TableCell>
																		<div className="flex items-center gap-3">
																			<div
																				className="h-8 w-8 rounded-full flex items-center justify-center text-lg"
																				style={{
																					backgroundColor: `${holding.color}20`,
																					color: holding.color,
																				}}
																			>
																				{holding.icon}
																			</div>
																			<div>
																				<p className="font-medium">{holding.cryptoName}</p>
																				<p className="text-xs text-muted-foreground">
																					{holding.symbol}
																				</p>
																			</div>
																		</div>
																	</TableCell>
																	<TableCell className="text-right font-mono">
																		{formatNumber(holding.quantity, 4)}
																	</TableCell>
																	<TableCell className="text-right font-mono">
																		{formatCurrency(holding.averageBuyPrice)}
																	</TableCell>
																	<TableCell className="text-right font-mono">
																		{formatCurrency(holding.currentPrice)}
																	</TableCell>
																	<TableCell className="text-right font-mono">
																		{formatCurrency(holding.value)}
																	</TableCell>
																	<TableCell
																		className={`text-right font-mono ${holding.profitLoss >= 0 ? "text-green-600" : "text-red-600"}`}
																	>
																		<div>
																			{holding.profitLoss >= 0 ? "+" : ""}
																			{formatCurrency(holding.profitLoss)}
																		</div>
																		<div className="text-xs">
																			({holding.profitLossPercent >= 0 ? "+" : ""}
																			{holding.profitLossPercent.toFixed(2)}%)
																		</div>
																	</TableCell>
																	<TableCell
																		className={`text-right font-mono ${holding.change24h >= 0 ? "text-green-600" : "text-red-600"}`}
																	>
																		{holding.change24h >= 0 ? "+" : ""}
																		{holding.change24h.toFixed(2)}%
																	</TableCell>
																	<TableCell className="text-right">
																		<DropdownMenu>
																			<DropdownMenuTrigger
																				asChild
																				onClick={(e) => e.stopPropagation()}
																			>
																				<Button variant="ghost" size="icon">
																					<MoreVertical className="h-4 w-4" />
																				</Button>
																			</DropdownMenuTrigger>
																			<DropdownMenuContent align="end">
																				<DropdownMenuItem
																					onClick={(e) => {
																						e.stopPropagation();
																						onSelectCrypto(holding.cryptoId);
																					}}
																				>
																					<Eye className="h-4 w-4 mr-2" />
																					View Details
																				</DropdownMenuItem>
																				<DropdownMenuItem onClick={(e) => e.stopPropagation()}>
																					<Edit className="h-4 w-4 mr-2" />
																					Edit
																				</DropdownMenuItem>
																				<DropdownMenuSeparator />
																				<DropdownMenuItem
																					className="text-destructive"
																					onClick={(e) => e.stopPropagation()}
																				>
																					<Trash2 className="h-4 w-4 mr-2" />
																					Delete
																				</DropdownMenuItem>
																			</DropdownMenuContent>
																		</DropdownMenu>
																	</TableCell>
																</TableRow>
															))}
														</TableBody>
													</Table>
												</div>
											</AccordionContent>
										</AccordionItem>
									);
								})}
							</Accordion>
						)}

						{/* Group By Asset View */}
						{groupBy === "asset" && (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Asset</TableHead>
										<TableHead className="text-right">Total Quantity</TableHead>
										<TableHead className="text-right">Accounts</TableHead>
										<TableHead className="text-right">Current Price</TableHead>
										<TableHead className="text-right">Total Value</TableHead>
										<TableHead className="text-right">Total P&L</TableHead>
										<TableHead className="text-right">24h</TableHead>
										<TableHead className="text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{aggregateByAsset().map((asset: any) => (
										<TableRow
											key={asset.symbol}
											className="cursor-pointer hover:bg-muted/50"
											onClick={() => onSelectCrypto(asset.cryptoId)}
										>
											<TableCell>
												<div className="flex items-center gap-3">
													<div
														className="h-10 w-10 rounded-full flex items-center justify-center text-xl"
														style={{
															backgroundColor: `${asset.color}20`,
															color: asset.color,
														}}
													>
														{asset.icon}
													</div>
													<div>
														<p className="font-medium">{asset.cryptoName}</p>
														<p className="text-xs text-muted-foreground">{asset.symbol}</p>
													</div>
												</div>
											</TableCell>
											<TableCell className="text-right font-mono">
												{formatNumber(asset.quantity, 4)}
											</TableCell>
											<TableCell className="text-right">
												<Badge variant="outline">
													{asset.accounts.length} account
													{asset.accounts.length > 1 ? "s" : ""}
												</Badge>
											</TableCell>
											<TableCell className="text-right font-mono">
												{formatCurrency(asset.currentPrice)}
											</TableCell>
											<TableCell className="text-right font-mono">
												{formatCurrency(asset.value)}
											</TableCell>
											<TableCell
												className={`text-right font-mono ${asset.profitLoss >= 0 ? "text-green-600" : "text-red-600"}`}
											>
												<div>
													{asset.profitLoss >= 0 ? "+" : ""}
													{formatCurrency(asset.profitLoss)}
												</div>
												<div className="text-xs">
													({asset.profitLossPercent >= 0 ? "+" : ""}
													{asset.profitLossPercent.toFixed(2)}%)
												</div>
											</TableCell>
											<TableCell
												className={`text-right font-mono ${asset.change24h >= 0 ? "text-green-600" : "text-red-600"}`}
											>
												{asset.change24h >= 0 ? "+" : ""}
												{asset.change24h.toFixed(2)}%
											</TableCell>
											<TableCell className="text-right">
												<DropdownMenu>
													<DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
														<Button variant="ghost" size="icon">
															<MoreVertical className="h-4 w-4" />
														</Button>
													</DropdownMenuTrigger>
													<DropdownMenuContent align="end">
														<DropdownMenuItem
															onClick={(e) => {
																e.stopPropagation();
																onSelectCrypto(asset.cryptoId);
															}}
														>
															<Eye className="h-4 w-4 mr-2" />
															View Details
														</DropdownMenuItem>
														<DropdownMenuItem onClick={(e) => e.stopPropagation()}>
															<Wallet className="h-4 w-4 mr-2" />
															View Accounts
														</DropdownMenuItem>
													</DropdownMenuContent>
												</DropdownMenu>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Add Crypto Form Dialog */}
			<AddCryptoForm
				open={showAddForm}
				onClose={() => setShowAddForm(false)}
				onSubmit={async (data) => {
					if (!currentPortfolio) {
						toast.error("No portfolio selected. Please select a portfolio first.");
						throw new Error("No portfolio selected");
					}
					try {
						const result = await addCrypto({
							name: data.cryptoName || data.symbol,
							instrumentID: data.instrumentID || data.cryptoId || undefined,
							assetTypeID: "2", // Crypto asset type ID from server
							quantity: data.quantity || 0,
							purchasePrice: data.averageBuyPrice || 0,
							currentValue: data.currentPrice * data.quantity || undefined,
							purchaseDate: data.purchaseDate,
							walletAddress: data.walletAddress || undefined,
							blockchainNetwork: undefined,
							quoteCurrency: data.quoteCurrency,
						});

						if (result.asset || result.portfolioAsset) {
							toast.success(`Added ${data.quantity} ${data.symbol} to your portfolio!`);
							setShowAddForm(false);
						} else {
							throw new Error("createCryptoAsset returned no asset");
						}
					} catch (error) {
						toast.error("Failed to add crypto. Please try again.");
						throw error;
					}
				}}
			/>
		</div>
	);
}
