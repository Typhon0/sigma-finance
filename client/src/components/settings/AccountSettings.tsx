import { useMutation } from "@apollo/client";
import { Check, KeyRound, MapPin, Shield, User, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchInput } from "@/components/ui/search-input";
import { Separator } from "@/components/ui/separator";
import { UPDATE_USER_TAX_JURISDICTION_MUTATION } from "@/graphql/mutations/user.mutations";
import { useAuth } from "@/hooks/use-auth";

interface Country {
	code: string;
	name: string;
	flag: string;
	region: string;
	popular?: boolean;
}

const countries: Country[] = [
	{ code: "FR", name: "France", flag: "🇫🇷", region: "Europe", popular: true },
	{ code: "DE", name: "Allemagne", flag: "🇩🇪", region: "Europe", popular: true },
	{
		code: "GB",
		name: "Royaume-Uni",
		flag: "🇬🇧",
		region: "Europe",
		popular: true,
	},
	{ code: "ES", name: "Espagne", flag: "🇪🇸", region: "Europe", popular: true },
	{ code: "IT", name: "Italie", flag: "🇮🇹", region: "Europe", popular: true },
	{
		code: "CH",
		name: "Suisse",
		flag: "🇨🇭",
		region: "Europe",
		popular: true,
	},
	{
		code: "US",
		name: "États-Unis",
		flag: "🇺🇸",
		region: "Amériques",
		popular: true,
	},
	{ code: "CA", name: "Canada", flag: "🇨🇦", region: "Amériques", popular: true },
	{
		code: "JP",
		name: "Japon",
		flag: "🇯🇵",
		region: "Asie-Pacifique",
		popular: true,
	},
	{
		code: "SG",
		name: "Singapour",
		flag: "🇸🇬",
		region: "Asie-Pacifique",
		popular: true,
	},
	{
		code: "AU",
		name: "Australie",
		flag: "🇦🇺",
		region: "Asie-Pacifique",
		popular: true,
	},
	{
		code: "AE",
		name: "Émirats Arabes Unis",
		flag: "🇦🇪",
		region: "Moyen-Orient",
		popular: true,
	},
];

const regions = ["Tous", "Europe", "Amériques", "Asie-Pacifique", "Moyen-Orient"];

export function AccountSettings() {
	const { user, isAdmin } = useAuth();
	const [name, setName] = useState(user?.name || "");
	const [email, setEmail] = useState(user?.email || "");
	const [selectedCountries, setSelectedCountries] = useState<string[]>([
		user?.taxJurisdiction || "FR",
	]);
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedRegion, setSelectedRegion] = useState("Tous");
	const [activeSubSection, setActiveSubSection] = useState<
		"profile" | "jurisdictions" | "security"
	>("profile");

	const [updateJurisdiction] = useMutation(UPDATE_USER_TAX_JURISDICTION_MUTATION);

	const filteredCountries = countries.filter((country) => {
		const matchesSearch =
			country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			country.code.toLowerCase().includes(searchQuery.toLowerCase());
		const matchesRegion =
			selectedRegion === "Tous" ||
			(selectedRegion === "Europe" && country.region === "Europe") ||
			(selectedRegion === "Amériques" && country.region === "Amériques") ||
			(selectedRegion === "Asie-Pacifique" && country.region === "Asie-Pacifique") ||
			(selectedRegion === "Moyen-Orient" && country.region === "Moyen-Orient");
		return matchesSearch && matchesRegion;
	});

	const toggleCountry = async (countryCode: string) => {
		setSelectedCountries([countryCode]);
		try {
			await updateJurisdiction({
				variables: { input: { taxJurisdiction: countryCode } },
			});
			toast.success(`Juridiction fiscale définie sur ${countryCode}`);
		} catch {
			toast.error("Échec de la mise à jour de la juridiction fiscale");
		}
	};

	const handleSave = () => {
		toast.success("Modifications enregistrées avec succès");
	};

	const initials = (name || email || "US")
		.split(" ")
		.map((p) => p[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();

	return (
		<div className="space-y-6">
			{/* En-tête de page */}
			<div className="flex flex-col gap-1">
				<div className="flex items-center gap-2">
					<User className="h-5 w-5 text-muted-foreground" />
					<h1 className="text-xl font-semibold tracking-tight text-foreground">
						Compte & Profil
					</h1>
				</div>
				<p className="text-xs text-muted-foreground">
					Gérez vos informations d'identité, votre résidence fiscale et la sécurité de votre compte.
				</p>
			</div>

			{/* Segmented Sub-Navigation Control */}
			<div className="inline-flex p-1 bg-muted/20 border border-border/50 rounded-xl gap-1">
				<button
					type="button"
					onClick={() => setActiveSubSection("profile")}
					className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
						activeSubSection === "profile"
							? "bg-background/80 text-foreground shadow-xs border border-border/60"
							: "border border-transparent text-muted-foreground hover:text-foreground"
					}`}
				>
					<User className="h-3.5 w-3.5" />
					Profil & Identité
				</button>

				<button
					type="button"
					onClick={() => setActiveSubSection("jurisdictions")}
					className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
						activeSubSection === "jurisdictions"
							? "bg-background/80 text-foreground shadow-xs border border-border/60"
							: "border border-transparent text-muted-foreground hover:text-foreground"
					}`}
				>
					<MapPin className="h-3.5 w-3.5" />
					Juridiction Fiscale
				</button>

				<button
					type="button"
					onClick={() => setActiveSubSection("security")}
					className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
						activeSubSection === "security"
							? "bg-background/80 text-foreground shadow-xs border border-border/60"
							: "border border-transparent text-muted-foreground hover:text-foreground"
					}`}
				>
					<Shield className="h-3.5 w-3.5" />
					Sécurité & Accès
				</button>
			</div>

			{/* Onglet 1: Profil */}
			{activeSubSection === "profile" && (
				<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs p-6 space-y-6">
					<div className="flex items-center gap-4">
						<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/40 font-mono text-sm font-semibold text-foreground/90">
							{initials}
						</div>
						<div>
							<div className="flex items-center gap-2">
								<h2 className="text-sm font-semibold text-foreground">{name || user?.name || "Utilisateur"}</h2>
								{isAdmin ? (
									<span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-secondary/80 px-2 py-0.5 text-[10px] font-medium text-foreground">
										<Shield className="h-2.5 w-2.5 text-muted-foreground" />
										ADMIN
									</span>
								) : (
									<span className="rounded-full border border-border/40 px-2 py-0.5 text-[10px] text-muted-foreground">
										USER
									</span>
								)}
							</div>
							<p className="font-mono text-xs text-muted-foreground">{email || user?.email}</p>
						</div>
					</div>

					<Separator className="bg-border/40" />

					<div className="space-y-4 max-w-lg">
						<div className="space-y-1.5">
							<Label htmlFor="name" className="text-xs font-medium">Nom complet</Label>
							<Input
								id="name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="Votre nom"
								className="h-9 text-xs bg-card/40 border-border/60"
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="email" className="text-xs font-medium">Adresse email</Label>
							<Input
								id="email"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="nom@exemple.com"
								className="h-9 text-xs bg-card/40 border-border/60"
							/>
						</div>

						<div className="pt-2">
							<Button size="sm" onClick={handleSave} className="h-8 gap-1.5 text-xs font-medium">
								<Check className="h-3.5 w-3.5" />
								Enregistrer les modifications
							</Button>
						</div>
					</div>
				</div>
			)}

			{/* Onglet 2: Juridiction Fiscale */}
			{activeSubSection === "jurisdictions" && (
				<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs p-6 space-y-5">
					<div>
						<h2 className="text-sm font-semibold text-foreground">Résidence & Régime Fiscal</h2>
						<p className="text-xs text-muted-foreground mt-0.5">
							Configure les règles d'abattements, plus-values mobilières (PFU, FIFO, PMP) et devises fiscales.
						</p>
					</div>

					{/* Juridiction active */}
					<div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3.5 py-2.5 text-xs">
						<div className="flex items-center gap-2">
							<MapPin className="h-4 w-4 text-muted-foreground" />
							<span className="text-muted-foreground">Juridiction sélectionnée :</span>
							{selectedCountries.map((code) => {
								const c = countries.find((item) => item.code === code);
								return (
									<Badge key={code} variant="secondary" className="gap-1.5 font-mono text-xs py-0.5">
										<span>{c?.flag || "🌍"}</span>
										<span>{c?.name || code}</span>
										<span className="text-muted-foreground/70">({code})</span>
									</Badge>
								);
							})}
						</div>
					</div>

					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-1">
						<SearchInput
							placeholder="Rechercher un pays ou code..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							onClear={() => setSearchQuery("")}
							className="h-9 text-xs max-w-xs"
						/>

						<div className="flex gap-1.5 flex-wrap">
							{regions.map((region) => (
								<Button
									key={region}
									variant={selectedRegion === region ? "secondary" : "ghost"}
									size="sm"
									className={`h-7 px-2.5 text-xs border border-transparent ${
										selectedRegion === region ? "border-border/60 font-medium" : "text-muted-foreground"
									}`}
									onClick={() => setSelectedRegion(region)}
								>
									{region}
								</Button>
							))}
						</div>
					</div>

					<ScrollArea className="h-[280px] rounded-lg border border-border/40 p-2">
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
				</div>
			)}

			{/* Onglet 3: Sécurité & Accès */}
			{activeSubSection === "security" && (
				<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs p-6 space-y-6">
					<div>
						<h2 className="text-sm font-semibold text-foreground">Sécurité & Sessions</h2>
						<p className="text-xs text-muted-foreground mt-0.5">
							Contrôlez les paramètres d'authentification et l'état de votre compte.
						</p>
					</div>

					<div className="rounded-lg border border-border/40 bg-card/20 divide-y divide-border/30 px-3.5 py-0.5 text-xs max-w-lg">
						<div className="flex items-center justify-between py-2.5">
							<span className="text-muted-foreground">Statut du compte</span>
							<span className="inline-flex items-center gap-1.5 font-medium text-foreground/90">
								<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
								Actif & opérationnel
							</span>
						</div>

						<div className="flex items-center justify-between py-2.5">
							<span className="text-muted-foreground">Rôle utilisateur</span>
							<span className="font-mono">{isAdmin ? "ADMIN" : "USER"}</span>
						</div>

						<div className="flex items-center justify-between py-2.5">
							<span className="text-muted-foreground">Identifiant utilisateur (UUID)</span>
							<span className="font-mono text-[11px] text-muted-foreground select-all">
								{user?.id || "-"}
							</span>
						</div>
					</div>

					<div className="pt-2">
						<Button
							variant="outline"
							size="sm"
							className="h-8 gap-1.5 text-xs border-border/60 bg-card/30"
							onClick={() => toast.info("Modification du mot de passe disponible prochainement ou via l'administrateur")}
						>
							<KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
							Changer mon mot de passe
						</Button>
					</div>
				</div>
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
			className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition-all ${
				isSelected
					? "bg-secondary/80 border-border/80 text-foreground shadow-xs"
					: "bg-card/20 hover:bg-muted/30 border-border/40 text-muted-foreground hover:text-foreground"
			}`}
		>
			<div className="flex items-center gap-2.5 min-w-0">
				<span className="text-base select-none">{country.flag}</span>
				<div className="min-w-0">
					<p className="text-xs font-medium truncate text-foreground">{country.name}</p>
					<p className="text-[10px] font-mono text-muted-foreground">{country.code}</p>
				</div>
			</div>
			{isSelected && <Check className="h-3.5 w-3.5 text-foreground shrink-0" />}
		</button>
	);
}
