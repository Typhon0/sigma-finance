import { Link } from "@tanstack/react-router";
import {
	Activity,
	CloudDownload,
	Database,
	Key,
	KeyRound,
	Link2,
	NotebookPen,
	Palette,
	ScrollText,
	Search,
	User,
	Users,
	X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export type SettingsSection =
	| "account"
	| "users"
	| "connections"
	| "api-keys"
	| "market-data"
	| "historical-data-jobs"
	| "display"
	| "finance-database"
	| "manual-instruments"
	| "data"
	| "logs"
	| "metrics";

interface SettingsLayoutProps {
	children: React.ReactNode;
	activeSection: SettingsSection;
	fullWidth?: boolean;
}

interface SectionItem {
	id: SettingsSection;
	label: string;
	icon: typeof User;
	href: string;
	adminOnly?: boolean;
}

interface SectionGroup {
	title: string;
	items: SectionItem[];
}

const sectionKeywords: Record<SettingsSection, string[]> = {
	account: ["profil", "nom", "email", "résidence", "fiscale", "mot de passe", "password", "uuid", "juridiction", "france"],
	users: ["utilisateurs", "admin", "rôles", "comptes", "sécurité", "membres", "lock", "bloquer", "supprimer", "email vérifié"],
	connections: ["wallets", "banques", "institutions", "gocardless", "kraken", "evm", "solana", "bitcoin", "ledger", "metamask", "sync"],
	"api-keys": ["clés", "api", "tokens", "tiingo", "finnhub", "alphavantage", "coingecko", "alchemy", "secret", "enable banking"],
	"market-data": ["marché", "cotations", "fournisseurs", "sync", "credentials", "local build", "live data", "feeds"],
	"historical-data-jobs": ["jobs", "backfill", "yfinance", "historique", "tâches", "reprise", "rattrapage"],
	display: ["thème", "apparence", "couleur", "police", "font", "radius", "devise", "sombre", "clair", "dark", "eur", "usd"],
	"finance-database": ["catalogue", "référentiel", "actions", "etf", "crypto", "indices", "devises", "actifs", "database"],
	"manual-instruments": ["actifs manuels", "symboles", "création", "archives", "personnalisé", "isin", "ticker"],
	data: ["sauvegarde", "restauration", "export", "csv", "json", "audit", "backup", "restore", "rétention", "fiscal"],
	logs: ["journaux", "sidecar", "erreurs", "stream", "console", "terminal", "stdout", "debug"],
	metrics: ["métriques", "cpu", "mémoire", "pool", "performances", "redis", "latence", "goroutines", "ram"],
};

const sectionGroups: SectionGroup[] = [
	{
		title: "Général",
		items: [
			{
				id: "account",
				label: "Compte & Profil",
				icon: User,
				href: "/settings/account",
			},
			{
				id: "display",
				label: "Affichage & Thème",
				icon: Palette,
				href: "/settings/display",
			},
			{
				id: "data",
				label: "Données & Sauvegardes",
				icon: Database,
				href: "/settings/data",
			},
		],
	},
	{
		title: "Connectivité & Marchés",
		items: [
			{
				id: "connections",
				label: "Comptes & Wallets",
				icon: Link2,
				href: "/settings/connections",
			},
			{
				id: "api-keys",
				label: "Clés API & Intégrations",
				icon: KeyRound,
				href: "/settings/api-keys",
			},
			{
				id: "market-data",
				label: "Données de Marché",
				icon: Key,
				href: "/settings/market-data",
			},
			{
				id: "historical-data-jobs",
				label: "Tâches d'Historique",
				icon: CloudDownload,
				href: "/settings/historical-data-jobs",
			},
		],
	},
	{
		title: "Administration & Système",
		items: [
			{
				id: "users",
				label: "Gestion des Utilisateurs",
				icon: Users,
				href: "/settings/users",
				adminOnly: true,
			},
			{
				id: "finance-database",
				label: "Catalogue Financier",
				icon: CloudDownload,
				href: "/settings/finance-database",
			},
			{
				id: "manual-instruments",
				label: "Instruments Manuels",
				icon: NotebookPen,
				href: "/settings/manual-instruments",
			},
			{
				id: "logs",
				label: "Journaux Système",
				icon: ScrollText,
				href: "/settings/logs",
			},
			{
				id: "metrics",
				label: "Métriques d'Arrière-Plan",
				icon: Activity,
				href: "/settings/metrics",
			},
		],
	},
];

export function SettingsLayout({ children, activeSection, fullWidth }: SettingsLayoutProps) {
	const { isAdmin } = useAuth();
	const [searchQuery, setSearchQuery] = useState("");
	const searchInputRef = useRef<HTMLInputElement>(null);

	// Global shortcut: '/' to focus search, 'Esc' to clear & blur
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
				e.preventDefault();
				searchInputRef.current?.focus();
			} else if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
				setSearchQuery("");
				searchInputRef.current?.blur();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	const normalizedQuery = searchQuery.trim().toLowerCase();

	const filteredGroups = useMemo(() => {
		if (!normalizedQuery) return sectionGroups;
		return sectionGroups
			.map((group) => {
				const matchingItems = group.items.filter((item) => {
					if (item.adminOnly && !isAdmin) return false;
					const labelMatch = item.label.toLowerCase().includes(normalizedQuery);
					const keywords = sectionKeywords[item.id] || [];
					const keywordMatch = keywords.some((kw) => kw.toLowerCase().includes(normalizedQuery));
					return labelMatch || keywordMatch;
				});
				return { ...group, items: matchingItems };
			})
			.filter((group) => group.items.length > 0);
	}, [normalizedQuery, isAdmin]);

	const totalMatchingItems = useMemo(
		() => filteredGroups.reduce((acc, g) => acc + g.items.length, 0),
		[filteredGroups],
	);

	return (
		<div className="flex min-h-full w-full flex-col md:flex-row">
			{/* Desktop: clean hairline sidebar with instant search. Mobile: horizontally scrollable pill rail. */}
			<aside className="shrink-0 border-b border-border/60 bg-card/20 md:w-64 md:border-b-0 md:border-r backdrop-blur-xs flex flex-col">
				<div className="flex items-baseline justify-between gap-3 px-4 pb-1 pt-4 md:block md:p-5 md:pb-2">
					<h2 className="text-base font-semibold tracking-tight text-foreground">Paramètres</h2>
					<p className="hidden text-xs text-muted-foreground md:block mt-0.5">
						Préférences et configuration système
					</p>
				</div>

				{/* Instant Settings Search (Desktop & Mobile) */}
				<div className="relative px-3 pt-1 pb-2">
					<Search className="absolute left-5 top-3.5 h-3.5 w-3.5 text-muted-foreground/60 pointer-events-none" />
					<Input
						ref={searchInputRef}
						type="search"
						placeholder="Rechercher... (touche /)"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="h-8 pl-8 pr-7 text-xs bg-card/40 border-border/60 placeholder:text-muted-foreground/60 rounded-lg focus-visible:bg-card/70"
					/>
					{searchQuery && (
						<button
							type="button"
							onClick={() => {
								setSearchQuery("");
								searchInputRef.current?.focus();
							}}
							className="absolute right-5 top-3.5 text-muted-foreground hover:text-foreground"
							title="Effacer la recherche"
						>
							<X className="h-3.5 w-3.5" />
						</button>
					)}
				</div>

				<nav
					aria-label="Sections des paramètres"
					className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:gap-4 md:px-3 md:pb-6"
				>
					{totalMatchingItems === 0 ? (
						<p className="px-3 py-6 text-xs text-center text-muted-foreground">
							Aucun réglage pour « {searchQuery} »
						</p>
					) : (
						filteredGroups.map((group) => {
							const visibleItems = group.items.filter((item) => !item.adminOnly || isAdmin);
							if (visibleItems.length === 0) return null;

							return (
								<div key={group.title} className="space-y-1">
									<h3 className="hidden text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-2.5 py-1 md:block">
										{group.title}
									</h3>
									<div className="flex gap-1 md:flex-col md:gap-0.5">
										{visibleItems.map((item) => {
											const Icon = item.icon;
											const active = activeSection === item.id;
											return (
												<Link
													key={item.id}
													to={item.href}
													aria-current={active ? "page" : undefined}
													className={cn(
														"flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs transition-colors duration-150 relative",
														active
															? "border border-border/80 bg-secondary/80 font-medium text-foreground shadow-xs"
															: "border border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground",
													)}
												>
													<Icon
														className={cn(
															"h-3.5 w-3.5 shrink-0 transition-colors",
															active ? "text-foreground" : "text-muted-foreground/70",
														)}
													/>
													<span>{item.label}</span>
													{active && (
														<span className="hidden md:block absolute right-2 h-1.5 w-1.5 rounded-full bg-primary" />
													)}
												</Link>
											);
										})}
									</div>
								</div>
							);
						})
					)}
				</nav>
			</aside>

			<div className="min-w-0 flex-1">
				<div
					className={cn(
						"mx-auto w-full p-4 sm:p-6 lg:p-8",
						fullWidth ? "max-w-full" : "max-w-4xl",
					)}
				>
					{children}
				</div>
			</div>
		</div>
	);
}
