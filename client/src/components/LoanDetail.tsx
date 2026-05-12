import ReactECharts from "echarts-for-react";
import {
	AlertCircle,
	ArrowLeft,
	BarChart3,
	Building2,
	Clock,
	CreditCard,
	DollarSign,
	Edit,
	FileText,
	MoreVertical,
	Percent,
	PieChart,
	Target,
	TrendingDown,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { usePortfolio } from "@/components/PortfolioProvider";
import { useCurrency } from "@/hooks/use-currency";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

interface LoanDetailProps {
	loanId: string;
	onBack: () => void;
}

export function LoanDetail({ loanId, onBack }: LoanDetailProps) {
	const { assets, loading } = usePortfolio();
	const [_timePeriod, _setTimePeriod] = useState("ALL");

	// Loan-specific data structure — TODO: backend should provide loan-specific fields
	// (interestRate, remainingBalance, duration, monthlyPayment, etc.)
	// For now we derive what we can from PortfolioAssetItem and use sensible defaults
	interface LoanData {
		id: string;
		name: string;
		type: string;
		loanAmount: number;
		remainingBalance: number;
		interestRate: number;
		duration: number;
		monthlyPayment: number;
		startDate: Date;
		endDate: Date;
		bank: string;
		currency: string;
		linkedAssets: string[];
		ownershipMode: string;
		status: string;
		applicationFee?: number;
		brokerFee?: number;
		insuranceFee?: number;
		earlyRepaymentFee?: number;
	}

	// Derive loan assets from real portfolio data
	const loanAssets = useMemo(() => assets.filter((a) => a.type === "loan"), [assets]);

	// TODO: Replace with loan-specific fields once backend supports them
	// Currently we map PortfolioAssetItem fields to LoanData as best we can
	const loans: LoanData[] = useMemo(
		() =>
			loanAssets.map((a) => {
				const loanAmount = a.currentValue || 0;
				const interestRate = a.interestRate ?? 5.0; // TODO: from backend
				const duration = 120; // TODO: from backend (months)
				const monthlyRate = interestRate / 100 / 12;
				const monthlyPayment =
					loanAmount > 0 && duration > 0
						? (loanAmount * monthlyRate * (1 + monthlyRate) ** duration) /
							((1 + monthlyRate) ** duration - 1)
						: 0;

				return {
					id: a.id,
					name: a.name,
					type: "amortizing", // TODO: from backend
					loanAmount,
					remainingBalance: loanAmount, // TODO: from backend
					interestRate,
					duration,
					monthlyPayment,
					startDate: new Date(), // TODO: from backend
					endDate: new Date(Date.now() + duration * 30 * 86400000),
					bank: a.institution || "Unknown",
					currency: a.currency || "USD",
					linkedAssets: [], // TODO: from backend
					ownershipMode: "personal", // TODO: from backend
					status: "active",
				};
			}),
		[loanAssets],
	);

	const loan = loans.find((l) => l.id === loanId) || null;

	// Loading state
	if (loading) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="text-center space-y-4">
					<div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
					<p className="text-muted-foreground">Loading loan details...</p>
				</div>
			</div>
		);
	}

	if (!loan) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="text-center space-y-4">
					<CreditCard className="h-12 w-12 mx-auto text-muted-foreground" />
					<p className="text-muted-foreground">Loan not found</p>
					<Button onClick={onBack}>
						<ArrowLeft className="h-4 w-4 mr-2" />
						Back to Loans
					</Button>
				</div>
			</div>
		);
	}

	// biome-ignore lint/correctness/useHookAtTopLevel: unavoidable
	const { formatCurrencyCompact: formatCurrency } = useCurrency();

	const formatDate = (date: Date) => {
		const dateObj = date instanceof Date ? date : new Date(date);
		return dateObj.toLocaleDateString("fr-FR", {
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	};

	// Calculate loan metrics
	const paidAmount = loan.loanAmount - loan.remainingBalance;
	const paymentProgress = (paidAmount / loan.loanAmount) * 100;
	const totalInterestPaid = paidAmount * (loan.interestRate / 100);
	const totalCost =
		loan.loanAmount + ((loan.loanAmount * loan.interestRate) / 100) * (loan.duration / 12);
	const monthsElapsed = Math.floor(
		(Date.now() - loan.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30),
	);
	const monthsRemaining = loan.duration - monthsElapsed;

	// Get loan type badge color
	const getLoanTypeBadgeVariant = (type: string) => {
		switch (type) {
			case "amortizing":
				return "default";
			case "in-fine":
				return "secondary";
			case "deferred-interest":
				return "outline";
			case "deferred-total":
				return "destructive";
			case "step":
				return "default";
			default:
				return "outline";
		}
	};

	const getLoanTypeLabel = (type: string) => {
		switch (type) {
			case "amortizing":
				return "Amortizing";
			case "in-fine":
				return "In Fine";
			case "deferred-interest":
				return "Deferred Interest";
			case "deferred-total":
				return "Deferred Total";
			case "step":
				return "Step Loan";
			default:
				return type;
		}
	};

	// Generate amortization schedule
	const generateAmortizationSchedule = () => {
		const schedule: {
			month: number;
			date: string;
			payment: number;
			principal: number;
			interest: number;
			balance: number;
		}[] = [];
		let balance = loan.loanAmount;
		const monthlyRate = loan.interestRate / 100 / 12;

		for (let month = 1; month <= Math.min(loan.duration, 60); month++) {
			// Limit to 60 months for display
			let principal = 0;
			let interest = balance * monthlyRate;

			if (loan.type === "amortizing") {
				principal = loan.monthlyPayment - interest;
			} else if (loan.type === "in-fine") {
				principal = month === loan.duration ? balance : 0;
			} else if (loan.type === "deferred-total") {
				principal = 0;
				interest = 0;
			}

			balance -= principal;

			const date = new Date(loan.startDate);
			date.setMonth(date.getMonth() + month);

			schedule.push({
				month,
				date: date.toLocaleDateString("fr-FR", {
					month: "short",
					year: "numeric",
				}),
				payment: principal + interest,
				principal,
				interest,
				balance: Math.max(0, balance),
			});
		}

		return schedule;
	};

	const amortizationSchedule = generateAmortizationSchedule();

	// Chart: Balance Evolution
	const balanceEvolutionOption = {
		tooltip: {
			trigger: "axis",
			backgroundColor: "rgba(0, 0, 0, 0.8)",
			borderColor: "#333",
			textStyle: { color: "#fff" },
			// biome-ignore lint/suspicious/noExplicitAny: unavoidable
			formatter: (params: any) => {
				const data = params[0];
				return `${data.name}<br/>Balance: ${formatCurrency(data.value)}`;
			},
		},
		grid: { left: 60, right: 20, top: 40, bottom: 40 },
		xAxis: {
			type: "category",
			data: amortizationSchedule.map((s) => s.date),
			axisLabel: { rotate: 45, fontSize: 10 },
		},
		yAxis: {
			type: "value",
			axisLabel: {
				formatter: (value: number) => `${(value / 1000).toFixed(0)}K`,
			},
		},
		series: [
			{
				name: "Balance",
				type: "line",
				data: amortizationSchedule.map((s) => s.balance),
				smooth: true,
				areaStyle: {
					color: {
						type: "linear",
						x: 0,
						y: 0,
						x2: 0,
						y2: 1,
						colorStops: [
							{ offset: 0, color: "rgba(239, 68, 68, 0.3)" },
							{ offset: 1, color: "rgba(239, 68, 68, 0.05)" },
						],
					},
				},
				lineStyle: { color: "#ef4444", width: 2 },
				itemStyle: { color: "#ef4444" },
			},
		],
	};

	// Chart: Payment Breakdown
	const paymentBreakdownOption = {
		tooltip: {
			trigger: "axis",
			backgroundColor: "rgba(0, 0, 0, 0.8)",
			borderColor: "#333",
			textStyle: { color: "#fff" },
		},
		legend: { data: ["Principal", "Interest"], bottom: 0 },
		grid: { left: 60, right: 20, top: 20, bottom: 60 },
		xAxis: {
			type: "category",
			data: amortizationSchedule.slice(0, 24).map((s) => s.date),
			axisLabel: { rotate: 45, fontSize: 10 },
		},
		yAxis: {
			type: "value",
			axisLabel: {
				formatter: (value: number) => `${(value / 1000).toFixed(1)}K`,
			},
		},
		series: [
			{
				name: "Principal",
				type: "bar",
				stack: "total",
				data: amortizationSchedule.slice(0, 24).map((s) => s.principal),
				itemStyle: { color: "#10b981" },
			},
			{
				name: "Interest",
				type: "bar",
				stack: "total",
				data: amortizationSchedule.slice(0, 24).map((s) => s.interest),
				itemStyle: { color: "#f59e0b" },
			},
		],
	};

	// Chart: Interest vs Principal Pie
	const interestPrincipalOption = {
		tooltip: {
			trigger: "item",
			backgroundColor: "rgba(0, 0, 0, 0.8)",
			borderColor: "#333",
			textStyle: { color: "#fff" },
			formatter: "{b}: {c} ({d}%)",
		},
		legend: { bottom: 0 },
		series: [
			{
				type: "pie",
				radius: ["40%", "70%"],
				avoidLabelOverlap: false,
				itemStyle: {
					borderRadius: 10,
					borderColor: "#fff",
					borderWidth: 2,
				},
				label: { show: true, formatter: "{b}\n{d}%" },
				data: [
					{
						value: paidAmount,
						name: "Principal Paid",
						itemStyle: { color: "#10b981" },
					},
					{
						value: totalInterestPaid,
						name: "Interest Paid",
						itemStyle: { color: "#f59e0b" },
					},
					{
						value: loan.remainingBalance,
						name: "Remaining",
						itemStyle: { color: "#ef4444" },
					},
				],
			},
		],
	};

	// Get linked assets
	const linkedAssets = assets.filter((a) => loan.linkedAssets?.includes(a.id));

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
								<h1 className="text-3xl">{loan.name}</h1>
								<Badge variant={getLoanTypeBadgeVariant(loan.type)}>
									{getLoanTypeLabel(loan.type)}
								</Badge>
								<Badge variant={loan.status === "active" ? "default" : "secondary"}>
									{loan.status}
								</Badge>
							</div>
							<p className="text-muted-foreground mt-1">
								{loan.bank} • {formatDate(loan.startDate)}
							</p>
						</div>
					</div>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="icon">
								<MoreVertical className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={() => toast.info("Edit feature coming soon")}>
								<Edit className="h-4 w-4 mr-2" />
								Edit Loan
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => toast.success("Downloading statement...")}>
								<FileText className="h-4 w-4 mr-2" />
								Download Statement
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => toast.info("Export feature coming soon")}>
								<FileText className="h-4 w-4 mr-2" />
								Export Data
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				{/* Key Metrics */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
								<DollarSign className="h-4 w-4" />
								Remaining Balance
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-mono text-red-600">
								{formatCurrency(loan.remainingBalance)}
							</div>
							<p className="text-xs text-muted-foreground mt-1">
								of {formatCurrency(loan.loanAmount)} original
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
								<CreditCard className="h-4 w-4" />
								Monthly Payment
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-mono">{formatCurrency(loan.monthlyPayment)}</div>
							<p className="text-xs text-muted-foreground mt-1">
								{monthsRemaining} payments remaining
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
							<div className="text-2xl font-mono">{loan.interestRate.toFixed(2)}%</div>
							<p className="text-xs text-muted-foreground mt-1">Fixed rate</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
								<Target className="h-4 w-4" />
								Progress
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-mono text-green-600">{paymentProgress.toFixed(1)}%</div>
							<div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
								<div
									className="h-full bg-green-600 transition-all"
									style={{ width: `${paymentProgress}%` }}
								/>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Tabs */}
				<Tabs defaultValue="overview" className="space-y-4">
					<TabsList>
						<TabsTrigger value="overview">Overview</TabsTrigger>
						<TabsTrigger value="schedule">Amortization Schedule</TabsTrigger>
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
										<TrendingDown className="h-5 w-5" />
										Balance Evolution
									</CardTitle>
									<CardDescription>Remaining balance over time</CardDescription>
								</CardHeader>
								<CardContent>
									<ReactECharts
										option={balanceEvolutionOption}
										style={{ height: "300px" }}
										opts={{ renderer: "svg" }}
									/>
								</CardContent>
							</Card>

							{/* Payment Breakdown Chart */}
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<BarChart3 className="h-5 w-5" />
										Payment Breakdown
									</CardTitle>
									<CardDescription>Principal vs Interest (24 months)</CardDescription>
								</CardHeader>
								<CardContent>
									<ReactECharts
										option={paymentBreakdownOption}
										style={{ height: "300px" }}
										opts={{ renderer: "svg" }}
									/>
								</CardContent>
							</Card>
						</div>

						{/* Summary Cards */}
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							<Card>
								<CardHeader>
									<CardTitle className="text-sm">Total Paid</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="text-xl font-mono text-green-600">
										{formatCurrency(paidAmount)}
									</div>
									<p className="text-xs text-muted-foreground mt-1">
										{paymentProgress.toFixed(1)}% of loan amount
									</p>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle className="text-sm">Interest Paid</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="text-xl font-mono text-orange-600">
										{formatCurrency(totalInterestPaid)}
									</div>
									<p className="text-xs text-muted-foreground mt-1">Estimated so far</p>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle className="text-sm">Total Cost</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="text-xl font-mono">{formatCurrency(totalCost)}</div>
									<p className="text-xs text-muted-foreground mt-1">Principal + Interest</p>
								</CardContent>
							</Card>
						</div>

						{/* Linked Assets */}
						{linkedAssets.length > 0 && (
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<Building2 className="h-5 w-5" />
										Linked Assets
									</CardTitle>
									<CardDescription>Assets financed by this loan</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="space-y-3">
										{linkedAssets.map((asset) => (
											<div
												key={asset.id}
												className="flex items-center justify-between p-3 border rounded-lg"
											>
												<div className="flex items-center gap-3">
													<div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
														<Building2 className="h-5 w-5 text-primary" />
													</div>
													<div>
														<p className="font-medium">{asset.name}</p>
														<p className="text-sm text-muted-foreground capitalize">{asset.type}</p>
													</div>
												</div>
												<div className="text-right">
													<p className="font-mono">{formatCurrency(asset.currentValue)}</p>
													{asset.currentValue && loan.remainingBalance && (
														<p className="text-xs text-muted-foreground">
															LTV: {((loan.remainingBalance / asset.currentValue) * 100).toFixed(1)}
															%
														</p>
													)}
												</div>
											</div>
										))}
									</div>
								</CardContent>
							</Card>
						)}
					</TabsContent>

					{/* Amortization Schedule Tab */}
					<TabsContent value="schedule" className="space-y-4">
						<Card>
							<CardHeader>
								<CardTitle>Amortization Schedule</CardTitle>
								<CardDescription>
									Detailed payment breakdown for each month (showing first 60 payments)
								</CardDescription>
							</CardHeader>
							<CardContent>
								<ScrollArea className="h-[600px]">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Month</TableHead>
												<TableHead>Date</TableHead>
												<TableHead className="text-right">Payment</TableHead>
												<TableHead className="text-right">Principal</TableHead>
												<TableHead className="text-right">Interest</TableHead>
												<TableHead className="text-right">Balance</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{amortizationSchedule.map((row) => (
												<TableRow key={row.month}>
													<TableCell className="font-medium">{row.month}</TableCell>
													<TableCell>{row.date}</TableCell>
													<TableCell className="text-right font-mono">
														{formatCurrency(row.payment)}
													</TableCell>
													<TableCell className="text-right font-mono text-green-600">
														{formatCurrency(row.principal)}
													</TableCell>
													<TableCell className="text-right font-mono text-orange-600">
														{formatCurrency(row.interest)}
													</TableCell>
													<TableCell className="text-right font-mono">
														{formatCurrency(row.balance)}
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</ScrollArea>
							</CardContent>
						</Card>
					</TabsContent>

					{/* Analytics Tab */}
					<TabsContent value="analytics" className="space-y-4">
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
							{/* Interest vs Principal Pie */}
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<PieChart className="h-5 w-5" />
										Loan Composition
									</CardTitle>
									<CardDescription>Distribution of payments</CardDescription>
								</CardHeader>
								<CardContent>
									<ReactECharts
										option={interestPrincipalOption}
										style={{ height: "350px" }}
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
									<CardDescription>Important metrics and recommendations</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="space-y-4">
										<div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
											<div className="flex items-start gap-3">
												<div className="h-8 w-8 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
													<Target className="h-4 w-4 text-white" />
												</div>
												<div>
													<p className="font-medium text-green-900 dark:text-green-100">On Track</p>
													<p className="text-sm text-green-700 dark:text-green-300 mt-1">
														You've paid {paymentProgress.toFixed(1)}% of your loan. Keep up the good
														work!
													</p>
												</div>
											</div>
										</div>

										<div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
											<div className="flex items-start gap-3">
												<div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
													<Clock className="h-4 w-4 text-white" />
												</div>
												<div>
													<p className="font-medium text-blue-900 dark:text-blue-100">
														Time Remaining
													</p>
													<p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
														{monthsRemaining} months ({(monthsRemaining / 12).toFixed(1)} years)
														until loan payoff
													</p>
												</div>
											</div>
										</div>

										<div className="p-4 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg">
											<div className="flex items-start gap-3">
												<div className="h-8 w-8 rounded-full bg-orange-600 flex items-center justify-center flex-shrink-0">
													<Percent className="h-4 w-4 text-white" />
												</div>
												<div>
													<p className="font-medium text-orange-900 dark:text-orange-100">
														Interest Impact
													</p>
													<p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
														Interest represents {((totalInterestPaid / totalCost) * 100).toFixed(1)}
														% of total cost
													</p>
												</div>
											</div>
										</div>

										{loan.interestRate > 5 && (
											<div className="p-4 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg">
												<div className="flex items-start gap-3">
													<div className="h-8 w-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
														<TrendingDown className="h-4 w-4 text-white" />
													</div>
													<div>
														<p className="font-medium text-purple-900 dark:text-purple-100">
															Refinancing Opportunity
														</p>
														<p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
															Your rate ({loan.interestRate}%) is higher than average. Consider
															refinancing.
														</p>
													</div>
												</div>
											</div>
										)}
									</div>
								</CardContent>
							</Card>
						</div>
					</TabsContent>

					{/* Details Tab */}
					<TabsContent value="details" className="space-y-4">
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
							{/* Loan Information */}
							<Card>
								<CardHeader>
									<CardTitle>Loan Information</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="flex justify-between py-2 border-b">
										<span className="text-muted-foreground">Loan Type</span>
										<span className="font-medium">{getLoanTypeLabel(loan.type)}</span>
									</div>
									<div className="flex justify-between py-2 border-b">
										<span className="text-muted-foreground">Bank</span>
										<span className="font-medium">{loan.bank}</span>
									</div>
									<div className="flex justify-between py-2 border-b">
										<span className="text-muted-foreground">Original Amount</span>
										<span className="font-mono">{formatCurrency(loan.loanAmount)}</span>
									</div>
									<div className="flex justify-between py-2 border-b">
										<span className="text-muted-foreground">Remaining Balance</span>
										<span className="font-mono text-red-600">
											{formatCurrency(loan.remainingBalance)}
										</span>
									</div>
									<div className="flex justify-between py-2 border-b">
										<span className="text-muted-foreground">Interest Rate</span>
										<span className="font-mono">{loan.interestRate}%</span>
									</div>
									<div className="flex justify-between py-2 border-b">
										<span className="text-muted-foreground">Duration</span>
										<span className="font-medium">
											{loan.duration} months ({(loan.duration / 12).toFixed(1)} years)
										</span>
									</div>
									<div className="flex justify-between py-2 border-b">
										<span className="text-muted-foreground">Monthly Payment</span>
										<span className="font-mono">{formatCurrency(loan.monthlyPayment)}</span>
									</div>
									<div className="flex justify-between py-2 border-b">
										<span className="text-muted-foreground">Currency</span>
										<span className="font-medium">{loan.currency}</span>
									</div>
									<div className="flex justify-between py-2">
										<span className="text-muted-foreground">Status</span>
										<Badge variant={loan.status === "active" ? "default" : "secondary"}>
											{loan.status}
										</Badge>
									</div>
								</CardContent>
							</Card>

							{/* Timeline & Fees */}
							<Card>
								<CardHeader>
									<CardTitle>Timeline & Fees</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="flex justify-between py-2 border-b">
										<span className="text-muted-foreground">Start Date</span>
										<span className="font-medium">{formatDate(loan.startDate)}</span>
									</div>
									<div className="flex justify-between py-2 border-b">
										<span className="text-muted-foreground">End Date</span>
										<span className="font-medium">{formatDate(loan.endDate)}</span>
									</div>
									<div className="flex justify-between py-2 border-b">
										<span className="text-muted-foreground">Months Elapsed</span>
										<span className="font-medium">{monthsElapsed} months</span>
									</div>
									<div className="flex justify-between py-2 border-b">
										<span className="text-muted-foreground">Months Remaining</span>
										<span className="font-medium">{monthsRemaining} months</span>
									</div>

									<Separator className="my-4" />

									{loan.applicationFee && (
										<div className="flex justify-between py-2 border-b">
											<span className="text-muted-foreground">Application Fee</span>
											<span className="font-mono">{formatCurrency(loan.applicationFee)}</span>
										</div>
									)}
									{loan.brokerFee && (
										<div className="flex justify-between py-2 border-b">
											<span className="text-muted-foreground">Broker Fee</span>
											<span className="font-mono">{formatCurrency(loan.brokerFee)}</span>
										</div>
									)}
									{loan.insuranceFee && (
										<div className="flex justify-between py-2 border-b">
											<span className="text-muted-foreground">Insurance (monthly)</span>
											<span className="font-mono">{formatCurrency(loan.insuranceFee)}</span>
										</div>
									)}
									{loan.earlyRepaymentFee && (
										<div className="flex justify-between py-2">
											<span className="text-muted-foreground">Early Repayment Fee</span>
											<span className="font-mono">{loan.earlyRepaymentFee}%</span>
										</div>
									)}
								</CardContent>
							</Card>

							{/* Ownership */}
							<Card>
								<CardHeader>
									<CardTitle>Ownership</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="flex justify-between py-2 border-b">
										<span className="text-muted-foreground">Ownership Mode</span>
										<Badge variant={loan.ownershipMode === "personal" ? "default" : "secondary"}>
											{loan.ownershipMode === "personal" ? "Personal" : "Company"}
										</Badge>
									</div>
									<div className="p-4 bg-muted rounded-lg">
										<p className="text-sm text-muted-foreground">
											This loan is held under{" "}
											{loan.ownershipMode === "personal" ? "personal" : "company"} ownership.
										</p>
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
