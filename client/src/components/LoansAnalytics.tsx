import ReactECharts from "echarts-for-react";
import {
	BarChart3,
	Calendar,
	DollarSign,
	LineChart,
	Percent,
	PieChart,
	Target,
	TrendingUp,
} from "lucide-react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "./ui/card";

interface Loan {
	id: string;
	name: string;
	type: string;
	loanAmount: number;
	remainingBalance: number;
	interestRate: number;
	duration: number;
	monthlyPayment: number;
	startDate: Date;
	endDate?: Date;
	currency: string;
}

interface LoansAnalyticsProps {
	loans: Loan[];
}

export function LoansAnalytics({ loans }: LoansAnalyticsProps) {
	const formatCurrency = (amount: number) => {
		const validAmount =
			typeof amount === "number" && !Number.isNaN(amount) ? amount : 0;
		return validAmount.toLocaleString("fr-FR", {
			style: "currency",
			currency: "EUR",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		});
	};

	// Calculate metrics
	const totalDebt = loans.reduce((sum, loan) => sum + loan.remainingBalance, 0);
	const totalOriginal = loans.reduce((sum, loan) => sum + loan.loanAmount, 0);
	const totalPaid = totalOriginal - totalDebt;
	const totalMonthlyPayment = loans.reduce(
		(sum, loan) => sum + loan.monthlyPayment,
		0,
	);
	const avgInterestRate =
		loans.length > 0
			? loans.reduce((sum, loan) => sum + loan.interestRate, 0) / loans.length
			: 0;

	// Estimate total interest to be paid (simplified calculation)
	const estimateTotalInterest = () => {
		return loans.reduce((sum, loan) => {
			const monthsRemaining = loan.duration;
			const totalPayments = loan.monthlyPayment * monthsRemaining;
			const interestPaid = totalPayments - loan.loanAmount;
			return sum + Math.max(0, interestPaid);
		}, 0);
	};

	const totalInterestEstimate = estimateTotalInterest();

	// 1. Debt Distribution by Loan Type (Pie Chart)
	const getDebtByTypeData = () => {
		const typeMap = new Map<string, number>();
		loans.forEach((loan) => {
			const current = typeMap.get(loan.type) || 0;
			typeMap.set(loan.type, current + loan.remainingBalance);
		});

		return Array.from(typeMap.entries()).map(([name, value]) => ({
			name: name.replace("-", " ").replace(/\b\w/g, (l) => l.toUpperCase()),
			value: value,
		}));
	};

	const debtByTypeOption = {
		tooltip: {
			trigger: "item",
			formatter: "{b}: {c} ({d}%)",
		},
		legend: {
			orient: "vertical",
			left: "left",
			textStyle: {
				color: "var(--foreground)",
			},
		},
		series: [
			{
				name: "Debt by Type",
				type: "pie",
				radius: ["40%", "70%"],
				avoidLabelOverlap: false,
				itemStyle: {
					borderRadius: 10,
					borderColor: "var(--background)",
					borderWidth: 2,
				},
				label: {
					show: false,
					position: "center",
				},
				emphasis: {
					label: {
						show: true,
						fontSize: 20,
						fontWeight: "bold",
						color: "var(--foreground)",
					},
				},
				labelLine: {
					show: false,
				},
				data: getDebtByTypeData(),
				color: ["#3b82f6", "#8b5cf6", "#f97316", "#ef4444", "#10b981"],
			},
		],
	};

	// 2. Debt Paydown Progress (Bar Chart)
	const debtProgressOption = {
		tooltip: {
			trigger: "axis",
			axisPointer: {
				type: "shadow",
			},
		},
		legend: {
			data: ["Paid", "Remaining"],
			textStyle: {
				color: "var(--foreground)",
			},
		},
		grid: {
			left: "3%",
			right: "4%",
			bottom: "3%",
			containLabel: true,
		},
		xAxis: {
			type: "value",
			axisLabel: {
				color: "var(--muted-foreground)",
			},
			splitLine: {
				lineStyle: {
					color: "var(--border)",
				},
			},
		},
		yAxis: {
			type: "category",
			data: loans.map((loan) =>
				loan.name.length > 20 ? `${loan.name.substring(0, 17)}...` : loan.name,
			),
			axisLabel: {
				color: "var(--foreground)",
			},
		},
		series: [
			{
				name: "Paid",
				type: "bar",
				stack: "total",
				label: {
					show: false,
				},
				emphasis: {
					focus: "series",
				},
				data: loans.map((loan) => loan.loanAmount - loan.remainingBalance),
				itemStyle: {
					color: "#10b981",
				},
			},
			{
				name: "Remaining",
				type: "bar",
				stack: "total",
				label: {
					show: false,
				},
				emphasis: {
					focus: "series",
				},
				data: loans.map((loan) => loan.remainingBalance),
				itemStyle: {
					color: "#ef4444",
				},
			},
		],
	};

	// 3. Monthly Payment Breakdown (Bar Chart)
	const monthlyPaymentOption = {
		tooltip: {
			trigger: "axis",
			axisPointer: {
				type: "shadow",
			},
			formatter: (params: any) => {
				const loan = loans[params[0].dataIndex];
				return `${loan.name}<br/>
                Monthly Payment: ${formatCurrency(loan.monthlyPayment)}<br/>
                Interest Rate: ${loan.interestRate.toFixed(2)}%`;
			},
		},
		grid: {
			left: "3%",
			right: "4%",
			bottom: "3%",
			containLabel: true,
		},
		xAxis: {
			type: "category",
			data: loans.map((loan) =>
				loan.name.length > 15 ? `${loan.name.substring(0, 12)}...` : loan.name,
			),
			axisLabel: {
				color: "var(--foreground)",
				rotate: 45,
			},
		},
		yAxis: {
			type: "value",
			axisLabel: {
				color: "var(--muted-foreground)",
			},
			splitLine: {
				lineStyle: {
					color: "var(--border)",
				},
			},
		},
		series: [
			{
				name: "Monthly Payment",
				data: loans.map((loan) => loan.monthlyPayment),
				type: "bar",
				itemStyle: {
					color: "#3b82f6",
					borderRadius: [4, 4, 0, 0],
				},
				emphasis: {
					itemStyle: {
						color: "#2563eb",
					},
				},
			},
		],
	};

	// 4. Interest Rate Comparison (Horizontal Bar)
	const interestRateOption = {
		tooltip: {
			trigger: "axis",
			axisPointer: {
				type: "shadow",
			},
		},
		grid: {
			left: "3%",
			right: "4%",
			bottom: "3%",
			containLabel: true,
		},
		xAxis: {
			type: "value",
			axisLabel: {
				color: "var(--muted-foreground)",
				formatter: "{value}%",
			},
			splitLine: {
				lineStyle: {
					color: "var(--border)",
				},
			},
		},
		yAxis: {
			type: "category",
			data: loans.map((loan) =>
				loan.name.length > 20 ? `${loan.name.substring(0, 17)}...` : loan.name,
			),
			axisLabel: {
				color: "var(--foreground)",
			},
		},
		series: [
			{
				name: "Interest Rate",
				type: "bar",
				data: loans.map((loan) => loan.interestRate),
				itemStyle: {
					color: (params: any) => {
						const rate = params.value;
						if (rate < 3) return "#10b981";
						if (rate < 5) return "#f59e0b";
						return "#ef4444";
					},
					borderRadius: [0, 4, 4, 0],
				},
			},
		],
	};

	// 5. Debt vs Principal Timeline (Projection)
	const getPaydownProjection = () => {
		const months = 60; // 5 years projection
		const data = [];

		for (let month = 0; month <= months; month += 6) {
			let totalRemaining = 0;
			let totalPaid = 0;

			loans.forEach((loan) => {
				// Simplified calculation - in reality would use proper amortization
				const monthlyPrincipal = loan.loanAmount / loan.duration;
				const paidSoFar = monthlyPrincipal * month;
				const remaining = Math.max(0, loan.remainingBalance - paidSoFar);

				totalRemaining += remaining;
				totalPaid += loan.loanAmount - remaining;
			});

			data.push({
				month: month,
				remaining: Math.round(totalRemaining),
				paid: Math.round(totalPaid),
			});
		}

		return data;
	};

	const projectionData = getPaydownProjection();

	const debtProjectionOption = {
		tooltip: {
			trigger: "axis",
			axisPointer: {
				type: "cross",
			},
		},
		legend: {
			data: ["Remaining Debt", "Principal Paid"],
			textStyle: {
				color: "var(--foreground)",
			},
		},
		grid: {
			left: "3%",
			right: "4%",
			bottom: "3%",
			containLabel: true,
		},
		xAxis: {
			type: "category",
			boundaryGap: false,
			data: projectionData.map((d) => `${d.month}mo`),
			axisLabel: {
				color: "var(--muted-foreground)",
			},
		},
		yAxis: {
			type: "value",
			axisLabel: {
				color: "var(--muted-foreground)",
			},
			splitLine: {
				lineStyle: {
					color: "var(--border)",
				},
			},
		},
		series: [
			{
				name: "Remaining Debt",
				type: "line",
				data: projectionData.map((d) => d.remaining),
				smooth: true,
				itemStyle: {
					color: "#ef4444",
				},
				areaStyle: {
					color: {
						type: "linear",
						x: 0,
						y: 0,
						x2: 0,
						y2: 1,
						colorStops: [
							{
								offset: 0,
								color: "rgba(239, 68, 68, 0.3)",
							},
							{
								offset: 1,
								color: "rgba(239, 68, 68, 0.05)",
							},
						],
					},
				},
			},
			{
				name: "Principal Paid",
				type: "line",
				data: projectionData.map((d) => d.paid),
				smooth: true,
				itemStyle: {
					color: "#10b981",
				},
				areaStyle: {
					color: {
						type: "linear",
						x: 0,
						y: 0,
						x2: 0,
						y2: 1,
						colorStops: [
							{
								offset: 0,
								color: "rgba(16, 185, 129, 0.3)",
							},
							{
								offset: 1,
								color: "rgba(16, 185, 129, 0.05)",
							},
						],
					},
				},
			},
		],
	};

	// 6. Loan Health Score (Gauge)
	const calculateHealthScore = () => {
		// Simple health score based on:
		// - Average interest rate (lower is better)
		// - Payment progress (higher is better)
		// - Monthly payment burden (relative to debt)

		const avgRate = avgInterestRate;
		const paymentProgress = (totalPaid / totalOriginal) * 100;
		const paymentRatio = (totalMonthlyPayment / totalDebt) * 100;

		// Score out of 100
		let score = 50;

		// Interest rate component (0-30 points)
		if (avgRate < 3) score += 30;
		else if (avgRate < 4) score += 20;
		else if (avgRate < 5) score += 10;

		// Progress component (0-40 points)
		score += Math.min(40, paymentProgress * 0.4);

		// Payment burden component (0-30 points)
		if (paymentRatio < 2) score += 30;
		else if (paymentRatio < 3) score += 20;
		else if (paymentRatio < 5) score += 10;

		return Math.min(100, Math.max(0, score));
	};

	const healthScore = calculateHealthScore();

	const healthScoreOption = {
		series: [
			{
				type: "gauge",
				startAngle: 180,
				endAngle: 0,
				center: ["50%", "70%"],
				radius: "90%",
				min: 0,
				max: 100,
				splitNumber: 10,
				axisLine: {
					lineStyle: {
						width: 6,
						color: [
							[0.3, "#ef4444"],
							[0.7, "#f59e0b"],
							[1, "#10b981"],
						],
					},
				},
				pointer: {
					icon: "path://M12.8,0.7l12,40.1H0.7L12.8,0.7z",
					length: "12%",
					width: 20,
					offsetCenter: [0, "-60%"],
					itemStyle: {
						color: "auto",
					},
				},
				axisTick: {
					length: 12,
					lineStyle: {
						color: "auto",
						width: 2,
					},
				},
				splitLine: {
					length: 20,
					lineStyle: {
						color: "auto",
						width: 5,
					},
				},
				axisLabel: {
					color: "var(--muted-foreground)",
					fontSize: 12,
					distance: -60,
					rotate: "tangential",
					formatter: (value: number) => {
						if (value === 0) return "0";
						if (value === 50) return "50";
						if (value === 100) return "100";
						return "";
					},
				},
				title: {
					offsetCenter: [0, "-10%"],
					fontSize: 16,
					color: "var(--foreground)",
				},
				detail: {
					fontSize: 32,
					offsetCenter: [0, "-35%"],
					valueAnimation: true,
					formatter: (value: number) => `${Math.round(value)}`,
					color: "auto",
				},
				data: [
					{
						value: healthScore,
						name: "Loan Health Score",
					},
				],
			},
		],
	};

	return (
		<div className="space-y-6">
			{/* Summary Metrics */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Total Debt</CardTitle>
						<DollarSign className="h-4 w-4 text-red-600" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-red-600">
							{formatCurrency(totalDebt)}
						</div>
						<p className="text-xs text-muted-foreground">
							{((totalPaid / totalOriginal) * 100).toFixed(1)}% paid off
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Principal Paid
						</CardTitle>
						<TrendingUp className="h-4 w-4 text-green-600" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-green-600">
							{formatCurrency(totalPaid)}
						</div>
						<p className="text-xs text-muted-foreground">
							Out of {formatCurrency(totalOriginal)}
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Avg Interest Rate
						</CardTitle>
						<Percent className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{avgInterestRate.toFixed(2)}%
						</div>
						<p className="text-xs text-muted-foreground">
							Estimated interest: {formatCurrency(totalInterestEstimate)}
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Monthly Obligation
						</CardTitle>
						<Calendar className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{formatCurrency(totalMonthlyPayment)}
						</div>
						<p className="text-xs text-muted-foreground">
							{loans.length} active loans
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Charts Grid */}
			<div className="grid gap-6 md:grid-cols-2">
				{/* Debt Distribution */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<PieChart className="h-5 w-5" />
							Debt Distribution by Type
						</CardTitle>
						<CardDescription>
							Breakdown of remaining balance by loan type
						</CardDescription>
					</CardHeader>
					<CardContent>
						<ReactECharts
							option={debtByTypeOption}
							style={{ height: "300px" }}
							opts={{ renderer: "svg" }}
						/>
					</CardContent>
				</Card>

				{/* Loan Health Score */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Target className="h-5 w-5" />
							Loan Portfolio Health
						</CardTitle>
						<CardDescription>
							Overall health score based on rates, progress, and payment burden
						</CardDescription>
					</CardHeader>
					<CardContent>
						<ReactECharts
							option={healthScoreOption}
							style={{ height: "300px" }}
							opts={{ renderer: "svg" }}
						/>
						<div className="mt-4 space-y-2 text-sm">
							<div className="flex justify-between">
								<span className="text-muted-foreground">Score Range:</span>
								<span className="font-medium">
									{healthScore < 30
										? "Poor"
										: healthScore < 70
											? "Fair"
											: "Excellent"}
								</span>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Paydown Progress */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<BarChart3 className="h-5 w-5" />
							Paydown Progress
						</CardTitle>
						<CardDescription>
							Amount paid vs remaining for each loan
						</CardDescription>
					</CardHeader>
					<CardContent>
						<ReactECharts
							option={debtProgressOption}
							style={{ height: "400px" }}
							opts={{ renderer: "svg" }}
						/>
					</CardContent>
				</Card>

				{/* Monthly Payments */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Calendar className="h-5 w-5" />
							Monthly Payment Breakdown
						</CardTitle>
						<CardDescription>Monthly payment amount per loan</CardDescription>
					</CardHeader>
					<CardContent>
						<ReactECharts
							option={monthlyPaymentOption}
							style={{ height: "400px" }}
							opts={{ renderer: "svg" }}
						/>
					</CardContent>
				</Card>

				{/* Interest Rates */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Percent className="h-5 w-5" />
							Interest Rate Comparison
						</CardTitle>
						<CardDescription>
							Interest rates across all loans (color-coded by rate)
						</CardDescription>
					</CardHeader>
					<CardContent>
						<ReactECharts
							option={interestRateOption}
							style={{ height: "400px" }}
							opts={{ renderer: "svg" }}
						/>
						<div className="mt-4 flex gap-4 text-xs">
							<div className="flex items-center gap-2">
								<div className="h-3 w-3 rounded-full bg-green-600"></div>
								<span className="text-muted-foreground">&lt; 3%</span>
							</div>
							<div className="flex items-center gap-2">
								<div className="h-3 w-3 rounded-full bg-orange-500"></div>
								<span className="text-muted-foreground">3-5%</span>
							</div>
							<div className="flex items-center gap-2">
								<div className="h-3 w-3 rounded-full bg-red-600"></div>
								<span className="text-muted-foreground">&gt; 5%</span>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Debt Projection */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<LineChart className="h-5 w-5" />
							5-Year Debt Projection
						</CardTitle>
						<CardDescription>
							Projected paydown timeline (next 60 months)
						</CardDescription>
					</CardHeader>
					<CardContent>
						<ReactECharts
							option={debtProjectionOption}
							style={{ height: "400px" }}
							opts={{ renderer: "svg" }}
						/>
					</CardContent>
				</Card>
			</div>

			{/* Additional Insights */}
			<Card>
				<CardHeader>
					<CardTitle>Key Insights</CardTitle>
					<CardDescription>
						Important metrics and recommendations for your loan portfolio
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 md:grid-cols-3">
						<div className="space-y-2">
							<h4 className="text-sm font-medium flex items-center gap-2">
								<TrendingUp className="h-4 w-4 text-green-600" />
								Debt-Free Date
							</h4>
							<p className="text-2xl font-bold">
								{loans.length > 0
									? new Date(
											Math.max(
												...loans.map((l) =>
													l.endDate ? l.endDate.getTime() : Date.now(),
												),
											),
										).getFullYear()
									: "N/A"}
							</p>
							<p className="text-xs text-muted-foreground">
								Based on current payment schedule
							</p>
						</div>

						<div className="space-y-2">
							<h4 className="text-sm font-medium flex items-center gap-2">
								<DollarSign className="h-4 w-4 text-orange-600" />
								Total Interest Cost
							</h4>
							<p className="text-2xl font-bold text-orange-600">
								{formatCurrency(totalInterestEstimate)}
							</p>
							<p className="text-xs text-muted-foreground">
								Estimated over lifetime
							</p>
						</div>

						<div className="space-y-2">
							<h4 className="text-sm font-medium flex items-center gap-2">
								<Percent className="h-4 w-4 text-blue-600" />
								Debt-to-Asset Ratio
							</h4>
							<p className="text-2xl font-bold">N/A</p>
							<p className="text-xs text-muted-foreground">
								Link assets to calculate
							</p>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
