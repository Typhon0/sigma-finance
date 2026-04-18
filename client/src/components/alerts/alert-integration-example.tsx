import { Bell, Settings, Zap } from "lucide-react";
import { useState } from "react";
import { AlertManagement, AlertQuickSetup } from "@/components/alerts";
import type {
	Alert,
	AlertFormData,
	AlertQuickSetupData,
	Asset,
	Portfolio,
} from "@/components/alerts/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Example data for demonstration
const examplePortfolios: Portfolio[] = [
	{
		id: "1",
		name: "Main Portfolio",
		description: "Primary investment portfolio",
	},
	{ id: "2", name: "Retirement Fund", description: "401k and IRA investments" },
	{
		id: "3",
		name: "Crypto Portfolio",
		description: "Cryptocurrency investments",
	},
];

const exampleAssets: Asset[] = [
	{
		id: "1",
		name: "Apple Inc.",
		symbol: "AAPL",
		type: "STOCK",
		currentPrice: 145.5,
	},
	{
		id: "2",
		name: "Bitcoin",
		symbol: "BTC",
		type: "CRYPTO",
		currentPrice: 42000,
	},
	{
		id: "3",
		name: "Tesla Inc.",
		symbol: "TSLA",
		type: "STOCK",
		currentPrice: 180.25,
	},
	{
		id: "4",
		name: "Ethereum",
		symbol: "ETH",
		type: "CRYPTO",
		currentPrice: 2500,
	},
];

/**
 * Example component demonstrating alert system integration
 * This shows how to integrate alerts into your dashboard components
 */
export function AlertIntegrationExample() {
	const [alerts, setAlerts] = useState<Alert[]>([]);
	const [showFullManagement, setShowFullManagement] = useState(false);

	// Simulate alert creation
	const handleCreateAlert = async (data: AlertFormData) => {
		const newAlert: Alert = {
			id: `alert-${Date.now()}`,
			alertType: data.alertType,
			conditionType: data.conditionType,
			assetId: data.assetId,
			portfolioId: data.portfolioId,
			thresholdValue: data.thresholdValue,
			thresholdPercentage: data.thresholdPercentage,
			notificationMethods: data.notificationMethods,
			isActive: data.isActive,
			name: data.name,
			description: data.description,
			createdAt: new Date(),
			updatedAt: new Date(),
			triggerCount: 0,
			asset: data.assetId
				? exampleAssets.find((a) => a.id === data.assetId)
				: undefined,
			portfolio: data.portfolioId
				? examplePortfolios.find((p) => p.id === data.portfolioId)
				: undefined,
		};

		setAlerts((prev) => [...prev, newAlert]);
		console.log("Created alert:", newAlert);
	};

	// Simulate alert updates
	const handleUpdateAlert = async (id: string, data: AlertFormData) => {
		setAlerts((prev) =>
			prev.map((alert) =>
				alert.id === id
					? {
							...alert,
							...data,
							updatedAt: new Date(),
							asset: data.assetId
								? exampleAssets.find((a) => a.id === data.assetId)
								: undefined,
							portfolio: data.portfolioId
								? examplePortfolios.find((p) => p.id === data.portfolioId)
								: undefined,
						}
					: alert,
			),
		);
		console.log("Updated alert:", id, data);
	};

	// Simulate alert deletion
	const handleDeleteAlert = async (id: string) => {
		setAlerts((prev) => prev.filter((alert) => alert.id !== id));
		console.log("Deleted alert:", id);
	};

	// Handle quick setup
	const handleQuickSetup = async (data: AlertQuickSetupData) => {
		const alertData: AlertFormData = {
			alertType: data.alertType,
			conditionType:
				data.alertType === "PRICE" || data.alertType === "PORTFOLIO_VALUE"
					? "ABOVE"
					: "INCREASE_BY",
			assetId: data.assetId,
			portfolioId: data.portfolioId,
			thresholdValue: data.thresholdValue,
			thresholdPercentage: data.thresholdPercentage,
			notificationMethods: data.notificationMethods,
			isActive: true,
			name: `Quick Alert - ${data.alertType}`,
		};

		await handleCreateAlert(alertData);
	};

	if (showFullManagement) {
		return (
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<h2 className="text-2xl font-bold">Alert Management Example</h2>
					<Button
						variant="outline"
						onClick={() => setShowFullManagement(false)}
					>
						Back to Summary
					</Button>
				</div>

				<AlertManagement
					portfolios={examplePortfolios}
					assets={exampleAssets}
					alerts={alerts}
					notifications={[]} // Empty for demo
					alertHistory={[]} // Empty for demo
					onCreateAlert={handleCreateAlert}
					onUpdateAlert={handleUpdateAlert}
					onDeleteAlert={handleDeleteAlert}
					onAcknowledgeAlert={async () => {}} // No-op for demo
					onTestAlert={async () => {}} // No-op for demo
					onFilterAlerts={() => {}} // No-op for demo
				/>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h2 className="text-2xl font-bold">Alert System Integration Example</h2>
				<div className="flex items-center gap-2">
					<AlertQuickSetup
						portfolios={examplePortfolios}
						assets={exampleAssets}
						onSubmit={handleQuickSetup}
					/>
					<Button onClick={() => setShowFullManagement(true)} className="gap-2">
						<Settings className="h-4 w-4" />
						Full Management
					</Button>
				</div>
			</div>

			{/* Alert Summary */}
			<div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardContent className="p-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium text-muted-foreground">
									Total Alerts
								</p>
								<div className="text-2xl font-bold">{alerts.length}</div>
							</div>
							<Bell className="h-4 w-4 text-muted-foreground" />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium text-muted-foreground">
									Active Alerts
								</p>
								<div className="text-2xl font-bold">
									{alerts.filter((a) => a.isActive).length}
								</div>
							</div>
							<Settings className="h-4 w-4 text-muted-foreground" />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium text-muted-foreground">
									Price Alerts
								</p>
								<div className="text-2xl font-bold">
									{alerts.filter((a) => a.alertType === "PRICE").length}
								</div>
							</div>
							<Zap className="h-4 w-4 text-muted-foreground" />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium text-muted-foreground">
									Portfolio Alerts
								</p>
								<div className="text-2xl font-bold">
									{
										alerts.filter((a) => a.alertType === "PORTFOLIO_VALUE")
											.length
									}
								</div>
							</div>
							<Bell className="h-4 w-4 text-muted-foreground" />
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Current Alerts */}
			<Card>
				<CardHeader>
					<CardTitle>Current Alerts</CardTitle>
				</CardHeader>
				<CardContent>
					{alerts.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">
							<Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
							<p className="text-lg font-medium mb-2">No Alerts Created</p>
							<p>Use the Quick Alert Setup button to create your first alert</p>
						</div>
					) : (
						<div className="space-y-3">
							{alerts.map((alert) => (
								<div
									key={alert.id}
									className="flex items-center justify-between p-4 border rounded-lg"
								>
									<div className="flex items-center gap-3">
										<Badge variant={alert.isActive ? "default" : "secondary"}>
											{alert.alertType}
										</Badge>
										<div>
											<p className="font-medium">{alert.name}</p>
											<p className="text-sm text-muted-foreground">
												{alert.asset?.name || alert.portfolio?.name} |
												{alert.thresholdValue
													? ` $${alert.thresholdValue}`
													: ""}
												{alert.thresholdPercentage
													? ` ${alert.thresholdPercentage}%`
													: ""}
											</p>
										</div>
									</div>
									<div className="flex items-center gap-2">
										{alert.notificationMethods.map((method) => (
											<Badge key={method} variant="outline" className="text-xs">
												{method}
											</Badge>
										))}
									</div>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Integration Instructions */}
			<Card>
				<CardHeader>
					<CardTitle>Integration Instructions</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
						<h4 className="font-medium text-blue-900 mb-2">
							Dashboard Integration
						</h4>
						<p className="text-sm text-blue-800">
							This example shows how to integrate the alert system into your
							dashboard components. The alert management system is designed to
							work seamlessly with the dashboard-centric architecture.
						</p>
					</div>

					<div className="p-4 bg-green-50 border border-green-200 rounded-lg">
						<h4 className="font-medium text-green-900 mb-2">Quick Setup</h4>
						<p className="text-sm text-green-800">
							Use the AlertQuickSetup component for context-aware alert creation
							from portfolio and asset views.
						</p>
					</div>

					<div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
						<h4 className="font-medium text-purple-900 mb-2">
							Full Management
						</h4>
						<p className="text-sm text-purple-800">
							The AlertManagement component provides comprehensive alert
							configuration, monitoring, and testing capabilities.
						</p>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
