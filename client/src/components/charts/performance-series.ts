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
	if (range === "YTD") {
		const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
		const totalMs = now.getTime() - startOfYear;
		return new Date(startOfYear + (totalMs * index) / Math.max(1, points - 1));
	}
	if (range === "1Y") {
		const startOfYearAgo = new Date(now).setFullYear(now.getFullYear() - 1);
		const totalMs = now.getTime() - startOfYearAgo;
		return new Date(startOfYearAgo + (totalMs * index) / Math.max(1, points - 1));
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

export function computeFallbackSparkline(
	currentPrice: number,
	dayChangePercent: number,
	timeRange?: TimeRange,
): number[] {
	if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
		return [0, 0, 0, 0, 0, 0, 0];
	}

	const points = 7;
	const rangeScale =
		timeRange === "1D"
			? 1
			: timeRange === "7D"
				? 2
				: timeRange === "1M"
					? 3.5
					: timeRange === "3M"
						? 6
						: timeRange === "YTD"
							? 8
							: timeRange === "1Y"
								? 10
								: timeRange === "ALL"
									? 12
									: 1;

	const effectiveChange = (dayChangePercent || 0) * (rangeScale > 1 ? Math.sqrt(rangeScale) : 1);
	const startPrice = currentPrice / (1 + effectiveChange / 100);
	const drift = currentPrice - startPrice;
	const volatility =
		Math.max(Math.abs(effectiveChange) / 100, 0.005 * Math.sqrt(rangeScale)) *
		Math.max(currentPrice, startPrice);
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
				: computeFallbackSparkline(holding.currentPrice, holding.changePercent, timeRange);

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

export function hasSufficientBackendData(
	backendSeries: PerformancePoint[],
	timeRange: TimeRange,
): boolean {
	if (backendSeries.length < 2) return false;
	if (timeRange === "1D") return false;

	const first = backendSeries[0].date.getTime();
	const last = backendSeries[backendSeries.length - 1].date.getTime();
	const spanDays = Math.max(0, (last - first) / (1000 * 60 * 60 * 24));

	switch (timeRange) {
		case "7D":
			return spanDays >= 3 && backendSeries.length >= 3;
		case "1M":
			return spanDays >= 14 && backendSeries.length >= 7;
		case "3M":
			return spanDays >= 45 && backendSeries.length >= 15;
		case "YTD":
			return spanDays >= 20 && backendSeries.length >= 10;
		case "1Y":
			return spanDays >= 120 && backendSeries.length >= 25;
		case "ALL":
			return spanDays >= 7 && backendSeries.length >= 5;
		default:
			return backendSeries.length >= 2;
	}
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
	const sufficient = hasSufficientBackendData(backendSeries, timeRange);

	if (!sufficient) {
		if (holdings && holdings.length > 0) {
			return buildMarketSynthesizedSeries({
				holdings,
				totalValue,
				timeRange,
				now,
			});
		}
	} else {
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
