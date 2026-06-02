import { Outlet, useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { usePortfolio } from "@/components/PortfolioProvider";
import { AccountDetail } from "./AccountDetail";
import { AccountsList } from "./AccountsList";
import { Analytics } from "./Analytics";
import { ArtDetail } from "./assets/collectibles/ArtDetail";
import { CollectiblesList } from "./assets/collectibles/CollectiblesList";
import { JewelryDetail } from "./assets/collectibles/JewelryDetail";
import { PreciousMetalsDetail } from "./assets/collectibles/PreciousMetalsDetail";
import { VehicleDetail } from "./assets/collectibles/VehicleDetail";
import { WatchDetail } from "./assets/collectibles/WatchDetail";
import { WineDetail } from "./assets/collectibles/WineDetail";
import { CryptoDetail } from "./assets/crypto/CryptoDetail";
import { CryptoList } from "./assets/crypto/CryptoList";
import { CryptoMarketOverview } from "./assets/crypto/CryptoMarketOverview";
import { CryptoScreener } from "./assets/crypto/CryptoScreener";
import { InsuranceDetail } from "./assets/insurance/InsuranceDetail";
import { InsuranceList } from "./assets/insurance/InsuranceList";
import { LoanDetail } from "./assets/loans/LoanDetail";
import { LoansList } from "./assets/loans/LoansList";
import { RealEstateDetail } from "./assets/real-estate/RealEstateDetail";
import { RealEstateList } from "./assets/real-estate/RealEstateList";
import { StockDetail } from "./assets/stocks-funds/StockDetail";
import { StockMarketOverview } from "./assets/stocks-funds/StockMarketOverview";
import { StockScreener } from "./assets/stocks-funds/StockScreener";
import { StocksFundsModule } from "./assets/stocks-funds/StocksFundsModule";
import { DensityDashboard } from "./dashboard/DensityGrid";
import { ProShell } from "./layout/ProShell";
import { MarketCalendar } from "./MarketCalendar";
import { MarketHeatmaps } from "./MarketHeatmaps";
import { PortfolioOverview } from "./PortfolioOverview";
// Existing Views
import { TransactionManagement } from "./TransactionManagement";
import { WatchlistManagement } from "./WatchlistManagement";

interface DashboardProps {
	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	user: any;
	onLogout: () => void;
}

export function Dashboard({ user: initialUser, onLogout }: DashboardProps) {
	const location = useLocation();
	const searchParams = useSearch({ from: "/_app/dashboard" });
	const navigate = useNavigate();

	const [_user, setUser] = useState(initialUser);
	const [activeView, setActiveView] = useState(searchParams.view || "overview");
	const [assetTypeFilter, _setAssetTypeFilter] = useState("all");

	// Selection States
	const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
	const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
	const [_selectedSavingId, setSelectedSavingId] = useState<string | null>(null);
	const [selectedCryptoId, setSelectedCryptoId] = useState<string | null>(null);
	const [selectedCryptoSymbol, setSelectedCryptoSymbol] = useState<string | null>(null);
	const [selectedStockSymbol, setSelectedStockSymbol] = useState<string | null>(null);
	const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
	const [selectedInsuranceId, setSelectedInsuranceId] = useState<string | null>(null);
	const [selectedCollectibleId, setSelectedCollectibleId] = useState<string | null>(null);

	// Screener States
	const [stockScreenerPreset, setStockScreenerPreset] = useState<string | undefined>(undefined);
	const [cryptoScreenerPreset, setCryptoScreenerPreset] = useState<string | undefined>(undefined);

	const { assets } = usePortfolio();

	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	const _handleUpdateUser = (updatedUser: any) => {
		setUser(updatedUser);
		localStorage.setItem("portfolio_user", JSON.stringify(updatedUser));
	};

	// --- NAVIGATION HANDLERS ---
	const handleNavigate = (viewId: string) => {
		// Routes that should use TanStack Router navigation to separate pages
		const routerRoutes: Record<string, string> = {
			stocks: "/assets/stocks",
			crypto: "/assets/crypto",
			"real-estate": "/assets/real-estate",
			accounts: "/assets/accounts",
			loans: "/assets/loans",
			insurance: "/assets/insurance",
			collectibles: "/assets/collectibles",
			"stock-market-overview": "/dashboard/stock-market-overview",
			"crypto-market-overview": "/dashboard/crypto-market-overview",
			"market-heatmaps": "/dashboard/market-heatmaps",
			"market-calendar": "/dashboard/market-calendar",
			watchlist: "/dashboard/watchlist",
			"stock-screener": "/dashboard?view=stock-screener",
			"crypto-screener": "/dashboard?view=crypto-screener",
		};

		if (routerRoutes[viewId]) {
			navigate({ to: routerRoutes[viewId] });
			return;
		}

		// Reset selection states when navigating top-level
		setSelectedPropertyId(null);
		setSelectedLoanId(null);
		setSelectedSavingId(null);
		setSelectedCryptoId(null);
		setSelectedAccountId(null);
		setSelectedInsuranceId(null);
		setSelectedCollectibleId(null);

		setActiveView(viewId);
	};

	// --- CONTENT RENDERING ---
	const renderContent = () => {
		switch (activeView) {
			case "overview":
				return <DensityDashboard />;

			// Keep legacy PortfolioOverview accessible if needed via a specific route,
			// but 'overview' now maps to the new Density Dashboard.
			case "legacy-overview":
				return <PortfolioOverview assetTypeFilter={assetTypeFilter} />;

			case "stocks":
				return (
					<StocksFundsModule
						onNavigateToTransactions={() => setActiveView("transactions")}
						onSelectAccount={(accountName) => {
							// Try to find the account asset ID
							const accountAsset = assets.find(
								(a) =>
									(a.name === accountName || a.accountName === accountName) &&
									["bank", "savings", "securities", "wallet"].includes(a.type),
							);
							if (accountAsset) {
								setSelectedAccountId(accountAsset.id);
								setActiveView("accounts");
							} else {
								toast.info(`Account details not available for ${accountName}`);
							}
						}}
						onSelectAsset={(symbol) => {
							setSelectedStockSymbol(symbol);
							setActiveView("stock-screener");
						}}
					/>
				);

			case "real-estate":
				if (selectedPropertyId) {
					return (
						<RealEstateDetail
							propertyId={selectedPropertyId}
							onBack={() => setSelectedPropertyId(null)}
						/>
					);
				}
				return <RealEstateList onSelectProperty={setSelectedPropertyId} />;

			case "loans":
				if (selectedLoanId) {
					return <LoanDetail loanId={selectedLoanId} onBack={() => setSelectedLoanId(null)} />;
				}
				return <LoansList onSelectLoan={setSelectedLoanId} />;

			case "accounts":
				if (selectedAccountId) {
					return (
						<AccountDetail
							accountId={selectedAccountId}
							onBack={() => setSelectedAccountId(null)}
							onSelectAsset={setSelectedCryptoId}
						/>
					);
				}
				return <AccountsList onSelectAccount={handleSelectAccount} />;

			case "crypto":
				if (selectedCryptoId) {
					return (
						<CryptoDetail symbol={selectedCryptoId} onBack={() => setSelectedCryptoId(null)} />
					);
				}
				return (
					<CryptoList onSelectCrypto={setSelectedCryptoId} onSelectAccount={handleSelectAccount} />
				);

			case "insurance":
				if (selectedInsuranceId) {
					return (
						<InsuranceDetail
							insuranceId={selectedInsuranceId}
							onBack={() => setSelectedInsuranceId(null)}
						/>
					);
				}
				return <InsuranceList onSelectInsurance={setSelectedInsuranceId} />;

			case "collectibles":
				if (selectedCollectibleId) {
					const collectible = assets.find((a) => a.id === selectedCollectibleId);
					// Route based on type
					if (collectible?.type === "watch")
						return (
							<WatchDetail
								watchId={selectedCollectibleId}
								onBack={() => setSelectedCollectibleId(null)}
							/>
						);
					if (collectible?.type === "art")
						return (
							<ArtDetail
								artId={selectedCollectibleId}
								onBack={() => setSelectedCollectibleId(null)}
							/>
						);
					if (collectible?.type === "vehicle")
						return (
							<VehicleDetail
								vehicleId={selectedCollectibleId}
								onBack={() => setSelectedCollectibleId(null)}
							/>
						);
					if (collectible?.type === "jewelry")
						return (
							<JewelryDetail
								jewelryId={selectedCollectibleId}
								onBack={() => setSelectedCollectibleId(null)}
							/>
						);
					if (collectible?.type === "wine")
						return (
							<WineDetail
								wineId={selectedCollectibleId}
								onBack={() => setSelectedCollectibleId(null)}
							/>
						);
					if (collectible?.type === "precious_metals")
						return (
							<PreciousMetalsDetail
								metalId={selectedCollectibleId}
								onBack={() => setSelectedCollectibleId(null)}
							/>
						);

					return <CollectiblesList onSelectCollectible={setSelectedCollectibleId} />;
				}
				return <CollectiblesList onSelectCollectible={setSelectedCollectibleId} />;

			case "transactions":
				return <TransactionManagement />;
			case "watchlist":
				return <WatchlistManagement />;
			case "analytics":
				return <Analytics />;

			// Market & Screener Routes
			case "stock-market-overview":
				return (
					<StockMarketOverview
						onNavigateToStockScreener={(preset) => {
							setStockScreenerPreset(preset);
							setActiveView("stock-screener");
						}}
						onNavigateToHeatmap={() => setActiveView("market-heatmaps")}
						onNavigateToCalendar={() => setActiveView("market-calendar")}
						onSelectStock={(symbol) => {
							setSelectedStockSymbol(symbol);
							setActiveView("stock-screener");
						}}
					/>
				);
			case "crypto-market-overview":
				return (
					<CryptoMarketOverview
						onNavigateToCryptoScreener={(preset) => {
							setCryptoScreenerPreset(preset);
							setActiveView("crypto-screener");
						}}
						onNavigateToHeatmap={() => setActiveView("market-heatmaps")}
						onSelectCrypto={(symbol) => {
							setSelectedCryptoSymbol(symbol);
							setActiveView("crypto-screener");
						}}
					/>
				);
			case "stock-screener":
				if (selectedStockSymbol) {
					return (
						<StockDetail
							symbol={selectedStockSymbol}
							onBack={() => setSelectedStockSymbol(null)}
							onNavigateToScreener={() => {
								setSelectedStockSymbol(null);
								toast.success("Applied filters");
							}}
						/>
					);
				}
				return (
					<StockScreener
						initialPreset={stockScreenerPreset}
						onSelectStock={setSelectedStockSymbol}
					/>
				);

			case "crypto-screener":
				if (selectedCryptoSymbol) {
					return (
						<CryptoDetail
							symbol={selectedCryptoSymbol}
							onBack={() => setSelectedCryptoSymbol(null)}
							onNavigateToScreener={() => {
								setSelectedCryptoSymbol(null);
								toast.success("Applied filters");
							}}
						/>
					);
				}
				return (
					<CryptoScreener
						initialPreset={cryptoScreenerPreset}
						onSelectCrypto={setSelectedCryptoSymbol}
					/>
				);

			case "market-heatmaps":
				return (
					<MarketHeatmaps
						onFilterStock={() => setActiveView("stock-screener")}
						onFilterCrypto={() => setActiveView("crypto-screener")}
					/>
				);
			case "market-calendar":
				return <MarketCalendar onFilterStock={() => setActiveView("stock-screener")} />;

			default:
				return <DensityDashboard />;
		}
	};

	const handleSelectAccount = (accountId: string) => {
		setSelectedAccountId(accountId);
		setActiveView("accounts");
	};

	// Check if we're at a child route (path is more than just /dashboard)
	const isChildRoute = location.pathname !== "/dashboard";

	return (
		<ProShell onNavigate={handleNavigate} onLogout={onLogout}>
			{isChildRoute ? <Outlet /> : renderContent()}
		</ProShell>
	);
}
