/**
 * Day-change arithmetic.
 *
 * `dayChangePercent` is measured from the PREVIOUS close, but the value we hold
 * is the CURRENT value. Computing `value * rate` therefore overstates every
 * gain and understates every loss: a $110 position up 10% actually moved $10
 * (from a $100 close), not $11.
 *
 * The correct delta is `current - previousClose`, which simplifies to
 * `value * r / (1 + r)`.
 */

/**
 * Dollar change for a position given its current value and day-change percent.
 * Returns 0 when the position lost everything or the rate is unusable.
 */
export function computeDayChangeAmount(currentValue: number, dayChangePercent: number): number {
	if (!Number.isFinite(currentValue) || !Number.isFinite(dayChangePercent)) return 0;
	const rate = dayChangePercent / 100;
	// rate === -1 means a total loss; the previous close is undefined.
	if (rate <= -1) return 0;
	return (currentValue * rate) / (1 + rate);
}

/**
 * Back out the previous close from a current price and a day-change percent.
 * Used to seed a sparkline when the API has no intraday series.
 */
export function previousCloseFromDayChange(currentPrice: number, dayChangePercent: number): number {
	if (!Number.isFinite(currentPrice) || !Number.isFinite(dayChangePercent)) return currentPrice;
	const rate = dayChangePercent / 100;
	if (rate <= -1) return currentPrice;
	return currentPrice / (1 + rate);
}
