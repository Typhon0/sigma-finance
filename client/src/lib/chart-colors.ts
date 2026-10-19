/**
 * Chart color utilities for ECharts integration with shadcn/ui theme
 */

/**
 * Convert an OKLCH color string to an sRGB hex string (or rgba() when the
 * value carries alpha). Real CSS Color 4 conversion rather than a lookup
 * table: tokens are tuned per theme, so every value that reaches a canvas
 * must resolve exactly. Non-oklch input passes through untouched.
 */
export function oklchToRgb(oklch: string): string {
	if (!oklch?.includes("oklch")) {
		return oklch;
	}

	const match = oklch.match(
		/oklch\(\s*([\d.]+%?)\s+([\d.]+%?)\s+([\d.]+)(?:deg|rad|grad|turn)?\s*(?:\/\s*([\d.]+%?)\s*)?\)/i,
	);
	if (!match) {
		return oklch;
	}

	const lightness = match[1].endsWith("%")
		? Number.parseFloat(match[1]) / 100
		: Number.parseFloat(match[1]);
	// A chroma percentage maps to the 0–0.4 range per CSS Color 4.
	const chroma = match[2].endsWith("%")
		? (Number.parseFloat(match[2]) / 100) * 0.4
		: Number.parseFloat(match[2]);
	const hue = (Number.parseFloat(match[3]) * Math.PI) / 180;
	const alpha = match[4]
		? match[4].endsWith("%")
			? Number.parseFloat(match[4]) / 100
			: Number.parseFloat(match[4])
		: 1;

	// oklch → oklab
	const a = chroma * Math.cos(hue);
	const b = chroma * Math.sin(hue);

	// oklab → linear sRGB (Björn Ottosson's matrices)
	const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

	const linR = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
	const linG = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
	const linB = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

	const toSrgb = (value: number): number => {
		const c = Math.min(1, Math.max(0, value));
		return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
	};

	const r = Math.round(toSrgb(linR) * 255);
	const g = Math.round(toSrgb(linG) * 255);
	const bl = Math.round(toSrgb(linB) * 255);

	if (alpha < 1) {
		return `rgba(${r}, ${g}, ${bl}, ${Number(alpha.toFixed(3))})`;
	}

	return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

/**
 * "r, g, b" triplet for composing rgba() strings that ECharts can parse.
 */
export function hexToRgbTriplet(hex: string): string {
	const value = hex.replace("#", "");
	const full =
		value.length === 3
			? value
					.split("")
					.map((c) => c + c)
					.join("")
			: value.slice(0, 6);
	const int = Number.parseInt(full, 16);
	if (Number.isNaN(int)) {
		return "107, 114, 128";
	}
	return `${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}`;
}

/**
 * Get chart colors from CSS variables
 */
export function getChartColors(): string[] {
	if (typeof window === "undefined") {
		return ["#e11d48", "#0ea5e9", "#8b5cf6", "#22c55e", "#f59e0b"];
	}

	const root = document.documentElement;
	const computedStyle = getComputedStyle(root);

	return [
		oklchToRgb(computedStyle.getPropertyValue("--chart-1").trim()),
		oklchToRgb(computedStyle.getPropertyValue("--chart-2").trim()),
		oklchToRgb(computedStyle.getPropertyValue("--chart-3").trim()),
		oklchToRgb(computedStyle.getPropertyValue("--chart-4").trim()),
		oklchToRgb(computedStyle.getPropertyValue("--chart-5").trim()),
	];
}

/**
 * Get theme colors for chart styling
 */
export function getChartThemeColors() {
	if (typeof window === "undefined") {
		return {
			background: "transparent",
			foreground: "#000000",
			card: "#ffffff",
			cardForeground: "#000000",
			border: "#e5e7eb",
			mutedForeground: "#6b7280",
			gain: "#007149",
			loss: "#bb1139",
			primary: "#18181b",
		};
	}

	const root = document.documentElement;
	const computedStyle = getComputedStyle(root);

	return {
		background: "transparent",
		foreground: oklchToRgb(computedStyle.getPropertyValue("--foreground").trim()),
		card: oklchToRgb(computedStyle.getPropertyValue("--card").trim()),
		cardForeground: oklchToRgb(computedStyle.getPropertyValue("--card-foreground").trim()),
		border: oklchToRgb(computedStyle.getPropertyValue("--border").trim()),
		mutedForeground: oklchToRgb(computedStyle.getPropertyValue("--muted-foreground").trim()),
		gain: oklchToRgb(computedStyle.getPropertyValue("--gain").trim()),
		loss: oklchToRgb(computedStyle.getPropertyValue("--loss").trim()),
		primary: oklchToRgb(computedStyle.getPropertyValue("--primary").trim()),
	};
}

/**
 * Asset type color mapping for consistent visualization
 */
export const ASSET_TYPE_COLORS: Record<string, string> = {
	STOCK: "#e11d48", // Red
	CRYPTO: "#0ea5e9", // Blue
	BANK_ACCOUNT: "#22c55e", // Green
	REAL_ESTATE: "#8b5cf6", // Purple
	LIFE_INSURANCE: "#f59e0b", // Orange
	WATCH: "#ec4899", // Pink
	OTHER: "#6b7280", // Gray
};

/**
 * Get color for asset type
 */
export function getAssetTypeColor(assetType: string): string {
	return ASSET_TYPE_COLORS[assetType] || ASSET_TYPE_COLORS.OTHER;
}
