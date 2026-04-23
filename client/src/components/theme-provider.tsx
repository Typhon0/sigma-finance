import { createContext, useContext, useEffect, useState } from "react";
import {
	applyShadcnThemePreferences,
	getSystemTheme,
	loadShadcnThemePreferences,
} from "@/lib/theme/shadcn-theme";

export type Theme = "dark" | "light" | "system";
type ResolvedTheme = "dark" | "light";

type ThemeProviderProps = {
	children: React.ReactNode;
	defaultTheme?: Theme;
	storageKey?: string;
};

type ThemeProviderState = {
	theme: Theme;
	resolvedTheme: ResolvedTheme;
	setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
	theme: "system",
	resolvedTheme: "dark",
	setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

function isTheme(value: string | null): value is Theme {
	return value === "light" || value === "dark" || value === "system";
}

export function ThemeProvider({
	children,
	defaultTheme = "system",
	storageKey = "vite-ui-theme",
	...props
}: ThemeProviderProps) {
	const [theme, setTheme] = useState<Theme>(() => {
		const storedTheme = localStorage.getItem(storageKey);
		return isTheme(storedTheme) ? storedTheme : defaultTheme;
	});
	const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
		if (theme === "system") {
			return getSystemTheme();
		}
		return theme;
	});

	useEffect(() => {
		const root = window.document.documentElement;
		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

		const applyTheme = (nextTheme: ResolvedTheme) => {
			root.classList.remove("light", "dark");
			root.classList.add(nextTheme);
			setResolvedTheme(nextTheme);
			applyShadcnThemePreferences(loadShadcnThemePreferences(), nextTheme);
		};

		if (theme === "system") {
			const systemTheme = getSystemTheme();
			applyTheme(systemTheme);

			const handleSystemThemeChange = () => {
				applyTheme(getSystemTheme());
			};

			mediaQuery.addEventListener("change", handleSystemThemeChange);
			return () => {
				mediaQuery.removeEventListener("change", handleSystemThemeChange);
			};
		}

		applyTheme(theme);
	}, [theme]);

	const value = {
		theme,
		resolvedTheme,
		setTheme: (theme: Theme) => {
			localStorage.setItem(storageKey, theme);
			setTheme(theme);
		},
	};

	return (
		<ThemeProviderContext.Provider {...props} value={value}>
			{children}
		</ThemeProviderContext.Provider>
	);
}

export const useTheme = () => {
	const context = useContext(ThemeProviderContext);

	if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider");

	return context;
};
