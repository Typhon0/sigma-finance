import { Check, MapPin, Shield, User, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchInput } from "@/components/ui/search-input";
import { Separator } from "@/components/ui/separator";

interface Country {
	code: string;
	name: string;
	flag: string;
	region: string;
	popular?: boolean;
}

const countries: Country[] = [
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
	{
		code: "US",
		name: "United States",
		flag: "🇺🇸",
		region: "Americas",
		popular: true,
	},
	{ code: "CA", name: "Canada", flag: "🇨🇦", region: "Americas", popular: true },
	{
		code: "JP",
		name: "Japan",
		flag: "🇯🇵",
		region: "Asia-Pacific",
		popular: true,
	},
	{
		code: "SG",
		name: "Singapore",
		flag: "🇸🇬",
		region: "Asia-Pacific",
		popular: true,
	},
	{
		code: "AU",
		name: "Australia",
		flag: "🇦🇺",
		region: "Asia-Pacific",
		popular: true,
	},
	{
		code: "AE",
		name: "United Arab Emirates",
		flag: "🇦🇪",
		region: "Middle East & Africa",
		popular: true,
	},
];

const regions = ["All", "Europe", "Americas", "Asia-Pacific", "Middle East & Africa"];

export function AccountSettings() {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [selectedCountries, setSelectedCountries] = useState<string[]>(["FR"]);
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedRegion, setSelectedRegion] = useState("All");
	const [activeSubSection, setActiveSubSection] = useState<
		"profile" | "jurisdictions" | "security"
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
		toast.success("Settings saved successfully");
	};

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold">Account & Profile</h1>
				<p className="text-muted-foreground">Manage your personal information and preferences</p>
			</div>

			{/* Sub-navigation */}
			<div className="flex gap-2 border-b pb-2">
				<Button
					variant={activeSubSection === "profile" ? "default" : "ghost"}
					onClick={() => setActiveSubSection("profile")}
					className="rounded-b-none"
				>
					<User className="h-4 w-4 mr-2" />
					Profile
				</Button>
				<Button
					variant={activeSubSection === "jurisdictions" ? "default" : "ghost"}
					onClick={() => setActiveSubSection("jurisdictions")}
					className="rounded-b-none"
				>
					<MapPin className="h-4 w-4 mr-2" />
					Jurisdictions
				</Button>
				<Button
					variant={activeSubSection === "security" ? "default" : "ghost"}
					onClick={() => setActiveSubSection("security")}
					className="rounded-b-none"
				>
					<Shield className="h-4 w-4 mr-2" />
					Security
				</Button>
			</div>

			{/* Profile Tab */}
			{activeSubSection === "profile" && (
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
						<Button onClick={handleSave}>
							<Check className="h-4 w-4 mr-2" />
							Save Changes
						</Button>
					</CardContent>
				</Card>
			)}

			{/* Jurisdictions Tab */}
			{activeSubSection === "jurisdictions" && (
				<Card>
					<CardHeader>
						<CardTitle>Tax Jurisdictions</CardTitle>
						<CardDescription>
							Select the countries where you have tax residency or investment interests.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="p-4 rounded-lg bg-muted">
							<div className="flex items-center gap-2 mb-2">
								<MapPin className="h-4 w-4 text-muted-foreground" />
								<span className="text-sm font-medium">Selected ({selectedCountries.length})</span>
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
						</div>

						<Separator />

						<SearchInput
							placeholder="Search accounts..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							onClear={() => setSearchQuery("")}
							containerClassName="flex-1"
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

						<ScrollArea className="h-[300px]">
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
						</ScrollArea>
					</CardContent>
				</Card>
			)}

			{/* Security Tab */}
			{activeSubSection === "security" && (
				<Card>
					<CardHeader>
						<CardTitle>Security Settings</CardTitle>
						<CardDescription>Manage your account security</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground">Security settings coming soon...</p>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

function CountryCard({
	country,
	isSelected,
	onToggle,
}: {
	country: Country;
	isSelected: boolean;
	onToggle: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onToggle}
			className={`
				relative p-3 rounded-lg border text-left transition-all
				${isSelected ? "bg-primary/5 border-primary ring-2 ring-primary/20" : "bg-card hover:bg-accent border-border"}
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
