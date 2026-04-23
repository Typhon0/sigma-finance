/**
 * Chart theming utilities for mobile and dashboard contexts
 * Provides responsive themes and mobile-optimized styling
 */

import { useTheme } from "next-themes";
import { useMemo } from "react";
import type { ChartTheme } from "./lightweight-charts";

/**
 * Device context types
 */
export type DeviceContext = "desktop" | "tablet" | "mobile";
export type ChartContext = "dashboard" | "fullscreen" | "modal" | "inline";

/**
 * Theme variant types
 */
export type ThemeVariant = "default" | "compact" | "minimal" | "high-contrast";

/**
 * Extended chart theme with mobile optimizations
 */
export interface ExtendedChartTheme extends ChartTheme {
	// Font sizes
	fontSize: {
		small: string;
		medium: string;
		large: string;
	};

	// Spacing
	padding: {
		small: number;
		medium: number;
		large: number;
	};

	// Touch targets
	touchTarget: {
		minSize: number;
		padding: number;
	};

	// Borders and shadows
	border: {
		width: number;
		radius: number;
		color: string;
	};

	shadow: {
		small: string;
		medium: string;
		large: string;
	};

	// Animation settings
	animation: {
		duration: number;
		easing: string;
		reducedMotion: boolean;
	};
}

/**
 * Base theme configurations
 */
const BASE_LIGHT_THEME: ExtendedChartTheme = {
	// Lightweight Charts colors
	background: "transparent",
	textColor: "#374151",
	gridColor: "#f3f4f6",
	crosshairColor: "#9ca3af",
	upColor: "#22c55e",
	downColor: "#ef4444",
	borderUpColor: "#22c55e",
	borderDownColor: "#ef4444",
	wickUpColor: "#22c55e",
	wickDownColor: "#ef4444",

	// Extended properties
	fontSize: {
		small: "10px",
		medium: "12px",
		large: "14px",
	},

	padding: {
		small: 8,
		medium: 16,
		large: 24,
	},

	touchTarget: {
		minSize: 44, // iOS/Android minimum touch target
		padding: 8,
	},

	border: {
		width: 1,
		radius: 8,
		color: "#e5e7eb",
	},

	shadow: {
		small: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
		medium: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
		large: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
	},

	animation: {
		duration: 200,
		easing: "ease-in-out",
		reducedMotion: false,
	},
};

const BASE_DARK_THEME: ExtendedChartTheme = {
	...BASE_LIGHT_THEME,

	// Lightweight Charts colors
	background: "transparent",
	textColor: "#d1d5db",
	gridColor: "#374151",
	crosshairColor: "#6b7280",

	border: {
		...BASE_LIGHT_THEME.border,
		color: "#374151",
	},

	shadow: {
		small: "0 1px 2px 0 rgb(0 0 0 / 0.3)",
		medium: "0 4px 6px -1px rgb(0 0 0 / 0.3)",
		large: "0 10px 15px -3px rgb(0 0 0 / 0.3)",
	},
};

/**
 * Device-specific theme adjustments
 */
const DEVICE_ADJUSTMENTS: Record<DeviceContext, Partial<ExtendedChartTheme>> = {
	desktop: {
		fontSize: {
			small: "11px",
			medium: "13px",
			large: "15px",
		},
		padding: {
			small: 12,
			medium: 20,
			large: 32,
		},
		touchTarget: {
			minSize: 32,
			padding: 4,
		},
	},

	tablet: {
		fontSize: {
			small: "12px",
			medium: "14px",
			large: "16px",
		},
		padding: {
			small: 16,
			medium: 24,
			large: 32,
		},
		touchTarget: {
			minSize: 48,
			padding: 12,
		},
	},

	mobile: {
		fontSize: {
			small: "10px",
			medium: "12px",
			large: "14px",
		},
		padding: {
			small: 8,
			medium: 16,
			large: 24,
		},
		touchTarget: {
			minSize: 44,
			padding: 8,
		},
		border: {
			width: 1,
			radius: 6,
			color: "#e5e7eb",
		},
	},
};

/**
 * Context-specific theme adjustments
 */
const CONTEXT_ADJUSTMENTS: Record<ChartContext, Partial<ExtendedChartTheme>> = {
	dashboard: {
		padding: {
			small: 8,
			medium: 12,
			large: 16,
		},
		border: {
			width: 1,
			radius: 6,
			color: "#e5e7eb",
		},
		shadow: {
			small: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
			medium: "0 2px 4px 0 rgb(0 0 0 / 0.05)",
			large: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
		},
	},

	fullscreen: {
		padding: {
			small: 16,
			medium: 24,
			large: 32,
		},
		fontSize: {
			small: "12px",
			medium: "14px",
			large: "16px",
		},
	},

	modal: {
		padding: {
			small: 12,
			medium: 16,
			large: 24,
		},
		shadow: {
			small: "none",
			medium: "none",
			large: "none",
		},
	},

	inline: {
		padding: {
			small: 4,
			medium: 8,
			large: 12,
		},
		border: {
			width: 0,
			radius: 4,
			color: "transparent",
		},
		shadow: {
			small: "none",
			medium: "none",
			large: "none",
		},
	},
};

/**
 * Theme variant adjustments
 */
const VARIANT_ADJUSTMENTS: Record<ThemeVariant, Partial<ExtendedChartTheme>> = {
	default: {},

	compact: {
		fontSize: {
			small: "9px",
			medium: "10px",
			large: "12px",
		},
		padding: {
			small: 4,
			medium: 8,
			large: 12,
		},
		touchTarget: {
			minSize: 32,
			padding: 4,
		},
	},

	minimal: {
		gridColor: "transparent",
		border: {
			width: 0,
			radius: 0,
			color: "transparent",
		},
		shadow: {
			small: "none",
			medium: "none",
			large: "none",
		},
	},

	"high-contrast": {
		upColor: "#00ff00",
		downColor: "#ff0000",
		borderUpColor: "#00ff00",
		borderDownColor: "#ff0000",
		wickUpColor: "#00ff00",
		wickDownColor: "#ff0000",
		textColor: "#000000",
		gridColor: "#666666",
		crosshairColor: "#333333",
	},
};

/**
 * Detect device context based on screen size
 */
export function detectDeviceContext(): DeviceContext {
	if (typeof window === "undefined") return "desktop";

	const width = window.innerWidth;

	if (width < 768) return "mobile";
	if (width < 1024) return "tablet";
	return "desktop";
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
	if (typeof window === "undefined") return false;

	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Create extended chart theme
 */
export function createExtendedTheme(
	isDark: boolean = false,
	device: DeviceContext = "desktop",
	context: ChartContext = "dashboard",
	variant: ThemeVariant = "default",
): ExtendedChartTheme {
	const baseTheme = isDark ? BASE_DARK_THEME : BASE_LIGHT_THEME;

	// Apply adjustments in order of precedence
	const theme: ExtendedChartTheme = {
		...baseTheme,
		...DEVICE_ADJUSTMENTS[device],
		...CONTEXT_ADJUSTMENTS[context],
		...VARIANT_ADJUSTMENTS[variant],
	};

	// Apply reduced motion preference
	if (prefersReducedMotion()) {
		theme.animation = {
			...theme.animation,
			duration: 0,
			reducedMotion: true,
		};
	}

	return theme;
}

/**
 * Hook for responsive chart theming
 */
export function useResponsiveChartTheme(
	context: ChartContext = "dashboard",
	variant: ThemeVariant = "default",
	deviceOverride?: DeviceContext,
) {
	const { theme, systemTheme } = useTheme();

	const extendedTheme = useMemo(() => {
		const isDark = theme === "dark" || (theme === "system" && systemTheme === "dark");
		const device = deviceOverride || detectDeviceContext();

		return createExtendedTheme(isDark, device, context, variant);
	}, [theme, systemTheme, context, variant, deviceOverride]);

	return extendedTheme;
}

/**
 * CSS custom properties generator
 */
export function generateChartCSSProperties(theme: ExtendedChartTheme): Record<string, string> {
	return {
		"--chart-bg": theme.background,
		"--chart-text": theme.textColor,
		"--chart-grid": theme.gridColor,
		"--chart-crosshair": theme.crosshairColor,
		"--chart-up": theme.upColor,
		"--chart-down": theme.downColor,
		"--chart-border-up": theme.borderUpColor,
		"--chart-border-down": theme.borderDownColor,
		"--chart-wick-up": theme.wickUpColor,
		"--chart-wick-down": theme.wickDownColor,

		"--chart-font-sm": theme.fontSize.small,
		"--chart-font-md": theme.fontSize.medium,
		"--chart-font-lg": theme.fontSize.large,

		"--chart-padding-sm": `${theme.padding.small}px`,
		"--chart-padding-md": `${theme.padding.medium}px`,
		"--chart-padding-lg": `${theme.padding.large}px`,

		"--chart-touch-size": `${theme.touchTarget.minSize}px`,
		"--chart-touch-padding": `${theme.touchTarget.padding}px`,

		"--chart-border-width": `${theme.border.width}px`,
		"--chart-border-radius": `${theme.border.radius}px`,
		"--chart-border-color": theme.border.color,

		"--chart-shadow-sm": theme.shadow.small,
		"--chart-shadow-md": theme.shadow.medium,
		"--chart-shadow-lg": theme.shadow.large,

		"--chart-animation-duration": `${theme.animation.duration}ms`,
		"--chart-animation-easing": theme.animation.easing,
	};
}

/**
 * Mobile-optimized theme presets
 */
export const MOBILE_THEME_PRESETS = {
	dashboardMobile: (isDark: boolean) =>
		createExtendedTheme(isDark, "mobile", "dashboard", "compact"),

	inlineMobile: (isDark: boolean) => createExtendedTheme(isDark, "mobile", "inline", "minimal"),

	fullscreenMobile: (isDark: boolean) =>
		createExtendedTheme(isDark, "mobile", "fullscreen", "default"),

	accessibleMobile: (isDark: boolean) =>
		createExtendedTheme(isDark, "mobile", "dashboard", "high-contrast"),
} as const;

/**
 * Theme utilities for chart components
 */
export const ChartThemeUtils = {
	create: createExtendedTheme,
	detect: detectDeviceContext,
	reducedMotion: prefersReducedMotion,
	cssProperties: generateChartCSSProperties,
	presets: MOBILE_THEME_PRESETS,
};

/**
 * Chart theme provider component
 */
export function ChartThemeProvider({
	children,
	context = "dashboard",
	variant = "default",
	device,
}: {
	children: React.ReactNode;
	context?: ChartContext;
	variant?: ThemeVariant;
	device?: DeviceContext;
}) {
	const theme = useResponsiveChartTheme(context, variant, device);
	const cssProperties = generateChartCSSProperties(theme);

	return (
		<div style={cssProperties} className="chart-theme-provider">
			{children}
		</div>
	);
}

/**
 * Export theme types for external use
 */
