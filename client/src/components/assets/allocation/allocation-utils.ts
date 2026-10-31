import { getChartColors, getChartThemeColors } from "@/lib/chart-colors";
import { allocatePercentages } from "@/lib/money/rounding";
import type { AllocationSlice } from "./types";

/** Slices shown before the remainder collapses into an "Others" bucket. */
export const MAX_ALLOCATION_SLICES = 5;

export interface AllocationEntry {
	name: string;
	value: number;
	count?: number;
}

export interface BuildAllocationSlicesOptions {
	/** Override the color for a slice; return undefined to fall back to the theme series. */
	colorFor?: (name: string, index: number) => string | undefined;
	seriesColors?: string[];
	othersColor?: string;
	maxVisible?: number;
}

/**
 * Rank entries by value, apportion percentages with the largest-remainder
 * method (so parts sum to exactly 100), and collapse the tail into "Others".
 *
 * Pure and total: empty input yields no slices, never NaN.
 */
export function buildAllocationSlices(
	entries: AllocationEntry[],
	options: BuildAllocationSlicesOptions = {},
): AllocationSlice[] {
	if (entries.length === 0) return [];

	const {
		seriesColors = getChartColors(),
		othersColor = getChartThemeColors().mutedForeground,
		maxVisible = MAX_ALLOCATION_SLICES,
		colorFor,
	} = options;

	const sorted = [...entries].sort((a, b) => b.value - a.value);
	const allPercents = allocatePercentages(sorted.map((entry) => entry.value));
	const resolveColor = (name: string, index: number): string =>
		colorFor?.(name, index) ?? seriesColors[index % seriesColors.length];

	if (sorted.length > maxVisible) {
		const top = sorted.slice(0, maxVisible).map((entry, idx) => ({
			name: entry.name,
			value: entry.value,
			count: entry.count,
			percent: allPercents[idx],
			color: resolveColor(entry.name, idx),
			isOthers: false,
		}));
		const rest = sorted.slice(maxVisible);
		const restValue = rest.reduce((sum, entry) => sum + entry.value, 0);
		if (restValue > 0) {
			top.push({
				name: "Others",
				value: restValue,
				count: rest.reduce((sum, entry) => sum + (entry.count ?? 1), 0),
				percent: allPercents.slice(maxVisible).reduce((sum, percent) => sum + percent, 0),
				color: othersColor,
				isOthers: true,
			});
		}
		return top;
	}

	return sorted.map((entry, idx) => ({
		name: entry.name,
		value: entry.value,
		count: entry.count,
		percent: allPercents[idx],
		color: resolveColor(entry.name, idx),
		isOthers: false,
	}));
}

/**
 * Categorical series colors for allocation charts, resolved from the theme's
 * chart tokens. Resolved at call time because ECharts needs concrete color
 * strings and cannot resolve CSS custom properties.
 */
export function getAllocationChartColors(): { series: string[]; others: string } {
	return {
		series: getChartColors(),
		others: getChartThemeColors().mutedForeground,
	};
}
