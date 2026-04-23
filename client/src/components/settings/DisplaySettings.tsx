import { Check, Laptop, Layers, Moon, Palette, Sun, Type } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Theme } from "@/components/theme-provider";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useUpdateUserThemePreferencesMutation } from "@/hooks/use-user-mutations";
import { useAuth } from "@/lib/auth-context";
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
		name: "Light",
		description: "Clean and bright interface",
		icon: Sun,
	},
	{ id: "dark", name: "Dark", description: "Easy on the eyes", icon: Moon },
	{
		id: "system",
		name: "System",
		description: "Follows your system preference",
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
					// Silent retry - will sync on next change
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

	// Load preferences: prefer backend user, fallback to localStorage
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

		// If no backend prefs, load from localStorage
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

	const handleMenuAccentChange = (value: MenuAccent) => {
		setSelectedMenuAccent(value);
		applyTheme(
			selectedTheme,
			designStyle,
			selectedBaseColor,
			selectedAccent,
			selectedFont,
			selectedHeadingFont,
			selectedRadius,
			value,
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
			selectedRadius,
			value,
			selectedMenuColor,
			selectedRtl,
		);
	};

	const handleMenuColorChange = (value: MenuColor) => {
		setSelectedMenuColor(value);
		applyTheme(
			selectedTheme,
			designStyle,
			selectedBaseColor,
			selectedAccent,
			selectedFont,
			selectedHeadingFont,
			selectedRadius,
			selectedMenuAccent,
			value,
			selectedRtl,
		);
		syncToBackend(
			selectedTheme,
			designStyle,
			selectedBaseColor,
			selectedAccent,
			selectedFont,
			selectedHeadingFont,
			selectedRadius,
			selectedMenuAccent,
			value,
			selectedRtl,
		);
	};

	const handleRtlChange = (value: boolean) => {
		setSelectedRtl(value);
		applyTheme(
			selectedTheme,
			designStyle,
			selectedBaseColor,
			selectedAccent,
			selectedFont,
			selectedHeadingFont,
			selectedRadius,
			selectedMenuAccent,
			selectedMenuColor,
			value,
		);
		syncToBackend(
			selectedTheme,
			designStyle,
			selectedBaseColor,
			selectedAccent,
			selectedFont,
			selectedHeadingFont,
			selectedRadius,
			selectedMenuAccent,
			selectedMenuColor,
			value,
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

		toast.success("Display preferences reset to default");
	};

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold">Display & Theme</h1>
				<p className="text-muted-foreground">Personalize your appearance</p>
			</div>

			<DisplayCurrencySelector
				currentCurrency={displayCurrency}
				onCurrencyChange={setDisplayCurrency}
			/>

			<Card>
				<CardHeader>
					<CardTitle>Appearance</CardTitle>
					<CardDescription>Choose how the app looks</CardDescription>
				</CardHeader>
				<CardContent>
					<RadioGroup value={selectedTheme} onValueChange={handleThemeChange}>
						<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
							{themes.map((themeOption) => {
								const Icon = themeOption.icon;
								return (
									<label
										key={themeOption.id}
										htmlFor={themeOption.id}
										className={`
											relative flex cursor-pointer rounded-lg border-2 p-4 transition-all
											${selectedTheme === themeOption.id ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}
										`}
									>
										<div className="flex flex-1 items-start gap-3">
											<div
												className={`
													flex h-10 w-10 items-center justify-center rounded-lg
													${selectedTheme === themeOption.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}
												`}
											>
												<Icon className="h-5 w-5" />
											</div>
											<div className="flex-1">
												<div className="flex items-center gap-2">
													<RadioGroupItem
														value={themeOption.id}
														id={themeOption.id}
														className="sr-only"
													/>
													<span className="font-medium">{themeOption.name}</span>
													{selectedTheme === themeOption.id && (
														<Check className="h-4 w-4 text-primary" />
													)}
												</div>
												<p className="mt-1 text-sm text-muted-foreground">
													{themeOption.description}
												</p>
											</div>
										</div>
									</label>
								);
							})}
						</div>
					</RadioGroup>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Layers className="h-5 w-5" />
						Visual Style
					</CardTitle>
					<CardDescription>Choose a density and spacing preset for the interface</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
						{THEME_STYLE_OPTIONS.map((styleOption) => (
							<button
								type="button"
								key={styleOption.id}
								onClick={() => handleStyleChange(styleOption.id)}
								className={`
									flex items-center justify-between rounded-lg border-2 p-4 text-left transition-all
									${designStyle === styleOption.id ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}
								`}
							>
								<div>
									<p className="font-medium">{styleOption.name}</p>
									<p className="text-sm text-muted-foreground">{styleOption.description}</p>
								</div>
								{designStyle === styleOption.id && <Check className="h-4 w-4 text-primary" />}
							</button>
						))}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Palette className="h-5 w-5" />
						Base Color
					</CardTitle>
					<CardDescription>
						The gray scale that forms the foundation of your interface
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
						{BASE_COLOR_OPTIONS.map((baseColor) => (
							<button
								type="button"
								key={baseColor.id}
								onClick={() => handleBaseColorChange(baseColor.id)}
								className={`
									flex items-center justify-between rounded-lg border-2 p-4 text-left transition-all
									${selectedBaseColor === baseColor.id ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}
								`}
							>
								<div className="flex items-center gap-3">
									<div
										className="h-6 w-6 rounded-md border"
										style={{ backgroundColor: baseColor.preview }}
									/>
									<div>
										<p className="font-medium">{baseColor.name}</p>
									</div>
								</div>
								{selectedBaseColor === baseColor.id && <Check className="h-4 w-4 text-primary" />}
							</button>
						))}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Palette className="h-5 w-5" />
						Accent Color
					</CardTitle>
					<CardDescription>
						Pick a dynamic shadcn color preset for buttons and highlights
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-8 gap-2 md:grid-cols-13">
						{ACCENT_COLOR_OPTIONS.map((color) => (
							<button
								type="button"
								key={color.id}
								onClick={() => handleAccentChange(color.id)}
								className={`
									relative h-9 w-9 rounded-md border-2 transition-transform hover:scale-105
									${selectedAccent === color.id ? "border-foreground ring-2 ring-ring ring-offset-2 ring-offset-background" : "border-transparent"}
								`}
								style={{ backgroundColor: color.hex }}
								title={color.name}
							>
								{selectedAccent === color.id && (
									<Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" />
								)}
							</button>
						))}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Type className="h-5 w-5" />
						Font Family
					</CardTitle>
					<CardDescription>Choose the typeface for your interface</CardDescription>
				</CardHeader>
				<CardContent>
					<RadioGroup
						value={selectedFont}
						onValueChange={(value) => handleFontChange(value as FontPreference)}
					>
						<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
							{FONT_OPTIONS.map((font) => (
								<button
									type="button"
									key={font.id}
									onClick={() => handleFontChange(font.id)}
									className={`
										relative flex cursor-pointer rounded-lg border-2 p-4 text-left transition-all
										${selectedFont === font.id ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}
									`}
								>
									<div className="flex flex-1 flex-col gap-2">
										<div className="flex items-center gap-2">
											<span className="font-medium">{font.name}</span>
											{selectedFont === font.id && <Check className="h-4 w-4 text-primary" />}
										</div>
										<p className="text-xs text-muted-foreground">{font.description}</p>
										<p className="mt-1 text-sm" style={{ fontFamily: font.fontFamily }}>
											The quick brown fox
										</p>
									</div>
								</button>
							))}
						</div>
					</RadioGroup>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Type className="h-5 w-5" />
						Heading Font
					</CardTitle>
					<CardDescription>
						Choose a separate typeface for headings, or inherit from body
					</CardDescription>
				</CardHeader>
				<CardContent>
					<RadioGroup
						value={selectedHeadingFont}
						onValueChange={(value) => handleHeadingFontChange(value as HeadingFont)}
					>
						<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
							{HEADING_FONT_OPTIONS.map((font) => (
								<button
									type="button"
									key={font.id}
									onClick={() => handleHeadingFontChange(font.id)}
									className={`
										relative flex cursor-pointer rounded-lg border-2 p-4 text-left transition-all
										${selectedHeadingFont === font.id ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}
									`}
								>
									<div className="flex flex-1 flex-col gap-2">
										<div className="flex items-center gap-2">
											<span className="font-medium">{font.name}</span>
											{selectedHeadingFont === font.id && (
												<Check className="h-4 w-4 text-primary" />
											)}
										</div>
										<p className="text-xs text-muted-foreground">{font.description}</p>
										{"fontFamily" in font && (
											<p className="mt-1 text-sm" style={{ fontFamily: font.fontFamily }}>
												The quick brown fox
											</p>
										)}
									</div>
								</button>
							))}
						</div>
					</RadioGroup>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Corner Radius</CardTitle>
					<CardDescription>Match shadcn radius presets from compact to rounded</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
						{RADIUS_OPTIONS.map((radiusOption) => (
							<button
								type="button"
								key={radiusOption.id}
								onClick={() => handleRadiusChange(radiusOption.value)}
								className={`
									flex items-center justify-between rounded-lg border-2 p-4 text-left transition-all
									${selectedRadius === radiusOption.value ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}
								`}
							>
								<div>
									<p className="font-medium">{radiusOption.label}</p>
									<p className="text-sm text-muted-foreground">{radiusOption.description}</p>
								</div>
								{selectedRadius === radiusOption.value && (
									<Check className="h-4 w-4 text-primary" />
								)}
							</button>
						))}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Layers className="h-5 w-5" />
						Sidebar Menu
					</CardTitle>
					<CardDescription>Customize the look and feel of the sidebar navigation</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<div>
						<p className="mb-3 text-sm font-medium">Menu Accent</p>
						<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
							{MENU_ACCENT_OPTIONS.map((option) => (
								<button
									type="button"
									key={option.id}
									onClick={() => handleMenuAccentChange(option.id)}
									className={`
										flex items-center justify-between rounded-lg border-2 p-4 text-left transition-all
										${selectedMenuAccent === option.id ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}
									`}
								>
									<div>
										<p className="font-medium">{option.name}</p>
										<p className="text-sm text-muted-foreground">{option.description}</p>
									</div>
									{selectedMenuAccent === option.id && <Check className="h-4 w-4 text-primary" />}
								</button>
							))}
						</div>
					</div>
					<div>
						<p className="mb-3 text-sm font-medium">Menu Color</p>
						<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
							{MENU_COLOR_OPTIONS.map((option) => (
								<button
									type="button"
									key={option.id}
									onClick={() => handleMenuColorChange(option.id)}
									className={`
										flex items-center justify-between rounded-lg border-2 p-4 text-left transition-all
										${selectedMenuColor === option.id ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}
									`}
								>
									<div>
										<p className="font-medium">{option.name}</p>
										<p className="text-sm text-muted-foreground">{option.description}</p>
									</div>
									{selectedMenuColor === option.id && <Check className="h-4 w-4 text-primary" />}
								</button>
							))}
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Layout Direction</CardTitle>
					<CardDescription>Choose between left-to-right and right-to-left layout</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
						<button
							type="button"
							onClick={() => handleRtlChange(false)}
							className={`
								flex items-center justify-between rounded-lg border-2 p-4 text-left transition-all
								${!selectedRtl ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}
							`}
						>
							<div>
								<p className="font-medium">Left to Right</p>
								<p className="text-sm text-muted-foreground">Default layout direction</p>
							</div>
							{!selectedRtl && <Check className="h-4 w-4 text-primary" />}
						</button>
						<button
							type="button"
							onClick={() => handleRtlChange(true)}
							className={`
								flex items-center justify-between rounded-lg border-2 p-4 text-left transition-all
								${selectedRtl ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}
							`}
						>
							<div>
								<p className="font-medium">Right to Left</p>
								<p className="text-sm text-muted-foreground">
									Arabic, Hebrew, and other RTL languages
								</p>
							</div>
							{selectedRtl && <Check className="h-4 w-4 text-primary" />}
						</button>
					</div>
				</CardContent>
			</Card>

			<div className="flex justify-end gap-3 border-t pt-4">
				<Button variant="outline" onClick={resetToDefault}>
					Reset to Default
				</Button>
			</div>
		</div>
	);
}
