/**
 * Deterministic money rounding for portfolio display.
 *
 * Two problems this solves, both of which produced visibly wrong numbers in the
 * Stocks & Funds module:
 *
 * 1. Float aggregation drift. Summing floats such as 0.1 + 0.2 leaves the total
 *    off by ~1e-16, which then shows up as a total that does not match the sum of
 *    the rows above it. Summing in integer minor units (cents) removes it.
 *
 * 2. Percentages that do not add up. Independent `(value / total) * 100`
 *    calculations round individually, so a 3-way split lands on 99.98% or
 *    100.02% - the donut and the legend visibly disagree. The Hamilton
 *    (largest-remainder) method distributes the rounding error to the entries
 *    with the largest discarded fraction, so the parts always sum to exactly
 *    100% while staying as close as possible to the true values.
 *
 * Both functions are pure and total: they never throw, never return NaN, and
 * preserve input order and length.
 */

/** Number of minor units in one major unit for a given decimal precision. */
export function minorUnitScale(decimals: number): number {
	const safe = Number.isInteger(decimals) && decimals >= 0 ? decimals : 2;
	return 10 ** safe;
}

/**
 * Convert a major-unit amount to integer minor units (cents for decimals = 2).
 *
 * Non-finite input becomes 0 rather than NaN propagating through a total.
 */
export function toMinorUnits(amount: number, decimals = 2): number {
	if (typeof amount !== "number" || !Number.isFinite(amount)) return 0;
	const scale = minorUnitScale(decimals);
	const scaled = amount * scale;

	// A binary value like 1.005 is stored as 1.00499999999999989, so scaling it
	// gives 100.49999999999999 and a bare Math.round yields 100 instead of the
	// 101 that half-up rounding of 1.005 is supposed to give. Nudging by a
	// proportional epsilon - many orders of magnitude below any precision that
	// matters - corrects the representation error without disturbing values that
	// are genuinely below the midpoint.
	const nudge = Number.EPSILON * Math.abs(scaled) * 2;
	return Math.round(scaled + Math.sign(scaled) * nudge);
}

/** Convert integer minor units back to a major-unit amount. */
export function fromMinorUnits(minor: number, decimals = 2): number {
	if (typeof minor !== "number" || !Number.isFinite(minor)) return 0;
	return minor / minorUnitScale(decimals);
}

/**
 * Sum amounts in integer minor units, then convert back.
 *
 * Cheaper and more accurate than `values.reduce((a, b) => a + b, 0)` for money:
 * every partial sum is an exact integer.
 */
export function sumMoney(values: ArrayLike<number>, decimals = 2): number {
	let total = 0;
	for (let i = 0; i < values.length; i += 1) {
		total += toMinorUnits(values[i], decimals);
	}
	return fromMinorUnits(total, decimals);
}

/**
 * Apportion `target` across `weights` using the largest-remainder method.
 *
 * Results are exact in units of 10^-`decimals` and sum to exactly `target`.
 * Ties are broken by ascending index, so the output is deterministic for a given
 * input ordering - important because these feed sorted tables and chart legends
 * where a wobbling last digit looks like a bug.
 *
 * @param target the total to distribute (100 for percentages, a money amount
 *               when splitting a balance). It is NOT the sum of the weights.
 */
function allocateByLargestRemainder(weights: number[], target: number, decimals: number): number[] {
	const scale = minorUnitScale(decimals);
	const targetUnits = Math.round(target * scale);

	const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
	if (weightSum <= 0) return new Array<number>(weights.length).fill(0);

	const exact = weights.map((weight) => (weight > 0 ? (weight / weightSum) * targetUnits : 0));
	const floored = exact.map((value) => Math.floor(value));

	let remainder = targetUnits - floored.reduce((sum, value) => sum + value, 0);
	if (remainder <= 0) {
		return floored.map((value) => value / scale);
	}

	// Largest fractional part first; index breaks ties deterministically.
	const order = exact
		.map((value, index) => ({ index, fraction: value - Math.floor(value) }))
		.sort((a, b) => b.fraction - a.fraction || a.index - b.index);

	for (let i = 0; i < order.length && remainder > 0; i += 1, remainder -= 1) {
		floored[order[i].index] += 1;
	}

	return floored.map((value) => value / scale);
}

/**
 * Express each value as a percentage of the total, such that the returned
 * percentages sum to exactly 100.
 *
 * Non-finite, negative and zero-total inputs yield zeros rather than NaN, so a
 * partially-loaded portfolio never renders "NaN%" in a legend.
 */
export function allocatePercentages(values: ArrayLike<number>, decimals = 2): number[] {
	const count = values.length;
	const sanitized = new Array<number>(count);

	for (let i = 0; i < count; i += 1) {
		const value = values[i];
		sanitized[i] = typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
	}

	return allocateByLargestRemainder(sanitized, 100, decimals);
}

/**
 * Largest-remainder apportionment of a whole amount across weighted parts.
 * Used where a currency total must be split without losing or inventing cents.
 */
export function allocateAmount(values: ArrayLike<number>, total: number, decimals = 2): number[] {
	const count = values.length;
	if (count === 0) return [];

	if (!Number.isFinite(total) || total <= 0) {
		return new Array<number>(count).fill(0);
	}

	return allocateByLargestRemainder(
		Array.from({ length: count }, (_, i) => {
			const value = values[i];
			return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
		}),
		total,
		decimals,
	);
}
