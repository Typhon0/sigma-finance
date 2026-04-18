import { gql, useQuery } from "@apollo/client";
import { useEffect, useState } from "react";

interface MarketDataHookOptions {
	symbol: string;
	assetType: string;
	interval?: string;
	from?: Date;
	to?: Date;
	autoRefresh?: boolean;
	refreshInterval?: number;
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
	/** The timestamp of the price data from the provider (not fetch time) */
	priceTimestamp: Date | null;
}

const MARKET_DATA_QUERY = gql`
  query GetMarketData(
    $symbol: String!
    $assetType: String!
    $interval: String!
    $from: Time!
    $to: Time!
  ) {
    candles(
      symbol: $symbol
      assetType: $assetType
      interval: $interval
      from: $from
      to: $to
      limit: 100
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

export const useMarketData = ({
	symbol,
	assetType,
	interval = "1D",
	from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
	to = new Date(),
	autoRefresh = false,
	refreshInterval = 30000, // 30 seconds
}: MarketDataHookOptions) => {
	const { data, loading, error, refetch } = useQuery(MARKET_DATA_QUERY, {
		variables: { symbol, assetType, interval, from, to },
		pollInterval: autoRefresh ? refreshInterval : 0,
		fetchPolicy: "network-only",
	});

	const [state, setState] = useState<MarketDataState>({
		data: [],
		currentPrice: null,
		loading: true,
		error: null,
		lastUpdated: null,
		priceTimestamp: null,
	});

	useEffect(() => {
		if (loading) {
			setState((prev) => ({ ...prev, loading: true, error: null }));
			return;
		}

		if (error) {
			console.error("Market data fetch error:", error);
			setState((prev) => ({
				...prev,
				loading: false,
				error: error.message || "Failed to load market data",
			}));
			return;
		}

		if (data) {
			const { candles, realTimePrice } = data;
			// Extract the actual price timestamp from the API response
			const priceTimestamp = realTimePrice?.timestamp
				? new Date(realTimePrice.timestamp)
				: null;
			setState({
				data: candles || [],
				currentPrice: realTimePrice?.close || null,
				loading: false,
				error: null,
				lastUpdated: new Date(), // When we fetched the data
				priceTimestamp, // When the price was actually recorded
			});
		}
	}, [data, loading, error]);

	return {
		...state,
		refetch,
	};
};
