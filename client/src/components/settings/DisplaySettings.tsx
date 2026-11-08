import { Check, Laptop, Layers, Moon, Palette, Sparkles, Sun, TrendingUp, Type } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Theme } from "@/components/theme-provider";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { useUpdateUserThemePreferencesMutation } from "@/hooks/use-user-mutations";
import { useAuth } from "@/hooks/use-auth";
import {
	ACCENT_COLOR_OPTIONS,
	type AccentColor,
	applyShadcnThemePreferences,
	BASE_COLOR_OPTIONS,
	type BaseColor,
	DEFAULT_SHADCN_THEME_PREFERENCES,
	FONT_OPTIONS,
	type FontPreference,
	getSystemTheme,
	HEADING_FONT_OPTIONS,
	type HeadingFont,
	loadShadcnThemePreferences,
	MENU_ACCENT_OPTIONS,
	MENU_COLOR_OPTIONS,
	type MenuAccent,
	type MenuColor,
	RADIUS_OPTIONS,
	saveShadcnThemePreferences,
	THEME_STYLE_OPTIONS,
	type ThemeStyle,
} from "@/lib/theme/shadcn-theme";
import { useDesignSystem } from "@/providers/design-system-provider";
import { DisplayCurrencySelector } from "./DisplayCurrencySelector";

const themes: {
	id: Theme;
	name: string;
	description: string;
	icon: typeof Sun;
}[] = [
	{
		id: "light",
		name: "Clair",
		description: "Interface lumineuse et contrastée",
		icon: Sun,
	},
	{
		id: "dark",
		name: "Sombre",
		description: "Noir d'encre reposant pour les yeux",
		icon: Moon,
	},
	{
		id: "system",
		name: "Système",
		description: "S'adapte automatiquement à votre OS",
		icon: Laptop,
	},
];

function isTheme(value: string): value is Theme {
	return value === "light" || value === "dark" || value === "system";
}

function isAccentColor(value: string): value is AccentColor {
	return ACCENT_COLOR_OPTIONS.some((c) => c.id === value);
}

function isFontPreference(value: string): value is FontPreference {
	return FONT_OPTIONS.some((f) => f.id === value);
}

function isThemeStyle(value: string): value is ThemeStyle {
	return THEME_STYLE_OPTIONS.some((s) => s.id === value);
}

function isBaseColor(value: string): value is BaseColor {
	return BASE_COLOR_OPTIONS.some((b) => b.id === value);
}

function isHeadingFont(value: string): value is HeadingFont {
	return value === "inherit" || FONT_OPTIONS.some((f) => f.id === value);
}

function isMenuAccent(value: string): value is MenuAccent {
	return value === "subtle" || value === "bold";
}

function isMenuColor(value: string): value is MenuColor {
	return MENU_COLOR_OPTIONS.some((m) => m.id === value);
}

export function DisplaySettings() {
	const { user } = useAuth();
	const { theme, setTheme } = useTheme();
	const { style: designStyle, setStyle: setDesignStyle } = useDesignSystem();
	const [selectedTheme, setSelectedTheme] = useState<Theme>(theme);
	const [selectedAccent, setSelectedAccent] = useState<AccentColor>(
		DEFAULT_SHADCN_THEME_PREFERENCES.accentColor,
	);
	const [selectedFont, setSelectedFont] = useState<FontPreference>(
		DEFAULT_SHADCN_THEME_PREFERENCES.fontPreference,
	);
	const [selectedHeadingFont, setSelectedHeadingFont] = useState<HeadingFont>("inherit");
	const [selectedRadius, setSelectedRadius] = useState<number>(
		DEFAULT_SHADCN_THEME_PREFERENCES.radius,
	);
	const [selectedBaseColor, setSelectedBaseColor] = useState<BaseColor>(
		DEFAULT_SHADCN_THEME_PREFERENCES.baseColor,
	);
	const [selectedMenuAccent, setSelectedMenuAccent] = useState<MenuAccent>(
		DEFAULT_SHADCN_THEME_PREFERENCES.menuAccent,
	);
	const [selectedMenuColor, setSelectedMenuColor] = useState<MenuColor>(
		DEFAULT_SHADCN_THEME_PREFERENCES.menuColor,
	);
	const [selectedRtl, setSelectedRtl] = useState(false);
	const [displayCurrency, setDisplayCurrency] = useState("USD");
	const [updateThemePrefs] = useUpdateUserThemePreferencesMutation();
	const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const applyTheme = useCallback(
		(
			themeMode: Theme,
			style: ThemeStyle,
			baseColor: BaseColor,
			accent: AccentColor,
			font: FontPreference,
			headingFont: HeadingFont,
			radius: number,
			menuAccent: MenuAccent,
			menuColor: MenuColor,
			rtl: boolean,
		) => {
			const resolved = themeMode === "system" ? getSystemTheme() : themeMode;
			const preferences = {
				style,
				baseColor,
				accentColor: accent,
				fontPreference: font,
				headingFont,
				radius,
				menuAccent,
				menuColor,
				rtl,
			};

			setTheme(themeMode);
			saveShadcnThemePreferences(preferences);
			applyShadcnThemePreferences(preferences, resolved);
		},
		[setTheme],
	);

	const syncToBackend = useCallback(
		(
			themeMode: Theme,
			style: ThemeStyle,
			baseColor: BaseColor,
			accent: AccentColor,
			font: FontPreference,
			headingFont: HeadingFont,
			radius: number,
			menuAccent: MenuAccent,
			menuColor: MenuColor,
			rtl: boolean,
		) => {
			if (!user) return;

			if (syncTimeoutRef.current) {
				clearTimeout(syncTimeoutRef.current);
			}

			syncTimeoutRef.current = setTimeout(async () => {
				try {
					await updateThemePrefs({
						variables: {
							input: {
								themePreference: themeMode,
								themeBaseColor: baseColor,
								themeAccentColor: accent,
								themeFontPreference: font,
								themeHeadingFont: headingFont,
								themeMenuAccent: menuAccent,
								themeMenuColor: menuColor,
								themeStyle: style,
								themeRadius: radius,
								themeRTL: rtl,
							},
						},
					});
				} catch {
					// Silent retry
				}
			}, 500);
		},
		[user, updateThemePrefs],
	);

	useEffect(() => {
		return () => {
			if (syncTimeoutRef.current) {
				clearTimeout(syncTimeoutRef.current);
			}
		};
	}, []);

	// Load preferences
	useEffect(() => {
		setSelectedTheme(theme);

		if (user?.themePreference && isTheme(user.themePreference)) {
			setSelectedTheme(user.themePreference);
		}
		if (user?.themeBaseColor && isBaseColor(user.themeBaseColor)) {
			setSelectedBaseColor(user.themeBaseColor);
		}
		if (user?.themeAccentColor && isAccentColor(user.themeAccentColor)) {
			setSelectedAccent(user.themeAccentColor);
		}
		if (user?.themeFontPreference && isFontPreference(user.themeFontPreference)) {
			setSelectedFont(user.themeFontPreference);
		}
		if (user?.themeHeadingFont && isHeadingFont(user.themeHeadingFont)) {
			setSelectedHeadingFont(user.themeHeadingFont);
		}
		if (user?.themeMenuAccent && isMenuAccent(user.themeMenuAccent)) {
			setSelectedMenuAccent(user.themeMenuAccent);
		}
		if (user?.themeMenuColor && isMenuColor(user.themeMenuColor)) {
			setSelectedMenuColor(user.themeMenuColor);
		}
		if (user?.themeStyle && isThemeStyle(user.themeStyle)) {
			setDesignStyle(user.themeStyle);
		}
		if (typeof user?.themeRadius === "number") {
			setSelectedRadius(user.themeRadius);
		}
		if (typeof user?.themeRTL === "boolean") {
			setSelectedRtl(user.themeRTL);
		}

		const hasBackendThemePrefs =
			user?.themePreference ||
			user?.themeBaseColor ||
			user?.themeAccentColor ||
			user?.themeFontPreference ||
			user?.themeHeadingFont ||
			user?.themeMenuAccent ||
			user?.themeMenuColor ||
			user?.themeStyle ||
			typeof user?.themeRadius === "number" ||
			typeof user?.themeRTL === "boolean";

		if (!hasBackendThemePrefs) {
			const local = loadShadcnThemePreferences();
			setSelectedAccent(local.accentColor);
			setSelectedFont(local.fontPreference);
			setSelectedHeadingFont(local.headingFont);
			setSelectedRadius(local.radius);
			setDesignStyle(local.style);
			setSelectedBaseColor(local.baseColor);
			setSelectedMenuAccent(local.menuAccent);
			setSelectedMenuColor(local.menuColor);
			setSelectedRtl(local.rtl);
		}
	}, [theme, user, setDesignStyle]);

	useEffect(() => {
		if (user?.displayCurrency) {
			setDisplayCurrency(user.displayCurrency);
		}
	}, [user?.displayCurrency]);

	const handleThemeChange = (value: string) => {
		if (isTheme(value)) {
			setSelectedTheme(value);
			applyTheme(
				value,
				designStyle,
				selectedBaseColor,
				selectedAccent,
				selectedFont,
				selectedHeadingFont,
				selectedRadius,
				selectedMenuAccent,
				selectedMenuColor,
				selectedRtl,
			);
			syncToBackend(
				value,
				designStyle,
				selectedBaseColor,
				selectedAccent,
				selectedFont,
				selectedHeadingFont,
				selectedRadius,
				selectedMenuAccent,
				selectedMenuColor,
				selectedRtl,
			);
		}
	};

	const handleStyleChange = (value: ThemeStyle) => {
		setDesignStyle(value);
		applyTheme(
			selectedTheme,
			value,
			selectedBaseColor,
			selectedAccent,
			selectedFont,
			selectedHeadingFont,
			selectedRadius,
			selectedMenuAccent,
			selectedMenuColor,
			selectedRtl,
		);
		syncToBackend(
			selectedTheme,
			value,
			selectedBaseColor,
			selectedAccent,
			selectedFont,
			selectedHeadingFont,
			selectedRadius,
			selectedMenuAccent,
			selectedMenuColor,
			selectedRtl,
		);
	};

	const handleBaseColorChange = (value: BaseColor) => {
		setSelectedBaseColor(value);
		applyTheme(
			selectedTheme,
			designStyle,
			value,
			selectedAccent,
			selectedFont,
			selectedHeadingFont,
			selectedRadius,
			selectedMenuAccent,
			selectedMenuColor,
			selectedRtl,
		);
		syncToBackend(
			selectedTheme,
			designStyle,
			value,
			selectedAccent,
			selectedFont,
			selectedHeadingFont,
			selectedRadius,
			selectedMenuAccent,
			selectedMenuColor,
			selectedRtl,
		);
	};

	const handleAccentChange = (value: AccentColor) => {
		setSelectedAccent(value);
		applyTheme(
			selectedTheme,
			designStyle,
			selectedBaseColor,
			value,
			selectedFont,
			selectedHeadingFont,
			selectedRadius,
			selectedMenuAccent,
			selectedMenuColor,
			selectedRtl,
		);
		syncToBackend(
			selectedTheme,
			designStyle,
			selectedBaseColor,
			value,
			selectedFont,
			selectedHeadingFont,
			selectedRadius,
			selectedMenuAccent,
			selectedMenuColor,
			selectedRtl,
		);
	};

	const handleFontChange = (value: FontPreference) => {
		setSelectedFont(value);
		applyTheme(
			selectedTheme,
			designStyle,
			selectedBaseColor,
			selectedAccent,
			value,
			selectedHeadingFont,
			selectedRadius,
			selectedMenuAccent,
			selectedMenuColor,
			selectedRtl,
		);
		syncToBackend(
			selectedTheme,
			designStyle,
			selectedBaseColor,
			selectedAccent,
			value,
			selectedHeadingFont,
			selectedRadius,
			selectedMenuAccent,
			selectedMenuColor,
			selectedRtl,
		);
	};

	const handleHeadingFontChange = (value: HeadingFont) => {
		setSelectedHeadingFont(value);
		applyTheme(
			selectedTheme,
			designStyle,
			selectedBaseColor,
			selectedAccent,
			selectedFont,
			value,
			selectedRadius,
			selectedMenuAccent,
			selectedMenuColor,
			selectedRtl,
		);
		syncToBackend(
			selectedTheme,
			designStyle,
			selectedBaseColor,
			selectedAccent,
			selectedFont,
			value,
			selectedRadius,
			selectedMenuAccent,
			selectedMenuColor,
			selectedRtl,
		);
	};

	const handleRadiusChange = (value: number) => {
		setSelectedRadius(value);
		applyTheme(
			selectedTheme,
			designStyle,
			selectedBaseColor,
			selectedAccent,
			selectedFont,
			selectedHeadingFont,
			value,
			selectedMenuAccent,
			selectedMenuColor,
			selectedRtl,
		);
		syncToBackend(
			selectedTheme,
			designStyle,
			selectedBaseColor,
			selectedAccent,
			selectedFont,
			selectedHeadingFont,
			value,
			selectedMenuAccent,
			selectedMenuColor,
			selectedRtl,
		);
	};

	const resetToDefault = () => {
		setSelectedTheme("system");
		setDesignStyle(DEFAULT_SHADCN_THEME_PREFERENCES.style);
		setSelectedBaseColor(DEFAULT_SHADCN_THEME_PREFERENCES.baseColor);
		setSelectedAccent(DEFAULT_SHADCN_THEME_PREFERENCES.accentColor);
		setSelectedFont(DEFAULT_SHADCN_THEME_PREFERENCES.fontPreference);
		setSelectedHeadingFont(DEFAULT_SHADCN_THEME_PREFERENCES.headingFont);
		setSelectedRadius(DEFAULT_SHADCN_THEME_PREFERENCES.radius);
		setSelectedMenuAccent(DEFAULT_SHADCN_THEME_PREFERENCES.menuAccent);
		setSelectedMenuColor(DEFAULT_SHADCN_THEME_PREFERENCES.menuColor);
		setSelectedRtl(DEFAULT_SHADCN_THEME_PREFERENCES.rtl);

		applyTheme(
			"system",
			DEFAULT_SHADCN_THEME_PREFERENCES.style,
			DEFAULT_SHADCN_THEME_PREFERENCES.baseColor,
			DEFAULT_SHADCN_THEME_PREFERENCES.accentColor,
			DEFAULT_SHADCN_THEME_PREFERENCES.fontPreference,
			DEFAULT_SHADCN_THEME_PREFERENCES.headingFont,
			DEFAULT_SHADCN_THEME_PREFERENCES.radius,
			DEFAULT_SHADCN_THEME_PREFERENCES.menuAccent,
			DEFAULT_SHADCN_THEME_PREFERENCES.menuColor,
			DEFAULT_SHADCN_THEME_PREFERENCES.rtl,
		);

		if (user) {
			updateThemePrefs({
				variables: {
					input: {
						themePreference: "system",
						themeBaseColor: DEFAULT_SHADCN_THEME_PREFERENCES.baseColor,
						themeAccentColor: DEFAULT_SHADCN_THEME_PREFERENCES.accentColor,
						themeFontPreference: DEFAULT_SHADCN_THEME_PREFERENCES.fontPreference,
						themeHeadingFont: DEFAULT_SHADCN_THEME_PREFERENCES.headingFont,
						themeMenuAccent: DEFAULT_SHADCN_THEME_PREFERENCES.menuAccent,
						themeMenuColor: DEFAULT_SHADCN_THEME_PREFERENCES.menuColor,
						themeStyle: DEFAULT_SHADCN_THEME_PREFERENCES.style,
						themeRadius: DEFAULT_SHADCN_THEME_PREFERENCES.radius,
						themeRTL: DEFAULT_SHADCN_THEME_PREFERENCES.rtl,
					},
				},
			}).catch(() => {
				// Silent retry
			});
		}

		toast.success("Préférences d'affichage réinitialisées");
	};

	return (
		<div className="space-y-6">
			{/* En-tête */}
			<div className="flex flex-col gap-1">
				<div className="flex items-center gap-2">
					<Palette className="h-5 w-5 text-muted-foreground" />
					<h1 className="text-xl font-semibold tracking-tight text-foreground">
						Affichage & Thème
					</h1>
				</div>
				<p className="text-xs text-muted-foreground">
					Personnalisez le rendu visuel, les contrastes, la typographie et la devise d'évaluation.
				</p>
			</div>

			{/* Sélecteur de Devise */}
			<DisplayCurrencySelector
				currentCurrency={displayCurrency}
				onCurrencyChange={setDisplayCurrency}
			/>

			{/* Widget d'Aperçu en Direct Interactif */}
			<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs p-5 space-y-4 shadow-xs">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Sparkles className="h-4 w-4 text-primary" />
						<h2 className="text-sm font-semibold tracking-tight text-foreground">
							Aperçu en Direct du Terminal
						</h2>
					</div>
					<span className="text-[11px] font-mono text-muted-foreground bg-muted/30 border border-border/50 px-2 py-0.5 rounded">
						Simulation temps réel
					</span>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					{/* KPI Card Simulate */}
					<div className="rounded-xl border border-border/60 bg-card/40 p-4 flex flex-col justify-between">
						<div className="flex items-center justify-between">
							<span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
								Patrimoine Net
							</span>
							<span className="h-2 w-2 rounded-full bg-emerald-500" />
						</div>
						<div className="mt-3">
							<p className="text-2xl font-bold font-mono tracking-tight tabular-nums text-foreground">
								{displayCurrency === "EUR"
									? "142 850,00 €"
									: displayCurrency === "GBP"
										? "£142,850.00"
										: "$142,850.00"}
							</p>
							<div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-500 font-medium font-mono tabular-nums">
								<TrendingUp className="h-3 w-3" />
								<span>+2 340,00 € (+1,64%)</span>
								<span className="text-muted-foreground text-[10px]">aujourd'hui</span>
							</div>
						</div>
					</div>

					{/* Sample Financial Row */}
					<div className="md:col-span-2 rounded-xl border border-border/60 bg-card/40 divide-y divide-border/30 overflow-hidden text-xs">
						<div className="p-2.5 px-3.5 flex items-center justify-between bg-muted/20 text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
							<span>Actif financier</span>
							<span>Valorisation & Performance</span>
						</div>
						<div className="p-3 px-3.5 flex items-center justify-between hover:bg-muted/30 transition-colors">
							<div className="flex items-center gap-2.5">
								<div className="flex h-7 w-7 items-center justify-center rounded bg-muted/60 font-mono text-[10px] font-bold text-foreground">
									NVDA
								</div>
								<div>
									<p className="font-semibold text-foreground">NVIDIA Corporation</p>
									<p className="text-[11px] text-muted-foreground font-mono">15.00 actions</p>
								</div>
							</div>
							<div className="text-right">
								<p className="font-mono font-medium tabular-nums text-foreground">
									{displayCurrency === "EUR" ? "1 740,00 €" : "$1,740.00"}
								</p>
								<p className="text-[11px] font-mono tabular-nums text-emerald-500 font-medium">
									+4,12%
								</p>
							</div>
						</div>
						<div className="p-3 px-3.5 flex items-center justify-between hover:bg-muted/30 transition-colors">
							<div className="flex items-center gap-2.5">
								<div className="flex h-7 w-7 items-center justify-center rounded bg-amber-500/10 text-amber-500 font-mono text-[10px] font-bold">
									BTC
								</div>
								<div>
									<p className="font-semibold text-foreground">Bitcoin (On-Chain)</p>
									<p className="text-[11px] text-muted-foreground font-mono">0.45000000 BTC</p>
								</div>
							</div>
							<div className="text-right">
								<p className="font-mono font-medium tabular-nums text-foreground">
									{displayCurrency === "EUR" ? "38 250,00 €" : "$38,250.00"}
								</p>
								<p className="text-[11px] font-mono tabular-nums text-emerald-500 font-medium">
									+1,85%
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Mode d'Apparence */}
			<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs p-6 space-y-4">
				<div>
					<h2 className="text-sm font-semibold text-foreground">Mode d'Apparence</h2>
					<p className="text-xs text-muted-foreground mt-0.5">
						Choisissez la tonalité globale de l'interface.
					</p>
				</div>

				<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
					{themes.map((themeOption) => {
						const Icon = themeOption.icon;
						const isSelected = selectedTheme === themeOption.id;
						return (
							<button
								type="button"
								key={themeOption.id}
								onClick={() => handleThemeChange(themeOption.id)}
								className={`flex items-center justify-between p-3.5 rounded-lg border text-left transition-all ${
									isSelected
										? "bg-secondary/70 border-primary/50 text-foreground shadow-2xs"
										: "bg-card/20 hover:bg-muted/30 border-border/40 text-muted-foreground hover:text-foreground"
								}`}
							>
								<div className="flex items-center gap-3 min-w-0">
									<div
										className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/60 ${
											isSelected ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground"
										}`}
									>
										<Icon className="h-4 w-4" />
									</div>
									<div className="min-w-0">
										<p className="text-xs font-semibold text-foreground truncate">{themeOption.name}</p>
										<p className="text-[11px] text-muted-foreground truncate">{themeOption.description}</p>
									</div>
								</div>
								{isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-1.5" />}
							</button>
						);
					})}
				</div>
			</div>

			{/* Style Visuel (Presets Sigma) */}
			<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs p-6 space-y-4">
				<div>
					<div className="flex items-center gap-2">
						<Layers className="h-4 w-4 text-muted-foreground" />
						<h2 className="text-sm font-semibold text-foreground">Style Visuel & Densité</h2>
					</div>
					<p className="text-xs text-muted-foreground mt-0.5">
						Préréglages d'espacement, d'élévation et d'arrondis inspirés des grands terminaux financiers.
					</p>
				</div>

				<div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
					{THEME_STYLE_OPTIONS.map((styleOption) => {
						const isSelected = designStyle === styleOption.id;
						return (
							<button
								type="button"
								key={styleOption.id}
								onClick={() => handleStyleChange(styleOption.id)}
								className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
									isSelected
										? "bg-secondary/70 border-primary/50 text-foreground shadow-2xs"
										: "bg-card/20 hover:bg-muted/30 border-border/40 text-muted-foreground hover:text-foreground"
								}`}
							>
								<div className="min-w-0">
									<p className="text-xs font-semibold text-foreground">{styleOption.name}</p>
									<p className="text-[11px] text-muted-foreground truncate">{styleOption.description}</p>
								</div>
								{isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-2" />}
							</button>
						);
					})}
				</div>
			</div>

			{/* Nuancier de Base & Couleur d'Accent */}
			<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs p-6 space-y-5">
				<div>
					<h2 className="text-sm font-semibold text-foreground">Couleur de Base & Accent</h2>
					<p className="text-xs text-muted-foreground mt-0.5">
						Définissez la teinte neutre sous-jacente et les rehauts interactifs.
					</p>
				</div>

				{/* Nuance de base */}
				<div className="space-y-2">
					<p className="text-xs font-medium text-foreground">Nuancier de fond (Gris)</p>
					<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
						{BASE_COLOR_OPTIONS.map((baseColor) => {
							const isSelected = selectedBaseColor === baseColor.id;
							return (
								<button
									type="button"
									key={baseColor.id}
									onClick={() => handleBaseColorChange(baseColor.id)}
									className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
										isSelected
											? "bg-secondary/70 border-primary/50 text-foreground shadow-2xs"
											: "bg-card/20 hover:bg-muted/30 border-border/40 text-muted-foreground hover:text-foreground"
									}`}
								>
									<div
										className="h-4 w-4 rounded-full border border-border/80 shrink-0"
										style={{ backgroundColor: baseColor.preview }}
									/>
									<span className="text-xs font-medium truncate">{baseColor.name}</span>
								</button>
							);
						})}
					</div>
				</div>

				{/* Couleur d'accent */}
				<div className="space-y-2 pt-2">
					<p className="text-xs font-medium text-foreground">Accent dynamique</p>
					<div className="flex flex-wrap gap-2">
						{ACCENT_COLOR_OPTIONS.map((color) => {
							const isSelected = selectedAccent === color.id;
							return (
								<button
									type="button"
									key={color.id}
									onClick={() => handleAccentChange(color.id)}
									className={`relative h-7 w-7 rounded-full border transition-transform hover:scale-105 ${
										isSelected
											? "border-foreground ring-2 ring-ring ring-offset-2 ring-offset-background"
											: "border-border/60"
									}`}
									style={{ backgroundColor: color.hex }}
									title={color.name}
								>
									{isSelected && (
										<Check className="absolute inset-0 m-auto h-3 w-3 text-white drop-shadow" />
									)}
								</button>
							);
						})}
					</div>
				</div>
			</div>

			{/* Typographie */}
			<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs p-6 space-y-4">
				<div>
					<div className="flex items-center gap-2">
						<Type className="h-4 w-4 text-muted-foreground" />
						<h2 className="text-sm font-semibold text-foreground">Typographie</h2>
					</div>
					<p className="text-xs text-muted-foreground mt-0.5">
						Choisissez la famille de polices de corps et de titrage.
					</p>
				</div>

				<div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
					{FONT_OPTIONS.map((font) => {
						const isSelected = selectedFont === font.id;
						return (
							<button
								type="button"
								key={font.id}
								onClick={() => handleFontChange(font.id)}
								className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
									isSelected
										? "bg-secondary/70 border-primary/50 text-foreground shadow-2xs"
										: "bg-card/20 hover:bg-muted/30 border-border/40 text-muted-foreground hover:text-foreground"
								}`}
							>
								<div>
									<div className="flex items-center gap-2">
										<span className="text-xs font-medium text-foreground">{font.name}</span>
										<span className="text-[10px] text-muted-foreground">({font.description})</span>
									</div>
									<p
										className="mt-1 text-xs text-muted-foreground/80 font-normal"
										style={{ fontFamily: font.fontFamily }}
									>
										Sigma Finance 123 456 €
									</p>
								</div>
								{isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-2" />}
							</button>
						);
					})}
				</div>
			</div>

			{/* Rayon des Angles (Corner Radius) */}
			<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs p-6 space-y-4">
				<div>
					<h2 className="text-sm font-semibold text-foreground">Arrondis des Éléments (Radius)</h2>
					<p className="text-xs text-muted-foreground mt-0.5">
						Ajuste la courbure des bordures de boutons, cartes et fenêtres.
					</p>
				</div>

				<div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
					{RADIUS_OPTIONS.map((radiusOption) => {
						const isSelected = selectedRadius === radiusOption.value;
						return (
							<button
								type="button"
								key={radiusOption.id}
								onClick={() => handleRadiusChange(radiusOption.value)}
								className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
									isSelected
										? "bg-secondary/70 border-primary/50 text-foreground shadow-2xs"
										: "bg-card/20 hover:bg-muted/30 border-border/40 text-muted-foreground hover:text-foreground"
								}`}
							>
								<div className="min-w-0">
									<p className="text-xs font-semibold text-foreground">{radiusOption.label}</p>
									<p className="text-[10px] text-muted-foreground truncate">
										{radiusOption.description}
									</p>
								</div>
								{isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-1.5" />}
							</button>
						);
					})}
				</div>
			</div>

			{/* Pied de page: Réinitialisation */}
			<div className="flex justify-end pt-2">
				<Button
					variant="ghost"
					size="sm"
					onClick={resetToDefault}
					className="text-xs text-muted-foreground hover:text-foreground"
				>
					Rétablir les paramètres d'affichage par défaut
				</Button>
			</div>
		</div>
	);
}
