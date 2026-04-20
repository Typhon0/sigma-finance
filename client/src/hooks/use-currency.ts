import { useAuth } from "@/lib/auth-context";
import { CURRENCY_SYMBOLS } from "@/lib/utils";
import { formatCurrency as formatCurrencyUtil } from "@/lib/utils/formatters";

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
	 * but defaults to the user's preferred currency instead of USD.
	 */
	const formatCurrency = (amount: number | null | undefined): string => {
		if (amount === null || amount === undefined) {
			return `${currencySymbol}0.00`;
		}
		return formatCurrencyUtil(amount, currency);
	};

	/**
	 * Format with custom fraction digits (useful for large values in charts).
	 */
	const formatCurrencyCompact = (
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
	};

	return {
		currency,
		currencySymbol,
		formatCurrency,
		formatCurrencyCompact,
	};
}
