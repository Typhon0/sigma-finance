// TradingView Charting Library Datafeed Implementation
// This provides the interface between TradingView charts and our market data API

// TradingView Datafeed API types - these will be available when the library is installed
interface IBasicDataFeed {
	onReady(callback: OnReadyCallback): void;
	searchSymbols(
		userInput: string,
		exchange: string,
		symbolType: string,
		callback: SearchSymbolsCallback,
	): void;
	resolveSymbol(
		symbolName: string,
		onSymbolResolvedCallback: ResolveCallback,
		onResolveErrorCallback: ErrorCallback,
	): void;
	getBars(
		symbolInfo: LibrarySymbolInfo,
		resolution: ResolutionString,
		periodParams: PeriodParams,
		onHistoryCallback: HistoryCallback,
		onErrorCallback: ErrorCallback,
	): void;
	subscribeBars(
		symbolInfo: LibrarySymbolInfo,
		resolution: ResolutionString,
		onRealtimeCallback: SubscribeBarsCallback,
		subscriberUid: string,
		onResetCacheNeededCallback?: () => void,
	): void;
	unsubscribeBars(subscriberUid: string): void;
}

interface LibrarySymbolInfo {
	ticker: string;
	name: string;
	description: string;
	type: string;
	session: string;
	timezone: string;
	exchange: string;
	minmov: number;
	pricescale: number;
	has_intraday: boolean;
	has_no_volume: boolean;
	has_weekly_and_monthly: boolean;
	supported_resolutions: ResolutionString[];
	volume_precision: number;
	data_status: string;
	full_name: string;
	listed_exchange: string;
	format: string;
}

interface PeriodParams {
	from: number;
	to: number;
	firstDataRequest: boolean;
}

interface Bar {
	time: number;
	open: number;
	high: number;
	low: number;
	close: number;
	volume?: number;
}

interface SearchSymbolResultItem {
	symbol: string;
	full_name: string;
	description: string;
	exchange: string;
	type: string;
}

interface DatafeedConfiguration {
	exchanges: Array<{ value: string; name: string; desc: string }>;
	symbols_types: Array<{ name: string; value: string }>;
	supported_resolutions: ResolutionString[];
	supports_marks: boolean;
	supports_timescale_marks: boolean;
	supports_time: boolean;
	futures_regex: RegExp | null;
}

type ResolutionString = "1" | "5" | "15" | "30" | "60" | "240" | "1D" | "1W" | "1M";
type OnReadyCallback = (configuration: DatafeedConfiguration) => void;
type SearchSymbolsCallback = (symbols: SearchSymbolResultItem[]) => void;
type ResolveCallback = (symbolInfo: LibrarySymbolInfo) => void;
type ErrorCallback = (error: string) => void;
type HistoryCallback = (bars: Bar[], meta: { noData: boolean }) => void;
type SubscribeBarsCallback = (bar: Bar) => void;

interface CandleData {
	symbol: string;
	assetType: string;
	interval: string;
	open: number;
	high: number;
	low: number;
	close: number;
	volume?: number;
	timestamp: string;
	source: string;
}

class MarketDataFeed implements IBasicDataFeed {
	private apiUrl: string;
	private supportedResolutions: ResolutionString[];
	private subscribers: Map<string, SubscribeBarsCallback> = new Map();

	constructor(apiUrl: string = "/graphql") {
		this.apiUrl = apiUrl;
		this.supportedResolutions = ["1", "5", "15", "30", "60", "240", "1D"] as ResolutionString[];
	}

	onReady(callback: OnReadyCallback): void {
		setTimeout(() => {
			callback({
				exchanges: [
					{ value: "CRYPTO", name: "Cryptocurrency", desc: "Crypto Markets" },
					{ value: "STOCK", name: "Stocks", desc: "Stock Markets" },
				],
				symbols_types: [
					{ name: "crypto", value: "crypto" },
					{ name: "stock", value: "stock" },
				],
				supported_resolutions: this.supportedResolutions,
				supports_marks: false,
				supports_timescale_marks: false,
				supports_time: true,
				futures_regex: null,
			});
		}, 0);
	}

	searchSymbols(
		userInput: string,
		exchange: string,
		_symbolType: string,
		callback: SearchSymbolsCallback,
	): void {
		// Simple symbol search - in production, this would query your symbol database
		const symbols = this.getPopularSymbols(exchange);
		const filtered = symbols.filter(
			(symbol) =>
				symbol.symbol.toLowerCase().includes(userInput.toLowerCase()) ||
				symbol.full_name.toLowerCase().includes(userInput.toLowerCase()),
		);
		callback(filtered);
	}

	resolveSymbol(
		symbolName: string,
		onSymbolResolvedCallback: ResolveCallback,
		_onResolveErrorCallback: ErrorCallback,
	): void {
		const [symbol, exchange] = symbolName.split(":");
		const assetType = exchange || "CRYPTO";

		// Create symbol info
		const symbolInfo: LibrarySymbolInfo = {
			ticker: symbolName,
			name: symbol,
			description: `${symbol} ${assetType}`,
			type: assetType.toLowerCase() as any,
			session: "24x7",
			timezone: "Etc/UTC",
			exchange: assetType,
			minmov: 1,
			pricescale: assetType === "CRYPTO" ? 100000000 : 100, // 8 decimals for crypto, 2 for stocks
			has_intraday: true,
			has_no_volume: false,
			has_weekly_and_monthly: true,
			supported_resolutions: this.supportedResolutions,
			volume_precision: 2,
			data_status: "streaming",
			full_name: `${symbol}/${assetType}`,
			listed_exchange: assetType,
			format: "price",
		};

		setTimeout(() => onSymbolResolvedCallback(symbolInfo), 0);
	}

	getBars(
		symbolInfo: LibrarySymbolInfo,
		resolution: ResolutionString,
		periodParams: PeriodParams,
		onHistoryCallback: HistoryCallback,
		onErrorCallback: ErrorCallback,
	): void {
		const { from, to, firstDataRequest } = periodParams;

		this.fetchCandles(
			symbolInfo.name,
			symbolInfo.exchange,
			resolution,
			from * 1000, // Convert to milliseconds
			to * 1000,
			firstDataRequest ? 1000 : 500,
		)
			.then((candles) => {
				if (candles.length === 0) {
					onHistoryCallback([], { noData: true });
					return;
				}

				const bars = candles.map((candle) => ({
					time: new Date(candle.timestamp).getTime(),
					open: candle.open,
					high: candle.high,
					low: candle.low,
					close: candle.close,
					volume: candle.volume || 0,
				}));

				// Sort by time
				bars.sort((a, b) => a.time - b.time);

				onHistoryCallback(bars, { noData: false });
			})
			.catch((error) => {
				onErrorCallback(error.message);
			});
	}

	subscribeBars(
		symbolInfo: LibrarySymbolInfo,
		_resolution: ResolutionString,
		onRealtimeCallback: SubscribeBarsCallback,
		subscriberUid: string,
		_onResetCacheNeededCallback?: () => void,
	): void {
		this.subscribers.set(subscriberUid, onRealtimeCallback);

		// Start real-time updates
		this.startRealtimeUpdates(symbolInfo, _resolution, onRealtimeCallback);
	}

	unsubscribeBars(subscriberUid: string): void {
		this.subscribers.delete(subscriberUid);
	}

	private async fetchCandles(
		symbol: string,
		assetType: string,
		resolution: ResolutionString,
		from: number,
		to: number,
		limit: number,
	): Promise<CandleData[]> {
		const interval = this.mapResolutionToInterval(resolution);

		const query = `
      query GetCandles($symbol: String!, $assetType: String!, $interval: String!, $from: Time!, $to: Time!, $limit: Int!) {
        candles(symbol: $symbol, assetType: $assetType, interval: $interval, from: $from, to: $to, limit: $limit) {
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
    `;

		const variables = {
			symbol,
			assetType,
			interval,
			from: new Date(from).toISOString(),
			to: new Date(to).toISOString(),
			limit,
		};

		const response = await fetch(this.apiUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${localStorage.getItem("token")}`,
			},
			body: JSON.stringify({ query, variables }),
		});

		const result = await response.json();

		if (result.errors) {
			throw new Error(result.errors[0].message);
		}

		return result.data.candles;
	}

	private async fetchRealTimePrice(symbol: string, assetType: string): Promise<CandleData | null> {
		const query = `
      query GetRealTimePrice($symbol: String!, $assetType: String!) {
        realTimePrice(symbol: $symbol, assetType: $assetType) {
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
    `;

		const variables = { symbol, assetType };

		try {
			const response = await fetch(this.apiUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${localStorage.getItem("token")}`,
				},
				body: JSON.stringify({ query, variables }),
			});

			const result = await response.json();

			if (result.errors) {
				return null;
			}

			return result.data.realTimePrice;
		} catch (_error) {
			return null;
		}
	}

	private startRealtimeUpdates(
		symbolInfo: LibrarySymbolInfo,
		_resolution: ResolutionString,
		callback: SubscribeBarsCallback,
	): void {
		// Poll for real-time updates every 5 seconds
		const interval = setInterval(async () => {
			try {
				const candle = await this.fetchRealTimePrice(symbolInfo.name, symbolInfo.exchange);
				if (candle) {
					const bar = {
						time: new Date(candle.timestamp).getTime(),
						open: candle.open,
						high: candle.high,
						low: candle.low,
						close: candle.close,
						volume: candle.volume || 0,
					};
					callback(bar);
				}
			} catch (_error) {}
		}, 5000);

		// Store interval for cleanup
		(callback as any)._interval = interval;
	}

	private mapResolutionToInterval(resolution: ResolutionString): string {
		const mapping: Record<string, string> = {
			"1": "1m",
			"5": "5m",
			"15": "15m",
			"30": "30m",
			"60": "1h",
			"240": "4h",
			"1D": "1d",
		};
		return mapping[resolution] || "1m";
	}

	private getPopularSymbols(exchange: string) {
		if (exchange === "CRYPTO") {
			return [
				{
					symbol: "BTC/USDT",
					full_name: "Bitcoin/Tether",
					description: "Bitcoin vs Tether",
					exchange: "CRYPTO",
					type: "crypto",
				},
				{
					symbol: "ETH/USDT",
					full_name: "Ethereum/Tether",
					description: "Ethereum vs Tether",
					exchange: "CRYPTO",
					type: "crypto",
				},
				{
					symbol: "BNB/USDT",
					full_name: "Binance Coin/Tether",
					description: "Binance Coin vs Tether",
					exchange: "CRYPTO",
					type: "crypto",
				},
				{
					symbol: "ADA/USDT",
					full_name: "Cardano/Tether",
					description: "Cardano vs Tether",
					exchange: "CRYPTO",
					type: "crypto",
				},
				{
					symbol: "SOL/USDT",
					full_name: "Solana/Tether",
					description: "Solana vs Tether",
					exchange: "CRYPTO",
					type: "crypto",
				},
			];
		} else {
			return [
				{
					symbol: "AAPL",
					full_name: "Apple Inc.",
					description: "Apple Inc.",
					exchange: "STOCK",
					type: "stock",
				},
				{
					symbol: "MSFT",
					full_name: "Microsoft Corporation",
					description: "Microsoft Corporation",
					exchange: "STOCK",
					type: "stock",
				},
				{
					symbol: "GOOGL",
					full_name: "Alphabet Inc.",
					description: "Alphabet Inc.",
					exchange: "STOCK",
					type: "stock",
				},
				{
					symbol: "AMZN",
					full_name: "Amazon.com Inc.",
					description: "Amazon.com Inc.",
					exchange: "STOCK",
					type: "stock",
				},
				{
					symbol: "TSLA",
					full_name: "Tesla Inc.",
					description: "Tesla Inc.",
					exchange: "STOCK",
					type: "stock",
				},
			];
		}
	}
}

export default MarketDataFeed;
