import { CheckCircle, RefreshCw, XCircle } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Provider {
	id: string;
	name: string;
	type: string;
	requiresKey: boolean;
	intervals: string[];
	supportsRealtime: boolean;
	rateLimit: {
		requestsPerMinute: number;
		requestsPerDay: number;
		burstLimit: number;
	};
}

interface HealthStatus {
	provider: string;
	healthy: boolean;
	apiKeyValid?: boolean | null;
	lastChecked: string;
}

interface Candle {
	symbol: string;
	assetType: string;
	interval: string;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
	timestamp: string;
	source: string;
}

const ASSET_TYPES = [
	{ value: "STOCK", label: "US Stocks & ETFs" },
	{ value: "CRYPTO", label: "Cryptocurrency" },
	{ value: "FOREX", label: "Forex" },
];

const INTERVALS = [
	{ value: "1m", label: "1 Minute" },
	{ value: "5m", label: "5 Minutes" },
	{ value: "15m", label: "15 Minutes" },
	{ value: "1h", label: "1 Hour" },
	{ value: "4h", label: "4 Hours" },
	{ value: "1d", label: "1 Day" },
];

const TEST_SYMBOLS: Record<string, string[]> = {
	STOCK: ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"],
	CRYPTO: ["BTC/USDT", "ETH/USDT", "SOL/USDT"],
	FOREX: ["EUR/USD", "GBP/USD", "USD/JPY"],
};

export default function MarketDataTest() {
	const [symbol, setSymbol] = useState("AAPL");
	const [assetType, setAssetType] = useState("STOCK");
	const [interval, setInterval] = useState("1d");

	const [loading, setLoading] = useState(false);
	const [providers, setProviders] = useState<Provider[]>([]);
	const [health, setHealth] = useState<HealthStatus[]>([]);
	const [candles, setCandles] = useState<Candle[]>([]);
	const [realtimePrice, setRealtimePrice] = useState<Candle | null>(null);
	const [error, setError] = useState<string | null>(null);

	const [providersLoaded, setProvidersLoaded] = useState(false);
	const [healthLoaded, setHealthLoaded] = useState(false);
	const [candlesLoaded, setCandlesLoaded] = useState(false);

	const fetchWithAuth = async (
		query: string,
		variables: Record<string, unknown>,
	) => {
		const token = localStorage.getItem("auth_token");
		const response = await fetch("/graphql", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(token && { Authorization: `Bearer ${token}` }),
			},
			body: JSON.stringify({ query, variables }),
		});
		const data = await response.json();
		if (data.errors) {
			throw new Error(data.errors[0].message);
		}
		return data.data;
	};

	const loadProviders = async () => {
		setLoading(true);
		setError(null);
		try {
			const data = await fetchWithAuth(
				`
				query GetProviders($assetType: String!) {
					supportedProviders(assetType: $assetType) {
						id
						name
						type
						requiresKey
						intervals
						supportsRealtime
						rateLimit {
							requestsPerMinute
							requestsPerDay
							burstLimit
						}
					}
				}
			`,
				{ assetType },
			);
			setProviders(data.supportedProviders);
			setProvidersLoaded(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load providers");
		} finally {
			setLoading(false);
		}
	};

	const loadHealth = async () => {
		setLoading(true);
		setError(null);
		try {
			const data = await fetchWithAuth(
				`
				query GetHealth {
					providerHealth {
						provider
						healthy
						apiKeyValid
						lastChecked
					}
				}
			`,
				{},
			);
			setHealth(data.providerHealth);
			setHealthLoaded(true);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to load health status",
			);
		} finally {
			setLoading(false);
		}
	};

	const loadCandles = async () => {
		setLoading(true);
		setError(null);
		setCandlesLoaded(false);
		try {
			const now = new Date();
			const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

			const data = await fetchWithAuth(
				`
				query GetCandles($symbol: String!, $assetType: String!, $interval: String!, $from: Time!, $to: Time!) {
					candles(symbol: $symbol, assetType: $assetType, interval: $interval, from: $from, to: $to, limit: 10) {
						symbol
						assetType
						interval
						open
						high
						low
						close
						volume
						timestamp
						source
					}
				}
			`,
				{
					symbol,
					assetType,
					interval,
					from: from.toISOString(),
					to: now.toISOString(),
				},
			);
			setCandles(data.candles);
			setCandlesLoaded(true);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to load candle data",
			);
		} finally {
			setLoading(false);
		}
	};

	const loadRealtimePrice = async () => {
		setLoading(true);
		setError(null);
		try {
			const data = await fetchWithAuth(
				`
				query GetPrice($symbol: String!, $assetType: String!) {
					realTimePrice(symbol: $symbol, assetType: $assetType) {
						symbol
						close
						timestamp
						source
					}
				}
			`,
				{ symbol, assetType },
			);
			setRealtimePrice(data.realTimePrice);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to load realtime price",
			);
		} finally {
			setLoading(false);
		}
	};

	const loadAll = async () => {
		await Promise.all([loadProviders(), loadHealth()]);
		await Promise.all([loadCandles(), loadRealtimePrice()]);
	};

	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Market Data Debug
					</h1>
					<p className="text-muted-foreground">
						Test market data providers and see which source is being used
					</p>
				</div>
				<Button onClick={loadAll} disabled={loading} variant="outline">
					<RefreshCw
						className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
					/>
					Refresh All
				</Button>
			</div>

			{error && (
				<Card className="border-red-200 bg-red-50">
					<CardContent className="pt-4">
						<div className="flex items-center gap-2 text-red-600">
							<XCircle className="h-4 w-4" />
							<span>{error}</span>
						</div>
					</CardContent>
				</Card>
			)}

			<Tabs defaultValue="candles" className="space-y-4">
				<TabsList>
					<TabsTrigger value="candles">Candles</TabsTrigger>
					<TabsTrigger value="realtime">Real-time</TabsTrigger>
					<TabsTrigger value="providers">Providers</TabsTrigger>
					<TabsTrigger value="health">Health</TabsTrigger>
				</TabsList>

				<TabsContent value="candles" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Historical Data</CardTitle>
							<CardDescription>
								Test candle data and see which provider was used
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
								<div>
									<Label>Asset Type</Label>
									<Select value={assetType} onValueChange={setAssetType}>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{ASSET_TYPES.map((t) => (
												<SelectItem key={t.value} value={t.value}>
													{t.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div>
									<Label>Symbol</Label>
									<Input
										value={symbol}
										onChange={(e) => setSymbol(e.target.value)}
										placeholder="AAPL"
									/>
								</div>
								<div>
									<Label>Interval</Label>
									<Select value={interval} onValueChange={setInterval}>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{INTERVALS.map((i) => (
												<SelectItem key={i.value} value={i.value}>
													{i.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="flex items-end">
									<Button
										onClick={loadCandles}
										disabled={loading}
										className="w-full"
									>
										{loading ? "Loading..." : "Fetch Candles"}
									</Button>
								</div>
							</div>

							<div className="flex flex-wrap gap-2">
								<span className="text-sm text-muted-foreground">
									Quick pick:
								</span>
								{TEST_SYMBOLS[assetType]?.map((s) => (
									<Badge
										key={s}
										variant="outline"
										className="cursor-pointer hover:bg-secondary"
										onClick={() => setSymbol(s)}
									>
										{s}
									</Badge>
								))}
							</div>

							{candlesLoaded && candles.length > 0 && (
								<div className="space-y-2">
									<div className="flex items-center gap-2 text-sm">
										<Badge variant="outline" className="bg-green-50">
											Source: {candles[0]?.source}
										</Badge>
										<span className="text-muted-foreground">
											{candles.length} candles returned
										</span>
									</div>
									<div className="border rounded-lg overflow-hidden">
										<table className="w-full text-sm">
											<thead className="bg-muted">
												<tr>
													<th className="px-3 py-2 text-left">Time</th>
													<th className="px-3 py-2 text-right">Open</th>
													<th className="px-3 py-2 text-right">High</th>
													<th className="px-3 py-2 text-right">Low</th>
													<th className="px-3 py-2 text-right">Close</th>
													<th className="px-3 py-2 text-right">Volume</th>
												</tr>
											</thead>
											<tbody>
												{candles.slice(0, 5).map((c, i) => (
													<tr key={i} className="border-t">
														<td className="px-3 py-2">
															{new Date(c.timestamp).toLocaleString()}
														</td>
														<td className="px-3 py-2 text-right">
															${c.open.toFixed(2)}
														</td>
														<td className="px-3 py-2 text-right">
															${c.high.toFixed(2)}
														</td>
														<td className="px-3 py-2 text-right">
															${c.low.toFixed(2)}
														</td>
														<td className="px-3 py-2 text-right font-medium">
															${c.close.toFixed(2)}
														</td>
														<td className="px-3 py-2 text-right text-muted-foreground">
															{c.volume.toLocaleString()}
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								</div>
							)}

							{candlesLoaded && candles.length === 0 && (
								<div className="text-center py-8 text-muted-foreground">
									No candle data returned for {symbol}
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="realtime" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Real-time Price</CardTitle>
							<CardDescription>
								Get the latest price and see which provider was used
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
								<div>
									<Label>Asset Type</Label>
									<Select value={assetType} onValueChange={setAssetType}>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{ASSET_TYPES.map((t) => (
												<SelectItem key={t.value} value={t.value}>
													{t.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div>
									<Label>Symbol</Label>
									<Input
										value={symbol}
										onChange={(e) => setSymbol(e.target.value)}
										placeholder="AAPL"
									/>
								</div>
								<div className="flex items-end">
									<Button
										onClick={loadRealtimePrice}
										disabled={loading}
										className="w-full"
									>
										{loading ? "Loading..." : "Get Price"}
									</Button>
								</div>
							</div>

							{realtimePrice && (
								<div className="border rounded-lg p-4">
									<div className="flex items-center justify-between">
										<div>
											<div className="text-2xl font-bold">
												{realtimePrice.symbol}
											</div>
											<div className="text-3xl font-bold text-green-600">
												${realtimePrice.close.toFixed(2)}
											</div>
										</div>
										<div className="text-right">
											<Badge variant="outline" className="bg-green-50">
												Source: {realtimePrice.source}
											</Badge>
											<div className="text-sm text-muted-foreground mt-1">
												Updated:{" "}
												{new Date(realtimePrice.timestamp).toLocaleTimeString()}
											</div>
										</div>
									</div>
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="providers" className="space-y-4">
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle>Supported Providers</CardTitle>
									<CardDescription>
										Providers available for each asset type
									</CardDescription>
								</div>
								<Button
									onClick={loadProviders}
									disabled={loading}
									variant="outline"
								>
									<RefreshCw
										className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
									/>
									Refresh
								</Button>
							</div>
						</CardHeader>
						<CardContent>
							<div className="mb-4">
								<Label>Asset Type</Label>
								<Select value={assetType} onValueChange={setAssetType}>
									<SelectTrigger className="w-48">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{ASSET_TYPES.map((t) => (
											<SelectItem key={t.value} value={t.value}>
												{t.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{providersLoaded && (
								<div className="grid gap-4 md:grid-cols-2">
									{providers.map((p) => (
										<div key={p.id} className="border rounded-lg p-4">
											<div className="flex items-center justify-between mb-2">
												<div className="font-semibold">{p.name}</div>
												<Badge
													variant={p.requiresKey ? "default" : "secondary"}
												>
													{p.requiresKey ? "Requires API Key" : "Free"}
												</Badge>
											</div>
											<div className="text-sm text-muted-foreground space-y-1">
												<div>ID: {p.id}</div>
												<div>
													Rate Limit: {p.rateLimit.requestsPerMinute} req/min
												</div>
												<div>
													Intervals: {p.intervals.slice(0, 4).join(", ")}
													{p.intervals.length > 4 && "..."}
												</div>
												<div>
													Realtime:{" "}
													{p.supportsRealtime ? (
														<CheckCircle className="inline h-3 w-3 text-green-500" />
													) : (
														<XCircle className="inline h-3 w-3 text-red-500" />
													)}
												</div>
											</div>
										</div>
									))}
								</div>
							)}

							{!providersLoaded && !loading && (
								<div className="text-center py-8 text-muted-foreground">
									Click Refresh to load providers
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="health" className="space-y-4">
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle>Provider Health</CardTitle>
									<CardDescription>
										Status of all market data providers
									</CardDescription>
								</div>
								<Button
									onClick={loadHealth}
									disabled={loading}
									variant="outline"
								>
									<RefreshCw
										className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
									/>
									Refresh
								</Button>
							</div>
						</CardHeader>
						<CardContent>
							{healthLoaded && (
								<div className="space-y-2">
									{health.map((h) => (
										<div
											key={h.provider}
											className="flex items-center justify-between border-b py-3"
										>
											<div className="flex items-center gap-2">
												{h.healthy ? (
													<CheckCircle className="h-4 w-4 text-green-500" />
												) : (
													<XCircle className="h-4 w-4 text-red-500" />
												)}
												<span className="font-medium">{h.provider}</span>
											</div>
											<div className="flex items-center gap-2">
												<Badge variant={h.healthy ? "default" : "destructive"}>
													{h.healthy ? "Healthy" : "Unhealthy"}
												</Badge>
												{h.apiKeyValid === true && (
													<Badge className="bg-green-500">Key Valid</Badge>
												)}
												{h.apiKeyValid === false && (
													<Badge variant="destructive">Key Invalid</Badge>
												)}
												{h.apiKeyValid === null ||
												h.apiKeyValid === undefined ? (
													<Badge variant="secondary">No Key</Badge>
												) : null}
											</div>
										</div>
									))}
								</div>
							)}

							{!healthLoaded && !loading && (
								<div className="text-center py-8 text-muted-foreground">
									Click Refresh to load health status
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>

			<Card>
				<CardHeader>
					<CardTitle>Provider Routing</CardTitle>
					<CardDescription>How data requests are routed</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid gap-6 md:grid-cols-3">
						<div className="border rounded-lg p-4">
							<div className="font-semibold mb-2 text-blue-600">
								US Stocks & ETFs
							</div>
							<ol className="text-sm space-y-1 text-muted-foreground">
								<li>
									1. <strong>Tiingo</strong> - Primary (500 req/hr,
									CRSP-adjusted)
								</li>
								<li>
									2. <strong>Alpha Vantage</strong> - Fallback
								</li>
								<li>
									3. <strong>Twelvedata</strong> - Chart data
								</li>
								<li>
									4. <strong>Finnhub</strong> - WebSocket
								</li>
							</ol>
						</div>
						<div className="border rounded-lg p-4">
							<div className="font-semibold mb-2 text-orange-600">
								Cryptocurrency
							</div>
							<ol className="text-sm space-y-1 text-muted-foreground">
								<li>
									1. <strong>Binance</strong> - Primary
								</li>
								<li>
									2. <strong>CryptoCompare</strong> - Fallback
								</li>
								<li>
									3. <strong>Tiingo</strong> - Also supported
								</li>
							</ol>
						</div>
						<div className="border rounded-lg p-4">
							<div className="font-semibold mb-2 text-purple-600">Forex</div>
							<ol className="text-sm space-y-1 text-muted-foreground">
								<li>
									1. <strong>Alpha Vantage</strong> - Primary (best forex)
								</li>
								<li>
									2. <strong>Tiingo</strong> - Also supported
								</li>
							</ol>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
