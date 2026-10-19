import type { FxResolution } from "./fx-valuation";

export interface Asset {
	id: string;
	/**
	 * The server's `positions.id` for this holding, when the provider resolved
	 * exactly one. The tax-lots endpoints look the position up by this id, not
	 * by the asset id; absent means unknown, and callers must skip the query
	 * rather than substitute `id`. See PortfolioProvider.resolvePositionId.
	 */
	positionId?: string;
	portfolioId: string;
	symbol: string;
	name: string;
	type: string;
	quantity: number;
	avgCost: number;
	currentPrice: number;
	totalValue: number;
	/**
	 * Unrealized P&L in the display currency, or null when the cost basis
	 * cannot be expressed in it. See fx-valuation.ts: a converted basis uses
	 * the server's valuation sums; the raw basis only when it was already in
	 * the display currency. Never a cross-currency difference.
	 */
	totalReturn: number | null;
	totalReturnPercentage: number;
	dayChangePercentage: number;
	/**
	 * Whether the provider actually supplied a day-change figure. A missing
	 * metric is not a flat session: surfaces must hide the delta rather than
	 * print $0.00. Mirrors the holdings table's `hasDayChange`.
	 */
	hasDayChange: boolean;
	account: string;
	sector: string;
	currency: string;
	/**
	 * Whether the server can back a percentage return for this position, and
	 * why not when it cannot. Resolved from `PositionValuation`; never guessed
	 * from a currency comparison. Callers must present a P&L percentage only
	 * when `fx.canShowPercentage` is true. See fx-valuation.ts.
	 */
	fx: FxResolution;
	portfolioWeight: number;
	/**
	 * Instrument-level reference metrics, all nullable: null means the data
	 * provider has not supplied the figure. Never default them on read.
	 */
	expenseRatio?: number;
	dividendYield?: number;
	peRatio?: number;
	sparklineData: number[];
}

export interface TargetAllocation {
	sector: string;
	targetPercentage: number;
}
