import { Bell, Check, Globe, MapPin, Settings, Shield, User, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SearchInput } from "@/components/ui/search-input";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";

interface UserSettingsProps {
	user: any;
	onUpdateUser: (userData: any) => void;
}

interface Country {
	code: string;
	name: string;
	flag: string;
	region: string;
	popular?: boolean;
}

const countries: Country[] = [
	// Popular European countries
	{ code: "FR", name: "France", flag: "🇫🇷", region: "Europe", popular: true },
	{ code: "DE", name: "Germany", flag: "🇩🇪", region: "Europe", popular: true },
	{
		code: "GB",
		name: "United Kingdom",
		flag: "🇬🇧",
		region: "Europe",
		popular: true,
	},
	{ code: "ES", name: "Spain", flag: "🇪🇸", region: "Europe", popular: true },
	{ code: "IT", name: "Italy", flag: "🇮🇹", region: "Europe", popular: true },
	{
		code: "CH",
		name: "Switzerland",
		flag: "🇨🇭",
		region: "Europe",
		popular: true,
	},
	{ code: "BE", name: "Belgium", flag: "🇧🇪", region: "Europe" },
	{ code: "NL", name: "Netherlands", flag: "🇳🇱", region: "Europe" },
	{ code: "AT", name: "Austria", flag: "🇦🇹", region: "Europe" },
	{ code: "PT", name: "Portugal", flag: "🇵🇹", region: "Europe" },
	{ code: "SE", name: "Sweden", flag: "🇸🇪", region: "Europe" },
	{ code: "NO", name: "Norway", flag: "🇳🇴", region: "Europe" },
	{ code: "DK", name: "Denmark", flag: "🇩🇰", region: "Europe" },
	{ code: "FI", name: "Finland", flag: "🇫🇮", region: "Europe" },
	{ code: "IE", name: "Ireland", flag: "🇮🇪", region: "Europe" },
	{ code: "PL", name: "Poland", flag: "🇵🇱", region: "Europe" },
	{ code: "CZ", name: "Czech Republic", flag: "🇨🇿", region: "Europe" },
	{ code: "GR", name: "Greece", flag: "🇬🇷", region: "Europe" },
	{ code: "LU", name: "Luxembourg", flag: "🇱🇺", region: "Europe" },

	// Americas
	{
		code: "US",
		name: "United States",
		flag: "🇺🇸",
		region: "Americas",
		popular: true,
	},
	{ code: "CA", name: "Canada", flag: "🇨🇦", region: "Americas", popular: true },
	{ code: "BR", name: "Brazil", flag: "🇧🇷", region: "Americas" },
	{ code: "MX", name: "Mexico", flag: "🇲🇽", region: "Americas" },
	{ code: "AR", name: "Argentina", flag: "🇦🇷", region: "Americas" },
	{ code: "CL", name: "Chile", flag: "🇨🇱", region: "Americas" },

	// Asia-Pacific
	{ code: "CN", name: "China", flag: "🇨🇳", region: "Asia-Pacific" },
	{
		code: "JP",
		name: "Japan",
		flag: "🇯🇵",
		region: "Asia-Pacific",
		popular: true,
	},
	{ code: "KR", name: "South Korea", flag: "🇰🇷", region: "Asia-Pacific" },
	{
		code: "SG",
		name: "Singapore",
		flag: "🇸🇬",
		region: "Asia-Pacific",
		popular: true,
	},
	{ code: "HK", name: "Hong Kong", flag: "🇭🇰", region: "Asia-Pacific" },
	{
		code: "AU",
		name: "Australia",
		flag: "🇦🇺",
		region: "Asia-Pacific",
		popular: true,
	},
	{ code: "NZ", name: "New Zealand", flag: "🇳🇿", region: "Asia-Pacific" },
	{ code: "IN", name: "India", flag: "🇮🇳", region: "Asia-Pacific" },
	{ code: "TH", name: "Thailand", flag: "🇹🇭", region: "Asia-Pacific" },
	{ code: "MY", name: "Malaysia", flag: "🇲🇾", region: "Asia-Pacific" },
	{ code: "ID", name: "Indonesia", flag: "🇮🇩", region: "Asia-Pacific" },
	{ code: "PH", name: "Philippines", flag: "🇵🇭", region: "Asia-Pacific" },
	{ code: "VN", name: "Vietnam", flag: "🇻🇳", region: "Asia-Pacific" },

	// Middle East & Africa
	{
		code: "AE",
		name: "United Arab Emirates",
		flag: "🇦🇪",
		region: "Middle East & Africa",
		popular: true,
	},
	{
		code: "SA",
		name: "Saudi Arabia",
		flag: "🇸🇦",
		region: "Middle East & Africa",
	},
	{ code: "IL", name: "Israel", flag: "🇮🇱", region: "Middle East & Africa" },
	{
		code: "ZA",
		name: "South Africa",
		flag: "🇿🇦",
		region: "Middle East & Africa",
	},
	{ code: "EG", name: "Egypt", flag: "🇪🇬", region: "Middle East & Africa" },
	{ code: "MA", name: "Morocco", flag: "🇲🇦", region: "Middle East & Africa" },
];

const regions = ["All", "Europe", "Americas", "Asia-Pacific", "Middle East & Africa"];

export function UserSettings({ user, onUpdateUser }: UserSettingsProps) {
	const [name, setName] = useState(user.name || "");
	const [email, setEmail] = useState(user.email || "");
	const [selectedCountries, setSelectedCountries] = useState<string[]>(user.countries || ["FR"]);
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedRegion, setSelectedRegion] = useState("All");
	const [activeTab, setActiveTab] = useState<
		"profile" | "jurisdictions" | "preferences" | "security"
	>("profile");

	const filteredCountries = countries.filter((country) => {
		const matchesSearch =
			country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			country.code.toLowerCase().includes(searchQuery.toLowerCase());
		const matchesRegion = selectedRegion === "All" || country.region === selectedRegion;
		return matchesSearch && matchesRegion;
	});

	const toggleCountry = (countryCode: string) => {
		setSelectedCountries((prev) => {
			if (prev.includes(countryCode)) {
				// Don't allow removing the last country
				if (prev.length === 1) {
					toast.error("You must have at least one jurisdiction selected");
					return prev;
				}
				return prev.filter((c) => c !== countryCode);
			}
			return [...prev, countryCode];
		});
	};

	const handleSave = () => {
		const updatedUser = {
			...user,
			name,
			email,
			countries: selectedCountries,
		};
		onUpdateUser(updatedUser);
		toast.success("Settings saved successfully");
	};

	const _getSelectedCountriesDisplay = () => {
		return selectedCountries
			.map((code) => countries.find((c) => c.code === code))
			.filter(Boolean)
			.map((c) => `${c?.flag} ${c?.name}`)
			.join(", ");
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-3xl mb-2">Settings</h1>
				<p className="text-muted-foreground">Manage your account settings and preferences</p>
			</div>

			{/* Tabs */}
			<div className="flex gap-2 border-b">
				<Button
					variant={activeTab === "profile" ? "default" : "ghost"}
					onClick={() => setActiveTab("profile")}
					className="rounded-b-none"
				>
					<User className="h-4 w-4 mr-2" />
					Profile
				</Button>
				<Button
					variant={activeTab === "jurisdictions" ? "default" : "ghost"}
					onClick={() => setActiveTab("jurisdictions")}
					className="rounded-b-none"
				>
					<Globe className="h-4 w-4 mr-2" />
					Jurisdictions
				</Button>
				<Button
					variant={activeTab === "preferences" ? "default" : "ghost"}
					onClick={() => setActiveTab("preferences")}
					className="rounded-b-none"
				>
					<Settings className="h-4 w-4 mr-2" />
					Preferences
				</Button>
				<Button
					variant={activeTab === "security" ? "default" : "ghost"}
					onClick={() => setActiveTab("security")}
					className="rounded-b-none"
				>
					<Shield className="h-4 w-4 mr-2" />
					Security
				</Button>
			</div>

			{/* Profile Tab */}
			{activeTab === "profile" && (
				<div className="grid gap-6">
					<Card>
						<CardHeader>
							<CardTitle>Personal Information</CardTitle>
							<CardDescription>Update your personal details</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="name">Full Name</Label>
								<Input
									id="name"
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="John Doe"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="email">Email</Label>
								<Input
									id="email"
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									placeholder="john@example.com"
								/>
							</div>
						</CardContent>
					</Card>
				</div>
			)}

			{/* Jurisdictions Tab */}
			{activeTab === "jurisdictions" && (
				<div className="grid gap-6">
					<Card>
						<CardHeader>
							<CardTitle>Tax Jurisdictions</CardTitle>
							<CardDescription>
								Select the countries where you have tax residency or investment interests. This will
								customize the available asset types for your situation.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{/* Currently Selected */}
							<div className="p-4 rounded-lg bg-muted">
								<div className="flex items-center gap-2 mb-2">
									<MapPin className="h-4 w-4 text-muted-foreground" />
									<span className="text-sm font-medium">
										Selected Jurisdictions ({selectedCountries.length})
									</span>
								</div>
								<div className="flex flex-wrap gap-2">
									{selectedCountries.map((code) => {
										const country = countries.find((c) => c.code === code);
										return country ? (
											<Badge key={code} variant="secondary" className="gap-1">
												<span>{country.flag}</span>
												<span>{country.name}</span>
												<X
													className="h-3 w-3 cursor-pointer hover:text-destructive"
													onClick={() => toggleCountry(code)}
												/>
											</Badge>
										) : null;
									})}
								</div>
								{selectedCountries.length === 0 && (
									<p className="text-sm text-muted-foreground">No jurisdictions selected</p>
								)}
							</div>

							<Separator />

							{/* Search and Filter */}
							<div className="space-y-3">
								<SearchInput
									placeholder="Search settings..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									onClear={() => setSearchQuery("")}
								/>

								<div className="flex gap-2 flex-wrap">
									{regions.map((region) => (
										<Button
											key={region}
											variant={selectedRegion === region ? "default" : "outline"}
											size="sm"
											onClick={() => setSelectedRegion(region)}
										>
											{region}
										</Button>
									))}
								</div>
							</div>

							{/* Popular Countries */}
							{searchQuery === "" && selectedRegion === "All" && (
								<div className="space-y-2">
									<p className="text-sm font-medium text-muted-foreground">Popular</p>
									<div className="grid grid-cols-2 md:grid-cols-3 gap-2">
										{countries
											.filter((c) => c.popular)
											.map((country) => (
												<CountryCard
													key={country.code}
													country={country}
													isSelected={selectedCountries.includes(country.code)}
													onToggle={() => toggleCountry(country.code)}
												/>
											))}
									</div>
								</div>
							)}

							{/* All Countries */}
							<div className="space-y-2">
								{searchQuery === "" && selectedRegion === "All" && (
									<p className="text-sm font-medium text-muted-foreground">All Countries</p>
								)}
								<ScrollArea className="h-[400px] pr-4">
									<div className="grid grid-cols-2 md:grid-cols-3 gap-2">
										{filteredCountries.map((country) => (
											<CountryCard
												key={country.code}
												country={country}
												isSelected={selectedCountries.includes(country.code)}
												onToggle={() => toggleCountry(country.code)}
											/>
										))}
									</div>
									{filteredCountries.length === 0 && (
										<div className="text-center py-8">
											<Globe className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-50" />
											<p className="text-muted-foreground">No countries found</p>
										</div>
									)}
								</ScrollArea>
							</div>

							<div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
								<div className="flex gap-3">
									<Bell className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
									<div className="space-y-1">
										<p className="text-sm font-medium text-blue-900 dark:text-blue-100">
											Asset Type Availability
										</p>
										<p className="text-sm text-blue-700 dark:text-blue-300">
											Some asset types are only available in specific countries (e.g., SCPI in
											France, 401k in USA). Your jurisdiction selection will customize which assets
											you can add to your portfolio.
										</p>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			)}

			{/* Preferences Tab */}
			{activeTab === "preferences" && (
				<div className="grid gap-6">
					<Card>
						<CardHeader>
							<CardTitle>Application Preferences</CardTitle>
							<CardDescription>Customize your application experience</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<p className="text-sm text-muted-foreground">Preferences coming soon...</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Data Management</CardTitle>
							<CardDescription>Reset your portfolio to default demo data</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
								<div className="flex gap-3">
									<Shield className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
									<div className="space-y-2 flex-1">
										<p className="text-sm font-medium text-amber-900 dark:text-amber-100">
											Reset to Default Portfolio
										</p>
										<p className="text-sm text-amber-700 dark:text-amber-300">
											This will delete all your current assets and restore the default demo
											portfolio with all asset categories (stocks, crypto, real estate,
											collectibles, etc.).
										</p>
										<Button
											variant="destructive"
											size="sm"
											onClick={() => {
												if (
													confirm(
														"Are you sure you want to reset all your data? This action cannot be undone.",
													)
												) {
													localStorage.removeItem("assets");
													localStorage.removeItem("transactions");
													localStorage.removeItem("watchlist");
													toast.success("Data reset! Please refresh the page to see the changes.");
													setTimeout(() => window.location.reload(), 1500);
												}
											}}
										>
											Reset to Default Data
										</Button>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			)}

			{/* Security Tab */}
			{activeTab === "security" && (
				<div className="grid gap-6">
					<Card>
						<CardHeader>
							<CardTitle>Security Settings</CardTitle>
							<CardDescription>Manage your account security</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<p className="text-sm text-muted-foreground">Security settings coming soon...</p>
						</CardContent>
					</Card>
				</div>
			)}

			{/* Save Button */}
			<div className="flex justify-end gap-3 pt-4 border-t">
				<Button variant="outline">Cancel</Button>
				<Button onClick={handleSave}>
					<Check className="h-4 w-4 mr-2" />
					Save Changes
				</Button>
			</div>
		</div>
	);
}

interface CountryCardProps {
	country: Country;
	isSelected: boolean;
	onToggle: () => void;
}

function CountryCard({ country, isSelected, onToggle }: CountryCardProps) {
	return (
		<button
			type="button"
			onClick={onToggle}
			className={`
        relative p-3 rounded-lg border text-left transition-all
        ${
					isSelected
						? "bg-primary/5 border-primary ring-2 ring-primary/20"
						: "bg-card hover:bg-accent border-border"
				}
      `}
		>
			<div className="flex items-center gap-2">
				<span className="text-2xl">{country.flag}</span>
				<div className="flex-1 min-w-0">
					<p className="text-sm font-medium truncate">{country.name}</p>
					<p className="text-xs text-muted-foreground">{country.code}</p>
				</div>
				{isSelected && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
			</div>
		</button>
	);
}
