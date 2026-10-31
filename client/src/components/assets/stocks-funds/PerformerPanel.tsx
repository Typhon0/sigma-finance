import { useMemo, useState } from "react";
import { TrendArrowDown, TrendArrowUp } from "@/components/TrendArrows";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * One holding, reduced to what a ranking needs. Deliberately narrower than
 * StockAsset so this panel cannot drift into re-deriving portfolio maths.
 */
export interface PerformerAsset {
	id: string;
	symbol: string;
	name: string;
	totalValue: number;
	/** Unrealized P&L in the display currency, or null when unknowable. */
	totalReturn: number | null;
	totalReturnPercentage: number;
	/** False when the server cannot vouch for a return in display currency. */
	canShowPercentage: boolean;
	dayChangePercentage: number;
	hasDayChange: boolean;
}

type PerformerWindow = "today" | "since-purchase";
type PerformerBasis = "amount" | "percent";

interface RankedRow {
	symbol: string;
	name: string;
	amount: number | null;
	percent: number | null;
}

const VISIBLE_ROWS = 4;

const WINDOW_LABELS: Record<PerformerWindow, string> = {
	today: "Today",
	"since-purchase": "Since purchase",
};

const BASIS_LABELS: Record<PerformerBasis, string> = {
	amount: "Amount",
	percent: "Percent",
};

/**
 * The day's move in money, reconstructed from the percentage rather than
 * invented: value_today = value_prev * (1 + r), so the move is
 * value - value / (1 + r). A -100% return has no finite predecessor and is
 * dropped instead of printing Infinity.
 */
function todayAmount(asset: PerformerAsset): number | null {
	if (!asset.dayChangePercentage || asset.dayChangePercentage <= -100) return null;
	if (!Number.isFinite(asset.totalValue)) return null;
	const previous = asset.totalValue / (1 + asset.dayChangePercentage / 100);
	const move = asset.totalValue - previous;
	return Number.isFinite(move) ? move : null;
}

function rankFor(assets: PerformerAsset[], window: PerformerWindow): PerformerAsset[] {
	if (window === "today") return assets.filter((a) => a.hasDayChange);
	return assets.filter((a) => a.totalReturn !== null && a.canShowPercentage);
}

function toRow(asset: PerformerAsset, window: PerformerWindow): RankedRow {
	if (window === "today") {
		return {
			symbol: asset.symbol,
			name: asset.name,
			amount: todayAmount(asset),
			percent: asset.dayChangePercentage,
		};
	}
	return {
		symbol: asset.symbol,
		name: asset.name,
		amount: asset.totalReturn,
		percent: asset.canShowPercentage ? asset.totalReturnPercentage : null,
	};
}

function sortValue(row: RankedRow, basis: PerformerBasis): number {
	return (basis === "amount" ? row.amount : row.percent) ?? 0;
}

export interface PerformerPanelProps {
	assets: PerformerAsset[];
	formatCurrency: (value: number) => string;
	onSelectAsset?: (symbol: string) => void;
	className?: string;
	/** Two rows a side, ticker only: the brief row's height, not a full dashboard. */
	compact?: boolean;
	/**
	 * No card of its own: the page's insight strip owns the surface and the
	 * rules between cells. A card inside a strip is a box inside a box.
	 */
	bare?: boolean;
}

/**
 * Top and bottom performers, both directions at once.
 *
 * Replaces the old "Performance Drivers" card, which capped the two lists at
 * three and two rows, sorted by absolute dollars only, offered no period, and
 * rendered rows that could not be opened. The comparison between the two
 * columns is the insight, so the panel never hides one behind a toggle; the
 * toggle is spent on the axis that actually changes the answer (money vs
 * rate), with the second axis being the window.
 */
export function PerformerPanel({
	assets,
	formatCurrency,
	onSelectAsset,
	className,
	compact = false,
	bare = false,
}: PerformerPanelProps) {
	const [window, setWindow] = useState<PerformerWindow>("today");
	const [basis, setBasis] = useState<PerformerBasis>("percent");

	const { gainers, losers, basisUnavailable } = useMemo(() => {
		const ranked = rankFor(assets, window)
			.map((asset) => toRow(asset, window))
			.filter((row) => (basis === "amount" ? row.amount !== null : row.percent !== null));

		const limit = compact ? 2 : VISIBLE_ROWS;
		const sorted = [...ranked].sort((a, b) => sortValue(b, basis) - sortValue(a, basis));
		const up = sorted.filter((row) => sortValue(row, basis) > 0).slice(0, limit);
		const down = sorted
			.filter((row) => sortValue(row, basis) < 0)
			.slice(-limit)
			.reverse();

		// "Since purchase" percentages are the server's call: without a cost
		// basis in the display currency there is no rate to print, only money.
		const basisUnavailable =
			window === "since-purchase" &&
			basis === "percent" &&
			assets.length > 0 &&
			assets.every((asset) => !asset.canShowPercentage);

		return { gainers: up, losers: down, basisUnavailable };
	}, [assets, window, basis, compact]);

	const visibleGainers = basisUnavailable ? [] : gainers;
	const visibleLosers = basisUnavailable ? [] : losers;
	const isEmpty = visibleGainers.length === 0 && visibleLosers.length === 0;

	const renderRow = (row: RankedRow, index: number) => {
		const value = basis === "amount" ? row.amount : row.percent;
		const isUp = (value ?? 0) >= 0;
		const sign = isUp ? "+" : "";
		const display =
			value === null
				? "—"
				: basis === "amount"
					? `${sign}${formatCurrency(value)}`
					: `${sign}${value.toFixed(2)}%`;

		return (
			<button
				key={row.symbol}
				type="button"
				onClick={() => onSelectAsset?.(row.symbol)}
				className={cn(
					"group flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary touch-target",
					// The strip is a desktop glance; 44px rows there are three times the
					// height a two-line list needs, and phones keep the full target.
					bare && "md:min-h-0 md:py-1",
				)}
				aria-label={`${row.symbol}, ${row.name}, ${display} ${window === "today" ? "today" : "since purchase"}`}
			>
				<span className="w-3 shrink-0 font-mono text-micro tabular-nums text-muted-foreground">
					{index + 1}
				</span>
				<span className="min-w-0 flex-1">
					<span className="block truncate font-mono text-xs font-semibold text-foreground">
						{row.symbol}
					</span>
					{!compact && (
						<span className="block truncate text-micro text-muted-foreground leading-tight">
							{row.name}
						</span>
					)}
				</span>
				<span
					className={cn(
						"flex shrink-0 items-center gap-1 font-mono text-xs font-semibold tabular-nums",
						isUp ? "text-gain" : "text-loss",
					)}
				>
					{isUp ? <TrendArrowUp /> : <TrendArrowDown />}
					{display}
				</span>
			</button>
		);
	};

	const Wrapper = bare ? "div" : Card;

	return (
		<Wrapper
			className={cn(
				"relative flex flex-col justify-between",
				!bare &&
					"overflow-hidden border border-border/40 bg-card/25 rounded-xl transition-colors duration-300 ease-in-out",
				!bare && (compact ? "min-h-[160px] p-3.5" : "min-h-[220px] p-4"),
				className,
			)}
		>
			<div>
				<div
					className={cn(
						"flex flex-wrap items-center justify-between gap-2",
						bare ? "mb-2" : "mb-3",
					)}
				>
					<h3
						className={
							bare ? "text-sm font-semibold text-foreground" : "text-title text-foreground"
						}
					>
						{bare ? "Movers" : "Top & bottom performers"}
					</h3>
					<Segmented
						bare={bare}
						label="Performance window"
						options={(["today", "since-purchase"] as const).map((value) => ({
							value,
							label: WINDOW_LABELS[value],
						}))}
						selected={window}
						onSelect={setWindow}
					/>
				</div>

				{basisUnavailable ? (
					<div className="space-y-1.5 py-4">
						<p className="text-xs text-foreground">No cost basis in the display currency.</p>
						<p className="text-micro text-muted-foreground leading-normal">
							Returns need a purchase price for each holding. Add purchase prices to see winners and
							losers.
						</p>
					</div>
				) : isEmpty ? (
					<p className="py-6 text-center text-xs text-muted-foreground">
						{window === "today"
							? "No priced holdings moved today."
							: "No holding has a cost basis yet."}
					</p>
				) : (
					<div className="grid grid-cols-1 gap-x-6 gap-y-1 md:grid-cols-2">
						<div>
							{!bare && (
								<p className="mb-1 text-micro font-semibold uppercase tracking-wider text-muted-foreground">
									Gainers
								</p>
							)}
							<div className="space-y-0.5">{visibleGainers.map(renderRow)}</div>
						</div>
						<div>
							{!bare && (
								<p className="mb-1 text-micro font-semibold uppercase tracking-wider text-muted-foreground">
									Losers
								</p>
							)}
							<div className="space-y-0.5">
								{visibleLosers.length > 0 ? (
									visibleLosers.map(renderRow)
								) : (
									<p className="px-1.5 py-1.5 text-micro text-muted-foreground">
										Nothing is down in this window.
									</p>
								)}
							</div>
						</div>
					</div>
				)}
			</div>

			<div
				className={cn(
					"mt-2 flex items-center justify-end gap-2",
					!bare && "border-t border-border/30 pt-2",
				)}
			>
				<Segmented
					bare={bare}
					label="Rank by"
					options={(["percent", "amount"] as const).map((value) => ({
						value,
						label: BASIS_LABELS[value],
					}))}
					selected={basis}
					onSelect={setBasis}
				/>
				{!compact && !bare && (
					<span className="text-micro text-muted-foreground">
						{window === "today" ? "Session move" : "Unrealized, per holding"}
					</span>
				)}
			</div>
		</Wrapper>
	);
}

function Segmented<T extends string>({
	label,
	options,
	selected,
	onSelect,
	bare = false,
}: {
	label: string;
	options: Array<{ value: T; label: string }>;
	selected: T;
	onSelect: (value: T) => void;
	bare?: boolean;
}) {
	return (
		<fieldset
			className={cn(
				"flex items-center gap-0.5",
				!bare && "rounded-md border border-border/40 bg-muted/40 p-0.5",
			)}
		>
			<legend className="sr-only">{label}</legend>
			{options.map((option) => (
				<button
					key={option.value}
					type="button"
					aria-pressed={selected === option.value}
					onClick={() => onSelect(option.value)}
					className={cn(
						"cursor-pointer rounded px-2 py-0.5 text-micro font-semibold transition-colors",
						selected === option.value
							? bare
								? "text-foreground underline decoration-foreground/40 underline-offset-4"
								: "bg-background text-foreground"
							: "text-muted-foreground hover:text-foreground",
					)}
				>
					{option.label}
				</button>
			))}
		</fieldset>
	);
}

export default PerformerPanel;
