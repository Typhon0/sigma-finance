import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | null | undefined): string {
	if (amount === null || amount === undefined) {
		return "$0.00";
	}
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
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
