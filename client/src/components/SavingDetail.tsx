import ReactECharts from "echarts-for-react";
import {
	AlertCircle,
	ArrowLeft,
	BarChart3,
	Clock,
	DollarSign,
	Percent,
	PiggyBank,
	Target,
	TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import { usePortfolio } from "@/components/PortfolioProvider";
import { CURRENCY_SYMBOLS } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

interface TransactionRowData {
	id: string;
	date: string;
	type: string;
	total: number;
	quantity?: number;
	pricePerUnit?: number;
}

/** Extracted sub-component to reduce JSX nesting depth (rolldown parser workaround) */
function TransactionTable({
	transactions,
	formatCurrency,
}: {
	transactions: TransactionRowData[];
	formatCurrency: (amount: number) => string;
}) {
	const getBadgeVariant = (type: string): "default" | "outline" | "secondary" => {
		if (type === "buy" || type === "deposit") return "default";
		if (type === "sell" || type === "withdrawal") return "outline";
		return "secondary";
	};

	return (
		<TableBody>
			{transactions.length > 0 ? (
				transactions.map((tx, idx) => (
					<TableRow key={tx.id || idx}>
						<TableCell className="text-sm">
							{new Date(tx.date).toLocaleDateString("fr-FR", {
								year: "numeric",
								month: "short",
								day: "numeric",
							})}
						</TableCell>
						<TableCell>
							<Badge variant={getBadgeVariant(tx.type)} className="capitalize">
								{tx.type}
							</Badge>
						</TableCell>
						<TableCell
							className={`text-right font-mono ${tx.total > 0 ? "text-green-600" : "text-red-600"}`}
						>
							{tx.total > 0 ? "+" : ""}
							{formatCurrency(tx.total)}
						</TableCell>
						<TableCell className="text-right font-mono text-muted-foreground">
							{tx.quantity ? `${tx.quantity} @ ${formatCurrency(tx.pricePerUnit ?? 0)}` : "--"}
						</TableCell>
					</TableRow>
				))
			) : (
				<TableRow>
					<TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
						<PiggyBank className="h-8 w-8 mx-auto mb-2" />
						<p>No transactions yet for this account</p>
					</TableCell>
				</TableRow>
			)}
		</TableBody>
	);
}

interface SavingDetailProps {
	savingId: string;
	onBack: () => void;
}

export function SavingDetail({ savingId, onBack }: SavingDetailProps) {
	const { assets, transactions } = usePortfolio();
	const [timePeriod, setTimePeriod] = useState("1Y");

	// Derive savings from portfolio assets, matching SavingsList data derivation
	const savings = useMemo(() => {
		return assets
			.filter((a) => a.type === "bank" || a.type === "savings")
			.map((a) => ({
				id: a.id,
				bankName: a.institution || a.symbol || "Unknown Bank",
				accountName: a.name,
				balance: a.balance ?? (a.currentValue || 0),
				ownership: (a.accountType === "joint"
					? "joint"
					: a.accountType === "company"
						? "company"
						: "personal") as "personal" | "joint" | "company",
				interestRate: a.interestRate ?? 0,
				currency: a.currency || "USD",
				accountType: a.accountType || a.type,
				accountNumber: a.accountNumber || `****${a.id.slice(-4)}`,
				initialDeposit: a.purchasePrice || 0,
			}));
	}, [assets]);

	const saving = savings.find((s) => s.id === savingId);

	// ALL hooks must be called before any early return (Rules of Hooks)

	// Derive real transactions for this asset from usePortfolio()
	const assetTransactions = useMemo(() => {
		return transactions
			.filter((t: any) => t.assetId === savingId)
			.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
	}, [transactions, savingId]);

	// Calculate monthsOpen from earliest transaction, or 0 if no transactions
	const monthsOpen = useMemo(() => {
		if (!saving) return 0;
		if (assetTransactions.length > 0) {
			const earliest = new Date(assetTransactions[assetTransactions.length - 1].date);
			return Math.max(
				1,
				Math.floor((Date.now() - earliest.getTime()) / (1000 * 60 * 60 * 24 * 30)),
			);
		}
		if (saving.initialDeposit > 0) return 1;
		return 0;
	}, [saving, assetTransactions]);

	// Generate historical data (useMemo with deterministic sinusoidal variation)
	const balanceHistory = useMemo(() => {
		if (!saving) return [];
		const data: { date: string; balance: number }[] = [];
		let months: number;

		if (timePeriod === "1M") months = 1;
		else if (timePeriod === "3M") months = 3;
		else if (timePeriod === "6M") months = 6;
		else if (timePeriod === "1Y") months = 12;
		else if (timePeriod === "YTD") {
			const now = new Date();
			const startOfYear = new Date(now.getFullYear(), 0, 1);
			months = Math.max(
				1,
				Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24 * 30)),
			);
		} else months = Math.min(monthsOpen || 12, 60); // ALL

		const startBalance = saving.initialDeposit;
		const currentBalance = saving.balance;
		const monthlyGrowth = months > 0 ? (currentBalance - startBalance) / months : 0;

		for (let i = 0; i <= months; i++) {
			const date = new Date();
			date.setMonth(date.getMonth() - (months - i));
			// Deterministic sinusoidal variation instead of Math.random()
			const variation =
				months > 0 ? Math.sin((i / months) * Math.PI * 2) * (currentBalance * 0.01) : 0;
			const balance = startBalance + monthlyGrowth * i + variation;

			data.push({
				date: date.toLocaleDateString("en-US", {
					month: "short",
					year: "numeric",
				}),
				balance: Math.max(startBalance, balance),
			});
		}

		return data;
	}, [timePeriod, monthsOpen, saving]);

	// Generate projection data (useMemo for stability)
	const projectionData = useMemo(() => {
		if (!saving) return [];
		const data: { period: string; balance: number; interest: number }[] = [];
		const months = [3, 6, 12, 24, 36, 60];

		months.forEach((month) => {
			const projectedBalance =
				saving.balance * (1 + (saving.interestRate || 0) / 100 / 12) ** month;
			const label = month < 12 ? `${month}M` : `${month / 12}Y`;

			data.push({
				period: label,
				balance: projectedBalance,
				interest: projectedBalance - saving.balance,
			});
		});

		return data;
	}, [saving]);

	// Early return after all hooks have been called
	if (!saving) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="text-center space-y-4">
					<PiggyBank className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
					<p className="text-muted-foreground">Account not found</p>
					<Button onClick={onBack}>
						<ArrowLeft className="h-4 w-4 mr-2" />
						Back to Accounts
					</Button>
				</div>
			</div>
		);
	}

	// Use the asset's native currency for formatting (e.g. a EUR account shows EUR)
	const nativeCurrency = saving.currency || "USD";
	const nativeCurrencySymbol = CURRENCY_SYMBOLS[nativeCurrency] ?? "$";
	const formatCurrency = (amount: number) => {
		const validAmount = typeof amount === "number" && !Number.isNaN(amount) ? amount : 0;
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: nativeCurrency,
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(validAmount);
	};

	const formatDate = (date: Date | string) => {
		const dateObj = date instanceof Date ? date : new Date(date);
		return dateObj.toLocaleDateString("fr-FR", {
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	};

	const totalGrowth = saving.balance - saving.initialDeposit;
	const growthPercentage =
		saving.initialDeposit > 0 ? (totalGrowth / saving.initialDeposit) * 100 : 0;
	const annualInterest = (saving.balance * (saving.interestRate || 0)) / 100;
	const monthlyInterest = annualInterest / 12;

	// Get ownership badge
	const getOwnershipBadge = () => {
		switch (saving.ownership) {
			case "personal":
				return (
					<Badge variant="default" className="capitalize">
						Personal
					</Badge>
				);
			case "company":
				return (
					<Badge variant="secondary" className="capitalize">
						Company
					</Badge>
				);
			case "joint":
				return (
					<Badge variant="outline" className="capitalize">
						Joint Account
					</Badge>
				);
			default:
				return <Badge className="capitalize">{saving.ownership}</Badge>;
		}
	};

	// Get ownership details text
	const getOwnershipDetails = () => {
		if (saving.ownership === "joint") {
			return "Joint account";
		}
		if (saving.ownership === "company") {
			return "Company account";
		}
		return "Individual ownership";
	};

	// Charts

	// Chart 1: Balance Evolution
	const balanceEvolutionOption = {
		tooltip: {
			trigger: "axis",
			backgroundColor: "rgba(0, 0, 0, 0.8)",
			borderColor: "#333",
			textStyle: { color: "#fff" },
			formatter: (params: any) => {
				const data = params[0];
				return `${data.name}<br/>Balance: ${formatCurrency(data.value)}`;
			},
		},
		grid: { left: 60, right: 20, top: 60, bottom: 40 },
		xAxis: {
			type: "category",
			data: balanceHistory.map((h) => h.date),
			axisLabel: { rotate: 45, fontSize: 10 },
		},
		yAxis: {
			type: "value",
			axisLabel: {
				formatter: (value: number) => `${nativeCurrencySymbol}${(value / 1000).toFixed(0)}K`,
			},
		},
		toolbox: {
			feature: {
				dataZoom: { yAxisIndex: "none" },
				restore: {},
				saveAsImage: {},
			},
			top: 0,
			right: 20,
		},
		series: [
			{
				name: "Balance",
				type: "line",
				data: balanceHistory.map((h) => h.balance),
				smooth: true,
				areaStyle: {
					color: {
						type: "linear",
						x: 0,
						y: 0,
						x2: 0,
						y2: 1,
						colorStops: [
							{ offset: 0, color: "rgba(16, 185, 129, 0.3)" },
							{ offset: 1, color: "rgba(16, 185, 129, 0.05)" },
						],
					},
				},
				lineStyle: { color: "#10b981", width: 2 },
				itemStyle: { color: "#10b981" },
			},
		],
	};

	// Chart 2: Growth Projection
	const projectionOption = {
		tooltip: {
			trigger: "axis",
			backgroundColor: "rgba(0, 0, 0, 0.8)",
			borderColor: "#333",
			textStyle: { color: "#fff" },
		},
		legend: { data: ["Balance", "Interest Earned"], bottom: 0 },
		grid: { left: 60, right: 20, top: 20, bottom: 60 },
		xAxis: {
			type: "category",
			data: projectionData.map((p) => p.period),
		},
		yAxis: {
			type: "value",
			axisLabel: {
				formatter: (value: number) => `${nativeCurrencySymbol}${(value / 1000).toFixed(0)}K`,
			},
		},
		series: [
			{
				name: "Balance",
				type: "bar",
				data: projectionData.map((p) => p.balance),
				itemStyle: { color: "#10b981" },
			},
			{
				name: "Interest Earned",
				type: "line",
				data: projectionData.map((p) => p.interest),
				smooth: true,
				itemStyle: { color: "#f59e0b" },
				lineStyle: { color: "#f59e0b", width: 2 },
			},
		],
	};

	// Chart 3: Monthly Growth
	const monthlyGrowthOption = {
		tooltip: {
			trigger: "axis",
			backgroundColor: "rgba(0, 0, 0, 0.8)",
			borderColor: "#333",
			textStyle: { color: "#fff" },
			axisPointer: { type: "shadow" },
		},
		grid: { left: 60, right: 20, top: 20, bottom: 40 },
		xAxis: {
			type: "category",
			data: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
		},
		yAxis: {
			type: "value",
			axisLabel: {
				formatter: (value: number) => `${nativeCurrencySymbol}${value}`,
			},
		},
		series: [
			{
				name: "Monthly Interest",
				type: "bar",
				data: Array(12)
					.fill(0)
					.map(
						(_v, i) => monthlyInterest + Math.sin((i / 12) * Math.PI * 2) * (monthlyInterest * 0.1),
					),
				itemStyle: {
					color: {
						type: "linear",
						x: 0,
						y: 0,
						x2: 0,
						y2: 1,
						colorStops: [
							{ offset: 0, color: "#10b981" },
							{ offset: 1, color: "#059669" },
						],
					},
				},
			},
		],
	};

	return (
		<ScrollArea className="h-full">
			<div className="p-6 space-y-6">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="flex items-center space-x-4">
						<Button variant="ghost" size="sm" onClick={onBack}>
							<ArrowLeft className="h-4 w-4 mr-2" />
							Back
						</Button>
						<div>
							<div className="flex items-center gap-3">
								<h1 className="text-3xl">{saving.accountName}</h1>
								{getOwnershipBadge()}
								<Badge variant="default" className="capitalize">
									{saving.accountType || "Savings"}
								</Badge>
							</div>
							<p className="text-muted-foreground mt-1">
								{saving.bankName} | Account {saving.accountNumber}
							</p>
						</div>
					</div>
				</div>

				{/* Key Metrics */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
								<DollarSign className="h-4 w-4" />
								Current Balance
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-mono text-green-600">
								{formatCurrency(saving.balance)}
							</div>
							<p className="text-xs text-muted-foreground mt-1">
								Started with {formatCurrency(saving.initialDeposit)}
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
								<TrendingUp className="h-4 w-4" />
								Total Growth
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-mono text-green-600">{formatCurrency(totalGrowth)}</div>
							<p className="text-xs text-muted-foreground mt-1">
								+{growthPercentage.toFixed(1)}% since opening
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
								<Percent className="h-4 w-4" />
								Interest Rate
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-mono">{(saving.interestRate || 0).toFixed(2)}%</div>
							<p className="text-xs text-muted-foreground mt-1">Annual rate</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
								<PiggyBank className="h-4 w-4" />
								Annual Interest
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-mono text-green-600">
								{formatCurrency(annualInterest)}
							</div>
							<p className="text-xs text-muted-foreground mt-1">
								~{formatCurrency(monthlyInterest)} per month
							</p>
						</CardContent>
					</Card>
				</div>

				{/* Time Period Selector */}
				<div className="flex gap-2">
					{["1M", "3M", "6M", "1Y", "YTD", "ALL"].map((period) => (
						<Button
							key={period}
							variant={timePeriod === period ? "default" : "outline"}
							size="sm"
							onClick={() => setTimePeriod(period)}
						>
							{period}
						</Button>
					))}
				</div>

				{/* Tabs */}
				<Tabs defaultValue="overview" className="space-y-4">
					<TabsList>
						<TabsTrigger value="overview">Overview</TabsTrigger>
						<TabsTrigger value="transactions">Transactions</TabsTrigger>
						<TabsTrigger value="analytics">Analytics</TabsTrigger>
						<TabsTrigger value="details">Details</TabsTrigger>
					</TabsList>

					{/* Overview Tab */}
					<TabsContent value="overview" className="space-y-4">
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
							{/* Balance Evolution Chart */}
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<TrendingUp className="h-5 w-5" />
										Balance Evolution
									</CardTitle>
									<CardDescription>Balance growth over time</CardDescription>
								</CardHeader>
								<CardContent>
									<ReactECharts
										option={balanceEvolutionOption}
										style={{ height: "350px" }}
										opts={{ renderer: "svg" }}
									/>
								</CardContent>
							</Card>

							{/* Growth Projection Chart */}
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<Target className="h-5 w-5" />
										Growth Projection
									</CardTitle>
									<CardDescription>
										Projected balance at {(saving.interestRate || 0).toFixed(2)}% interest
									</CardDescription>
								</CardHeader>
								<CardContent>
									<ReactECharts
										option={projectionOption}
										style={{ height: "350px" }}
										opts={{ renderer: "svg" }}
									/>
								</CardContent>
							</Card>
						</div>

						{/* Summary Cards */}
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							<Card>
								<CardHeader>
									<CardTitle className="text-sm">Account Age</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="text-xl font-mono">
										{monthsOpen > 0 ? `${monthsOpen} months` : "New"}
									</div>
									<p className="text-xs text-muted-foreground mt-1">
										{assetTransactions.length > 0
											? `${assetTransactions.length} transactions`
											: "No transactions yet"}
									</p>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle className="text-sm">Average Monthly Growth</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="text-xl font-mono text-green-600">
										{formatCurrency(monthsOpen > 0 ? totalGrowth / monthsOpen : totalGrowth)}
									</div>
									<p className="text-xs text-muted-foreground mt-1">Per month average</p>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle className="text-sm">Projected 1Y Balance</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="text-xl font-mono">
										{formatCurrency(saving.balance * (1 + (saving.interestRate || 0) / 100))}
									</div>
									<p className="text-xs text-muted-foreground mt-1">In 12 months</p>
								</CardContent>
							</Card>
						</div>
					</TabsContent>

					{/* Transactions Tab */}
					<TabsContent value="transactions" className="space-y-4">
						<Card>
							<CardHeader>
								<CardTitle>Transaction History</CardTitle>
								<CardDescription>
									Recent deposits, withdrawals, and interest payments
								</CardDescription>
							</CardHeader>
							<CardContent>
								<ScrollArea className="h-[500px]">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Date</TableHead>
												<TableHead>Type</TableHead>
												<TableHead className="text-right">Amount</TableHead>
												<TableHead className="text-right">Details</TableHead>
											</TableRow>
										</TableHeader>
										<TransactionTable
											transactions={assetTransactions}
											formatCurrency={formatCurrency}
										/>
									</Table>
								</ScrollArea>
							</CardContent>
						</Card>
					</TabsContent>

					{/* Analytics Tab */}
					<TabsContent value="analytics" className="space-y-4">
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
							{/* Monthly Interest Chart */}
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<BarChart3 className="h-5 w-5" />
										Monthly Interest
									</CardTitle>
									<CardDescription>Interest earned each month</CardDescription>
								</CardHeader>
								<CardContent>
									<ReactECharts
										option={monthlyGrowthOption}
										style={{ height: "300px" }}
										opts={{ renderer: "svg" }}
									/>
								</CardContent>
							</Card>

							{/* Key Insights */}
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<AlertCircle className="h-5 w-5" />
										Key Insights
									</CardTitle>
									<CardDescription>Smart recommendations for your account</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="space-y-4">
										<div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
											<div className="flex items-start gap-3">
												<div className="h-8 w-8 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
													<TrendingUp className="h-4 w-4 text-white" />
												</div>
												<div>
													<p className="font-medium text-green-900 dark:text-green-100">
														Healthy Growth
													</p>
													<p className="text-sm text-green-700 dark:text-green-300 mt-1">
														Your account has grown by {growthPercentage.toFixed(1)}% since opening.
														Great progress!
													</p>
												</div>
											</div>
										</div>

										<div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
											<div className="flex items-start gap-3">
												<div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
													<PiggyBank className="h-4 w-4 text-white" />
												</div>
												<div>
													<p className="font-medium text-blue-900 dark:text-blue-100">
														Annual Interest
													</p>
													<p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
														You'll earn approximately {formatCurrency(annualInterest)} this year in
														interest
													</p>
												</div>
											</div>
										</div>

										{(saving.interestRate || 0) > 3.5 && (
											<div className="p-4 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg">
												<div className="flex items-start gap-3">
													<div className="h-8 w-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
														<Target className="h-4 w-4 text-white" />
													</div>
													<div>
														<p className="font-medium text-purple-900 dark:text-purple-100">
															Great Rate!
														</p>
														<p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
															Your {(saving.interestRate || 0).toFixed(2)}% rate is above average.
															Well done!
														</p>
													</div>
												</div>
											</div>
										)}

										<div className="p-4 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg">
											<div className="flex items-start gap-3">
												<div className="h-8 w-8 rounded-full bg-orange-600 flex items-center justify-center flex-shrink-0">
													<Clock className="h-4 w-4 text-white" />
												</div>
												<div>
													<p className="font-medium text-orange-900 dark:text-orange-100">
														Time in Market
													</p>
													<p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
														Account has been active for{" "}
														{monthsOpen > 0
															? `${monthsOpen} months (${(monthsOpen / 12).toFixed(1)} years)`
															: "less than a month"}
													</p>
												</div>
											</div>
										</div>
									</div>
								</CardContent>
							</Card>
						</div>
					</TabsContent>

					{/* Details Tab */}
					<TabsContent value="details" className="space-y-4">
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
							{/* Account Information */}
							<Card>
								<CardHeader>
									<CardTitle>Account Information</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="flex justify-between py-2 border-b">
										<span className="text-muted-foreground">Account Name</span>
										<span className="font-medium">{saving.accountName}</span>
									</div>
									<div className="flex justify-between py-2 border-b">
										<span className="text-muted-foreground">Account Number</span>
										<span className="font-mono">{saving.accountNumber}</span>
									</div>
									<div className="flex justify-between py-2 border-b">
										<span className="text-muted-foreground">Account Type</span>
										<span className="font-medium capitalize">
											{saving.accountType || "Savings"}
										</span>
									</div>
									<div className="flex justify-between py-2 border-b">
										<span className="text-muted-foreground">Bank</span>
										<span className="font-medium">{saving.bankName}</span>
									</div>
									<div className="flex justify-between py-2 border-b">
										<span className="text-muted-foreground">Currency</span>
										<span className="font-medium">{saving.currency}</span>
									</div>
									<div className="flex justify-between py-2 border-b">
										<span className="text-muted-foreground">Current Balance</span>
										<span className="font-mono text-green-600">
											{formatCurrency(saving.balance)}
										</span>
									</div>
									<div className="flex justify-between py-2 border-b">
										<span className="text-muted-foreground">Ownership</span>
										{getOwnershipBadge()}
									</div>
									<div className="flex justify-between py-2">
										<span className="text-muted-foreground">Ownership Details</span>
										<span className="font-medium text-right">{getOwnershipDetails()}</span>
									</div>
								</CardContent>
							</Card>

							{/* Interest & Timeline */}
							<Card>
								<CardHeader>
									<CardTitle>Interest & Timeline</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="flex justify-between py-2 border-b">
										<span className="text-muted-foreground">Interest Rate</span>
										<span className="font-mono">{(saving.interestRate || 0).toFixed(2)}%</span>
									</div>
									<div className="flex justify-between py-2 border-b">
										<span className="text-muted-foreground">Annual Interest</span>
										<span className="font-mono text-green-600">
											{formatCurrency(annualInterest)}
										</span>
									</div>
									<div className="flex justify-between py-2 border-b">
										<span className="text-muted-foreground">Monthly Interest</span>
										<span className="font-mono text-green-600">
											{formatCurrency(monthlyInterest)}
										</span>
									</div>

									<Separator className="my-4" />

									{assetTransactions.length > 0 && (
										<div className="flex justify-between py-2 border-b">
											<span className="text-muted-foreground">First Transaction</span>
											<span className="font-medium">
												{formatDate(new Date(assetTransactions[assetTransactions.length - 1].date))}
											</span>
										</div>
									)}
									<div className="flex justify-between py-2 border-b">
										<span className="text-muted-foreground">Initial Deposit</span>
										<span className="font-mono">{formatCurrency(saving.initialDeposit)}</span>
									</div>
									<div className="flex justify-between py-2 border-b">
										<span className="text-muted-foreground">Account Age</span>
										<span className="font-medium">
											{monthsOpen > 0
												? `${monthsOpen} months (${(monthsOpen / 12).toFixed(1)} years)`
												: "New"}
										</span>
									</div>
									<div className="flex justify-between py-2">
										<span className="text-muted-foreground">Total Growth</span>
										<span className="font-mono text-green-600">
											{formatCurrency(totalGrowth)} (+
											{growthPercentage.toFixed(1)}%)
										</span>
									</div>
								</CardContent>
							</Card>
						</div>
					</TabsContent>
				</Tabs>
			</div>
		</ScrollArea>
	);
}
