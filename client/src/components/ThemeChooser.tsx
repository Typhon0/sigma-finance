import { Check, Laptop, Moon, Palette, Sun, Type } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";

const themes = [
	{
		id: "light",
		name: "Light",
		description: "Clean and bright interface",
		icon: Sun,
	},
	{
		id: "dark",
		name: "Dark",
		description: "Easy on the eyes",
		icon: Moon,
	},
	{
		id: "system",
		name: "System",
		description: "Follows your system preference",
		icon: Laptop,
	},
];

const accentColors = [
	{ id: "slate", name: "Slate", color: "#64748b" },
	{ id: "gray", name: "Gray", color: "#6b7280" },
	{ id: "zinc", name: "Zinc", color: "#71717a" },
	{ id: "neutral", name: "Neutral", color: "#737373" },
	{ id: "stone", name: "Stone", color: "#78716c" },
	{ id: "red", name: "Red", color: "#ef4444" },
	{ id: "orange", name: "Orange", color: "#f97316" },
	{ id: "amber", name: "Amber", color: "#f59e0b" },
	{ id: "yellow", name: "Yellow", color: "#eab308" },
	{ id: "lime", name: "Lime", color: "#84cc16" },
	{ id: "green", name: "Green", color: "#22c55e" },
	{ id: "emerald", name: "Emerald", color: "#10b981" },
	{ id: "teal", name: "Teal", color: "#14b8a6" },
	{ id: "cyan", name: "Cyan", color: "#06b6d4" },
	{ id: "sky", name: "Sky", color: "#0ea5e9" },
	{ id: "blue", name: "Blue", color: "#3b82f6" },
	{ id: "indigo", name: "Indigo", color: "#6366f1" },
	{ id: "violet", name: "Violet", color: "#8b5cf6" },
	{ id: "purple", name: "Purple", color: "#a855f7" },
	{ id: "fuchsia", name: "Fuchsia", color: "#d946ef" },
	{ id: "pink", name: "Pink", color: "#ec4899" },
	{ id: "rose", name: "Rose", color: "#f43f5e" },
];

const fontOptions = [
	{
		id: "inter",
		name: "Inter",
		description: "Modern and versatile",
		fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
		preview: "The quick brown fox jumps",
	},
	{
		id: "roboto",
		name: "Roboto",
		description: "Clean and geometric",
		fontFamily: "'Roboto', -apple-system, BlinkMacSystemFont, sans-serif",
		preview: "The quick brown fox jumps",
	},
	{
		id: "opensans",
		name: "Open Sans",
		description: "Friendly and readable",
		fontFamily: "'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif",
		preview: "The quick brown fox jumps",
	},
	{
		id: "lato",
		name: "Lato",
		description: "Elegant and professional",
		fontFamily: "'Lato', -apple-system, BlinkMacSystemFont, sans-serif",
		preview: "The quick brown fox jumps",
	},
	{
		id: "poppins",
		name: "Poppins",
		description: "Geometric and playful",
		fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif",
		preview: "The quick brown fox jumps",
	},
	{
		id: "montserrat",
		name: "Montserrat",
		description: "Urban and contemporary",
		fontFamily: "'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif",
		preview: "The quick brown fox jumps",
	},
	{
		id: "sourcesans",
		name: "Source Sans 3",
		description: "Balanced and versatile",
		fontFamily: "'Source Sans 3', -apple-system, BlinkMacSystemFont, sans-serif",
		preview: "The quick brown fox jumps",
	},
	{
		id: "worksans",
		name: "Work Sans",
		description: "Optimized for screens",
		fontFamily: "'Work Sans', -apple-system, BlinkMacSystemFont, sans-serif",
		preview: "The quick brown fox jumps",
	},
	{
		id: "nunito",
		name: "Nunito",
		description: "Rounded and friendly",
		fontFamily: "'Nunito', -apple-system, BlinkMacSystemFont, sans-serif",
		preview: "The quick brown fox jumps",
	},
	{
		id: "raleway",
		name: "Raleway",
		description: "Elegant and sophisticated",
		fontFamily: "'Raleway', -apple-system, BlinkMacSystemFont, sans-serif",
		preview: "The quick brown fox jumps",
	},
];

export function ThemeChooser() {
	const [selectedTheme, setSelectedTheme] = useState("system");
	const [selectedAccent, setSelectedAccent] = useState("slate");
	const [selectedFont, setSelectedFont] = useState("inter");

	// Load saved preferences on mount
	useEffect(() => {
		const savedTheme = localStorage.getItem("theme_preference") || "system";
		const savedAccent = localStorage.getItem("accent_color") || "slate";
		const savedFont = localStorage.getItem("font_preference") || "inter";

		setSelectedTheme(savedTheme);
		setSelectedAccent(savedAccent);
		setSelectedFont(savedFont);
	}, []);

	const applyTheme = () => {
		const isDark =
			selectedTheme === "dark" ||
			(selectedTheme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

		if (isDark) {
			document.documentElement.classList.add("dark");
		} else {
			document.documentElement.classList.remove("dark");
		}

		// Apply font
		const selectedFontOption = fontOptions.find((f) => f.id === selectedFont);
		if (selectedFontOption) {
			document.documentElement.style.setProperty("--font-family", selectedFontOption.fontFamily);
		}

		// Store preferences
		localStorage.setItem("theme_preference", selectedTheme);
		localStorage.setItem("accent_color", selectedAccent);
		localStorage.setItem("font_preference", selectedFont);

		toast.success("Theme updated successfully");
	};

	const resetToDefault = () => {
		setSelectedTheme("system");
		setSelectedAccent("slate");
		setSelectedFont("inter");

		// Apply defaults
		const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
		if (isDark) {
			document.documentElement.classList.add("dark");
		} else {
			document.documentElement.classList.remove("dark");
		}
		document.documentElement.style.setProperty(
			"--font-family",
			"'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
		);

		localStorage.setItem("theme_preference", "system");
		localStorage.setItem("accent_color", "slate");
		localStorage.setItem("font_preference", "inter");

		toast.success("Theme reset to default");
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-3xl mb-2">Theme Customization</h1>
				<p className="text-muted-foreground">Personalize your Sigma Finance experience</p>
			</div>

			{/* Theme Mode */}
			<Card>
				<CardHeader>
					<CardTitle>Appearance</CardTitle>
					<CardDescription>Choose how Sigma Finance looks to you</CardDescription>
				</CardHeader>
				<CardContent>
					<RadioGroup value={selectedTheme} onValueChange={setSelectedTheme}>
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							{themes.map((theme) => {
								const Icon = theme.icon;
								return (
									<label
										key={theme.id}
										htmlFor={theme.id}
										className={`
                      relative flex cursor-pointer rounded-lg border-2 p-4 transition-all
                      ${
												selectedTheme === theme.id
													? "border-primary bg-primary/5"
													: "border-border hover:bg-accent"
											}
                    `}
									>
										<div className="flex flex-1 items-start gap-3">
											<div
												className={`
                        flex h-10 w-10 items-center justify-center rounded-lg
                        ${
													selectedTheme === theme.id
														? "bg-primary text-primary-foreground"
														: "bg-muted text-muted-foreground"
												}
                      `}
											>
												<Icon className="h-5 w-5" />
											</div>
											<div className="flex-1">
												<div className="flex items-center gap-2">
													<RadioGroupItem value={theme.id} id={theme.id} className="sr-only" />
													<span className="font-medium">{theme.name}</span>
													{selectedTheme === theme.id && <Check className="h-4 w-4 text-primary" />}
												</div>
												<p className="text-sm text-muted-foreground mt-1">{theme.description}</p>
											</div>
										</div>
									</label>
								);
							})}
						</div>
					</RadioGroup>
				</CardContent>
			</Card>

			{/* Font Family */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Type className="h-5 w-5" />
						Font Family
					</CardTitle>
					<CardDescription>Choose the typeface for your interface</CardDescription>
				</CardHeader>
				<CardContent>
					<RadioGroup value={selectedFont} onValueChange={setSelectedFont}>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
							{fontOptions.map((font) => (
								<label
									key={font.id}
									htmlFor={`font-${font.id}`}
									className={`
                    relative flex cursor-pointer rounded-lg border-2 p-4 transition-all
                    ${
											selectedFont === font.id
												? "border-primary bg-primary/5"
												: "border-border hover:bg-accent"
										}
                  `}
								>
									<div className="flex flex-1 flex-col gap-2">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2">
												<RadioGroupItem
													value={font.id}
													id={`font-${font.id}`}
													className="sr-only"
												/>
												<span className="font-medium">{font.name}</span>
												{selectedFont === font.id && <Check className="h-4 w-4 text-primary" />}
											</div>
										</div>
										<p className="text-xs text-muted-foreground">{font.description}</p>
										<p className="text-sm mt-1" style={{ fontFamily: font.fontFamily }}>
											{font.preview}
										</p>
									</div>
								</label>
							))}
						</div>
					</RadioGroup>
				</CardContent>
			</Card>

			{/* Accent Color */}
			<Card>
				<CardHeader>
					<CardTitle>Accent Color</CardTitle>
					<CardDescription>Choose your preferred accent color (Coming Soon)</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-11 gap-2">
						{" "}
						{accentColors.map((color) => (
							<Button
								key={color.id}
								variant="outline"
								onClick={() => setSelectedAccent(color.id)}
								className={cn(
									"relative h-10 w-10 rounded-lg border-2 transition-all hover:scale-110 p-0",
									selectedAccent === color.id
										? "border-foreground ring-2 ring-ring ring-offset-2 ring-offset-background"
										: "border-transparent",
								)}
								style={{ backgroundColor: color.color }}
								title={color.name}
							>
								{selectedAccent === color.id && (
									<Check className="h-4 w-4 text-white absolute inset-0 m-auto drop-shadow-md" />
								)}
							</Button>
						))}
					</div>
					<p className="text-xs text-muted-foreground mt-4">
						Note: Accent color customization will be available in a future update
					</p>
				</CardContent>
			</Card>

			{/* Preview */}
			<Card>
				<CardHeader>
					<CardTitle>Preview</CardTitle>
					<CardDescription>See how your theme looks</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{/* Sample UI Elements */}
						<div className="flex gap-2">
							<Button>Primary Button</Button>
							<Button variant="secondary">Secondary Button</Button>
							<Button variant="outline">Outline Button</Button>
							<Button variant="ghost">Ghost Button</Button>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<Card>
								<CardHeader>
									<CardTitle>Sample Card</CardTitle>
									<CardDescription>This is how cards will appear</CardDescription>
								</CardHeader>
								<CardContent>
									<p className="text-sm">
										Your portfolio content will be displayed in cards like this one.
									</p>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<Palette className="h-5 w-5" />
										Themed Elements
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="space-y-2">
										<div className="flex items-center justify-between">
											<span className="text-sm">Total Value</span>
											<span className="font-semibold">$125,430.50</span>
										</div>
										<div className="flex items-center justify-between">
											<span className="text-sm">Daily Change</span>
											<span className="text-green-600 font-semibold">+$1,234.56</span>
										</div>
									</div>
								</CardContent>
							</Card>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Apply Button */}
			<div className="flex justify-end gap-3 pt-4 border-t">
				<Button variant="outline" onClick={resetToDefault}>
					Reset to Default
				</Button>
				<Button onClick={applyTheme}>
					<Check className="h-4 w-4 mr-2" />
					Apply Theme
				</Button>
			</div>
		</div>
	);
}
