import { memo, useMemo, useState } from "react";
import {
	type AllocationSlice,
	AllocationWidget,
	buildAllocationSlices,
	type AllocationFilter as GenericAllocationFilter,
	getAllocationChartColors,
} from "@/components/assets/allocation";
import type { Asset as StockAsset } from "@/components/stocks-funds/types";

/**
 * Cross-filter shared between the allocation widget and the holdings table.
 *
 * Kept as the canonical definition (StocksFundsModule re-exports it) so the
 * existing `mode: "sector" | "asset-class" | "type" | "asset"` contract does
 * not change; the generic widget only sees the string-based equivalent.
 */
export interface InsightFilter {
	mode: "sector" | "asset-class" | "type" | "asset";
	value: string;
	label?: string;
}

export interface StocksDistributionWidgetProps {
	assets: StockAsset[];
	totalValue: number;
	sectorValueMap: Map<string, number>;
	currencyValueMap?: Map<string, number>;
	formatCurrency: (val: number) => string;
	activeFilter?: InsightFilter | null;
	onSetFilter?: (filter: InsightFilter | null) => void;
	onSelectAsset?: (symbol: string) => void;
	/** Renders a layout-stable placeholder instead of the empty state. */
	loading?: boolean;
}

export function getDistributionColors(): { series: string[]; others: string } {
	return getAllocationChartColors();
}

type DistributionMode = "asset" | "sector" | "type";

const MODES = [
	{ id: "asset", label: "By Asset", groupUnit: "Assets" },
	{ id: "sector", label: "By Sector", groupUnit: "Sectors" },
	{ id: "type", label: "By Asset Type", groupUnit: "Types" },
] as const;

function isFundLike(asset: StockAsset): boolean {
	const rawType = asset.type?.toLowerCase() || "stock";
	return (
		rawType === "fund" ||
		asset.name.toLowerCase().includes("etf") ||
		asset.symbol.toLowerCase().includes("etf")
	);
}

function toGenericFilter(filter: InsightFilter): GenericAllocationFilter {
	return { mode: filter.mode, value: filter.value, label: filter.label };
}

function toInsightFilter(filter: GenericAllocationFilter): InsightFilter {
	const mode =
		filter.mode === "sector" ||
		filter.mode === "asset-class" ||
		filter.mode === "type" ||
		filter.mode === "asset"
			? filter.mode
			: "asset";
	return { mode, value: filter.value, label: filter.label };
}

export const StocksDistributionWidget = memo(function StocksDistributionWidget({
	assets,
	totalValue,
	sectorValueMap,
	formatCurrency,
	activeFilter,
	onSetFilter,
	onSelectAsset,
	loading = false,
}: StocksDistributionWidgetProps) {
	const [distributionMode, setDistributionMode] = useState<DistributionMode>("asset");

	// ── Compute Distribution Items ─────────────────────────────────────────
	const distributionItems = useMemo<AllocationSlice[]>(() => {
		if (assets.length === 0 || totalValue <= 0) return [];

		const { series: seriesColors, others: othersColor } = getAllocationChartColors();

		if (distributionMode === "asset") {
			const map = new Map<string, { value: number; count: number }>();
			for (const asset of assets) {
				const key = asset.symbol || asset.name;
				const current = map.get(key) ?? { value: 0, count: 0 };
				map.set(key, {
					value: current.value + asset.totalValue,
					count: current.count + 1,
				});
			}
			return buildAllocationSlices(
				[...map.entries()].map(([name, { value, count }]) => ({ name, value, count })),
				{ seriesColors, othersColor },
			);
		}

		if (distributionMode === "sector") {
			const map = new Map<string, { value: number; count: number }>();
			for (const [sec, val] of sectorValueMap.entries()) {
				const label = !sec || sec === "Needs metadata" || sec === "Unclassified" ? "Other" : sec;
				const current = map.get(label) ?? { value: 0, count: 0 };
				map.set(label, {
					value: current.value + val,
					count: current.count + 1,
				});
			}
			return buildAllocationSlices(
				[...map.entries()].map(([name, { value, count }]) => ({ name, value, count })),
				{ seriesColors, othersColor },
			);
		}

		// distributionMode === "type"
		const map = new Map<string, { value: number; count: number }>();
		for (const asset of assets) {
			const typeLabel = isFundLike(asset) ? "ETF & Funds" : "Individual Stocks";
			const current = map.get(typeLabel) ?? { value: 0, count: 0 };
			map.set(typeLabel, {
				value: current.value + asset.totalValue,
				count: current.count + 1,
			});
		}
		return buildAllocationSlices(
			[...map.entries()].map(([name, { value, count }]) => ({ name, value, count })),
			{ seriesColors, othersColor },
		);
	}, [assets, totalValue, sectorValueMap, distributionMode]);

	return (
		<AllocationWidget
			modes={MODES}
			activeMode={distributionMode}
			onModeChange={(mode) => setDistributionMode(mode as DistributionMode)}
			items={distributionItems}
			totalValue={totalValue}
			formatCurrency={formatCurrency}
			activeFilter={activeFilter ? toGenericFilter(activeFilter) : null}
			toFilter={(item, mode) => {
				if (mode === "type") {
					const filterVal = item.name.includes("ETF") ? "fund" : "stock";
					return { mode, value: filterVal, label: item.name };
				}
				return { mode, value: item.name, label: item.name };
			}}
			isItemActive={(item, mode, filter) => {
				if (!filter) return false;
				if (mode === "type") {
					if (filter.mode !== "type") return false;
					const isFundSlice = item.name.includes("ETF");
					return (
						(isFundSlice && filter.value === "fund") || (!isFundSlice && filter.value === "stock")
					);
				}
				return filter.mode === mode && filter.value === item.name;
			}}
			onFilterChange={(filter) => onSetFilter?.(filter ? toInsightFilter(filter) : null)}
			onSelectItem={(item, mode) => {
				if (mode === "asset") onSelectAsset?.(item.name);
			}}
			loading={loading}
			testId="stocks-distribution-widget"
		/>
	);
});
