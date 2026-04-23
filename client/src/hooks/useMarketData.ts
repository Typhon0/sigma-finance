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

const MARKET_DATA_BY_INSTRUMENT_QUERY = gql`
  query GetMarketDataByInstrument(
    $instrumentId: ID!
    $interval: String!
    $from: Time!
    $to: Time!
    $preferredProvider: String
  ) {
    candlesByInstrument(
      instrumentId: $instrumentId
      interval: $interval
      from: $from
      to: $to
      limit: 100
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

export const useMarketData = ({
	instrumentId,
	symbol,
	assetType,
	interval = "1D",
	from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
	to = new Date(),
	preferredProvider,
	autoRefresh = false,
	refreshInterval = 30000,
}: MarketDataHookOptions) => {
	const useInstrumentPath = Boolean(instrumentId && instrumentId.trim().length > 0);

	const skipQuery = useMemo(() => {
		if (useInstrumentPath) {
			return false;
		}
		return !(symbol && symbol.trim().length > 0 && assetType && assetType.trim().length > 0);
	}, [assetType, symbol, useInstrumentPath]);

	const queryDocument = useInstrumentPath
		? MARKET_DATA_BY_INSTRUMENT_QUERY
		: MARKET_DATA_BY_SYMBOL_QUERY;

	const variables = useMemo(() => {
		if (useInstrumentPath) {
			return {
				instrumentId: instrumentId ?? "",
				interval,
				from,
				to,
				preferredProvider,
			};
		}

		return {
			symbol: symbol ?? "",
			assetType: assetType ?? "",
			interval,
			from,
			to,
		};
	}, [assetType, from, instrumentId, interval, preferredProvider, symbol, to, useInstrumentPath]);

	const { data, loading, error, refetch } = useQuery<SymbolQueryData | InstrumentQueryData>(
		queryDocument,
		{
			variables,
			skip: skipQuery,
			pollInterval: autoRefresh ? refreshInterval : 0,
			fetchPolicy: "network-only",
		},
	);

	const [state, setState] = useState<MarketDataState>({
		data: [],
		currentPrice: null,
		loading: true,
		error: null,
		lastUpdated: null,
		priceTimestamp: null,
		sourceProvider: null,
		fallbackUsed: false,
	});

	useEffect(() => {
		if (skipQuery) {
			setState((prev) => ({
				...prev,
				loading: false,
				error: "Instrument selection is required",
			}));
			return;
		}

		if (loading) {
			setState((prev) => ({ ...prev, loading: true, error: null }));
			return;
		}

		if (error) {
			setState((prev) => ({
				...prev,
				loading: false,
				error: error.message || "Failed to load market data",
			}));
			return;
		}

		if (!data) {
			return;
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

			setState({
				data: candles,
				currentPrice: realTime?.close ?? null,
				loading: false,
				error: null,
				lastUpdated: new Date(),
				priceTimestamp: realTime?.timestamp ? new Date(realTime.timestamp) : null,
				sourceProvider,
				fallbackUsed,
			});
			return;
		}

		const symbolData = data as SymbolQueryData;
		const realTime = symbolData.realTimePrice;
		setState({
			data: symbolData.candles ?? [],
			currentPrice: realTime?.close ?? null,
			loading: false,
			error: null,
			lastUpdated: new Date(),
			priceTimestamp: realTime?.timestamp ? new Date(realTime.timestamp) : null,
			sourceProvider: null,
			fallbackUsed: false,
		});
	}, [data, error, loading, skipQuery, useInstrumentPath]);

	return {
		...state,
		refetch,
	};
};
