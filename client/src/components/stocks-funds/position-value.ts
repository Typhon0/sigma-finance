/**
 * Single source of truth for how a position's market value is derived.
 *
 * The Stocks & Funds header and the holdings table previously each had their
 * own copy of this logic, and they disagreed: the module only fell back to
 * `unitPrice * quantity` when `currentValue` was null/undefined/NaN, while the
 * table also fell back when it was `0`. A freshly added position whose price
 * fetch had not landed yet therefore read $0 in the header and its real value
 * in the table footer, and every weight percentage was computed against a
 * different denominator.
 *
 * `currentValue === 0` means "not priced yet", not "worth nothing", so the
 * fallback must trigger on any non-positive server value.
 */

export interface ResolvedPositionValue {
	/** Position value in portfolio currency. Zero when it cannot be resolved. */
	value: number;
	/** True when the value came from the server's `currentValue`. */
	isServerValued: boolean;
	/** True when we derived the value from unit price rather than a server total. */
	isDerived: boolean;
	/** True when neither a usable total nor a usable price is available. */
	isUnpriced: boolean;
}

function toFinite(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Resolve a position's value from whatever the API returned.
 *
 * Never throws and never returns NaN, so callers can sum the results directly.
 */
export function resolvePositionValue(
	currentValue: unknown,
	currentPrice: unknown,
	quantity: unknown,
): ResolvedPositionValue {
	const qty = toFinite(quantity);
	const price = toFinite(currentPrice);
	const serverValue = toFinite(currentValue);

	if (serverValue !== null && serverValue > 0) {
		return { value: serverValue, isServerValued: true, isDerived: false, isUnpriced: false };
	}

	const derived = (price ?? 0) * (qty ?? 0);
	if (derived > 0) {
		return { value: derived, isServerValued: false, isDerived: true, isUnpriced: false };
	}

	return { value: 0, isServerValued: false, isDerived: false, isUnpriced: true };
}

/** Anything that can carry the three inputs needed to value a position. */
export interface ValuablePosition {
	currentValue?: unknown;
	currentPrice?: unknown;
	quantity?: unknown;
}

/**
 * Sum the resolved values of a set of positions. Used for every portfolio
 * total and weight denominator so they share one basis.
 *
 * The input fields are optional because the GraphQL-backed asset shapes declare
 * them that way; `resolvePositionValue` already tolerates missing/NaN values.
 */
export function sumPositionValues(positions: Array<ValuablePosition>): number {
	let sum = 0;
	for (const position of positions) {
		sum += resolvePositionValue(
			position.currentValue,
			position.currentPrice,
			position.quantity,
		).value;
	}
	return sum;
}
