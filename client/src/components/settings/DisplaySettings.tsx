import { Check, Laptop, Moon, Palette, Sun, Type } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const themes = [
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

const fontOptions = [
	{
		id: "inter",
		name: "Inter",
		description: "Modern and versatile",
		fontFamily: "'Inter', sans-serif",
	},
	{
		id: "roboto",
		name: "Roboto",
		description: "Clean and geometric",
		fontFamily: "'Roboto', sans-serif",
	},
	{
		id: "opensans",
		name: "Open Sans",
		description: "Friendly and readable",
		fontFamily: "'Open Sans', sans-serif",
	},
];

export function DisplaySettings() {
	const [selectedTheme, setSelectedTheme] = useState("system");
	const [selectedFont, setSelectedFont] = useState("inter");

	useEffect(() => {
		const savedTheme = localStorage.getItem("theme_preference") || "system";
		const savedFont = localStorage.getItem("font_preference") || "inter";
		setSelectedTheme(savedTheme);
		setSelectedFont(savedFont);
	}, []);

	const applyTheme = () => {
		const isDark =
			selectedTheme === "dark" ||
			(selectedTheme === "system" &&
				window.matchMedia("(prefers-color-scheme: dark)").matches);

		if (isDark) {
			document.documentElement.classList.add("dark");
		} else {
			document.documentElement.classList.remove("dark");
		}

		const selectedFontOption = fontOptions.find((f) => f.id === selectedFont);
		if (selectedFontOption) {
			document.documentElement.style.setProperty(
				"--font-family",
				selectedFontOption.fontFamily,
			);
		}

		localStorage.setItem("theme_preference", selectedTheme);
		localStorage.setItem("font_preference", selectedFont);

		toast.success("Theme updated successfully");
	};

	const resetToDefault = () => {
		setSelectedTheme("system");
		setSelectedFont("inter");

		const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
		if (isDark) {
			document.documentElement.classList.add("dark");
		} else {
			document.documentElement.classList.remove("dark");
		}
		document.documentElement.style.setProperty(
			"--font-family",
			"'Inter', sans-serif",
		);

		localStorage.setItem("theme_preference", "system");
		localStorage.setItem("font_preference", "inter");

		toast.success("Theme reset to default");
	};

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold">Display & Theme</h1>
				<p className="text-muted-foreground">Personalize your appearance</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Appearance</CardTitle>
					<CardDescription>Choose how the app looks</CardDescription>
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
											${selectedTheme === theme.id ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}
										`}
									>
										<div className="flex flex-1 items-start gap-3">
											<div
												className={`
													flex h-10 w-10 items-center justify-center rounded-lg
													${selectedTheme === theme.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}
												`}
											>
												<Icon className="h-5 w-5" />
											</div>
											<div className="flex-1">
												<div className="flex items-center gap-2">
													<RadioGroupItem
														value={theme.id}
														id={theme.id}
														className="sr-only"
													/>
													<span className="font-medium">{theme.name}</span>
													{selectedTheme === theme.id && (
														<Check className="h-4 w-4 text-primary" />
													)}
												</div>
												<p className="text-sm text-muted-foreground mt-1">
													{theme.description}
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
						<Type className="h-5 w-5" />
						Font Family
					</CardTitle>
					<CardDescription>
						Choose the typeface for your interface
					</CardDescription>
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
										${selectedFont === font.id ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}
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
												{selectedFont === font.id && (
													<Check className="h-4 w-4 text-primary" />
												)}
											</div>
										</div>
										<p className="text-xs text-muted-foreground">
											{font.description}
										</p>
										<p
											className="text-sm mt-1"
											style={{ fontFamily: font.fontFamily }}
										>
											The quick brown fox
										</p>
									</div>
								</label>
							))}
						</div>
					</RadioGroup>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Accent Color</CardTitle>
					<CardDescription>Choose your preferred accent color</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex items-center gap-4 p-4 rounded-lg bg-muted">
						<Palette className="h-5 w-5 text-muted-foreground" />
						<div>
							<p className="text-sm font-medium">Coming Soon</p>
							<p className="text-xs text-muted-foreground">
								Accent color customization will be available in a future update
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

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
