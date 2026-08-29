import { useQuery } from "@apollo/client";
import { useMemo } from "react";
import type { SearchInstrumentsQuery, SearchInstrumentsQueryVariables } from "@/gql/graphql";
import { InstrumentAssetType } from "@/gql/graphql";
import { SEARCH_INSTRUMENTS } from "@/graphql/queries/instruments";

export type BenchmarkMode = "none" | "sp500" | "nasdaq" | "btc";

interface BenchmarkSymbolSpec {
	symbol: string;
	assetTypes: InstrumentAssetType[];
	/** Fallback symbol + types to try if the primary search returns nothing. */
	fallback?: { symbol: string; assetTypes: InstrumentAssetType[] };
}

/**
 * Maps each benchmark mode to a well-known symbol + asset types to search.
 * The hook resolves these to actual instrument UUIDs at runtime
 * via the GraphQL `searchInstruments` query, so the IDs adapt to
 * whatever instruments are seeded in the current environment.
 *
 * Primary search uses the actual index symbol (preferred when available).
 * Fallback uses the ETF proxy (SPY/QQQ) which reliably exists.
 */
export const BENCHMARK_SYMBOLS: Record<Exclude<BenchmarkMode, "none">, BenchmarkSymbolSpec> = {
	sp500: {
		symbol: "SPY",
		assetTypes: [
			InstrumentAssetType.Etf,
			InstrumentAssetType.Index,
			InstrumentAssetType.Fund,
			InstrumentAssetType.Stock,
		],
		fallback: {
			symbol: "^GSPC",
			assetTypes: [
				InstrumentAssetType.Index,
				InstrumentAssetType.Etf,
				InstrumentAssetType.Fund,
				InstrumentAssetType.Stock,
			],
		},
	},
	nasdaq: {
		symbol: "QQQ",
		assetTypes: [
			InstrumentAssetType.Etf,
			InstrumentAssetType.Index,
			InstrumentAssetType.Fund,
			InstrumentAssetType.Stock,
		],
		fallback: {
			symbol: "^NDX",
			assetTypes: [
				InstrumentAssetType.Index,
				InstrumentAssetType.Etf,
				InstrumentAssetType.Fund,
				InstrumentAssetType.Stock,
			],
		},
	},
	btc: {
		symbol: "BTC",
		assetTypes: [
			InstrumentAssetType.Crypto,
			InstrumentAssetType.Currency,
			InstrumentAssetType.Stock,
			InstrumentAssetType.Fund,
		],
		fallback: {
			symbol: "BTC-USD",
			assetTypes: [
				InstrumentAssetType.Crypto,
				InstrumentAssetType.Currency,
				InstrumentAssetType.Stock,
				InstrumentAssetType.Fund,
			],
		},
	},
};

const BENCHMARK_SEARCH_LIMIT = 20;

/** Build query variables for a benchmark symbol spec. */
function buildSearchVariables(spec: {
	symbol: string;
	assetTypes: InstrumentAssetType[];
}): SearchInstrumentsQueryVariables {
	return {
		input: {
			query: spec.symbol,
			assetTypes: spec.assetTypes,
			limit: BENCHMARK_SEARCH_LIMIT,
			offset: 0,
		},
	};
}

/** Pick the best instrument from search results (exact symbol match and canonical name preferred). */
function pickInstrumentId(
	symbol: string,
	data: SearchInstrumentsQuery | undefined,
): string | undefined {
	if (!data) return undefined;
	const results = data.searchInstruments.localResults;
	if (!results || results.length === 0) return undefined;

	const target = symbol.toUpperCase().replace(/^\^/, "");

	// Prioritize canonical instruments over obscure crypto tokens / derivatives
	const exactMatches = results.filter(
		(r) => r.instrument.symbol.toUpperCase() === symbol.toUpperCase(),
	);

	if (exactMatches.length > 0) {
		// If searching for BTC, prefer "Bitcoin" over "Merlin Mainnet", "batcat", etc.
		if (target === "BTC") {
			const btc = exactMatches.find((r) => r.instrument.name.toLowerCase() === "bitcoin");
			if (btc) return btc.instrument.id;
		}
		// If searching for QQQ, prefer the ETF "Invesco QQQ Trust" over "QQQ Token"
		if (target === "QQQ") {
			const etf = exactMatches.find(
				(r) =>
					r.instrument.assetType === InstrumentAssetType.Etf ||
					r.instrument.name.toLowerCase().includes("invesco"),
			);
			if (etf) return etf.instrument.id;
		}
		// If searching for SPY / ^SPX, prefer ETF or Index over crypto tokens
		if (target === "SPY" || target === "SPX") {
			const canon = exactMatches.find(
				(r) =>
					r.instrument.assetType === InstrumentAssetType.Index ||
					r.instrument.assetType === InstrumentAssetType.Etf ||
					r.instrument.assetType === InstrumentAssetType.Fund,
			);
			if (canon) return canon.instrument.id;
		}
		return exactMatches[0].instrument.id;
	}

	// 2. Base match before exchange suffix or currency pair (e.g. "SPY.US" matches "SPY", "BTC-USD" matches "BTC")
	const baseMatches = results.filter((r) => {
		const s = r.instrument.symbol.toUpperCase().replace(/^\^/, "");
		const prefix = s.split(/[.:\-_/]/)[0];
		return prefix === target || s === target;
	});

	if (baseMatches.length > 0) {
		if (target === "BTC") {
			const btc = baseMatches.find((r) => r.instrument.name.toLowerCase().includes("bitcoin"));
			if (btc) return btc.instrument.id;
		}
		if (target === "QQQ" || target === "NDX") {
			const qqq = baseMatches.find(
				(r) =>
					r.instrument.assetType === InstrumentAssetType.Index ||
					r.instrument.assetType === InstrumentAssetType.Etf ||
					r.instrument.name.toLowerCase().includes("nasdaq") ||
					r.instrument.name.toLowerCase().includes("invesco"),
			);
			if (qqq) return qqq.instrument.id;
		}
		if (target === "SPY" || target === "SPX") {
			const spy = baseMatches.find(
				(r) =>
					r.instrument.assetType === InstrumentAssetType.Index ||
					r.instrument.assetType === InstrumentAssetType.Etf ||
					r.instrument.name.toLowerCase().includes("s&p") ||
					r.instrument.name.toLowerCase().includes("spdr"),
			);
			if (spy) return spy.instrument.id;
		}
		return baseMatches[0].instrument.id;
	}

	return results[0]?.instrument.id;
}

export const KNOWN_BENCHMARK_IDS: Record<Exclude<BenchmarkMode, "none">, string> = {
	sp500: "f6d03dea-1639-4196-8588-55388e95c206", // SPY
	nasdaq: "a9cf548b-3fe5-41b2-81d3-a6ac450c1aa3", // QQQ
	btc: "245a988b-8073-44a1-bb7e-5ecde9c1dad8", // Bitcoin (BTC)
};

export interface BenchmarkInstrumentResult {
	/** Resolved instrument ID, or undefined if not found / still loading. */
	id: string | undefined;
	/** True while the primary or fallback search query is in flight. */
	loading: boolean;
}

/**
 * Resolves a benchmark mode to a database instrument ID.
 *
 * Uses pre-mapped IDs for instant zero-latency benchmark switching,
 * while falling back to runtime GraphQL `searchInstruments` if needed.
 */
export function useBenchmarkInstrumentId(benchmarkMode: BenchmarkMode): BenchmarkInstrumentResult {
	if (benchmarkMode === "none") {
		return { id: undefined, loading: false };
	}

	const knownId = KNOWN_BENCHMARK_IDS[benchmarkMode];
	const spec = BENCHMARK_SYMBOLS[benchmarkMode];

	// Primary search variables (index symbol) — skipped if known ID is already available
	const primaryVariables = useMemo(
		() =>
			spec && !knownId
				? buildSearchVariables({ symbol: spec.symbol, assetTypes: spec.assetTypes })
				: undefined,
		[spec, knownId],
	);

	// Fallback search variables (ETF symbol) — only needed when primary exists and has a fallback
	const fallbackVariables = useMemo(
		() => (spec?.fallback && !knownId ? buildSearchVariables(spec.fallback) : undefined),
		[spec, knownId],
	);

	const { data: primaryData, loading: primaryLoading } = useQuery<
		SearchInstrumentsQuery,
		SearchInstrumentsQueryVariables
	>(SEARCH_INSTRUMENTS, {
		variables: primaryVariables,
		skip: !primaryVariables,
		fetchPolicy: "cache-first",
	});

	// Only fire the fallback query when the primary search completed with no results
	const primaryResult = pickInstrumentId(spec?.symbol ?? "", primaryData);
	const needsFallback = Boolean(spec?.fallback && primaryData && !primaryResult);

	const { data: fallbackData, loading: fallbackLoading } = useQuery<
		SearchInstrumentsQuery,
		SearchInstrumentsQueryVariables
	>(SEARCH_INSTRUMENTS, {
		variables: fallbackVariables,
		skip: !needsFallback,
		fetchPolicy: "cache-first",
	});

	const loading = !knownId && (primaryLoading || needsFallback || fallbackLoading);

	const id = useMemo(() => {
		if (knownId) return knownId;
		if (!spec) return undefined;

		// Primary result takes priority
		if (primaryResult) return primaryResult;

		// Fall back to ETF proxy
		if (spec.fallback) {
			return pickInstrumentId(spec.fallback.symbol, fallbackData);
		}

		return undefined;
	}, [knownId, spec, primaryResult, fallbackData]);

	return { id, loading };
}
