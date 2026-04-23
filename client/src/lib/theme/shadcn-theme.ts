export type ThemeMode = "light" | "dark" | "system";

export type ThemeStyle = "vega" | "nova" | "maia" | "lyra" | "mira" | "luma" | "sera";

export type BaseColor = "neutral" | "stone" | "zinc" | "mauve" | "olive" | "mist" | "taupe";

export type MenuAccent = "subtle" | "bold";

export type MenuColor = "default" | "inverted" | "default-translucent" | "inverted-translucent";

export type AccentColor =
	| "slate"
	| "gray"
	| "zinc"
	| "neutral"
	| "stone"
	| "red"
	| "orange"
	| "amber"
	| "yellow"
	| "lime"
	| "green"
	| "emerald"
	| "teal"
	| "cyan"
	| "sky"
	| "blue"
	| "indigo"
	| "violet"
	| "purple"
	| "fuchsia"
	| "pink"
	| "rose"
	| "mauve"
	| "olive"
	| "mist"
	| "taupe";

export type FontPreference =
	| "inter"
	| "noto-sans"
	| "nunito-sans"
	| "figtree"
	| "roboto"
	| "raleway"
	| "dm-sans"
	| "public-sans"
	| "outfit"
	| "jetbrains-mono"
	| "geist"
	| "geist-mono"
	| "lora"
	| "merriweather"
	| "playfair-display"
	| "noto-serif"
	| "roboto-slab"
	| "oxanium"
	| "manrope"
	| "space-grotesk"
	| "montserrat"
	| "ibm-plex-sans"
	| "source-sans-3"
	| "instrument-sans"
	| "eb-garamond"
	| "instrument-serif";

export type HeadingFont = FontPreference | "inherit";

export interface ShadcnThemePreferences {
	style: ThemeStyle;
	baseColor: BaseColor;
	accentColor: AccentColor;
	fontPreference: FontPreference;
	headingFont: HeadingFont;
	radius: number;
	menuAccent: MenuAccent;
	menuColor: MenuColor;
	rtl: boolean;
}

export interface ThemeStyleOption {
	id: ThemeStyle;
	name: string;
	description: string;
}

export interface BaseColorOption {
	id: BaseColor;
	name: string;
	preview: string;
}

export interface MenuAccentOption {
	id: MenuAccent;
	name: string;
	description: string;
}

export interface MenuColorOption {
	id: MenuColor;
	name: string;
	description: string;
}

export interface AccentColorOption {
	id: AccentColor;
	name: string;
	hex: string;
}

export interface FontOption {
	id: FontPreference;
	name: string;
	description: string;
	fontFamily: string;
}

export interface RadiusOption {
	id: string;
	label: string;
	value: number;
	description: string;
}

export const THEME_STORAGE_KEY = "theme_preference";
export const THEME_STYLE_STORAGE_KEY = "theme_style";
export const BASE_COLOR_STORAGE_KEY = "base_color";
export const ACCENT_COLOR_STORAGE_KEY = "accent_color";
export const FONT_PREFERENCE_STORAGE_KEY = "font_preference";
export const HEADING_FONT_STORAGE_KEY = "heading_font";
export const THEME_RADIUS_STORAGE_KEY = "theme_radius";
export const MENU_ACCENT_STORAGE_KEY = "menu_accent";
export const MENU_COLOR_STORAGE_KEY = "menu_color";
export const RTL_STORAGE_KEY = "rtl";

export const DEFAULT_SHADCN_THEME_PREFERENCES: ShadcnThemePreferences = {
	style: "vega",
	baseColor: "neutral",
	accentColor: "zinc",
	fontPreference: "inter",
	headingFont: "inherit",
	radius: 0.625,
	menuAccent: "subtle",
	menuColor: "default",
	rtl: false,
};

export const THEME_STYLE_OPTIONS: ThemeStyleOption[] = [
	{
		id: "vega",
		name: "Vega",
		description: "The classic shadcn/ui look. Clean, balanced, medium spacing.",
	},
	{
		id: "nova",
		name: "Nova",
		description: "Reduced padding and margins for compact layouts.",
	},
	{
		id: "maia",
		name: "Maia",
		description: "Soft and rounded, with generous spacing.",
	},
	{
		id: "lyra",
		name: "Lyra",
		description: "Boxy and sharp. Pairs well with mono fonts.",
	},
	{
		id: "mira",
		name: "Mira",
		description: "Ultra-compact. Made for dense interfaces.",
	},
	{
		id: "luma",
		name: "Luma",
		description: "Bright and airy with subtle transparency.",
	},
	{
		id: "sera",
		name: "Sera",
		description: "Elegant serif headings with warm taupe undertones.",
	},
];

export const BASE_COLOR_OPTIONS: BaseColorOption[] = [
	{ id: "neutral", name: "Neutral", preview: "#737373" },
	{ id: "stone", name: "Stone", preview: "#78716c" },
	{ id: "zinc", name: "Zinc", preview: "#71717a" },
	{ id: "mauve", name: "Mauve", preview: "#8b7d8b" },
	{ id: "olive", name: "Olive", preview: "#7a7d5e" },
	{ id: "mist", name: "Mist", preview: "#6b7d8e" },
	{ id: "taupe", name: "Taupe", preview: "#8b7355" },
];

export const MENU_ACCENT_OPTIONS: MenuAccentOption[] = [
	{
		id: "subtle",
		name: "Subtle",
		description: "Soft hover and active states",
	},
	{
		id: "bold",
		name: "Bold",
		description: "Strong contrast on sidebar items",
	},
];

export const MENU_COLOR_OPTIONS: MenuColorOption[] = [
	{
		id: "default",
		name: "Default",
		description: "Standard sidebar colors",
	},
	{
		id: "inverted",
		name: "Inverted",
		description: "Swapped background and text",
	},
	{
		id: "default-translucent",
		name: "Default Translucent",
		description: "Glass effect with blur",
	},
	{
		id: "inverted-translucent",
		name: "Inverted Translucent",
		description: "Glass effect with swapped colors",
	},
];

export const ACCENT_COLOR_OPTIONS: AccentColorOption[] = [
	{ id: "slate", name: "Slate", hex: "#64748b" },
	{ id: "gray", name: "Gray", hex: "#6b7280" },
	{ id: "zinc", name: "Zinc", hex: "#71717a" },
	{ id: "neutral", name: "Neutral", hex: "#737373" },
	{ id: "stone", name: "Stone", hex: "#78716c" },
	{ id: "red", name: "Red", hex: "#ef4444" },
	{ id: "orange", name: "Orange", hex: "#f97316" },
	{ id: "amber", name: "Amber", hex: "#f59e0b" },
	{ id: "yellow", name: "Yellow", hex: "#eab308" },
	{ id: "lime", name: "Lime", hex: "#84cc16" },
	{ id: "green", name: "Green", hex: "#22c55e" },
	{ id: "emerald", name: "Emerald", hex: "#10b981" },
	{ id: "teal", name: "Teal", hex: "#14b8a6" },
	{ id: "cyan", name: "Cyan", hex: "#06b6d4" },
	{ id: "sky", name: "Sky", hex: "#0ea5e9" },
	{ id: "blue", name: "Blue", hex: "#3b82f6" },
	{ id: "indigo", name: "Indigo", hex: "#6366f1" },
	{ id: "violet", name: "Violet", hex: "#8b5cf6" },
	{ id: "purple", name: "Purple", hex: "#a855f7" },
	{ id: "fuchsia", name: "Fuchsia", hex: "#d946ef" },
	{ id: "pink", name: "Pink", hex: "#ec4899" },
	{ id: "rose", name: "Rose", hex: "#f43f5e" },
	{ id: "mauve", name: "Mauve", hex: "#8b7d8b" },
	{ id: "olive", name: "Olive", hex: "#7a7d5e" },
	{ id: "mist", name: "Mist", hex: "#6b7d8e" },
	{ id: "taupe", name: "Taupe", hex: "#8b7355" },
];

export const FONT_OPTIONS: FontOption[] = [
	{
		id: "inter",
		name: "Inter",
		description: "Modern and versatile",
		fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
	},
	{
		id: "noto-sans",
		name: "Noto Sans",
		description: "Global language support",
		fontFamily: "'Noto Sans', -apple-system, BlinkMacSystemFont, sans-serif",
	},
	{
		id: "nunito-sans",
		name: "Nunito Sans",
		description: "Friendly and warm",
		fontFamily: "'Nunito Sans', -apple-system, BlinkMacSystemFont, sans-serif",
	},
	{
		id: "figtree",
		name: "Figtree",
		description: "Geometric and crisp",
		fontFamily: "'Figtree', -apple-system, BlinkMacSystemFont, sans-serif",
	},
	{
		id: "roboto",
		name: "Roboto",
		description: "Clean and geometric",
		fontFamily: "'Roboto', -apple-system, BlinkMacSystemFont, sans-serif",
	},
	{
		id: "raleway",
		name: "Raleway",
		description: "Elegant and thin",
		fontFamily: "'Raleway', -apple-system, BlinkMacSystemFont, sans-serif",
	},
	{
		id: "dm-sans",
		name: "DM Sans",
		description: "Optimized for UI",
		fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
	},
	{
		id: "public-sans",
		name: "Public Sans",
		description: "Neutral and legible",
		fontFamily: "'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif",
	},
	{
		id: "outfit",
		name: "Outfit",
		description: "Rounded and modern",
		fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif",
	},
	{
		id: "jetbrains-mono",
		name: "JetBrains Mono",
		description: "Developer-friendly mono",
		fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace",
	},
	{
		id: "geist",
		name: "Geist",
		description: "Vercel's modern sans",
		fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, sans-serif",
	},
	{
		id: "geist-mono",
		name: "Geist Mono",
		description: "Vercel's mono font",
		fontFamily: "'Geist Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace",
	},
	{
		id: "lora",
		name: "Lora",
		description: "Readable serif",
		fontFamily: "'Lora', Georgia, 'Times New Roman', serif",
	},
	{
		id: "merriweather",
		name: "Merriweather",
		description: "Classic editorial serif",
		fontFamily: "'Merriweather', Georgia, 'Times New Roman', serif",
	},
	{
		id: "playfair-display",
		name: "Playfair Display",
		description: "Elegant display serif",
		fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif",
	},
	{
		id: "noto-serif",
		name: "Noto Serif",
		description: "Global serif support",
		fontFamily: "'Noto Serif', Georgia, 'Times New Roman', serif",
	},
	{
		id: "roboto-slab",
		name: "Roboto Slab",
		description: "Geometric slab serif",
		fontFamily: "'Roboto Slab', Georgia, 'Times New Roman', serif",
	},
	{
		id: "oxanium",
		name: "Oxanium",
		description: "Sci-fi inspired sans",
		fontFamily: "'Oxanium', -apple-system, BlinkMacSystemFont, sans-serif",
	},
	{
		id: "manrope",
		name: "Manrope",
		description: "Modern geometric sans",
		fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
	},
	{
		id: "space-grotesk",
		name: "Space Grotesk",
		description: "Quirky and technical",
		fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
	},
	{
		id: "montserrat",
		name: "Montserrat",
		description: "Urban and bold",
		fontFamily: "'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif",
	},
	{
		id: "ibm-plex-sans",
		name: "IBM Plex Sans",
		description: "Corporate clarity",
		fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif",
	},
	{
		id: "source-sans-3",
		name: "Source Sans 3",
		description: "Adobe's open-source sans",
		fontFamily: "'Source Sans 3', -apple-system, BlinkMacSystemFont, sans-serif",
	},
	{
		id: "instrument-sans",
		name: "Instrument Sans",
		description: "Sharp editorial sans",
		fontFamily: "'Instrument Sans', -apple-system, BlinkMacSystemFont, sans-serif",
	},
	{
		id: "eb-garamond",
		name: "EB Garamond",
		description: "Classic book serif",
		fontFamily: "'EB Garamond', Georgia, 'Times New Roman', serif",
	},
	{
		id: "instrument-serif",
		name: "Instrument Serif",
		description: "Modern editorial serif",
		fontFamily: "'Instrument Serif', Georgia, 'Times New Roman', serif",
	},
];

export const HEADING_FONT_OPTIONS = [
	{
		id: "inherit" as const,
		name: "Same as body",
		description: "Inherit body font",
	},
	...FONT_OPTIONS.map((f) => ({
		id: f.id as HeadingFont,
		name: f.name,
		description: f.description,
		fontFamily: f.fontFamily,
	})),
];

export const RADIUS_OPTIONS: RadiusOption[] = [
	{
		id: "none",
		label: "None",
		value: 0,
		description: "Sharp corners, zero radius",
	},
	{
		id: "small",
		label: "Small",
		value: 0.45,
		description: "Subtle rounding",
	},
	{
		id: "default",
		label: "Default",
		value: 0.625,
		description: "Balanced radius",
	},
	{
		id: "medium",
		label: "Medium",
		value: 0.75,
		description: "Softer cards",
	},
	{
		id: "large",
		label: "Large",
		value: 0.875,
		description: "Most rounded",
	},
];

const ACCENT_COLOR_MAP = new Map(ACCENT_COLOR_OPTIONS.map((option) => [option.id, option]));
const FONT_MAP = new Map(FONT_OPTIONS.map((option) => [option.id, option]));

function isAccentColor(value: string): value is AccentColor {
	return ACCENT_COLOR_MAP.has(value as AccentColor);
}

function isFontPreference(value: string): value is FontPreference {
	return FONT_MAP.has(value as FontPreference);
}

function parseRadius(value: string | null): number {
	if (!value) {
		return DEFAULT_SHADCN_THEME_PREFERENCES.radius;
	}

	const parsed = Number(value);
	if (Number.isNaN(parsed)) {
		return DEFAULT_SHADCN_THEME_PREFERENCES.radius;
	}

	if (parsed < 0 || parsed > 1.2) {
		return DEFAULT_SHADCN_THEME_PREFERENCES.radius;
	}

	return parsed;
}

function getAccentHex(accentColor: AccentColor): string {
	return ACCENT_COLOR_MAP.get(accentColor)?.hex ?? "#71717a";
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

function toTriplet(value: number): string {
	return value.toFixed(1).replace(/\.0$/, "");
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
	const normalized = hex.replace("#", "");
	const bigint = Number.parseInt(normalized, 16);
	const r = ((bigint >> 16) & 255) / 255;
	const g = ((bigint >> 8) & 255) / 255;
	const b = (bigint & 255) / 255;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const delta = max - min;
	const lightness = (max + min) / 2;

	let hue = 0;
	if (delta !== 0) {
		switch (max) {
			case r:
				hue = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
				break;
			case g:
				hue = ((b - r) / delta + 2) * 60;
				break;
			default:
				hue = ((r - g) / delta + 4) * 60;
				break;
		}
	}

	const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

	return {
		h: hue,
		s: saturation * 100,
		l: lightness * 100,
	};
}

function hslTriplet(h: number, s: number, l: number): string {
	return `hsl(${toTriplet(h)} ${toTriplet(s)}% ${toTriplet(l)}%)`;
}

function withHueOffset(hue: number, offset: number): number {
	const next = (hue + offset) % 360;
	return next < 0 ? next + 360 : next;
}

export function getSystemTheme(): "light" | "dark" {
	return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveThemeMode(mode: ThemeMode): "light" | "dark" {
	return mode === "system" ? getSystemTheme() : mode;
}

export function loadShadcnThemePreferences(): ShadcnThemePreferences {
	const styleValue = localStorage.getItem(THEME_STYLE_STORAGE_KEY);
	const baseColorValue = localStorage.getItem(BASE_COLOR_STORAGE_KEY);
	const accentValue = localStorage.getItem(ACCENT_COLOR_STORAGE_KEY);
	const fontValue = localStorage.getItem(FONT_PREFERENCE_STORAGE_KEY);
	const headingFontValue = localStorage.getItem(HEADING_FONT_STORAGE_KEY);
	const radiusValue = localStorage.getItem(THEME_RADIUS_STORAGE_KEY);
	const menuAccentValue = localStorage.getItem(MENU_ACCENT_STORAGE_KEY);
	const menuColorValue = localStorage.getItem(MENU_COLOR_STORAGE_KEY);
	const rtlValue = localStorage.getItem(RTL_STORAGE_KEY);

	const validStyles = new Set<string>(THEME_STYLE_OPTIONS.map((s) => s.id));
	const validBaseColors = new Set<string>(BASE_COLOR_OPTIONS.map((b) => b.id));

	return {
		style:
			styleValue && validStyles.has(styleValue)
				? (styleValue as ThemeStyle)
				: DEFAULT_SHADCN_THEME_PREFERENCES.style,
		baseColor:
			baseColorValue && validBaseColors.has(baseColorValue)
				? (baseColorValue as BaseColor)
				: DEFAULT_SHADCN_THEME_PREFERENCES.baseColor,
		accentColor:
			accentValue && isAccentColor(accentValue)
				? accentValue
				: DEFAULT_SHADCN_THEME_PREFERENCES.accentColor,
		fontPreference:
			fontValue && isFontPreference(fontValue)
				? fontValue
				: DEFAULT_SHADCN_THEME_PREFERENCES.fontPreference,
		headingFont:
			headingFontValue && (headingFontValue === "inherit" || isFontPreference(headingFontValue))
				? (headingFontValue as HeadingFont)
				: DEFAULT_SHADCN_THEME_PREFERENCES.headingFont,
		radius: parseRadius(radiusValue),
		menuAccent:
			menuAccentValue === "subtle" || menuAccentValue === "bold"
				? (menuAccentValue as MenuAccent)
				: DEFAULT_SHADCN_THEME_PREFERENCES.menuAccent,
		menuColor:
			menuColorValue &&
			["default", "inverted", "default-translucent", "inverted-translucent"].includes(
				menuColorValue,
			)
				? (menuColorValue as MenuColor)
				: DEFAULT_SHADCN_THEME_PREFERENCES.menuColor,
		rtl: rtlValue === "true",
	};
}

export function saveShadcnThemePreferences(preferences: ShadcnThemePreferences): void {
	localStorage.setItem(THEME_STYLE_STORAGE_KEY, preferences.style);
	localStorage.setItem(BASE_COLOR_STORAGE_KEY, preferences.baseColor);
	localStorage.setItem(ACCENT_COLOR_STORAGE_KEY, preferences.accentColor);
	localStorage.setItem(FONT_PREFERENCE_STORAGE_KEY, preferences.fontPreference);
	localStorage.setItem(HEADING_FONT_STORAGE_KEY, preferences.headingFont);
	localStorage.setItem(THEME_RADIUS_STORAGE_KEY, preferences.radius.toString());
	localStorage.setItem(MENU_ACCENT_STORAGE_KEY, preferences.menuAccent);
	localStorage.setItem(MENU_COLOR_STORAGE_KEY, preferences.menuColor);
	localStorage.setItem(RTL_STORAGE_KEY, String(preferences.rtl));
}

export function applyShadcnThemePreferences(
	preferences: ShadcnThemePreferences,
	resolvedTheme: "light" | "dark",
): void {
	const root = document.documentElement;
	const accentHex = getAccentHex(preferences.accentColor);
	const { h, s, l } = hexToHsl(accentHex);

	const isDark = resolvedTheme === "dark";
	const primaryLightness = isDark ? clamp(l + 12, 56, 80) : clamp(l - 3, 35, 55);
	const primarySaturation = isDark ? clamp(s + 8, 42, 90) : clamp(s + 6, 30, 90);
	const primaryHue = h;

	const primaryForeground = isDark
		? "hsl(240 5.9% 10%)"
		: primaryLightness > 50
			? "hsl(240 10% 3.9%)"
			: "hsl(0 0% 98%)";

	const ringLightness = isDark
		? clamp(primaryLightness + 8, 60, 92)
		: clamp(primaryLightness + 10, 45, 70);

	const chart1 = hslTriplet(primaryHue, primarySaturation, clamp(primaryLightness, 45, 70));
	const chart2 = hslTriplet(
		withHueOffset(primaryHue, 28),
		clamp(primarySaturation - 8, 35, 85),
		clamp(primaryLightness + (isDark ? -8 : -2), 35, 68),
	);
	const chart3 = hslTriplet(
		withHueOffset(primaryHue, 56),
		clamp(primarySaturation - 14, 30, 80),
		clamp(primaryLightness + (isDark ? -4 : 5), 40, 74),
	);
	const chart4 = hslTriplet(
		withHueOffset(primaryHue, -24),
		clamp(primarySaturation - 10, 28, 80),
		clamp(primaryLightness + (isDark ? 6 : 10), 45, 78),
	);
	const chart5 = hslTriplet(
		withHueOffset(primaryHue, -52),
		clamp(primarySaturation - 12, 30, 80),
		clamp(primaryLightness + (isDark ? 2 : 7), 40, 74),
	);

	root.style.setProperty("--primary", hslTriplet(primaryHue, primarySaturation, primaryLightness));
	root.style.setProperty("--primary-foreground", primaryForeground);
	root.style.setProperty(
		"--ring",
		hslTriplet(primaryHue, clamp(primarySaturation - 6, 25, 85), ringLightness),
	);
	root.style.setProperty(
		"--sidebar-primary",
		hslTriplet(primaryHue, primarySaturation, primaryLightness),
	);
	root.style.setProperty("--sidebar-primary-foreground", primaryForeground);
	root.style.setProperty("--sidebar-ring", root.style.getPropertyValue("--ring"));

	root.style.setProperty("--chart-1", chart1);
	root.style.setProperty("--chart-2", chart2);
	root.style.setProperty("--chart-3", chart3);
	root.style.setProperty("--chart-4", chart4);
	root.style.setProperty("--chart-5", chart5);

	root.style.setProperty("--radius", `${preferences.radius}rem`);

	const font = FONT_MAP.get(preferences.fontPreference);
	root.style.setProperty("--font-family", font?.fontFamily ?? FONT_OPTIONS[0].fontFamily);

	if (preferences.headingFont === "inherit") {
		root.style.removeProperty("--font-heading");
	} else {
		const headingFont = FONT_MAP.get(preferences.headingFont);
		root.style.setProperty("--font-heading", headingFont?.fontFamily ?? FONT_OPTIONS[0].fontFamily);
	}

	applyBaseColorVariables(preferences.baseColor, resolvedTheme);
	applyStyleVariables(preferences.style);
	applyMenuVariables(preferences.menuAccent, preferences.menuColor, resolvedTheme);

	if (preferences.rtl) {
		document.documentElement.dir = "rtl";
	} else {
		document.documentElement.dir = "ltr";
	}
}

const BASE_COLOR_OKLCH: Record<
	BaseColor,
	{
		light: Record<string, string>;
		dark: Record<string, string>;
	}
> = {
	neutral: {
		light: {
			background: "oklch(1 0 0)",
			foreground: "oklch(0.145 0 0)",
			card: "oklch(1 0 0)",
			"card-foreground": "oklch(0.145 0 0)",
			popover: "oklch(1 0 0)",
			"popover-foreground": "oklch(0.145 0 0)",
			primary: "oklch(0.205 0 0)",
			"primary-foreground": "oklch(0.985 0 0)",
			secondary: "oklch(0.97 0 0)",
			"secondary-foreground": "oklch(0.205 0 0)",
			muted: "oklch(0.97 0 0)",
			"muted-foreground": "oklch(0.556 0 0)",
			accent: "oklch(0.97 0 0)",
			"accent-foreground": "oklch(0.205 0 0)",
			destructive: "oklch(0.577 0.245 27.325)",
			border: "oklch(0.922 0 0)",
			input: "oklch(0.922 0 0)",
			ring: "oklch(0.708 0 0)",
			sidebar: "oklch(0.985 0 0)",
			"sidebar-foreground": "oklch(0.145 0 0)",
			"sidebar-primary": "oklch(0.205 0 0)",
			"sidebar-primary-foreground": "oklch(0.985 0 0)",
			"sidebar-accent": "oklch(0.97 0 0)",
			"sidebar-accent-foreground": "oklch(0.205 0 0)",
			"sidebar-border": "oklch(0.922 0 0)",
			"sidebar-ring": "oklch(0.708 0 0)",
		},
		dark: {
			background: "oklch(0.145 0 0)",
			foreground: "oklch(0.985 0 0)",
			card: "oklch(0.205 0 0)",
			"card-foreground": "oklch(0.985 0 0)",
			popover: "oklch(0.205 0 0)",
			"popover-foreground": "oklch(0.985 0 0)",
			primary: "oklch(0.922 0 0)",
			"primary-foreground": "oklch(0.205 0 0)",
			secondary: "oklch(0.269 0 0)",
			"secondary-foreground": "oklch(0.985 0 0)",
			muted: "oklch(0.269 0 0)",
			"muted-foreground": "oklch(0.708 0 0)",
			accent: "oklch(0.269 0 0)",
			"accent-foreground": "oklch(0.985 0 0)",
			destructive: "oklch(0.704 0.191 22.216)",
			border: "oklch(1 0 0 / 10%)",
			input: "oklch(1 0 0 / 15%)",
			ring: "oklch(0.556 0 0)",
			sidebar: "oklch(0.205 0 0)",
			"sidebar-foreground": "oklch(0.985 0 0)",
			"sidebar-primary": "oklch(0.488 0.243 264.376)",
			"sidebar-primary-foreground": "oklch(0.985 0 0)",
			"sidebar-accent": "oklch(0.269 0 0)",
			"sidebar-accent-foreground": "oklch(0.985 0 0)",
			"sidebar-border": "oklch(1 0 0 / 10%)",
			"sidebar-ring": "oklch(0.556 0 0)",
		},
	},
	stone: {
		light: {
			background: "oklch(1 0 0)",
			foreground: "oklch(0.147 0.004 49.25)",
			card: "oklch(1 0 0)",
			"card-foreground": "oklch(0.147 0.004 49.25)",
			popover: "oklch(1 0 0)",
			"popover-foreground": "oklch(0.147 0.004 49.25)",
			primary: "oklch(0.216 0.006 56.043)",
			"primary-foreground": "oklch(0.985 0.001 106.423)",
			secondary: "oklch(0.97 0.001 106.424)",
			"secondary-foreground": "oklch(0.216 0.006 56.043)",
			muted: "oklch(0.97 0.001 106.424)",
			"muted-foreground": "oklch(0.553 0.013 58.071)",
			accent: "oklch(0.97 0.001 106.424)",
			"accent-foreground": "oklch(0.216 0.006 56.043)",
			destructive: "oklch(0.577 0.245 27.325)",
			border: "oklch(0.923 0.003 48.717)",
			input: "oklch(0.923 0.003 48.717)",
			ring: "oklch(0.709 0.01 56.259)",
			sidebar: "oklch(0.985 0.001 106.423)",
			"sidebar-foreground": "oklch(0.147 0.004 49.25)",
			"sidebar-primary": "oklch(0.216 0.006 56.043)",
			"sidebar-primary-foreground": "oklch(0.985 0.001 106.423)",
			"sidebar-accent": "oklch(0.97 0.001 106.424)",
			"sidebar-accent-foreground": "oklch(0.216 0.006 56.043)",
			"sidebar-border": "oklch(0.923 0.003 48.717)",
			"sidebar-ring": "oklch(0.709 0.01 56.259)",
		},
		dark: {
			background: "oklch(0.147 0.004 49.25)",
			foreground: "oklch(0.985 0.001 106.423)",
			card: "oklch(0.216 0.006 56.043)",
			"card-foreground": "oklch(0.985 0.001 106.423)",
			popover: "oklch(0.216 0.006 56.043)",
			"popover-foreground": "oklch(0.985 0.001 106.423)",
			primary: "oklch(0.923 0.003 48.717)",
			"primary-foreground": "oklch(0.216 0.006 56.043)",
			secondary: "oklch(0.268 0.007 34.298)",
			"secondary-foreground": "oklch(0.985 0.001 106.423)",
			muted: "oklch(0.268 0.007 34.298)",
			"muted-foreground": "oklch(0.709 0.01 56.259)",
			accent: "oklch(0.268 0.007 34.298)",
			"accent-foreground": "oklch(0.985 0.001 106.423)",
			destructive: "oklch(0.704 0.191 22.216)",
			border: "oklch(1 0 0 / 10%)",
			input: "oklch(1 0 0 / 15%)",
			ring: "oklch(0.553 0.013 58.071)",
			sidebar: "oklch(0.216 0.006 56.043)",
			"sidebar-foreground": "oklch(0.985 0.001 106.423)",
			"sidebar-primary": "oklch(0.488 0.243 264.376)",
			"sidebar-primary-foreground": "oklch(0.985 0.001 106.423)",
			"sidebar-accent": "oklch(0.268 0.007 34.298)",
			"sidebar-accent-foreground": "oklch(0.985 0.001 106.423)",
			"sidebar-border": "oklch(1 0 0 / 10%)",
			"sidebar-ring": "oklch(0.553 0.013 58.071)",
		},
	},
	zinc: {
		light: {
			background: "oklch(1 0 0)",
			foreground: "oklch(0.141 0.005 285.823)",
			card: "oklch(1 0 0)",
			"card-foreground": "oklch(0.141 0.005 285.823)",
			popover: "oklch(1 0 0)",
			"popover-foreground": "oklch(0.141 0.005 285.823)",
			primary: "oklch(0.21 0.006 285.885)",
			"primary-foreground": "oklch(0.985 0 0)",
			secondary: "oklch(0.967 0.001 286.375)",
			"secondary-foreground": "oklch(0.21 0.006 285.885)",
			muted: "oklch(0.967 0.001 286.375)",
			"muted-foreground": "oklch(0.552 0.016 285.938)",
			accent: "oklch(0.967 0.001 286.375)",
			"accent-foreground": "oklch(0.21 0.006 285.885)",
			destructive: "oklch(0.577 0.245 27.325)",
			border: "oklch(0.92 0.004 286.32)",
			input: "oklch(0.92 0.004 286.32)",
			ring: "oklch(0.705 0.015 286.067)",
			sidebar: "oklch(0.985 0 0)",
			"sidebar-foreground": "oklch(0.141 0.005 285.823)",
			"sidebar-primary": "oklch(0.21 0.006 285.885)",
			"sidebar-primary-foreground": "oklch(0.985 0 0)",
			"sidebar-accent": "oklch(0.967 0.001 286.375)",
			"sidebar-accent-foreground": "oklch(0.21 0.006 285.885)",
			"sidebar-border": "oklch(0.92 0.004 286.32)",
			"sidebar-ring": "oklch(0.705 0.015 286.067)",
		},
		dark: {
			background: "oklch(0.141 0.005 285.823)",
			foreground: "oklch(0.985 0 0)",
			card: "oklch(0.21 0.006 285.885)",
			"card-foreground": "oklch(0.985 0 0)",
			popover: "oklch(0.21 0.006 285.885)",
			"popover-foreground": "oklch(0.985 0 0)",
			primary: "oklch(0.92 0.004 286.32)",
			"primary-foreground": "oklch(0.21 0.006 285.885)",
			secondary: "oklch(0.274 0.006 286.033)",
			"secondary-foreground": "oklch(0.985 0 0)",
			muted: "oklch(0.274 0.006 286.033)",
			"muted-foreground": "oklch(0.705 0.015 286.067)",
			accent: "oklch(0.274 0.006 286.033)",
			"accent-foreground": "oklch(0.985 0 0)",
			destructive: "oklch(0.704 0.191 22.216)",
			border: "oklch(1 0 0 / 10%)",
			input: "oklch(1 0 0 / 15%)",
			ring: "oklch(0.552 0.016 285.938)",
			sidebar: "oklch(0.21 0.006 285.885)",
			"sidebar-foreground": "oklch(0.985 0 0)",
			"sidebar-primary": "oklch(0.488 0.243 264.376)",
			"sidebar-primary-foreground": "oklch(0.985 0 0)",
			"sidebar-accent": "oklch(0.274 0.006 286.033)",
			"sidebar-accent-foreground": "oklch(0.985 0 0)",
			"sidebar-border": "oklch(1 0 0 / 10%)",
			"sidebar-ring": "oklch(0.552 0.016 285.938)",
		},
	},
	mauve: {
		light: {
			background: "oklch(1 0 0)",
			foreground: "oklch(0.145 0.008 326)",
			card: "oklch(1 0 0)",
			"card-foreground": "oklch(0.145 0.008 326)",
			popover: "oklch(1 0 0)",
			"popover-foreground": "oklch(0.145 0.008 326)",
			primary: "oklch(0.212 0.019 322.12)",
			"primary-foreground": "oklch(0.985 0 0)",
			secondary: "oklch(0.96 0.003 325.6)",
			"secondary-foreground": "oklch(0.212 0.019 322.12)",
			muted: "oklch(0.96 0.003 325.6)",
			"muted-foreground": "oklch(0.542 0.034 322.5)",
			accent: "oklch(0.96 0.003 325.6)",
			"accent-foreground": "oklch(0.212 0.019 322.12)",
			destructive: "oklch(0.577 0.245 27.325)",
			border: "oklch(0.922 0.005 325.62)",
			input: "oklch(0.922 0.005 325.62)",
			ring: "oklch(0.711 0.019 323.02)",
			sidebar: "oklch(0.985 0 0)",
			"sidebar-foreground": "oklch(0.145 0.008 326)",
			"sidebar-primary": "oklch(0.212 0.019 322.12)",
			"sidebar-primary-foreground": "oklch(0.985 0 0)",
			"sidebar-accent": "oklch(0.96 0.003 325.6)",
			"sidebar-accent-foreground": "oklch(0.212 0.019 322.12)",
			"sidebar-border": "oklch(0.922 0.005 325.62)",
			"sidebar-ring": "oklch(0.711 0.019 323.02)",
		},
		dark: {
			background: "oklch(0.145 0.008 326)",
			foreground: "oklch(0.985 0 0)",
			card: "oklch(0.212 0.019 322.12)",
			"card-foreground": "oklch(0.985 0 0)",
			popover: "oklch(0.212 0.019 322.12)",
			"popover-foreground": "oklch(0.985 0 0)",
			primary: "oklch(0.922 0.005 325.62)",
			"primary-foreground": "oklch(0.212 0.019 322.12)",
			secondary: "oklch(0.263 0.024 320.12)",
			"secondary-foreground": "oklch(0.985 0 0)",
			muted: "oklch(0.263 0.024 320.12)",
			"muted-foreground": "oklch(0.711 0.019 323.02)",
			accent: "oklch(0.263 0.024 320.12)",
			"accent-foreground": "oklch(0.985 0 0)",
			destructive: "oklch(0.704 0.191 22.216)",
			border: "oklch(1 0 0 / 10%)",
			input: "oklch(1 0 0 / 15%)",
			ring: "oklch(0.542 0.034 322.5)",
			sidebar: "oklch(0.212 0.019 322.12)",
			"sidebar-foreground": "oklch(0.985 0 0)",
			"sidebar-primary": "oklch(0.488 0.243 264.376)",
			"sidebar-primary-foreground": "oklch(0.985 0 0)",
			"sidebar-accent": "oklch(0.263 0.024 320.12)",
			"sidebar-accent-foreground": "oklch(0.985 0 0)",
			"sidebar-border": "oklch(1 0 0 / 10%)",
			"sidebar-ring": "oklch(0.542 0.034 322.5)",
		},
	},
	olive: {
		light: {
			background: "oklch(1 0 0)",
			foreground: "oklch(0.153 0.006 107.1)",
			card: "oklch(1 0 0)",
			"card-foreground": "oklch(0.153 0.006 107.1)",
			popover: "oklch(1 0 0)",
			"popover-foreground": "oklch(0.153 0.006 107.1)",
			primary: "oklch(0.228 0.013 107.4)",
			"primary-foreground": "oklch(0.988 0.003 106.5)",
			secondary: "oklch(0.966 0.005 106.5)",
			"secondary-foreground": "oklch(0.228 0.013 107.4)",
			muted: "oklch(0.966 0.005 106.5)",
			"muted-foreground": "oklch(0.58 0.031 107.3)",
			accent: "oklch(0.966 0.005 106.5)",
			"accent-foreground": "oklch(0.228 0.013 107.4)",
			destructive: "oklch(0.577 0.245 27.325)",
			border: "oklch(0.93 0.007 106.5)",
			input: "oklch(0.93 0.007 106.5)",
			ring: "oklch(0.737 0.021 106.9)",
			sidebar: "oklch(0.988 0.003 106.5)",
			"sidebar-foreground": "oklch(0.153 0.006 107.1)",
			"sidebar-primary": "oklch(0.228 0.013 107.4)",
			"sidebar-primary-foreground": "oklch(0.988 0.003 106.5)",
			"sidebar-accent": "oklch(0.966 0.005 106.5)",
			"sidebar-accent-foreground": "oklch(0.228 0.013 107.4)",
			"sidebar-border": "oklch(0.93 0.007 106.5)",
			"sidebar-ring": "oklch(0.737 0.021 106.9)",
		},
		dark: {
			background: "oklch(0.153 0.006 107.1)",
			foreground: "oklch(0.988 0.003 106.5)",
			card: "oklch(0.228 0.013 107.4)",
			"card-foreground": "oklch(0.988 0.003 106.5)",
			popover: "oklch(0.228 0.013 107.4)",
			"popover-foreground": "oklch(0.988 0.003 106.5)",
			primary: "oklch(0.93 0.007 106.5)",
			"primary-foreground": "oklch(0.228 0.013 107.4)",
			secondary: "oklch(0.286 0.016 107.4)",
			"secondary-foreground": "oklch(0.988 0.003 106.5)",
			muted: "oklch(0.286 0.016 107.4)",
			"muted-foreground": "oklch(0.737 0.021 106.9)",
			accent: "oklch(0.286 0.016 107.4)",
			"accent-foreground": "oklch(0.988 0.003 106.5)",
			destructive: "oklch(0.704 0.191 22.216)",
			border: "oklch(1 0 0 / 10%)",
			input: "oklch(1 0 0 / 15%)",
			ring: "oklch(0.58 0.031 107.3)",
			sidebar: "oklch(0.228 0.013 107.4)",
			"sidebar-foreground": "oklch(0.988 0.003 106.5)",
			"sidebar-primary": "oklch(0.488 0.243 264.376)",
			"sidebar-primary-foreground": "oklch(0.988 0.003 106.5)",
			"sidebar-accent": "oklch(0.286 0.016 107.4)",
			"sidebar-accent-foreground": "oklch(0.988 0.003 106.5)",
			"sidebar-border": "oklch(1 0 0 / 10%)",
			"sidebar-ring": "oklch(0.58 0.031 107.3)",
		},
	},
	mist: {
		light: {
			background: "oklch(1 0 0)",
			foreground: "oklch(0.148 0.004 228.8)",
			card: "oklch(1 0 0)",
			"card-foreground": "oklch(0.148 0.004 228.8)",
			popover: "oklch(1 0 0)",
			"popover-foreground": "oklch(0.148 0.004 228.8)",
			primary: "oklch(0.218 0.008 223.9)",
			"primary-foreground": "oklch(0.987 0.002 197.1)",
			secondary: "oklch(0.963 0.002 197.1)",
			"secondary-foreground": "oklch(0.218 0.008 223.9)",
			muted: "oklch(0.963 0.002 197.1)",
			"muted-foreground": "oklch(0.56 0.021 213.5)",
			accent: "oklch(0.963 0.002 197.1)",
			"accent-foreground": "oklch(0.218 0.008 223.9)",
			destructive: "oklch(0.577 0.245 27.325)",
			border: "oklch(0.925 0.005 214.3)",
			input: "oklch(0.925 0.005 214.3)",
			ring: "oklch(0.723 0.014 214.4)",
			sidebar: "oklch(0.987 0.002 197.1)",
			"sidebar-foreground": "oklch(0.148 0.004 228.8)",
			"sidebar-primary": "oklch(0.218 0.008 223.9)",
			"sidebar-primary-foreground": "oklch(0.987 0.002 197.1)",
			"sidebar-accent": "oklch(0.963 0.002 197.1)",
			"sidebar-accent-foreground": "oklch(0.218 0.008 223.9)",
			"sidebar-border": "oklch(0.925 0.005 214.3)",
			"sidebar-ring": "oklch(0.723 0.014 214.4)",
		},
		dark: {
			background: "oklch(0.148 0.004 228.8)",
			foreground: "oklch(0.987 0.002 197.1)",
			card: "oklch(0.218 0.008 223.9)",
			"card-foreground": "oklch(0.987 0.002 197.1)",
			popover: "oklch(0.218 0.008 223.9)",
			"popover-foreground": "oklch(0.987 0.002 197.1)",
			primary: "oklch(0.925 0.005 214.3)",
			"primary-foreground": "oklch(0.218 0.008 223.9)",
			secondary: "oklch(0.275 0.011 216.9)",
			"secondary-foreground": "oklch(0.987 0.002 197.1)",
			muted: "oklch(0.275 0.011 216.9)",
			"muted-foreground": "oklch(0.723 0.014 214.4)",
			accent: "oklch(0.275 0.011 216.9)",
			"accent-foreground": "oklch(0.987 0.002 197.1)",
			destructive: "oklch(0.704 0.191 22.216)",
			border: "oklch(1 0 0 / 10%)",
			input: "oklch(1 0 0 / 15%)",
			ring: "oklch(0.56 0.021 213.5)",
			sidebar: "oklch(0.218 0.008 223.9)",
			"sidebar-foreground": "oklch(0.987 0.002 197.1)",
			"sidebar-primary": "oklch(0.488 0.243 264.376)",
			"sidebar-primary-foreground": "oklch(0.987 0.002 197.1)",
			"sidebar-accent": "oklch(0.275 0.011 216.9)",
			"sidebar-accent-foreground": "oklch(0.987 0.002 197.1)",
			"sidebar-border": "oklch(1 0 0 / 10%)",
			"sidebar-ring": "oklch(0.56 0.021 213.5)",
		},
	},
	taupe: {
		light: {
			background: "oklch(1 0 0)",
			foreground: "oklch(0.147 0.004 49.3)",
			card: "oklch(1 0 0)",
			"card-foreground": "oklch(0.147 0.004 49.3)",
			popover: "oklch(1 0 0)",
			"popover-foreground": "oklch(0.147 0.004 49.3)",
			primary: "oklch(0.214 0.009 43.1)",
			"primary-foreground": "oklch(0.986 0.002 67.8)",
			secondary: "oklch(0.96 0.002 17.2)",
			"secondary-foreground": "oklch(0.214 0.009 43.1)",
			muted: "oklch(0.96 0.002 17.2)",
			"muted-foreground": "oklch(0.547 0.021 43.1)",
			accent: "oklch(0.96 0.002 17.2)",
			"accent-foreground": "oklch(0.214 0.009 43.1)",
			destructive: "oklch(0.577 0.245 27.325)",
			border: "oklch(0.922 0.005 34.3)",
			input: "oklch(0.922 0.005 34.3)",
			ring: "oklch(0.714 0.014 41.2)",
			sidebar: "oklch(0.986 0.002 67.8)",
			"sidebar-foreground": "oklch(0.147 0.004 49.3)",
			"sidebar-primary": "oklch(0.214 0.009 43.1)",
			"sidebar-primary-foreground": "oklch(0.986 0.002 67.8)",
			"sidebar-accent": "oklch(0.96 0.002 17.2)",
			"sidebar-accent-foreground": "oklch(0.214 0.009 43.1)",
			"sidebar-border": "oklch(0.922 0.005 34.3)",
			"sidebar-ring": "oklch(0.714 0.014 41.2)",
		},
		dark: {
			background: "oklch(0.147 0.004 49.3)",
			foreground: "oklch(0.986 0.002 67.8)",
			card: "oklch(0.214 0.009 43.1)",
			"card-foreground": "oklch(0.986 0.002 67.8)",
			popover: "oklch(0.214 0.009 43.1)",
			"popover-foreground": "oklch(0.986 0.002 67.8)",
			primary: "oklch(0.922 0.005 34.3)",
			"primary-foreground": "oklch(0.214 0.009 43.1)",
			secondary: "oklch(0.268 0.011 36.5)",
			"secondary-foreground": "oklch(0.986 0.002 67.8)",
			muted: "oklch(0.268 0.011 36.5)",
			"muted-foreground": "oklch(0.714 0.014 41.2)",
			accent: "oklch(0.268 0.011 36.5)",
			"accent-foreground": "oklch(0.986 0.002 67.8)",
			destructive: "oklch(0.704 0.191 22.216)",
			border: "oklch(1 0 0 / 10%)",
			input: "oklch(1 0 0 / 15%)",
			ring: "oklch(0.547 0.021 43.1)",
			sidebar: "oklch(0.214 0.009 43.1)",
			"sidebar-foreground": "oklch(0.986 0.002 67.8)",
			"sidebar-primary": "oklch(0.488 0.243 264.376)",
			"sidebar-primary-foreground": "oklch(0.986 0.002 67.8)",
			"sidebar-accent": "oklch(0.268 0.011 36.5)",
			"sidebar-accent-foreground": "oklch(0.986 0.002 67.8)",
			"sidebar-border": "oklch(1 0 0 / 10%)",
			"sidebar-ring": "oklch(0.547 0.021 43.1)",
		},
	},
};

function applyBaseColorVariables(baseColor: BaseColor, resolvedTheme: "light" | "dark"): void {
	const root = document.documentElement;
	const colorSet = BASE_COLOR_OKLCH[baseColor];
	if (!colorSet) return;

	const vars = resolvedTheme === "dark" ? colorSet.dark : colorSet.light;

	for (const [key, value] of Object.entries(vars)) {
		root.style.setProperty(`--${key}`, value);
	}
}

function applyStyleVariables(_style: ThemeStyle): void {
	const _root = document.documentElement;

	// NOTE: The data-style attribute is owned by DesignSystemProvider.
	// This function only exists for backward compatibility with code
	// that calls applyShadcnThemePreferences directly.
}

function applyMenuVariables(
	menuAccent: MenuAccent,
	menuColor: MenuColor,
	_resolvedTheme: "light" | "dark",
): void {
	const root = document.documentElement;

	const isBold = menuAccent === "bold";
	const isInverted = menuColor.startsWith("inverted");
	const isTranslucent = menuColor.endsWith("translucent");

	if (isInverted) {
		const sidebarBg = root.style.getPropertyValue("--sidebar");
		const sidebarFg = root.style.getPropertyValue("--sidebar-foreground");
		root.style.setProperty("--sidebar", sidebarFg || "oklch(0.205 0 0)");
		root.style.setProperty("--sidebar-foreground", sidebarBg || "oklch(0.985 0 0)");
	}

	if (isTranslucent) {
		root.style.setProperty("--sidebar-backdrop", "blur(12px)");
		root.style.setProperty("--sidebar-opacity", "0.85");
	} else {
		root.style.removeProperty("--sidebar-backdrop");
		root.style.removeProperty("--sidebar-opacity");
	}

	if (isBold) {
		root.style.setProperty("--sidebar-accent-contrast", "1");
	} else {
		root.style.removeProperty("--sidebar-accent-contrast");
	}
}
