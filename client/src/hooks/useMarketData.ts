import { gql, useQuery } from "@apollo/client";
import { useEffect, useMemo, useState } from "react";

interface MarketDataHookOptions {
	instrumentId?: string;
	symbol?: string;
	assetType?: string;
	interval?: string;
	from?: Date;
	to?: Date;
	preferredProvider?: string;
	autoRefresh?: boolean;
	refreshInterval?: number;
	/** Max candles to fetch. Defaults to 100. Longer timeframes need higher values. */
	limit?: number;
	/** When true, only fetches timestamp+close (no real-time price, no OHLCV metadata).
	    Uses cache-first policy. Ideal for chart components with large date ranges. */
	chartOnly?: boolean;
}

interface MarketDataPoint {
	timestamp: string;
	open: number;
	high: number;
	low: number;
	close: number;
	volume?: number;
}

interface MarketDataState {
	data: MarketDataPoint[];
	currentPrice: number | null;
	loading: boolean;
	error: string | null;
	lastUpdated: Date | null;
	priceTimestamp: Date | null;
	sourceProvider: string | null;
	fallbackUsed: boolean;
}

interface SymbolQueryData {
	candles: MarketDataPoint[];
	realTimePrice: {
		close: number;
		timestamp: string;
	} | null;
}

interface InstrumentQueryData {
	candlesByInstrument: {
		candles: MarketDataPoint[];
		sourceProvider: string;
		fallbackUsed: boolean;
	};
	realTimePriceByInstrument: {
		candle: {
			close: number;
			timestamp: string;
		} | null;
		sourceProvider: string;
		fallbackUsed: boolean;
	} | null;
}

const MARKET_DATA_BY_SYMBOL_QUERY = gql`
  query GetMarketDataBySymbol(
    $symbol: String!
    $assetType: String!
    $interval: String!
    $from: Time!
    $to: Time!
    $limit: Int!
  ) {
    candles(
      symbol: $symbol
      assetType: $assetType
      interval: $interval
      from: $from
      to: $to
      limit: $limit
    ) {
      timestamp
      open
      high
      low
      close
      volume
    }
    realTimePrice(symbol: $symbol, assetType: $assetType) {
      close
      timestamp
    }
  }
`;

const MARKET_DATA_BY_INSTRUMENT_QUERY = gql`
  query GetMarketDataByInstrument(
    $instrumentId: ID!
    $interval: String!
    $from: Time!
    $to: Time!
    $limit: Int!
    $preferredProvider: String
  ) {
    candlesByInstrument(
      instrumentId: $instrumentId
      interval: $interval
      from: $from
      to: $to
      limit: $limit
      preferredProvider: $preferredProvider
    ) {
      sourceProvider
      fallbackUsed
      candles {
        timestamp
        open
        high
        low
        close
        volume
      }
    }
    realTimePriceByInstrument(
      instrumentId: $instrumentId
      preferredProvider: $preferredProvider
    ) {
      sourceProvider
      fallbackUsed
      candle {
        close
        timestamp
      }
    }
  }
`;

// Slim chart-only query: only timestamp+close, no real-time price, no OHLCV metadata.
// Reduces JSON payload ~70% for large candle sets (ALL timeframe with 2000+ candles).
const MARKET_DATA_CHART_QUERY = gql`
  query GetMarketDataChart(
    $instrumentId: ID!
    $interval: String!
    $from: Time!
    $to: Time!
    $limit: Int!
    $preferredProvider: String
  ) {
    candlesByInstrument(
      instrumentId: $instrumentId
      interval: $interval
      from: $from
      to: $to
      limit: $limit
      preferredProvider: $preferredProvider
    ) {
      candles {
        timestamp
        close
      }
    }
  }
`;

export const useMarketData = ({
	instrumentId,
	symbol,
	assetType,
	interval = "1D",
	from,
	to,
	preferredProvider,
	autoRefresh = false,
	refreshInterval = 30000,
	limit = 100,
	chartOnly = false,
}: MarketDataHookOptions) => {
	const useInstrumentPath = Boolean(instrumentId && instrumentId.trim().length > 0);

	// When chartOnly, use the slim query (no real-time price, no OHLCV metadata).
	// For the instrument path, prefer the chart query; for the symbol path, the
	// existing query is kept unchanged (chartOnly is only used by instrument callers).
	const queryDocument = chartOnly
		? MARKET_DATA_CHART_QUERY
		: useInstrumentPath
			? MARKET_DATA_BY_INSTRUMENT_QUERY
			: MARKET_DATA_BY_SYMBOL_QUERY;

	// Stabilize and default 'from' date (default to 30 days ago, rounded to start of day)
	const stableFrom = useMemo(() => {
		if (from) {
			const rounded = new Date(from);
			rounded.setSeconds(0, 0);
			return rounded;
		}
		const date = new Date();
		date.setDate(date.getDate() - 30);
		date.setHours(0, 0, 0, 0);
		return date;
	}, [from ? Math.floor(from.getTime() / 60000) : 0]);

	// Stabilize and default 'to' date (default to now, rounded to nearest minute)
	const stableTo = useMemo(() => {
		if (to) {
			const rounded = new Date(to);
			rounded.setSeconds(0, 0);
			return rounded;
		}
		const date = new Date();
		date.setSeconds(0, 0);
		return date;
	}, [to ? Math.floor(to.getTime() / 60000) : 0]);

	const skipQuery = useMemo(() => {
		// chartOnly always uses the instrument path — skip when no valid instrumentId
		if (chartOnly) {
			return !(instrumentId && instrumentId.trim().length > 0);
		}
		if (useInstrumentPath) {
			return false;
		}
		return !(symbol && symbol.trim().length > 0 && assetType && assetType.trim().length > 0);
	}, [assetType, symbol, useInstrumentPath, chartOnly, instrumentId]);

	const variables = useMemo(() => {
		// chartOnly always uses the instrument path (the slim query is instrument-based)
		if (useInstrumentPath || chartOnly) {
			return {
				instrumentId: instrumentId ?? "",
				interval,
				from: stableFrom,
				to: stableTo,
				limit,
				preferredProvider,
			};
		}

		return {
			symbol: symbol ?? "",
			assetType: assetType ?? "",
			interval,
			from: stableFrom,
			to: stableTo,
			limit,
		};
	}, [
		assetType,
		stableFrom,
		instrumentId,
		interval,
		limit,
		preferredProvider,
		symbol,
		stableTo,
		useInstrumentPath,
	]);

	const { data, loading, error, refetch } = useQuery<SymbolQueryData | InstrumentQueryData>(
		queryDocument,
		{
			variables,
			skip: skipQuery,
			pollInterval: autoRefresh ? refreshInterval : 0,
			fetchPolicy: chartOnly ? "cache-first" : "network-only",
		},
	);

	const state = useMemo(() => {
		if (skipQuery) {
			return {
				data: [],
				currentPrice: null,
				loading: false,
				error: "Instrument selection is required",
				lastUpdated: null,
				priceTimestamp: null,
				sourceProvider: null,
				fallbackUsed: false,
			};
		}

		if (error) {
			return {
				data: [],
				currentPrice: null,
				loading: false,
				error: error.message || "Failed to load market data",
				lastUpdated: null,
				priceTimestamp: null,
				sourceProvider: null,
				fallbackUsed: false,
			};
		}

		if (!data) {
			return {
				data: [],
				currentPrice: null,
				loading: loading,
				error: loading ? null : "No market data available",
				lastUpdated: null,
				priceTimestamp: null,
				sourceProvider: null,
				fallbackUsed: false,
			};
		}

		if (chartOnly) {
			// Chart-only path: slim response with only candles (timestamp + close).
			// No real-time price, sourceProvider, or fallbackUsed metadata.
			const chartData = data as { candlesByInstrument: { candles: MarketDataPoint[] } };
			const candles = chartData.candlesByInstrument?.candles ?? [];
			return {
				data: candles,
				currentPrice: null,
				loading: loading,
				error: null,
				lastUpdated: new Date(),
				priceTimestamp: null,
				sourceProvider: null,
				fallbackUsed: false,
			};
		}

		if (useInstrumentPath) {
			const instrumentData = data as InstrumentQueryData;
			const candles = instrumentData.candlesByInstrument?.candles ?? [];
			const realTime = instrumentData.realTimePriceByInstrument?.candle ?? null;
			const sourceProvider =
				instrumentData.realTimePriceByInstrument?.sourceProvider ??
				instrumentData.candlesByInstrument?.sourceProvider ??
				null;
			const fallbackUsed =
				instrumentData.realTimePriceByInstrument?.fallbackUsed ??
				instrumentData.candlesByInstrument?.fallbackUsed ??
				false;

			return {
				data: candles,
				currentPrice: realTime?.close ?? null,
				loading: loading,
				error: null,
				lastUpdated: new Date(),
				priceTimestamp: realTime?.timestamp ? new Date(realTime.timestamp) : null,
				sourceProvider,
				fallbackUsed,
			};
		}

		const symbolData = data as SymbolQueryData;
		const realTime = symbolData.realTimePrice;
		return {
			data: symbolData.candles ?? [],
			currentPrice: realTime?.close ?? null,
			loading: loading,
			error: null,
			lastUpdated: new Date(),
			priceTimestamp: realTime?.timestamp ? new Date(realTime.timestamp) : null,
			sourceProvider: null,
			fallbackUsed: false,
		};
	}, [data, error, loading, skipQuery, useInstrumentPath]);

	return {
		...state,
		refetch,
	};
};
