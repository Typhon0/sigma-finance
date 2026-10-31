import type { PerformancePoint, TimeRange } from "./PortfolioHeroChart";

export interface CurveHoldingInput {
	value: number;
	currentPrice: number;
	changePercent: number;
	sparklineData?: number[];
}

export function getHistoryPointCount(range: TimeRange): number {
	if (range === "1D") return 24;
	if (range === "7D") return 7;
	if (range === "1M") return 30;
	if (range === "3M") return 45;
	if (range === "YTD") return 50;
	if (range === "1Y") return 52;
	return 104; // "ALL"
}

export function buildHistoryDate(now: Date, range: TimeRange, points: number, index: number): Date {
	const date = new Date(now.getTime());
	if (range === "1D") {
		date.setHours(now.getHours() - (points - 1 - index));
		return date;
	}
	date.setDate(now.getDate() - (points - 1 - index));
	return date;
}

export function resampleSeries(data: number[], targetPoints: number): number[] {
	if (targetPoints <= 0) return [];
	if (data.length === 0) return Array.from({ length: targetPoints }, () => 1);
	if (data.length === 1) return Array.from({ length: targetPoints }, () => data[0]);
	if (data.length === targetPoints) return data;

	return Array.from({ length: targetPoints }, (_, index) => {
		const position = (index / (targetPoints - 1)) * (data.length - 1);
		const lower = Math.floor(position);
		const upper = Math.min(data.length - 1, Math.ceil(position));
		const ratio = position - lower;
		const lowerValue = data[lower];
		const upperValue = data[upper];
		return lowerValue + (upperValue - lowerValue) * ratio;
	});
}

export function computeFallbackSparkline(currentPrice: number, dayChangePercent: number): number[] {
	if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
		return [0, 0, 0, 0, 0, 0, 0];
	}

	const points = 7;
	const startPrice = currentPrice / (1 + (dayChangePercent || 0) / 100);
	const drift = currentPrice - startPrice;
	const volatility =
		Math.max(Math.abs(dayChangePercent || 0) / 100, 0.005) * Math.max(currentPrice, startPrice);
	const seed = (Math.round(currentPrice * 100) % 37) / 37;
	const phaseA = seed * Math.PI * 2;
	const phaseB = seed * Math.PI;

	const series = Array.from({ length: points }, (_, index) => {
		const progress = points > 1 ? index / (points - 1) : 1;
		const baseline = startPrice + drift * progress;
		const waveA = Math.sin(progress * Math.PI * 1.8 + phaseA) * volatility * 0.25;
		const waveB = Math.sin(progress * Math.PI * 3.2 + phaseB) * volatility * 0.12;
		return Math.max(0, baseline + waveA + waveB);
	});

	series[0] = startPrice;
	series[series.length - 1] = currentPrice;
	return series.map((value) => Number(value.toFixed(4)));
}

export function buildMarketSynthesizedSeries({
	holdings,
	totalValue,
	timeRange,
	now = new Date(),
}: {
	holdings: CurveHoldingInput[];
	totalValue: number;
	timeRange: TimeRange;
	now?: Date;
}): PerformancePoint[] {
	const points = getHistoryPointCount(timeRange);

	const validHoldings = (holdings || []).filter((h) => Number.isFinite(h.value) && h.value > 0);

	if (validHoldings.length === 0 || totalValue <= 0) {
		return Array.from({ length: points }, (_, index) => ({
			date: buildHistoryDate(now, timeRange, points, index),
			portfolioValue: totalValue,
			benchmarkValue: totalValue,
		}));
	}

	const weightedSeries = validHoldings.map((holding) => {
		const source =
			holding.sparklineData && holding.sparklineData.length >= 2
				? holding.sparklineData
				: computeFallbackSparkline(holding.currentPrice, holding.changePercent);

		const sampled = resampleSeries(
			source.map((v) => (Number.isFinite(v) && v > 0 ? v : 1)),
			points,
		);

		const last = sampled[sampled.length - 1] || 1;
		return {
			weight: holding.value,
			normalized: sampled.map((v) => v / last),
		};
	});

	const totalWeight = weightedSeries.reduce((sum, row) => sum + row.weight, 0);

	const history: PerformancePoint[] = Array.from({ length: points }, (_, index) => {
		const blendedRatio =
			totalWeight > 0
				? weightedSeries.reduce((sum, row) => sum + row.weight * row.normalized[index], 0) /
					totalWeight
				: 1;

		const value = Math.max(0, Number((totalValue * blendedRatio).toFixed(2)));
		return {
			date: buildHistoryDate(now, timeRange, points, index),
			portfolioValue: value,
			benchmarkValue: value,
		};
	});

	// Anchor exact right edge to totalValue at now
	history[history.length - 1] = {
		date: now,
		portfolioValue: totalValue,
		benchmarkValue: totalValue,
	};

	return history;
}

export function resolveHybridPerformanceSeries({
	backendSeries,
	holdings,
	totalValue,
	timeRange,
	now = new Date(),
}: {
	backendSeries: PerformancePoint[];
	holdings?: CurveHoldingInput[];
	totalValue: number;
	timeRange: TimeRange;
	now?: Date;
}): PerformancePoint[] {
	// For 1D or when backendSeries has fewer than 2 valid points, synthesize market curve
	const isShortInterval = timeRange === "1D";
	const hasSufficientBackendData = backendSeries.length >= 2;

	if (!hasSufficientBackendData || (isShortInterval && holdings && holdings.length > 0)) {
		if (holdings && holdings.length > 0) {
			return buildMarketSynthesizedSeries({
				holdings,
				totalValue,
				timeRange,
				now,
			});
		}
	}

	if (hasSufficientBackendData) {
		// Ensure tail connects cleanly to totalValue at now if latest point is earlier than today
		const result = [...backendSeries];
		const last = result[result.length - 1];
		if (Math.abs(last.portfolioValue - totalValue) > 0.01 && now.getTime() > last.date.getTime()) {
			result.push({
				date: now,
				portfolioValue: totalValue,
				benchmarkValue: totalValue,
			});
		}
		return result;
	}

	// Ultimate fallback if no holdings or backend points
	return buildMarketSynthesizedSeries({
		holdings: [],
		totalValue,
		timeRange,
		now,
	});
}
