import { format as formatDateFns } from "date-fns";

/**
 * Shared formatters — one canonical pair per data kind, used by every surface
 * of the Stock Detail sheet (and the tax ledger) so the page renders like one
 * product instead of a patchwork of local Intl calls.
 *
 * Why a separate module instead of extending `lib/utils`: `utils.ts` loads
 * `clsx`/`tailwind-merge` at import time in every component in the app; these
 * date/quantity helpers are only wanted where money or dates are printed.
 */

/**
 * Money, the ledger way: "en-US" grouping, currency code symbol, always two
 * decimals. Deterministic — the same amount in the same currency always
 * renders the same string, wherever it appears on the page.
 */
export function formatMoney(amount: number, currency: string): string {
	if (!Number.isFinite(amount)) {
		return `— ${currency}`;
	}
	try {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency,
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(amount);
	} catch {
		// Unknown currency code: name the code rather than silently printing $.
		return `${amount.toFixed(2)} ${currency}`;
	}
}

/**
 * Dates, one shape everywhere: "Mar 5, 2026" (short month, medium year).
 * The tax ledger already used this shape; quotes and FX badges now match.
 */
export function formatDate(iso: string): string {
	try {
		return formatDateFns(new Date(iso), "MMM d, yyyy");
	} catch {
		return iso.slice(0, 10);
	}
}

/**
 * Quantities, one shape everywhere: whole shares as plain integers;
 * fractional holdings (crypto legs, drip lots) at 4 decimal places.
 */
export function formatQty(value: number): string {
	return value % 1 === 0
		? value.toLocaleString("en-US", { maximumFractionDigits: 0 })
		: value.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}
