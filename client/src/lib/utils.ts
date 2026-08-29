import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export const CURRENCY_SYMBOLS: Record<string, string> = {
	USD: "$",
	EUR: "€",
	GBP: "£",
};

export function formatCurrency(
	amount: number | null | undefined,
	currency: string = "USD",
): string {
	if (amount === null || amount === undefined || !Number.isFinite(amount)) {
		const symbol = CURRENCY_SYMBOLS[currency] ?? "$";
		return `${symbol}0.00`;
	}
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(amount);
}

export function formatPercentage(value: number | null | undefined): string {
	if (value === null || value === undefined) {
		return "0.00%";
	}
	return `${(value * 100).toFixed(2)}%`;
}
