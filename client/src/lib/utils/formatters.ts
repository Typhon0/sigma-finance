import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = "USD"): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
	}).format(amount);
}

export function formatPercentage(percent: number): string {
	return `${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%`;
}

export function getPerformanceVariant(
	percent: number,
): "default" | "destructive" | "secondary" {
	if (percent > 0) return "default";
	if (percent < 0) return "destructive";
	return "secondary";
}

export function getPerformanceColorClass(value: number): string {
	if (value > 0) return "text-green-600";
	if (value < 0) return "text-red-600";
	return "text-muted-foreground";
}
