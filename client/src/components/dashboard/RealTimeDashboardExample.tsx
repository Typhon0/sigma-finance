import { Activity, BarChart3, Bell, DollarSign, TrendingUp, Wifi } from "lucide-react";
import { useState } from "react";
import {
	FloatingAlertNotification,
	RealTimeAlertNotifications,
} from "@/components/alerts/RealTimeAlertNotifications";
import { RealTimeChart } from "@/components/charts/RealTimeChart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RealTimeDashboardProvider } from "@/contexts/RealTimeDashboardContext";
import { ConnectionStatus, GlobalConnectionStatus } from "./ConnectionStatus";
import { InlinePortfolioDetail } from "./inline-portfolio-detail";
import { RealTimePortfolioValue } from "./RealTimePortfolioValue";

// Mock data for demonstration
const mockPortfolios = [
	{
		id: "portfolio-1",
		name: "Growth Portfolio",
		description: "High-growth technology stocks",
		assets: [
			{
				id: "asset-1",
				asset: {
					id: "asset-1",
					name: "Apple Inc.",
					symbol: "AAPL",
					type: "STOCK",
				},
				quantity: 100,
				averagePurchasePrice: 150.0,
			},
			{
				id: "asset-2",
				asset: {
					id: "asset-2",
					name: "Microsoft Corporation",
					symbol: "MSFT",
					type: "STOCK",
				},
				quantity: 50,
				averagePurchasePrice: 300.0,
			},
		],
	},
	{
		id: "portfolio-2",
		name: "Crypto Portfolio",
		description: "Cryptocurrency investments",
		assets: [
			{
				id: "asset-3",
				asset: {
					id: "asset-3",
					name: "Bitcoin",
					symbol: "BTC",
					type: "CRYPTO",
				},
				quantity: 0.5,
				averagePurchasePrice: 45000.0,
			},
		],
	},
];

interface DashboardViewState {
	viewMode: "overview" | "portfolio-detail";
	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	selectedPortfolio: any | null;
}

export function RealTimeDashboardExample() {
	const [viewState, setViewState] = useState<DashboardViewState>({
		viewMode: "overview",
		selectedPortfolio: null,
	});

	// Extract all asset IDs for real-time tracking
	const allAssetIds = mockPortfolios.flatMap((portfolio) =>
		portfolio.assets.map((position) => position.asset.id),
	);

	// Extract all portfolio IDs for real-time tracking
	const allPortfolioIds = mockPortfolios.map((portfolio) => portfolio.id);

	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	const handlePortfolioSelect = (portfolio: any) => {
		setViewState({
			viewMode: "portfolio-detail",
			selectedPortfolio: portfolio,
		});
	};

	const handleBackToOverview = () => {
		setViewState({
			viewMode: "overview",
			selectedPortfolio: null,
		});
	};

	return (
		<RealTimeDashboardProvider trackedAssets={allAssetIds} trackedPortfolios={allPortfolioIds}>
			<div className="min-h-screen bg-gray-50">
				{/* Global Header with Connection Status */}
				<header className="bg-white border-b px-6 py-4">
					<div className="flex items-center justify-between">
						<div>
							<h1 className="text-2xl font-bold">Portfolio Tracker</h1>
							<p className="text-sm text-gray-600">Real-time portfolio management</p>
						</div>
						<div className="flex items-center gap-4">
							<GlobalConnectionStatus />
							<Badge variant="outline" className="flex items-center gap-1">
								<Activity className="h-3 w-3" />
								Real-time Mode
							</Badge>
						</div>
					</div>
				</header>

				<main className="p-6">
					{viewState.viewMode === "overview" && (
						<DashboardOverview
							portfolios={mockPortfolios}
							onPortfolioSelect={handlePortfolioSelect}
						/>
					)}

					{viewState.viewMode === "portfolio-detail" && viewState.selectedPortfolio && (
						<InlinePortfolioDetail
							portfolio={viewState.selectedPortfolio}
							onBack={handleBackToOverview}
						/>
					)}
				</main>

				{/* Floating Alert Notifications */}
				<FloatingAlertNotification />
			</div>
		</RealTimeDashboardProvider>
	);
}

interface DashboardOverviewProps {
	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	portfolios: any[];
	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	onPortfolioSelect: (portfolio: any) => void;
}

function DashboardOverview({
	portfolios,
	onPortfolioSelect: _onPortfolioSelect,
}: DashboardOverviewProps) {
	return (
		<div className="space-y-6">
			{/* Dashboard Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
					<p className="text-muted-foreground">Monitor your portfolios with real-time updates</p>
				</div>
				<ConnectionStatus variant="full" />
			</div>

			{/* Real-Time Portfolio Cards */}
			<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
				{portfolios.map((portfolio) => (
					<RealTimePortfolioValue
						key={portfolio.id}
						portfolioId={portfolio.id}
						portfolioName={portfolio.name}
						className="cursor-pointer hover:shadow-lg transition-shadow"
					/>
				))}
			</div>

			{/* Dashboard Tabs */}
			<Tabs defaultValue="charts" className="w-full">
				<TabsList className="grid w-full grid-cols-4">
					<TabsTrigger value="charts">
						<BarChart3 className="h-4 w-4 mr-2" />
						Charts
					</TabsTrigger>
					<TabsTrigger value="performance">
						<TrendingUp className="h-4 w-4 mr-2" />
						Performance
					</TabsTrigger>
					<TabsTrigger value="alerts">
						<Bell className="h-4 w-4 mr-2" />
						Alerts
					</TabsTrigger>
					<TabsTrigger value="market">
						<DollarSign className="h-4 w-4 mr-2" />
						Market Data
					</TabsTrigger>
				</TabsList>

				<TabsContent value="charts" className="space-y-6">
					<div className="grid gap-6 lg:grid-cols-2">
						{/* Real-time charts for major assets */}
						<RealTimeChart assetId="asset-1" symbol="AAPL" chartType="line" height={300} />
						<RealTimeChart assetId="asset-3" symbol="BTC" chartType="line" height={300} />
					</div>
				</TabsContent>

				<TabsContent value="performance" className="space-y-6">
					<div className="grid gap-6 lg:grid-cols-2">
						{portfolios.map((portfolio) => (
							<Card key={portfolio.id}>
								<CardHeader>
									<CardTitle>{portfolio.name} Performance</CardTitle>
								</CardHeader>
								<CardContent>
									<RealTimePortfolioValue
										portfolioId={portfolio.id}
										portfolioName={portfolio.name}
										showDetailedMetrics={true}
									/>
								</CardContent>
							</Card>
						))}
					</div>
				</TabsContent>

				<TabsContent value="alerts" className="space-y-6">
					<RealTimeAlertNotifications />
				</TabsContent>

				<TabsContent value="market" className="space-y-6">
					<div className="grid gap-6 lg:grid-cols-3">
						{/* Market data widgets */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Wifi className="h-4 w-4" />
									Market Status
								</CardTitle>
							</CardHeader>
							<CardContent>
								<ConnectionStatus variant="full" showReconnectButton={true} />
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Price Updates</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-2">
									<div className="flex justify-between items-center">
										<span className="text-sm">AAPL</span>
										<Badge variant="outline">Live</Badge>
									</div>
									<div className="flex justify-between items-center">
										<span className="text-sm">BTC</span>
										<Badge variant="outline">Live</Badge>
									</div>
									<div className="flex justify-between items-center">
										<span className="text-sm">MSFT</span>
										<Badge variant="outline">Live</Badge>
									</div>
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Real-time Features</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-2 text-sm">
									<div className="flex items-center gap-2">
										<div className="w-2 h-2 bg-green-500 rounded-full"></div>
										<span>Price Updates</span>
									</div>
									<div className="flex items-center gap-2">
										<div className="w-2 h-2 bg-green-500 rounded-full"></div>
										<span>Portfolio Values</span>
									</div>
									<div className="flex items-center gap-2">
										<div className="w-2 h-2 bg-green-500 rounded-full"></div>
										<span>Alert Notifications</span>
									</div>
									<div className="flex items-center gap-2">
										<div className="w-2 h-2 bg-green-500 rounded-full"></div>
										<span>Chart Updates</span>
									</div>
								</div>
							</CardContent>
						</Card>
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
}
