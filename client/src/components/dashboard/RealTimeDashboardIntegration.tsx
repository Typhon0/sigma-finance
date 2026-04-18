/**
 * Real-Time Dashboard Integration Example
 *
 * This component demonstrates how to integrate all real-time features
 * into the existing dashboard architecture while maintaining the
 * dashboard-centric approach with inline portfolio views.
 */

import { Activity, Wifi } from "lucide-react";
import React from "react";
import {
	FloatingAlertNotification,
	RealTimeAlertNotifications,
} from "@/components/alerts/RealTimeAlertNotifications";
import { RealTimeChart } from "@/components/charts/RealTimeChart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RealTimeDashboardProvider } from "@/contexts/RealTimeDashboardContext";
import { ConnectionStatus, GlobalConnectionStatus } from "./ConnectionStatus";
import { InlinePortfolioDetail } from "./inline-portfolio-detail";
import { RealTimePortfolioValue } from "./RealTimePortfolioValue";

interface RealTimeDashboardIntegrationProps {
	portfolios: any[];
	assets: any[];
	children: React.ReactNode;
}

/**
 * Wrapper component that provides real-time functionality to the entire dashboard
 */
export function RealTimeDashboardIntegration({
	portfolios,
	assets,
	children,
}: RealTimeDashboardIntegrationProps) {
	// Extract IDs for real-time tracking
	const portfolioIds = portfolios.map((p) => p.id);
	const assetIds = assets.map((a) => a.id);

	return (
		<RealTimeDashboardProvider
			trackedAssets={assetIds}
			trackedPortfolios={portfolioIds}
		>
			<div className="min-h-screen bg-gray-50">
				{/* Enhanced Header with Real-Time Status */}
				<RealTimeHeader />

				{/* Main Dashboard Content */}
				<main className="p-6">{children}</main>

				{/* Floating Real-Time Notifications */}
				<FloatingAlertNotification />
			</div>
		</RealTimeDashboardProvider>
	);
}

/**
 * Enhanced header with real-time connection status
 */
function RealTimeHeader() {
	return (
		<header className="bg-white border-b px-6 py-4">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Portfolio Tracker</h1>
					<p className="text-sm text-gray-600">
						Real-time portfolio management
					</p>
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
	);
}

/**
 * Enhanced portfolio summary cards with real-time updates
 */
interface RealTimePortfolioSummaryCardsProps {
	portfolios: any[];
	onPortfolioSelect: (portfolio: any) => void;
}

export function RealTimePortfolioSummaryCards({
	portfolios,
	onPortfolioSelect,
}: RealTimePortfolioSummaryCardsProps) {
	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{portfolios.map((portfolio) => (
				<div
					key={portfolio.id}
					className="cursor-pointer hover:shadow-lg transition-shadow"
					onClick={() => onPortfolioSelect(portfolio)}
				>
					<RealTimePortfolioValue
						portfolioId={portfolio.id}
						portfolioName={portfolio.name}
						showDetailedMetrics={false}
					/>
				</div>
			))}
		</div>
	);
}

/**
 * Real-time dashboard overview with live data
 */
interface RealTimeDashboardOverviewProps {
	portfolios: any[];
	onPortfolioSelect: (portfolio: any) => void;
}

export function RealTimeDashboardOverview({
	portfolios,
	onPortfolioSelect,
}: RealTimeDashboardOverviewProps) {
	return (
		<div className="space-y-6">
			{/* Dashboard Header with Connection Status */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
					<p className="text-muted-foreground">
						Monitor your portfolios with real-time updates
					</p>
				</div>
				<ConnectionStatus variant="full" />
			</div>

			{/* Real-Time Portfolio Cards */}
			<RealTimePortfolioSummaryCards
				portfolios={portfolios}
				onPortfolioSelect={onPortfolioSelect}
			/>

			{/* Real-Time Market Overview */}
			<div className="grid gap-6 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Wifi className="h-4 w-4" />
							Market Data
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							{/* Sample real-time charts for major assets */}
							<RealTimeChart
								assetId="sample-asset-1"
								symbol="AAPL"
								chartType="line"
								height={200}
							/>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Live Alerts</CardTitle>
					</CardHeader>
					<CardContent>
						<RealTimeAlertNotifications showInline={true} maxVisible={3} />
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

/**
 * Usage example for integrating real-time features into existing dashboard
 */
export function DashboardWithRealTimeExample() {
	const [viewState, setViewState] = React.useState<{
		viewMode: "overview" | "portfolio-detail";
		selectedPortfolio: any | null;
	}>({
		viewMode: "overview",
		selectedPortfolio: null,
	});

	// Mock data - in real app this would come from GraphQL
	const mockPortfolios = [
		{
			id: "portfolio-1",
			name: "Growth Portfolio",
			description: "High-growth technology stocks",
			assets: [],
		},
	];

	const mockAssets = [
		{ id: "asset-1", symbol: "AAPL", name: "Apple Inc." },
		{ id: "asset-2", symbol: "MSFT", name: "Microsoft Corporation" },
	];

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
		<RealTimeDashboardIntegration
			portfolios={mockPortfolios}
			assets={mockAssets}
		>
			{viewState.viewMode === "overview" && (
				<RealTimeDashboardOverview
					portfolios={mockPortfolios}
					onPortfolioSelect={handlePortfolioSelect}
				/>
			)}

			{viewState.viewMode === "portfolio-detail" &&
				viewState.selectedPortfolio && (
					<InlinePortfolioDetail
						portfolio={viewState.selectedPortfolio}
						onBack={handleBackToOverview}
					/>
				)}
		</RealTimeDashboardIntegration>
	);
}

/**
 * Hook for easy integration of real-time features into existing components
 */
export function useRealTimeIntegration(
	portfolioIds: string[],
	assetIds: string[],
) {
	return {
		// Wrap your component with this provider
		RealTimeProvider: ({ children }: { children: React.ReactNode }) => (
			<RealTimeDashboardProvider
				trackedAssets={assetIds}
				trackedPortfolios={portfolioIds}
			>
				{children}
			</RealTimeDashboardProvider>
		),

		// Components you can use
		components: {
			RealTimePortfolioValue,
			RealTimeChart,
			RealTimeAlertNotifications,
			ConnectionStatus,
			FloatingAlertNotification,
		},
	};
}
