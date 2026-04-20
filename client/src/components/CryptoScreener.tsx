import {
	Activity,
	Bitcoin,
	Download,
	Eye,
	Filter,
	Network,
	Save,
	Search,
	Star,
	TrendingUp,
	X,
	Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ScrollArea } from "./ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "./ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

interface CryptoScreenerProps {
	initialPreset?: string;
	onSelectCrypto?: (symbol: string) => void;
}

interface Crypto {
	symbol: string;
	name: string;
	price: number;
	change24h: number;
	volume24h: number;
	marketCap: number;
	circulatingSupply: number;
	category: string;
	exchange: string;
	// Derivatives metrics
	fundingRate?: number;
	openInterest?: number;
	oiChange24h?: number;
	liquidations24h?: number;
	// On-chain metrics
	activeAddresses?: number;
	txCount24h?: number;
	networkHash?: number;
	supplyInProfit?: number;
	exchangeInflow?: number;
	exchangeOutflow?: number;
}

export function CryptoScreener({
	initialPreset,
	onSelectCrypto,
}: CryptoScreenerProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
	const [selectedPreset, setSelectedPreset] = useState(initialPreset || "all");
	const [currentTab, setCurrentTab] = useState("spot");

	// Mock crypto data with derivatives and on-chain metrics
	const mockCryptos: Crypto[] = [
		{
			symbol: "BTC",
			name: "Bitcoin",
			price: 43250,
			change24h: 2.5,
			volume24h: 28.5e9,
			marketCap: 846e9,
			circulatingSupply: 19.5e6,
			category: "Layer 1",
			exchange: "All",
			fundingRate: 0.0085,
			openInterest: 15.2e9,
			oiChange24h: 3.2,
			liquidations24h: 125e6,
			activeAddresses: 950000,
			txCount24h: 285000,
			networkHash: 450e18,
			supplyInProfit: 82.5,
			exchangeInflow: 1.2e9,
			exchangeOutflow: 2.8e9,
		},
		{
			symbol: "ETH",
			name: "Ethereum",
			price: 2280,
			change24h: 1.8,
			volume24h: 15.2e9,
			marketCap: 274e9,
			circulatingSupply: 120e6,
			category: "Layer 1",
			exchange: "All",
			fundingRate: 0.0072,
			openInterest: 8.5e9,
			oiChange24h: 2.1,
			liquidations24h: 85e6,
			activeAddresses: 520000,
			txCount24h: 1.2e6,
			networkHash: 850e15,
			supplyInProfit: 78.2,
			exchangeInflow: 850e6,
			exchangeOutflow: 1.5e9,
		},
		{
			symbol: "SOL",
			name: "Solana",
			price: 98,
			change24h: -3.2,
			volume24h: 2.8e9,
			marketCap: 41e9,
			circulatingSupply: 418e6,
			category: "Layer 1",
			exchange: "All",
			fundingRate: -0.0125,
			openInterest: 1.2e9,
			oiChange24h: 8.5,
			liquidations24h: 42e6,
			activeAddresses: 180000,
			txCount24h: 45e6,
			networkHash: 0,
			supplyInProfit: 65.8,
			exchangeInflow: 125e6,
			exchangeOutflow: 95e6,
		},
		{
			symbol: "ADA",
			name: "Cardano",
			price: 0.58,
			change24h: 4.2,
			volume24h: 450e6,
			marketCap: 20.5e9,
			circulatingSupply: 35e9,
			category: "Layer 1",
			exchange: "All",
			fundingRate: 0.0045,
			openInterest: 420e6,
			oiChange24h: 1.5,
			liquidations24h: 8e6,
			activeAddresses: 85000,
			txCount24h: 125000,
			networkHash: 0,
			supplyInProfit: 55.2,
			exchangeInflow: 42e6,
			exchangeOutflow: 38e6,
		},
		{
			symbol: "AVAX",
			name: "Avalanche",
			price: 38.5,
			change24h: 6.1,
			volume24h: 780e6,
			marketCap: 14.2e9,
			circulatingSupply: 368e6,
			category: "Layer 1",
			exchange: "All",
			fundingRate: 0.0095,
			openInterest: 580e6,
			oiChange24h: 12.5,
			liquidations24h: 15e6,
			activeAddresses: 95000,
			txCount24h: 850000,
			networkHash: 0,
			supplyInProfit: 48.5,
			exchangeInflow: 85e6,
			exchangeOutflow: 125e6,
		},
		{
			symbol: "MATIC",
			name: "Polygon",
			price: 0.89,
			change24h: 1.2,
			volume24h: 320e6,
			marketCap: 8.3e9,
			circulatingSupply: 9.3e9,
			category: "Layer 2",
			exchange: "All",
			fundingRate: 0.0038,
			openInterest: 285e6,
			oiChange24h: -2.1,
			liquidations24h: 5e6,
			activeAddresses: 125000,
			txCount24h: 2.8e6,
			networkHash: 0,
			supplyInProfit: 62.8,
			exchangeInflow: 28e6,
			exchangeOutflow: 42e6,
		},
		{
			symbol: "DOT",
			name: "Polkadot",
			price: 7.85,
			change24h: -1.5,
			volume24h: 240e6,
			marketCap: 10.2e9,
			circulatingSupply: 1.3e9,
			category: "Layer 0",
			exchange: "All",
			fundingRate: 0.0052,
			openInterest: 185e6,
			oiChange24h: 0.8,
			liquidations24h: 4e6,
			activeAddresses: 42000,
			txCount24h: 85000,
			networkHash: 0,
			supplyInProfit: 58.5,
			exchangeInflow: 15e6,
			exchangeOutflow: 22e6,
		},
		{
			symbol: "LINK",
			name: "Chainlink",
			price: 15.42,
			change24h: 3.8,
			volume24h: 580e6,
			marketCap: 8.8e9,
			circulatingSupply: 571e6,
			category: "Oracle",
			exchange: "All",
			fundingRate: 0.0068,
			openInterest: 420e6,
			oiChange24h: 5.2,
			liquidations24h: 12e6,
			activeAddresses: 65000,
			txCount24h: 125000,
			networkHash: 0,
			supplyInProfit: 71.2,
			exchangeInflow: 38e6,
			exchangeOutflow: 55e6,
		},
		{
			symbol: "UNI",
			name: "Uniswap",
			price: 6.82,
			change24h: 2.1,
			volume24h: 180e6,
			marketCap: 5.1e9,
			circulatingSupply: 753e6,
			category: "DeFi",
			exchange: "All",
			fundingRate: 0.0042,
			openInterest: 125e6,
			oiChange24h: -1.2,
			liquidations24h: 3e6,
			activeAddresses: 45000,
			txCount24h: 95000,
			networkHash: 0,
			supplyInProfit: 52.8,
			exchangeInflow: 18e6,
			exchangeOutflow: 25e6,
		},
		{
			symbol: "ATOM",
			name: "Cosmos",
			price: 10.25,
			change24h: -2.8,
			volume24h: 420e6,
			marketCap: 4.0e9,
			circulatingSupply: 390e6,
			category: "Layer 0",
			exchange: "All",
			fundingRate: 0.0055,
			openInterest: 165e6,
			oiChange24h: 2.5,
			liquidations24h: 8e6,
			activeAddresses: 38000,
			txCount24h: 125000,
			networkHash: 0,
			supplyInProfit: 45.2,
			exchangeInflow: 25e6,
			exchangeOutflow: 18e6,
		},
	];

	// Presets
	const presets = [
		{ id: "all", name: "All Crypto", icon: Bitcoin, filters: {} },
		{
			id: "trending",
			name: "Trending",
			icon: TrendingUp,
			filters: { change24hMin: 5 },
		},
		{
			id: "highVolume",
			name: "High Volume",
			icon: Activity,
			filters: { volume24hMin: 1e9 },
		},
		{
			id: "oiRising",
			name: "OI Rising + Neg Funding",
			icon: Zap,
			filters: { oiChange24hMin: 5, fundingRateMax: 0 },
		},
		{
			id: "onchainActive",
			name: "On-Chain Active",
			icon: Network,
			filters: { activeAddressesMin: 100000 },
		},
		{
			id: "exchangeOutflow",
			name: "Exchange Outflow",
			icon: TrendingUp,
			filters: { netFlowPositive: true },
		},
	];

	// Apply preset
	const applyPreset = (presetId: string) => {
		const preset = presets.find((p) => p.id === presetId);
		if (preset) {
			setSelectedPreset(presetId);
			setActiveFilters(preset.filters);
			toast.success(`Applied ${preset.name} filter`);
		}
	};

	// Filter cryptos
	const filteredCryptos = useMemo(() => {
		return mockCryptos.filter((crypto) => {
			// Search filter
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				if (
					!crypto.symbol.toLowerCase().includes(query) &&
					!crypto.name.toLowerCase().includes(query)
				) {
					return false;
				}
			}

			// Active filters
			if (activeFilters.category && crypto.category !== activeFilters.category)
				return false;
			if (
				activeFilters.change24hMin &&
				crypto.change24h < activeFilters.change24hMin
			)
				return false;
			if (
				activeFilters.volume24hMin &&
				crypto.volume24h < activeFilters.volume24hMin
			)
				return false;
			if (
				activeFilters.marketCapMin &&
				crypto.marketCap < activeFilters.marketCapMin
			)
				return false;

			// Derivatives filters
			if (
				activeFilters.fundingRateMax &&
				crypto.fundingRate &&
				crypto.fundingRate > activeFilters.fundingRateMax
			)
				return false;
			if (
				activeFilters.oiChange24hMin &&
				crypto.oiChange24h &&
				crypto.oiChange24h < activeFilters.oiChange24hMin
			)
				return false;

			// On-chain filters
			if (
				activeFilters.activeAddressesMin &&
				crypto.activeAddresses &&
				crypto.activeAddresses < activeFilters.activeAddressesMin
			)
				return false;
			if (
				activeFilters.netFlowPositive &&
				crypto.exchangeOutflow &&
				crypto.exchangeInflow
			) {
				const netFlow = crypto.exchangeOutflow - crypto.exchangeInflow;
				if (netFlow <= 0) return false;
			}

			return true;
		});
	}, [searchQuery, activeFilters]);

	const { formatCurrency, currencySymbol } = useCurrency();

	const formatLargeNumber = (num: number) => {
		if (num >= 1e12) return `${currencySymbol}${(num / 1e12).toFixed(2)}T`;
		if (num >= 1e9) return `${currencySymbol}${(num / 1e9).toFixed(2)}B`;
		if (num >= 1e6) return `${currencySymbol}${(num / 1e6).toFixed(2)}M`;
		if (num >= 1e3) return `${currencySymbol}${(num / 1e3).toFixed(2)}K`;
		return formatCurrency(num);
	};

	const formatCompact = (num: number) => {
		if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
		if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
		return num.toFixed(0);
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

	const renderFilterChips = () => {
		const chips = [];
		Object.entries(activeFilters).forEach(([key, value]) => {
			let label = "";
			if (key === "category") label = `Category: ${value}`;
			else if (key === "change24hMin") label = `Change ≥ ${value}%`;
			else if (key === "volume24hMin")
				label = `Vol ≥ ${formatLargeNumber(value)}`;
			else if (key === "marketCapMin")
				label = `MCap ≥ ${formatLargeNumber(value)}`;
			else if (key === "fundingRateMax") label = `Funding ≤ ${value}%`;
			else if (key === "oiChange24hMin") label = `OI Change ≥ ${value}%`;
			else if (key === "activeAddressesMin")
				label = `Active Addr ≥ ${formatCompact(value)}`;
			else if (key === "netFlowPositive") label = "Positive Net Flow";

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
					<h1 className="text-3xl">Crypto Screener</h1>
					<p className="text-muted-foreground mt-1">
						Screen {mockCryptos.length} cryptocurrencies with spot, derivatives,
						and on-chain metrics
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => toast.success("View saved successfully")}
					>
						<Save className="h-4 w-4 mr-2" />
						Save View
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => toast.success("Exporting to CSV...")}
					>
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

			{/* Filters */}
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
						{/* Category Filter */}
						<div className="space-y-2">
							<Label>Category</Label>
							<Select
								value={activeFilters.category || "all"}
								onValueChange={(value) => {
									if (value === "all") {
										removeFilter("category");
									} else {
										setActiveFilters({ ...activeFilters, category: value });
									}
								}}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Categories</SelectItem>
									<SelectItem value="Layer 1">Layer 1</SelectItem>
									<SelectItem value="Layer 2">Layer 2</SelectItem>
									<SelectItem value="Layer 0">Layer 0</SelectItem>
									<SelectItem value="DeFi">DeFi</SelectItem>
									<SelectItem value="Oracle">Oracle</SelectItem>
								</SelectContent>
							</Select>
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
									<SelectItem value="1000000000">$1B+</SelectItem>
									<SelectItem value="10000000000">$10B+</SelectItem>
									<SelectItem value="50000000000">$50B+</SelectItem>
									<SelectItem value="100000000000">$100B+</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{/* 24h Change */}
						<div className="space-y-2">
							<Label>24h Change (Min %)</Label>
							<Input
								type="number"
								placeholder="e.g., 5"
								value={activeFilters.change24hMin || ""}
								onChange={(e) => {
									const value = parseFloat(e.target.value);
									if (!Number.isNaN(value)) {
										setActiveFilters({ ...activeFilters, change24hMin: value });
									} else {
										removeFilter("change24hMin");
									}
								}}
							/>
						</div>

						{/* Volume */}
						<div className="space-y-2">
							<Label>24h Volume (Min)</Label>
							<Select
								value={activeFilters.volume24hMin?.toString() || "all"}
								onValueChange={(value) => {
									if (value === "all") {
										removeFilter("volume24hMin");
									} else {
										setActiveFilters({
											...activeFilters,
											volume24hMin: parseFloat(value),
										});
									}
								}}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All</SelectItem>
									<SelectItem value="100000000">$100M+</SelectItem>
									<SelectItem value="500000000">$500M+</SelectItem>
									<SelectItem value="1000000000">$1B+</SelectItem>
									<SelectItem value="5000000000">$5B+</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					{/* Results Counter */}
					<div className="pt-2">
						<Badge variant="outline">
							{filteredCryptos.length} cryptocurrencies found
						</Badge>
					</div>
				</CardContent>
			</Card>

			{/* Results Table */}
			<Card>
				<CardHeader>
					<CardTitle>Results</CardTitle>
				</CardHeader>
				<CardContent>
					<Tabs value={currentTab} onValueChange={setCurrentTab}>
						<TabsList>
							<TabsTrigger value="spot">Spot Markets</TabsTrigger>
							<TabsTrigger value="derivatives">Derivatives</TabsTrigger>
							<TabsTrigger value="onchain">On-Chain</TabsTrigger>
						</TabsList>

						<TabsContent value="spot" className="mt-4">
							<ScrollArea className="h-[600px]">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Symbol</TableHead>
											<TableHead>Name</TableHead>
											<TableHead className="text-right">Price</TableHead>
											<TableHead className="text-right">24h Change</TableHead>
											<TableHead className="text-right">Volume 24h</TableHead>
											<TableHead className="text-right">Market Cap</TableHead>
											<TableHead className="text-right">Category</TableHead>
											<TableHead className="text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{filteredCryptos.map((crypto) => (
											<TableRow
												key={crypto.symbol}
												className="cursor-pointer hover:bg-muted/50"
												onClick={() => onSelectCrypto?.(crypto.symbol)}
											>
												<TableCell className="font-mono">
													{crypto.symbol}
												</TableCell>
												<TableCell>{crypto.name}</TableCell>
												<TableCell className="text-right font-mono">
													{formatCurrency(crypto.price)}
												</TableCell>
												<TableCell
													className={`text-right font-mono ${crypto.change24h >= 0 ? "text-green-600" : "text-red-600"}`}
												>
													{crypto.change24h >= 0 ? "+" : ""}
													{crypto.change24h.toFixed(2)}%
												</TableCell>
												<TableCell className="text-right font-mono">
													{formatLargeNumber(crypto.volume24h)}
												</TableCell>
												<TableCell className="text-right font-mono">
													{formatLargeNumber(crypto.marketCap)}
												</TableCell>
												<TableCell className="text-right">
													<Badge variant="secondary">{crypto.category}</Badge>
												</TableCell>
												<TableCell className="text-right">
													<div className="flex items-center justify-end gap-1">
														<Button
															variant="ghost"
															size="icon"
															onClick={() =>
																toast.info(`Viewing ${crypto.symbol}`)
															}
														>
															<Eye className="h-4 w-4" />
														</Button>
														<Button
															variant="ghost"
															size="icon"
															onClick={() =>
																toast.success(
																	`Added ${crypto.symbol} to watchlist`,
																)
															}
														>
															<Star className="h-4 w-4" />
														</Button>
													</div>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</ScrollArea>
						</TabsContent>

						<TabsContent value="derivatives" className="mt-4">
							<ScrollArea className="h-[600px]">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Symbol</TableHead>
											<TableHead className="text-right">Price</TableHead>
											<TableHead className="text-right">Funding Rate</TableHead>
											<TableHead className="text-right">
												Open Interest
											</TableHead>
											<TableHead className="text-right">
												OI Change 24h
											</TableHead>
											<TableHead className="text-right">
												Liquidations 24h
											</TableHead>
											<TableHead className="text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{filteredCryptos.map((crypto) => (
											<TableRow
												key={crypto.symbol}
												className="cursor-pointer hover:bg-muted/50"
												onClick={() => onSelectCrypto?.(crypto.symbol)}
											>
												<TableCell className="font-mono">
													{crypto.symbol}
												</TableCell>
												<TableCell className="text-right font-mono">
													{formatCurrency(crypto.price)}
												</TableCell>
												<TableCell
													className={`text-right font-mono ${(crypto.fundingRate || 0) >= 0 ? "text-green-600" : "text-red-600"}`}
												>
													{((crypto.fundingRate || 0) * 100).toFixed(3)}%
												</TableCell>
												<TableCell className="text-right font-mono">
													{formatLargeNumber(crypto.openInterest || 0)}
												</TableCell>
												<TableCell
													className={`text-right font-mono ${(crypto.oiChange24h || 0) >= 0 ? "text-green-600" : "text-red-600"}`}
												>
													{crypto.oiChange24h >= 0 ? "+" : ""}
													{(crypto.oiChange24h || 0).toFixed(2)}%
												</TableCell>
												<TableCell className="text-right font-mono text-red-600">
													{formatLargeNumber(crypto.liquidations24h || 0)}
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
											</TableRow>
										))}
									</TableBody>
								</Table>
							</ScrollArea>
						</TabsContent>

						<TabsContent value="onchain" className="mt-4">
							<ScrollArea className="h-[600px]">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Symbol</TableHead>
											<TableHead className="text-right">Price</TableHead>
											<TableHead className="text-right">
												Active Addresses
											</TableHead>
											<TableHead className="text-right">Txns 24h</TableHead>
											<TableHead className="text-right">
												Supply in Profit
											</TableHead>
											<TableHead className="text-right">
												Exchange Inflow
											</TableHead>
											<TableHead className="text-right">
												Exchange Outflow
											</TableHead>
											<TableHead className="text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{filteredCryptos.map((crypto) => {
											const netFlow =
												(crypto.exchangeOutflow || 0) -
												(crypto.exchangeInflow || 0);
											return (
												<TableRow
													key={crypto.symbol}
													className="cursor-pointer hover:bg-muted/50"
													onClick={() => onSelectCrypto?.(crypto.symbol)}
												>
													<TableCell className="font-mono">
														{crypto.symbol}
													</TableCell>
													<TableCell className="text-right font-mono">
														{formatCurrency(crypto.price)}
													</TableCell>
													<TableCell className="text-right font-mono">
														{formatCompact(crypto.activeAddresses || 0)}
													</TableCell>
													<TableCell className="text-right font-mono">
														{formatCompact(crypto.txCount24h || 0)}
													</TableCell>
													<TableCell className="text-right font-mono text-green-600">
														{(crypto.supplyInProfit || 0).toFixed(1)}%
													</TableCell>
													<TableCell className="text-right font-mono text-red-600">
														{formatLargeNumber(crypto.exchangeInflow || 0)}
													</TableCell>
													<TableCell className="text-right font-mono text-green-600">
														{formatLargeNumber(crypto.exchangeOutflow || 0)}
													</TableCell>
													<TableCell className="text-right">
														<div className="flex items-center justify-end gap-1">
															<Badge
																variant={netFlow > 0 ? "default" : "secondary"}
																className="text-xs"
															>
																{netFlow > 0 ? "Outflow" : "Inflow"}
															</Badge>
															<Button variant="ghost" size="icon">
																<Eye className="h-4 w-4" />
															</Button>
														</div>
													</TableCell>
												</TableRow>
											);
										})}
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
