import { useMutation, useQuery } from "@apollo/client";
import ReactECharts from "echarts-for-react";
import {
	ArrowLeft,
	Building2,
	CheckCircle2,
	Coins,
	HardDrive,
	LayoutGrid,
	Link as LinkIcon,
	Loader2,
	PieChart,
	RefreshCw,
	Settings,
	Trash2,
	TrendingDown,
	TrendingUp,
	Wallet,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { usePortfolio } from "@/components/PortfolioProvider";
import { TRIGGER_ACCOUNT_SYNC } from "@/graphql/mutations/sync";
import { GET_ACCOUNT, GET_ACCOUNTS } from "@/graphql/queries/accounts";
import { useCurrency } from "@/hooks/use-currency";
import { DeleteAccountDialog } from "./account/DeleteAccountDialog";
import { EditAccountDialog } from "./account/EditAccountDialog";
import { AssetDetailChart, type AssetDetailChartPoint } from "./charts/AssetDetailChart";
import { PageTimeframeSelector, type TimeRange } from "./shared/PageTimeframeSelector";
import type { EChartsMouseEventParam, HoveredChartData } from "./types/echarts";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

interface AccountDetailProps {
	accountId: string;
	onBack: () => void;
	onSelectAsset?: (assetId: string) => void;
}

export function AccountDetail({ accountId, onBack, onSelectAsset }: AccountDetailProps) {
	const { assets, currentPortfolio, refetch: refetchPortfolio } = usePortfolio();
	const [timeRange, setTimeRange] = useState<TimeRange>("1Y");
	const [distributionChartType, setDistributionChartType] = useState<"pie" | "treemap">("pie");
	const [showEditDialog, setShowEditDialog] = useState(false);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);

	const {
		data: accountQueryData,
		loading: accountLoading,
		refetch: refetchAccount,
	} = useQuery(GET_ACCOUNT, {
		variables: { id: accountId },
		skip: !accountId,
	});

	const [triggerSync, { loading: syncing }] = useMutation(TRIGGER_ACCOUNT_SYNC, {
		refetchQueries: currentPortfolio
			? [{ query: GET_ACCOUNTS, variables: { portfolioId: currentPortfolio } }]
			: undefined,
	});

	// Find the account in GraphQL data, with fallback to assets
	const account = useMemo(() => {
		const rawAcc = accountQueryData?.account;
		if (rawAcc) {
			const typeUpper = (rawAcc.type || "").toUpperCase();
			const type: "CEX" | "Bank" | "Broker" =
				typeUpper === "CRYPTO_EXCHANGE" ? "CEX" : typeUpper === "BROKER" ? "Broker" : "Bank";

			return {
				id: rawAcc.id,
				name: rawAcc.name,
				accountName: rawAcc.name,
				type,
				rawType: rawAcc.type,
				taxWrapper: rawAcc.taxWrapper,
				institution: rawAcc.institution || "Main Account",
				accountNumber:
					rawAcc.accountNumber || (rawAcc.institution ? rawAcc.institution : "Main Account"),
				currency: rawAcc.currency || "EUR",
				syncProvider: rawAcc.syncProvider,
				syncConnection: rawAcc.syncConnection,
				totalValue: rawAcc.totalValue ?? 0,
				currentValue: rawAcc.totalValue ?? 0,
				balance: rawAcc.totalValue ?? 0,
				purchasePrice: rawAcc.totalValue ?? 0,
			};
		}

		return assets.find((a) => a.id === accountId);
	}, [accountQueryData, assets, accountId]);

	// Find holdings linked to this account
	const holdings = useMemo(() => {
		if (!account) return [];
		return assets
			.filter((a) => {
				if ((a as { accountId?: string }).accountId === account.id) return true;
				if (a.account === account.name) return true;
				if (a.account === (account as { accountName?: string }).accountName) return true;
				return false;
			})
			.map((h) => {
				const currentPrice = h.currentPrice || 0;
				const quantity = h.quantity || 0;
				const value = h.value || quantity * currentPrice;
				const purchasePrice = h.purchasePrice || 0;
				const cost = purchasePrice * quantity;
				const pl = value - cost;
				const plPercent = cost > 0 ? (pl / cost) * 100 : 0;

				return {
					...h,
					value,
					cost,
					profitLoss: pl,
					profitLossPercent: plPercent,
					change24h: Math.random() * 5 * (Math.random() > 0.5 ? 1 : -1),
				};
			});
	}, [assets, account]);

	const handleSync = async () => {
		if (!account?.id) return;
		const toastId = toast.loading(`Synchronizing ${account.name}...`);
		try {
			await triggerSync({ variables: { accountId: account.id } });
			toast.success(`Sync started for ${account.name}`, { id: toastId });
			await refetchAccount();
			await refetchPortfolio();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to sync account";
			toast.error(msg, { id: toastId });
		}
	};

	if (accountLoading && !account) {
		return (
			<div className="flex flex-col items-center justify-center h-full p-8 space-y-4">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
				<p className="text-sm text-muted-foreground">Loading account details...</p>
			</div>
		);
	}

	if (!account) {
		return (
			<div className="flex flex-col items-center justify-center h-full p-8">
				<h2 className="text-xl font-bold mb-2">Account Not Found</h2>
				<Button onClick={onBack}>Go Back</Button>
			</div>
		);
	}

	const totalValue =
		holdings.length > 0
			? holdings.reduce((sum, h) => sum + h.value, 0)
			: account.balance || account.currentValue || 0;
	const totalCost =
		holdings.length > 0
			? holdings.reduce((sum, h) => sum + h.cost, 0)
			: account.purchasePrice || totalValue;
	const totalProfitLoss = totalValue - totalCost;
	const totalProfitLossPercent = totalCost > 0 ? (totalProfitLoss / totalCost) * 100 : 0;

	const { formatCurrencyCompact: formatCurrency } = useCurrency();

	const formatNumber = (num: number, decimals: number = 2) => {
		return num.toLocaleString("en-US", {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals,
		});
	};

	const chartData = useMemo(() => {
		let days = 365;
		switch (timeRange) {
			case "1M":
				days = 30;
				break;
			case "3M":
				days = 90;
				break;
			case "6M":
				days = 180;
				break;
			case "1Y":
				days = 365;
				break;
			case "ALL":
				days = 730;
				break;
			case "MAX":
				days = 1095;
				break;
		}

		const points: AssetDetailChartPoint[] = [];
		let current = totalValue;
		const volatility = 0.02;

		for (let i = 0; i <= days; i++) {
			points.unshift({
				date: new Date(Date.now() - i * 86400000).toISOString().split("T")[0],
				close: current,
			});
			current = current * (1 - (Math.random() - 0.48) * volatility);
		}
		return points;
	}, [timeRange, totalValue]);

	const distributionData = holdings.map((h) => ({
		name: h.symbol || h.name,
		value: h.value,
		itemStyle: { color: h.color || "#10b981" },
	}));

	const [hoveredAssetData, setHoveredAssetData] = React.useState<HoveredChartData | null>(null);

	const distributionChartOption =
		distributionChartType === "pie"
			? {
					tooltip: { show: false },
					legend: { show: false },
					graphic: {
						type: "group",
						left: "center",
						top: "center",
						children: [
							{
								type: "text",
								z: 100,
								left: "center",
								top: "middle",
								style: {
									text: hoveredAssetData ? hoveredAssetData.name : formatCurrency(totalValue),
									textAlign: "center",
									fill: document.documentElement.classList.contains("dark") ? "#fafafa" : "#0a0a0a",
									fontSize: hoveredAssetData ? 18 : 24,
									fontWeight: "600",
									lineHeight: 1.2,
								},
							},
							{
								type: "text",
								z: 100,
								left: "center",
								top: "middle",
								style: {
									text: hoveredAssetData ? formatCurrency(hoveredAssetData.value) : "Total Value",
									textAlign: "center",
									fill: document.documentElement.classList.contains("dark") ? "#a3a3a3" : "#737373",
									fontSize: hoveredAssetData ? 14 : 12,
									fontWeight: hoveredAssetData ? "500" : "400",
									y: hoveredAssetData ? 24 : 32,
								},
							},
						],
					},
					series: [
						{
							type: "pie",
							radius: ["65%", "90%"],
							avoidLabelOverlap: false,
							itemStyle: {
								borderRadius: 4,
								borderColor: document.documentElement.classList.contains("dark")
									? "#0a0a0a"
									: "#fafafa",
								borderWidth: 2,
							},
							label: { show: false },
							data:
								distributionData.length > 0
									? distributionData
									: [
											{
												value: 1,
												name: "Cash",
												itemStyle: { color: "#e5e5e5" },
											},
										],
						},
					],
				}
			: {
					tooltip: { formatter: "{b}: {c}" },
					series: [
						{
							type: "treemap",
							data: distributionData,
							width: "100%",
							height: "100%",
						},
					],
				};

	const AccountIcon = ({ type }: { type: string }) => {
		if (type === "securities" || type === "stock" || type === "fund")
			return <Building2 className="h-6 w-6" />;
		if (type === "crypto") return <HardDrive className="h-6 w-6" />;
		if (type === "bank" || type === "savings") return <Wallet className="h-6 w-6" />;
		return <Coins className="h-6 w-6" />;
	};

	return (
		<div className="space-y-6 animate-in fade-in duration-300">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<Button variant="ghost" size="icon" onClick={onBack}>
						<ArrowLeft className="h-5 w-5" />
					</Button>
					<div className="flex items-center gap-4">
						<div className="h-16 w-16 rounded-full flex items-center justify-center bg-secondary text-foreground">
							<AccountIcon type={account.type} />
						</div>
						<div>
							<h1 className="text-3xl font-bold tracking-tight">
								{account.name || account.accountName}
							</h1>
							<div className="flex items-center gap-3 mt-1">
								<Badge variant="outline" className="uppercase text-[10px]">
									{account.type}
								</Badge>
								<span className="text-sm text-muted-foreground font-mono">
									{account.accountNumber}
								</span>
							</div>
						</div>
					</div>
				</div>
				<div className="flex items-center gap-4">
					<PageTimeframeSelector
						value={timeRange}
						onChange={setTimeRange}
						ranges={["1M", "3M", "6M", "1Y", "ALL", "MAX"]}
					/>
					<div className="h-8 w-px bg-border/50 mx-2" />
					<div className="flex gap-2">
						{account.syncProvider && account.syncProvider !== "MANUAL" && (
							<Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
								<RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
								{syncing ? "Syncing..." : "Sync"}
							</Button>
						)}
						<Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
							<Settings className="h-4 w-4 mr-2" />
							Edit
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="text-destructive hover:bg-destructive/10 hover:text-destructive"
							onClick={() => setShowDeleteDialog(true)}
						>
							<Trash2 className="h-4 w-4 mr-2" />
							Delete
						</Button>
					</div>
				</div>
			</div>

			{/* Status Banner */}
			{account.syncProvider && account.syncProvider !== "MANUAL" ? (
				<div className="flex items-center justify-between p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
					<div className="flex items-center gap-2">
						<CheckCircle2 className="h-5 w-5 text-emerald-500" />
						<span className="text-sm text-emerald-700 dark:text-emerald-400">
							{account.syncProvider} connected • Last sync:{" "}
							{account.syncConnection?.lastSyncAt
								? new Date(account.syncConnection.lastSyncAt).toLocaleString()
								: "Never"}
						</span>
					</div>
					<Button
						variant="ghost"
						size="sm"
						onClick={handleSync}
						disabled={syncing}
						className="h-8 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-500/20"
					>
						<RefreshCw className={`h-3.5 w-3.5 mr-2 ${syncing ? "animate-spin" : ""}`} />
						{syncing ? "Syncing..." : "Sync Now"}
					</Button>
				</div>
			) : (
				<div className="flex items-center justify-between p-4 rounded-lg bg-muted/40 border border-border">
					<span className="text-sm text-muted-foreground">
						Manual Account • No automated integration configured
					</span>
				</div>
			)}

			{/* Stats Cards */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<Card>
					<CardHeader className="pb-3">
						<CardDescription>Total Value</CardDescription>
						<CardTitle className="text-2xl font-mono">{formatCurrency(totalValue)}</CardTitle>
					</CardHeader>
					<CardContent>
						<div
							className={`flex items-center gap-1 text-sm ${totalProfitLoss >= 0 ? "text-emerald-500" : "text-rose-500"}`}
						>
							{totalProfitLoss >= 0 ? (
								<TrendingUp className="h-4 w-4" />
							) : (
								<TrendingDown className="h-4 w-4" />
							)}
							<span className="font-mono">
								{totalProfitLoss >= 0 ? "+" : ""}
								{formatCurrency(totalProfitLoss)} ({totalProfitLossPercent.toFixed(2)}%)
							</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-3">
						<CardDescription>Total Cost</CardDescription>
						<CardTitle className="text-2xl font-mono">{formatCurrency(totalCost)}</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground">{holdings.length} assets</p>
					</CardContent>
				</Card>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Performance Chart */}
				<div className="lg:col-span-2">
					<div className="flex items-center justify-between mb-2">
						<h3 className="text-lg font-semibold">Performance</h3>
					</div>
					<AssetDetailChart
						data={chartData}
						symbol="Account"
						initialChartType="area"
						showIndicators={false}
						showTypeSelector={false}
						timeRange={timeRange}
					/>
				</div>

				{/* Asset Distribution */}
				<Card className="lg:col-span-1">
					<CardHeader>
						<div className="flex items-center justify-between">
							<CardTitle>Allocation</CardTitle>
							<div className="flex bg-muted rounded p-0.5">
								<Button
									variant={distributionChartType === "pie" ? "secondary" : "ghost"}
									size="icon"
									className="h-6 w-6"
									onClick={() => setDistributionChartType("pie")}
								>
									<PieChart className="h-3 w-3" />
								</Button>
								<Button
									variant={distributionChartType === "treemap" ? "secondary" : "ghost"}
									size="icon"
									className="h-6 w-6"
									onClick={() => setDistributionChartType("treemap")}
								>
									<LayoutGrid className="h-3 w-3" />
								</Button>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						<ReactECharts
							option={distributionChartOption}
							style={{ height: "300px" }}
							opts={{ renderer: "svg" }}
							onEvents={{
								mouseover: (params: EChartsMouseEventParam) => {
									if (params.componentType === "series" && params.seriesType === "pie") {
										setHoveredAssetData({
											name: params.name,
											value: params.value,
											percent: params.percent,
										});
									}
								},
								mouseout: () => {
									setHoveredAssetData(null);
								},
							}}
						/>
					</CardContent>
				</Card>
			</div>

			{/* Holdings Table */}
			{holdings.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle>Holdings</CardTitle>
						<CardDescription>Assets held in this account</CardDescription>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Asset</TableHead>
									<TableHead className="text-right">Quantity</TableHead>
									<TableHead className="text-right">Price</TableHead>
									<TableHead className="text-right">Value</TableHead>
									<TableHead className="text-right">P&L</TableHead>
									<TableHead className="text-right">Allocation</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{holdings.map((holding) => {
									const allocation = totalValue > 0 ? (holding.value / totalValue) * 100 : 0;
									return (
										<TableRow
											key={holding.id}
											className="cursor-pointer hover:bg-muted/50"
											onClick={() => onSelectAsset?.(holding.symbol || holding.name)}
										>
											<TableCell>
												<div className="flex items-center gap-3">
													<div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center font-bold text-xs">
														{holding.symbol ? holding.symbol.substring(0, 1) : "A"}
													</div>
													<div>
														<p className="font-medium text-sm">{holding.name}</p>
														<p className="text-xs text-muted-foreground">{holding.symbol}</p>
													</div>
												</div>
											</TableCell>
											<TableCell className="text-right font-mono text-sm">
												{formatNumber(holding.quantity, 4)}
											</TableCell>
											<TableCell className="text-right font-mono text-sm">
												{formatCurrency(holding.currentPrice)}
											</TableCell>
											<TableCell className="text-right font-mono text-sm font-medium">
												{formatCurrency(holding.value)}
											</TableCell>
											<TableCell
												className={`text-right font-mono text-sm ${holding.profitLoss >= 0 ? "text-emerald-500" : "text-rose-500"}`}
											>
												{holding.profitLoss >= 0 ? "+" : ""}
												{formatCurrency(holding.profitLoss)}
												<span className="text-xs ml-1 opacity-70">
													({holding.profitLossPercent.toFixed(1)}%)
												</span>
											</TableCell>
											<TableCell className="text-right">
												<div className="flex items-center gap-2 justify-end">
													<Progress value={allocation} className="w-16 h-1.5" />
													<span className="text-xs font-mono w-10 text-right">
														{allocation.toFixed(1)}%
													</span>
												</div>
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}

			{showEditDialog && (
				<EditAccountDialog
					open={showEditDialog}
					onOpenChange={setShowEditDialog}
					account={{
						id: account.id,
						name: account.name,
						type: (account as { rawType?: string }).rawType || account.type,
						taxWrapper: (account as { taxWrapper?: string | null }).taxWrapper,
						institution: (account as { institution?: string | null }).institution,
						accountNumber: account.accountNumber,
						currency: (account as { currency?: string | null }).currency,
					}}
					portfolioId={currentPortfolio || undefined}
					onSuccess={() => {
						setShowEditDialog(false);
						void refetchAccount();
						void refetchPortfolio();
					}}
				/>
			)}

			{showDeleteDialog && (
				<DeleteAccountDialog
					open={showDeleteDialog}
					onOpenChange={setShowDeleteDialog}
					accountId={account.id}
					accountName={account.name}
					portfolioId={currentPortfolio || undefined}
					onSuccess={() => {
						setShowDeleteDialog(false);
						void refetchPortfolio();
						onBack();
					}}
				/>
			)}
		</div>
	);
}
