import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * `cn` = clsx + tailwind-merge, with our custom `text-micro` size registered.
 *
 * tailwind-merge only knows Tailwind's stock scale. Handed `text-micro`
 * alongside a colour like `text-loss`, it classifies the unknown `text-*` as
 * a text COLOUR and merges the two, silently dropping `text-micro`. The
 * element then renders at the inherited font size — visibly larger than its
 * 11px siblings. Registering the token here keeps it in the font-size group,
 * so size and colour resolve independently, exactly like `text-xs` does.
 */
const twMerge = extendTailwindMerge({
	extend: {
		classGroups: {
			"font-size": [{ text: ["micro"] }],
		},
	},
});

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
