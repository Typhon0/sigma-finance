export function formatPercentage(percent: number, decimals = 2): string {
	const normalizedPercent = Number.isFinite(percent) ? percent : 0;
	const clampedDecimals = Math.max(0, Math.min(6, decimals));
	const signPrefix = normalizedPercent >= 0 ? "+" : "";

	return `${signPrefix}${normalizedPercent.toFixed(clampedDecimals)}%`;
}

export function getPerformanceVariant(percent: number): "default" | "destructive" | "secondary" {
	if (percent > 0) return "default";
	if (percent < 0) return "destructive";
	return "secondary";
}

export function getPerformanceColorClass(value: number): string {
	if (value > 0) return "text-green-600";
	if (value < 0) return "text-red-600";
	return "text-muted-foreground";
}
