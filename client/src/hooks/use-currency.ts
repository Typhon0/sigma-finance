import { useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { CURRENCY_SYMBOLS, formatCurrency as formatCurrencyUtil } from "@/lib/utils";

/**
 * Hook that provides currency formatting functions bound to the
 * current user's display currency preference.
 *
 * Falls back to USD when no user is logged in or displayCurrency is unset.
 */
export function useCurrency() {
	const { user } = useAuth();
	const currency = user?.displayCurrency || "USD";
	const currencySymbol = CURRENCY_SYMBOLS[currency] ?? "$";

	/**
	 * Format a numeric amount using the user's display currency.
	 * Mirrors the signature of the shared `formatCurrency` utility
	 * A missing amount formats to an em dash: the caller asked for a figure
	 * it does not have, and "$0.00" would read as a measurement it isn't.
	 * Callers that want zero must pass the number 0.
	 */
	const formatCurrency = useCallback(
		(amount: number | null | undefined): string => {
			if (amount === null || amount === undefined) {
				return "—";
			}
			return formatCurrencyUtil(amount, currency);
		},
		[currency],
	);

	/**
	 * Format with custom fraction digits (useful for large values in charts).
	 */
	const formatCurrencyCompact = useCallback(
		(
			amount: number | null | undefined,
			minimumFractionDigits = 0,
			maximumFractionDigits = 0,
		): string => {
			if (amount === null || amount === undefined) {
				return `${currencySymbol}0`;
			}
			return new Intl.NumberFormat("en-US", {
				style: "currency",
				currency,
				minimumFractionDigits,
				maximumFractionDigits,
			}).format(amount);
		},
		[currency, currencySymbol],
	);

	return {
		currency,
		currencySymbol,
		formatCurrency,
		formatCurrencyCompact,
	};
}
