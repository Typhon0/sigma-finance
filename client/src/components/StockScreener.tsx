import {
	Activity,
	BarChart3,
	DollarSign,
	Download,
	Eye,
	Filter,
	Percent,
	Save,
	Search,
	Settings2,
	Star,
	TrendingDown,
	TrendingUp,
	X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { ScrollArea } from "./ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";
import { Separator } from "./ui/separator";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "./ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

interface StockScreenerProps {
	initialPreset?: string;
	onSelectStock?: (symbol: string) => void;
}

interface Stock {
	symbol: string;
	name: string;
	price: number;
	change: number;
	changePercent: number;
	volume: number;
	marketCap: number;
	pe: number;
	eps: number;
	dividend: number;
	beta: number;
	week52High: number;
	week52Low: number;
	sector: string;
	industry: string;
	country: string;
}

export function StockScreener({
	initialPreset,
	onSelectStock,
}: StockScreenerProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
	const [selectedPreset, setSelectedPreset] = useState(initialPreset || "all");
	const [visibleColumns, setVisibleColumns] = useState<string[]>([
		"symbol",
		"name",
		"price",
		"change",
		"volume",
		"marketCap",
		"pe",
	]);
	const [currentTab, setCurrentTab] = useState("overview");

	// Mock stock data
	const mockStocks: Stock[] = [
		{
			symbol: "AAPL",
			name: "Apple Inc.",
			price: 192.53,
			change: 2.37,
			changePercent: 1.25,
			volume: 52340000,
			marketCap: 3000000000000,
			pe: 31.2,
			eps: 6.17,
			dividend: 0.96,
			beta: 1.24,
			week52High: 199.62,
			week52Low: 164.08,
			sector: "Technology",
			industry: "Consumer Electronics",
			country: "USA",
		},
		{
			symbol: "MSFT",
			name: "Microsoft Corporation",
			price: 378.91,
			change: 3.24,
			changePercent: 0.86,
			volume: 23450000,
			marketCap: 2820000000000,
			pe: 36.5,
			eps: 10.38,
			dividend: 3.0,
			beta: 0.91,
			week52High: 384.3,
			week52Low: 309.45,
			sector: "Technology",
			industry: "Software",
			country: "USA",
		},
		{
			symbol: "GOOGL",
			name: "Alphabet Inc.",
			price: 140.93,
			change: 1.82,
			changePercent: 1.31,
			volume: 28900000,
			marketCap: 1760000000000,
			pe: 26.3,
			eps: 5.36,
			dividend: 0,
			beta: 1.06,
			week52High: 150.24,
			week52Low: 104.0,
			sector: "Communication",
			industry: "Internet Services",
			country: "USA",
		},
		{
			symbol: "AMZN",
			name: "Amazon.com Inc.",
			price: 178.25,
			change: 9.97,
			changePercent: 5.93,
			volume: 45800000,
			marketCap: 1840000000000,
			pe: 51.8,
			eps: 3.44,
			dividend: 0,
			beta: 1.15,
			week52High: 188.65,
			week52Low: 118.35,
			sector: "Consumer Cyclical",
			industry: "Internet Retail",
			country: "USA",
		},
		{
			symbol: "NVDA",
			name: "NVIDIA Corporation",
			price: 495.22,
			change: 38.25,
			changePercent: 8.37,
			volume: 52300000,
			marketCap: 1220000000000,
			pe: 97.4,
			eps: 5.08,
			dividend: 0.16,
			beta: 1.68,
			week52High: 502.66,
			week52Low: 212.67,
			sector: "Technology",
			industry: "Semiconductors",
			country: "USA",
		},
		{
			symbol: "TSLA",
			name: "Tesla Inc.",
			price: 248.48,
			change: 18.13,
			changePercent: 7.87,
			volume: 128500000,
			marketCap: 788000000000,
			pe: 78.9,
			eps: 3.15,
			dividend: 0,
			beta: 2.04,
			week52High: 299.29,
			week52Low: 152.37,
			sector: "Consumer Cyclical",
			industry: "Auto Manufacturers",
			country: "USA",
		},
		{
			symbol: "META",
			name: "Meta Platforms Inc.",
			price: 389.18,
			change: 19.32,
			changePercent: 5.23,
			volume: 18600000,
			marketCap: 986000000000,
			pe: 29.7,
			eps: 13.1,
			dividend: 0,
			beta: 1.19,
			week52High: 425.3,
			week52Low: 224.0,
			sector: "Communication",
			industry: "Internet Content",
			country: "USA",
		},
		{
			symbol: "BRK.B",
			name: "Berkshire Hathaway",
			price: 358.43,
			change: 1.08,
			changePercent: 0.3,
			volume: 3200000,
			marketCap: 785000000000,
			pe: 8.5,
			eps: 42.16,
			dividend: 0,
			beta: 0.89,
			week52High: 381.5,
			week52Low: 303.31,
			sector: "Financial Services",
			industry: "Insurance",
			country: "USA",
		},
		{
			symbol: "V",
			name: "Visa Inc.",
			price: 259.64,
			change: 2.15,
			changePercent: 0.84,
			volume: 6700000,
			marketCap: 545000000000,
			pe: 32.1,
			eps: 8.09,
			dividend: 1.8,
			beta: 0.95,
			week52High: 273.41,
			week52Low: 227.05,
			sector: "Financial Services",
			industry: "Credit Services",
			country: "USA",
		},
		{
			symbol: "JPM",
			name: "JPMorgan Chase",
			price: 165.83,
			change: -0.72,
			changePercent: -0.43,
			volume: 10200000,
			marketCap: 481000000000,
			pe: 10.9,
			eps: 15.22,
			dividend: 4.0,
			beta: 1.12,
			week52High: 174.22,
			week52Low: 135.19,
			sector: "Financial Services",
			industry: "Banks",
			country: "USA",
		},
		{
			symbol: "JNJ",
			name: "Johnson & Johnson",
			price: 156.82,
			change: 0.45,
			changePercent: 0.29,
			volume: 8900000,
			marketCap: 380000000000,
			pe: 24.3,
			eps: 6.45,
			dividend: 4.76,
			beta: 0.63,
			week52High: 179.92,
			week52Low: 143.83,
			sector: "Healthcare",
			industry: "Drug Manufacturers",
			country: "USA",
		},
		{
			symbol: "WMT",
			name: "Walmart Inc.",
			price: 166.53,
			change: -4.12,
			changePercent: -2.42,
			volume: 8100000,
			marketCap: 449000000000,
			pe: 31.5,
			eps: 5.29,
			dividend: 2.28,
			beta: 0.52,
			week52High: 176.94,
			week52Low: 141.52,
			sector: "Consumer Defensive",
			industry: "Discount Stores",
			country: "USA",
		},
		{
			symbol: "PG",
			name: "Procter & Gamble",
			price: 153.24,
			change: 0.88,
			changePercent: 0.58,
			volume: 6500000,
			marketCap: 365000000000,
			pe: 25.7,
			eps: 5.96,
			dividend: 3.76,
			beta: 0.41,
			week52High: 165.35,
			week52Low: 144.39,
			sector: "Consumer Defensive",
			industry: "Household Products",
			country: "USA",
		},
		{
			symbol: "MA",
			name: "Mastercard Inc.",
			price: 412.67,
			change: 3.52,
			changePercent: 0.86,
			volume: 2800000,
			marketCap: 389000000000,
			pe: 35.4,
			eps: 11.66,
			dividend: 2.08,
			beta: 1.09,
			week52High: 450.96,
			week52Low: 359.81,
			sector: "Financial Services",
			industry: "Credit Services",
			country: "USA",
		},
		{
			symbol: "HD",
			name: "Home Depot Inc.",
			price: 332.19,
			change: -2.45,
			changePercent: -0.73,
			volume: 3400000,
			marketCap: 334000000000,
			pe: 21.8,
			eps: 15.24,
			dividend: 8.36,
			beta: 0.96,
			week52High: 391.18,
			week52Low: 299.59,
			sector: "Consumer Cyclical",
			industry: "Home Improvement Retail",
			country: "USA",
		},
	];

	// Presets
	const presets = [
		{ id: "all", name: "All Stocks", icon: BarChart3, filters: {} },
		{
			id: "value",
			name: "Value Stocks",
			icon: DollarSign,
			filters: { peMax: 20, dividendMin: 2 },
		},
		{
			id: "growth",
			name: "Growth Stocks",
			icon: TrendingUp,
			filters: { changePercentMin: 5, peMin: 30 },
		},
		{
			id: "dividend",
			name: "Dividend Stocks",
			icon: Percent,
			filters: { dividendMin: 3 },
		},
		{
			id: "gainers",
			name: "Top Gainers",
			icon: TrendingUp,
			filters: { changePercentMin: 3 },
		},
		{
			id: "losers",
			name: "Top Losers",
			icon: TrendingDown,
			filters: { changePercentMax: -2 },
		},
		{
			id: "active",
			name: "Most Active",
			icon: Activity,
			filters: { volumeMin: 20000000 },
		},
	];

	// Column groups
	const _columnGroups = {
		overview: ["symbol", "name", "price", "change", "changePercent", "volume"],
		performance: [
			"symbol",
			"change",
			"changePercent",
			"week52High",
			"week52Low",
			"beta",
		],
		valuation: ["symbol", "price", "marketCap", "pe", "eps"],
		dividends: ["symbol", "price", "dividend", "changePercent"],
		profitability: ["symbol", "eps", "pe", "marketCap"],
	};

	// Apply preset
	const applyPreset = (presetId: string) => {
		const preset = presets.find((p) => p.id === presetId);
		if (preset) {
			setSelectedPreset(presetId);
			setActiveFilters(preset.filters);
			toast.success(`Applied ${preset.name} filter`);
		}
	};

	// Filter stocks
	const filteredStocks = useMemo(() => {
		return mockStocks.filter((stock) => {
			// Search filter
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				if (
					!stock.symbol.toLowerCase().includes(query) &&
					!stock.name.toLowerCase().includes(query)
				) {
					return false;
				}
			}

			// Active filters
			if (activeFilters.sector && stock.sector !== activeFilters.sector)
				return false;
			if (activeFilters.peMin && stock.pe < activeFilters.peMin) return false;
			if (activeFilters.peMax && stock.pe > activeFilters.peMax) return false;
			if (
				activeFilters.dividendMin &&
				stock.dividend < activeFilters.dividendMin
			)
				return false;
			if (
				activeFilters.changePercentMin &&
				stock.changePercent < activeFilters.changePercentMin
			)
				return false;
			if (
				activeFilters.changePercentMax &&
				stock.changePercent > activeFilters.changePercentMax
			)
				return false;
			if (activeFilters.volumeMin && stock.volume < activeFilters.volumeMin)
				return false;
			if (
				activeFilters.marketCapMin &&
				stock.marketCap < activeFilters.marketCapMin
			)
				return false;
			if (
				activeFilters.marketCapMax &&
				stock.marketCap < activeFilters.marketCapMax
			)
				return false;

			return true;
		});
	}, [searchQuery, activeFilters]);

	const { formatCurrency, currencySymbol } = useCurrency();

	const formatLargeNumber = (num: number) => {
		if (num >= 1e12) return `${currencySymbol}${(num / 1e12).toFixed(2)}T`;
		if (num >= 1e9) return `${currencySymbol}${(num / 1e9).toFixed(2)}B`;
		if (num >= 1e6) return `${currencySymbol}${(num / 1e6).toFixed(2)}M`;
		return formatCurrency(num);
	};

	const removeFilter = (key: string) => {
		const newFilters = { ...activeFilters };
		delete newFilters[key];
		setActiveFilters(newFilters);
	};

	const clearAllFilters = () => {
		setActiveFilters({});
		setSelectedPreset("all");
		toast.success("All filters cleared");
	};

	const exportToCSV = () => {
		toast.success("Exporting to CSV...");
	};

	const saveView = () => {
		toast.success("View saved successfully");
	};

	const renderFilterChips = () => {
		const chips = [];
		Object.entries(activeFilters).forEach(([key, value]) => {
			let label = "";
			if (key === "sector") label = `Sector: ${value}`;
			else if (key === "peMin") label = `P/E ≥ ${value}`;
			else if (key === "peMax") label = `P/E ≤ ${value}`;
			else if (key === "dividendMin") label = `Div ≥ ${value}%`;
			else if (key === "changePercentMin") label = `Change ≥ ${value}%`;
			else if (key === "changePercentMax") label = `Change ≤ ${value}%`;
			else if (key === "volumeMin")
				label = `Vol ≥ ${(value / 1e6).toFixed(0)}M`;
			else if (key === "marketCapMin")
				label = `MCap ≥ ${formatLargeNumber(value)}`;

			if (label) {
				chips.push(
					<Badge key={key} variant="secondary" className="gap-2">
						{label}
						<X
							className="h-3 w-3 cursor-pointer"
							onClick={() => removeFilter(key)}
						/>
					</Badge>,
				);
			}
		});
		return chips;
	};

	return (
		<div className="p-6 space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl">Stock Screener</h1>
					<p className="text-muted-foreground mt-1">
						Screen {mockStocks.length} stocks with advanced filters
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" onClick={saveView}>
						<Save className="h-4 w-4 mr-2" />
						Save View
					</Button>
					<Button variant="outline" size="sm" onClick={exportToCSV}>
						<Download className="h-4 w-4 mr-2" />
						Export CSV
					</Button>
				</div>
			</div>

			{/* Presets */}
			<div className="flex gap-2 overflow-x-auto pb-2">
				{presets.map((preset) => (
					<Button
						key={preset.id}
						variant={selectedPreset === preset.id ? "default" : "outline"}
						size="sm"
						onClick={() => applyPreset(preset.id)}
						className="flex-shrink-0"
					>
						<preset.icon className="h-4 w-4 mr-2" />
						{preset.name}
					</Button>
				))}
			</div>

			{/* Filters and Search */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle className="flex items-center gap-2">
							<Filter className="h-5 w-5" />
							Filters
						</CardTitle>
						{Object.keys(activeFilters).length > 0 && (
							<Button variant="ghost" size="sm" onClick={clearAllFilters}>
								Clear All
							</Button>
						)}
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Search */}
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search by symbol or name..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-9"
						/>
					</div>

					{/* Active Filters Chips */}
					{renderFilterChips().length > 0 && (
						<div className="flex flex-wrap gap-2">{renderFilterChips()}</div>
					)}

					{/* Filter Grid */}
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
						{/* Sector Filter */}
						<div className="space-y-2">
							<Label>Sector</Label>
							<Select
								value={activeFilters.sector || "all"}
								onValueChange={(value) => {
									if (value === "all") {
										removeFilter("sector");
									} else {
										setActiveFilters({ ...activeFilters, sector: value });
									}
								}}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Sectors</SelectItem>
									<SelectItem value="Technology">Technology</SelectItem>
									<SelectItem value="Healthcare">Healthcare</SelectItem>
									<SelectItem value="Financial Services">
										Financial Services
									</SelectItem>
									<SelectItem value="Consumer Cyclical">
										Consumer Cyclical
									</SelectItem>
									<SelectItem value="Consumer Defensive">
										Consumer Defensive
									</SelectItem>
									<SelectItem value="Communication">Communication</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{/* P/E Ratio */}
						<div className="space-y-2">
							<Label>P/E Ratio (Max)</Label>
							<Input
								type="number"
								placeholder="e.g., 30"
								value={activeFilters.peMax || ""}
								onChange={(e) => {
									const value = parseFloat(e.target.value);
									if (!Number.isNaN(value)) {
										setActiveFilters({ ...activeFilters, peMax: value });
									} else {
										removeFilter("peMax");
									}
								}}
							/>
						</div>

						{/* Dividend Yield */}
						<div className="space-y-2">
							<Label>Dividend Yield (Min %)</Label>
							<Input
								type="number"
								placeholder="e.g., 2.0"
								value={activeFilters.dividendMin || ""}
								onChange={(e) => {
									const value = parseFloat(e.target.value);
									if (!Number.isNaN(value)) {
										setActiveFilters({ ...activeFilters, dividendMin: value });
									} else {
										removeFilter("dividendMin");
									}
								}}
							/>
						</div>

						{/* Market Cap */}
						<div className="space-y-2">
							<Label>Market Cap (Min)</Label>
							<Select
								value={activeFilters.marketCapMin?.toString() || "all"}
								onValueChange={(value) => {
									if (value === "all") {
										removeFilter("marketCapMin");
									} else {
										setActiveFilters({
											...activeFilters,
											marketCapMin: parseFloat(value),
										});
									}
								}}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All</SelectItem>
									<SelectItem value="2000000000">Small Cap ($2B+)</SelectItem>
									<SelectItem value="10000000000">Mid Cap ($10B+)</SelectItem>
									<SelectItem value="100000000000">
										Large Cap ($100B+)
									</SelectItem>
									<SelectItem value="200000000000">
										Mega Cap ($200B+)
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					{/* Results Counter */}
					<div className="pt-2">
						<Badge variant="outline">
							{filteredStocks.length} stocks found
						</Badge>
					</div>
				</CardContent>
			</Card>

			{/* Results Table */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle>Results</CardTitle>
						<Popover>
							<PopoverTrigger asChild>
								<Button variant="outline" size="sm">
									<Settings2 className="h-4 w-4 mr-2" />
									Columns
								</Button>
							</PopoverTrigger>
							<PopoverContent className="w-56">
								<div className="space-y-2">
									<h4 className="font-medium text-sm">Show Columns</h4>
									<Separator />
									{[
										"symbol",
										"name",
										"price",
										"change",
										"volume",
										"marketCap",
										"pe",
										"eps",
										"dividend",
									].map((col) => (
										<div key={col} className="flex items-center space-x-2">
											<Checkbox
												id={col}
												checked={visibleColumns.includes(col)}
												onCheckedChange={(checked) => {
													if (checked) {
														setVisibleColumns([...visibleColumns, col]);
													} else {
														setVisibleColumns(
															visibleColumns.filter((c) => c !== col),
														);
													}
												}}
											/>
											<Label htmlFor={col} className="text-sm capitalize">
												{col.replace(/([A-Z])/g, " $1").trim()}
											</Label>
										</div>
									))}
								</div>
							</PopoverContent>
						</Popover>
					</div>
				</CardHeader>
				<CardContent>
					<Tabs value={currentTab} onValueChange={setCurrentTab}>
						<TabsList>
							<TabsTrigger value="overview">Overview</TabsTrigger>
							<TabsTrigger value="performance">Performance</TabsTrigger>
							<TabsTrigger value="valuation">Valuation</TabsTrigger>
							<TabsTrigger value="dividends">Dividends</TabsTrigger>
						</TabsList>

						<TabsContent value={currentTab} className="mt-4">
							<ScrollArea className="h-[600px]">
								<Table>
									<TableHeader>
										<TableRow>
											{currentTab === "overview" && (
												<>
													<TableHead>Symbol</TableHead>
													<TableHead>Name</TableHead>
													<TableHead className="text-right">Price</TableHead>
													<TableHead className="text-right">Change</TableHead>
													<TableHead className="text-right">Volume</TableHead>
													<TableHead className="text-right">
														Market Cap
													</TableHead>
													<TableHead className="text-right">Actions</TableHead>
												</>
											)}
											{currentTab === "performance" && (
												<>
													<TableHead>Symbol</TableHead>
													<TableHead className="text-right">Change %</TableHead>
													<TableHead className="text-right">52W High</TableHead>
													<TableHead className="text-right">52W Low</TableHead>
													<TableHead className="text-right">Beta</TableHead>
													<TableHead className="text-right">Actions</TableHead>
												</>
											)}
											{currentTab === "valuation" && (
												<>
													<TableHead>Symbol</TableHead>
													<TableHead className="text-right">Price</TableHead>
													<TableHead className="text-right">
														Market Cap
													</TableHead>
													<TableHead className="text-right">P/E</TableHead>
													<TableHead className="text-right">EPS</TableHead>
													<TableHead className="text-right">Actions</TableHead>
												</>
											)}
											{currentTab === "dividends" && (
												<>
													<TableHead>Symbol</TableHead>
													<TableHead className="text-right">Price</TableHead>
													<TableHead className="text-right">Dividend</TableHead>
													<TableHead className="text-right">Yield %</TableHead>
													<TableHead className="text-right">Actions</TableHead>
												</>
											)}
										</TableRow>
									</TableHeader>
									<TableBody>
										{filteredStocks.map((stock) => (
											<TableRow
												key={stock.symbol}
												className="cursor-pointer hover:bg-muted/50"
												onClick={() => onSelectStock?.(stock.symbol)}
											>
												{currentTab === "overview" && (
													<>
														<TableCell className="font-mono">
															{stock.symbol}
														</TableCell>
														<TableCell>{stock.name}</TableCell>
														<TableCell className="text-right font-mono">
															{formatCurrency(stock.price)}
														</TableCell>
														<TableCell
															className={`text-right font-mono ${stock.change >= 0 ? "text-green-600" : "text-red-600"}`}
														>
															{stock.change >= 0 ? "+" : ""}
															{stock.changePercent.toFixed(2)}%
														</TableCell>
														<TableCell className="text-right font-mono">
															{(stock.volume / 1e6).toFixed(1)}M
														</TableCell>
														<TableCell className="text-right font-mono">
															{formatLargeNumber(stock.marketCap)}
														</TableCell>
														<TableCell className="text-right">
															<div className="flex items-center justify-end gap-1">
																<Button
																	variant="ghost"
																	size="icon"
																	onClick={() =>
																		toast.info(`Viewing ${stock.symbol}`)
																	}
																>
																	<Eye className="h-4 w-4" />
																</Button>
																<Button
																	variant="ghost"
																	size="icon"
																	onClick={() =>
																		toast.success(
																			`Added ${stock.symbol} to watchlist`,
																		)
																	}
																>
																	<Star className="h-4 w-4" />
																</Button>
															</div>
														</TableCell>
													</>
												)}
												{currentTab === "performance" && (
													<>
														<TableCell className="font-mono">
															{stock.symbol}
														</TableCell>
														<TableCell
															className={`text-right font-mono ${stock.changePercent >= 0 ? "text-green-600" : "text-red-600"}`}
														>
															{stock.changePercent >= 0 ? "+" : ""}
															{stock.changePercent.toFixed(2)}%
														</TableCell>
														<TableCell className="text-right font-mono">
															{formatCurrency(stock.week52High)}
														</TableCell>
														<TableCell className="text-right font-mono">
															{formatCurrency(stock.week52Low)}
														</TableCell>
														<TableCell className="text-right font-mono">
															{stock.beta.toFixed(2)}
														</TableCell>
														<TableCell className="text-right">
															<div className="flex items-center justify-end gap-1">
																<Button variant="ghost" size="icon">
																	<Eye className="h-4 w-4" />
																</Button>
																<Button variant="ghost" size="icon">
																	<Star className="h-4 w-4" />
																</Button>
															</div>
														</TableCell>
													</>
												)}
												{currentTab === "valuation" && (
													<>
														<TableCell className="font-mono">
															{stock.symbol}
														</TableCell>
														<TableCell className="text-right font-mono">
															{formatCurrency(stock.price)}
														</TableCell>
														<TableCell className="text-right font-mono">
															{formatLargeNumber(stock.marketCap)}
														</TableCell>
														<TableCell className="text-right font-mono">
															{stock.pe.toFixed(1)}
														</TableCell>
														<TableCell className="text-right font-mono">
															{formatCurrency(stock.eps)}
														</TableCell>
														<TableCell className="text-right">
															<div className="flex items-center justify-end gap-1">
																<Button variant="ghost" size="icon">
																	<Eye className="h-4 w-4" />
																</Button>
																<Button variant="ghost" size="icon">
																	<Star className="h-4 w-4" />
																</Button>
															</div>
														</TableCell>
													</>
												)}
												{currentTab === "dividends" && (
													<>
														<TableCell className="font-mono">
															{stock.symbol}
														</TableCell>
														<TableCell className="text-right font-mono">
															{formatCurrency(stock.price)}
														</TableCell>
														<TableCell className="text-right font-mono">
															{formatCurrency(stock.dividend)}
														</TableCell>
														<TableCell className="text-right font-mono text-green-600">
															{((stock.dividend / stock.price) * 100).toFixed(
																2,
															)}
															%
														</TableCell>
														<TableCell className="text-right">
															<div className="flex items-center justify-end gap-1">
																<Button variant="ghost" size="icon">
																	<Eye className="h-4 w-4" />
																</Button>
																<Button variant="ghost" size="icon">
																	<Star className="h-4 w-4" />
																</Button>
															</div>
														</TableCell>
													</>
												)}
											</TableRow>
										))}
									</TableBody>
								</Table>
							</ScrollArea>
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>
		</div>
	);
}
