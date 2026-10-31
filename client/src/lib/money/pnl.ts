/**
 * Shared profit-and-loss arithmetic for portfolio positions.
 *
 * Why this exists: the crypto and stocks modules each grew their own version of
 * "value minus cost basis", and they disagreed about the one case that matters.
 * When a position has no recorded purchase price, its cost basis is 0 — and
 * subtracting 0 from its market value reports the *entire holding* as profit.
 * A portfolio with a few imported positions therefore showed a large gain that
 * no transaction ever produced.
 *
 * The rule enforced here: a missing cost basis is an unknown, not a zero. Cost
 * basis is only usable when it is strictly positive, and a portfolio-wide figure
 * is only stated when enough of the portfolio's value is actually covered by
 * known cost bases. Below that threshold the total is withheld (null) rather
 * than shown next to figures it does not describe.
 *
 * Everything is pure and total: no throwing, no NaN, no negative-zero surprises
 * leaking into a currency formatter.
 */

/** A position reduced to the two amounts P&L needs, both in one currency. */
export interface PnlPositionInput {
	/** Current market value of the holding. */
	value: number;
	/**
	 * Cost basis of the holding (average purchase price × quantity).
	 * Zero or non-finite means "not recorded"; it is never read as free money.
	 */
	cost: number;
}

export interface PositionPnl {
	/** False when no usable cost basis exists, so P&L is genuinely unknowable. */
	hasCostBasis: boolean;
	value: number;
	cost: number;
	/** null when unknown — never 0, which would render as "flat". */
	pnl: number | null;
	/** null when unknown or when the basis is zero. */
	pnlPercent: number | null;
}

export interface PortfolioPnl {
	/** Sum of every position's market value, covered or not. */
	totalValue: number;
	/** Market value of the positions whose cost basis is known. */
	coveredValue: number;
	/** Cost basis of those same positions. */
	coveredCost: number;
	/** Gain on the covered subset; null unless the total is reliable. */
	pnl: number | null;
	pnlPercent: number | null;
	/** coveredValue / totalValue in 0..1. Zero when there is no value. */
	coverageRatio: number;
	/** Whether `pnl` describes the whole portfolio well enough to be shown. */
	isReliable: boolean;
	/** Positions with market value but no recorded cost basis. */
	missingCostBasisCount: number;
}

/**
 * Fraction of portfolio value that must carry a known cost basis before a
 * portfolio-wide gain is displayed.
 *
 * At 95%, five positions out of a hundred may be unpriced before the headline
 * is withheld. Lower thresholds were tried and produced numbers that silently
 * excluded a meaningful slice of the portfolio.
 */
export const MIN_COST_COVERAGE = 0.95;

function toFinite(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * P&L for a single position.
 *
 * A zero (or negative, or non-finite) cost basis is treated as unknown: the
 * position has a value but no measurable gain, which is a different statement
 * from "it gained its whole value".
 */
export function computePositionPnl(value: unknown, cost: unknown): PositionPnl {
	const safeValue = toFinite(value);
	const safeCost = toFinite(cost);
	const hasCostBasis = safeCost > 0;

	if (!hasCostBasis) {
		return { hasCostBasis: false, value: safeValue, cost: 0, pnl: null, pnlPercent: null };
	}

	const pnl = safeValue - safeCost;
	return {
		hasCostBasis: true,
		value: safeValue,
		cost: safeCost,
		pnl,
		pnlPercent: (pnl / safeCost) * 100,
	};
}

/**
 * Portfolio-level P&L across `positions`.
 *
 * The gain is computed only over positions with a known cost basis, so an
 * unpriced holding can never inflate it. `coverageRatio` reports how much of
 * the portfolio that subset represents, and `pnl` stays null unless coverage
 * clears `minCoverage`.
 *
 * A position worth nothing but carrying a cost basis (a total loss) still
 * counts as covered: its negative gain is real and belongs in the total. It
 * does, however, lower the coverage ratio, which is correct — its value no
 * longer contributes to the denominator's covered share.
 */
export function computePortfolioPnl(
	positions: ArrayLike<PnlPositionInput>,
	options: { minCoverage?: number } = {},
): PortfolioPnl {
	const minCoverage =
		typeof options.minCoverage === "number" && Number.isFinite(options.minCoverage)
			? options.minCoverage
			: MIN_COST_COVERAGE;

	let totalValue = 0;
	let coveredValue = 0;
	let coveredCost = 0;
	let missingCostBasisCount = 0;

	for (let i = 0; i < positions.length; i += 1) {
		const raw = positions[i];
		if (!raw) continue;
		const value = toFinite(raw.value);
		const cost = toFinite(raw.cost);

		// A position carrying neither value nor cost is not a holding; skip it
		// so an empty placeholder cannot drag the coverage ratio down.
		if (value === 0 && cost === 0) continue;

		totalValue += value;

		if (cost > 0) {
			coveredValue += value;
			coveredCost += cost;
		} else if (value > 0) {
			missingCostBasisCount += 1;
		}
	}

	const coverageRatio = totalValue > 0 ? coveredValue / totalValue : 0;
	const isReliable = coveredCost > 0 && coverageRatio >= minCoverage;
	const coveredPnl = coveredValue - coveredCost;

	return {
		totalValue,
		coveredValue,
		coveredCost,
		pnl: isReliable ? coveredPnl : null,
		pnlPercent: isReliable ? (coveredPnl / coveredCost) * 100 : null,
		coverageRatio,
		isReliable,
		missingCostBasisCount,
	};
}
