import { format } from "date-fns";
import {
	Activity,
	ArrowDownRight,
	ArrowUpRight,
	DollarSign,
	TrendingDown,
	TrendingUp,
	Wallet,
} from "lucide-react";
import React from "react";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	Cell,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { usePortfolio } from "@/components/PortfolioProvider";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "../ui/card";
import { cn } from "../ui/utils";

// --- UTILS ---
const formatCurrency = (val: number) =>
	new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(val);

// --- SUBCOMPONENTS ---

const KpiCard = ({
	title,
	value,
	change,
	icon: Icon,
	trend,
}: {
	title: string;
	value: string;
	change: string;
	icon: any;
	trend: "up" | "down" | "neutral";
}) => (
	<Card className="border-border/60 bg-card/50 shadow-sm backdrop-blur-sm">
		<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
			<CardTitle className="text-sm font-medium text-muted-foreground font-mono uppercase tracking-wider">
				{title}
			</CardTitle>
			<Icon className="h-4 w-4 text-muted-foreground" />
		</CardHeader>
		<CardContent className="p-4 pt-0">
			<div className="text-2xl font-bold tracking-tight font-mono">{value}</div>
			<p
				className={cn(
					"text-xs flex items-center mt-1 font-medium",
					trend === "up"
						? "text-emerald-500"
						: trend === "down"
							? "text-rose-500"
							: "text-muted-foreground",
				)}
			>
				{trend === "up" ? (
					<TrendingUp className="mr-1 h-3 w-3" />
				) : (
					<TrendingDown className="mr-1 h-3 w-3" />
				)}
				{change}
				<span className="text-muted-foreground ml-1 font-normal">
					from last month
				</span>
			</p>
		</CardContent>
	</Card>
);

const AssetAllocationChart = ({ assets }: { assets: any[] }) => {
	// Aggregate data
	const data = React.useMemo(() => {
		const groups: Record<string, number> = {};
		assets.forEach((a) => {
			const type =
				a.type === "loan"
					? "Liabilities"
					: ["stock", "fund"].includes(a.type)
						? "Equities"
						: ["crypto"].includes(a.type)
							? "Crypto"
							: ["real_estate"].includes(a.type)
								? "Real Estate"
								: "Other";

			const val =
				a.type === "loan"
					? a.amount || 0
					: a.currentValue || a.quantity * a.currentPrice || 0;
			groups[type] = (groups[type] || 0) + val;
		});

		return Object.entries(groups)
			.map(([name, value]) => ({ name, value }))
			.sort((a, b) => b.value - a.value);
	}, [assets]);

	const COLORS = ["#2563eb", "#16a34a", "#d97706", "#9333ea", "#ef4444"];

	return (
		<div className="h-[200px] w-full">
			<ResponsiveContainer width="100%" height="100%">
				<BarChart
					data={data}
					layout="vertical"
					margin={{ top: 0, right: 30, left: 20, bottom: 0 }}
				>
					<XAxis type="number" hide />
					<YAxis
						dataKey="name"
						type="category"
						width={80}
						tick={{ fontSize: 10 }}
						axisLine={false}
						tickLine={false}
					/>
					<Tooltip
						cursor={{ fill: "transparent" }}
						contentStyle={{
							backgroundColor: "var(--popover)",
							borderColor: "var(--border)",
							borderRadius: "6px",
						}}
						formatter={(value: number) => formatCurrency(value)}
					/>
					<Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
						{data.map((_entry, index) => (
							<Cell
								key={`cell-${index}`}
								fill={COLORS[index % COLORS.length]}
							/>
						))}
					</Bar>
				</BarChart>
			</ResponsiveContainer>
		</div>
	);
};

const TopMovers = ({ assets }: { assets: any[] }) => {
	const movers = React.useMemo(() => {
		return assets
			.filter((a) => ["stock", "crypto"].includes(a.type))
			.map((a) => {
				const currentVal = a.currentPrice || a.currentValue || 0;
				const purchaseVal = a.purchasePrice || 0;
				const change =
					purchaseVal > 0
						? ((currentVal - purchaseVal) / purchaseVal) * 100
						: 0;
				return {
					...a,
					change,
					displayValue: currentVal,
				};
			})
			.sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
			.slice(0, 5);
	}, [assets]);

	return (
		<div className="space-y-4">
			{movers.map((asset) => (
				<div
					key={asset.id}
					className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-card/30 hover:bg-card/60 transition-colors"
				>
					<div className="flex items-center gap-3">
						<div
							className={cn(
								"w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
								asset.change >= 0
									? "bg-emerald-500/10 text-emerald-500"
									: "bg-rose-500/10 text-rose-500",
							)}
						>
							{asset.symbol ? asset.symbol.substring(0, 2) : "AS"}
						</div>
						<div>
							<div className="font-medium text-sm">
								{asset.symbol || asset.name}
							</div>
							<div className="text-xs text-muted-foreground">{asset.name}</div>
						</div>
					</div>
					<div className="text-right">
						<div className="font-mono text-sm font-medium">
							{formatCurrency(asset.displayValue)}
						</div>
						<div
							className={cn(
								"text-xs flex items-center justify-end",
								asset.change >= 0 ? "text-emerald-500" : "text-rose-500",
							)}
						>
							{asset.change >= 0 ? "+" : ""}
							{asset.change.toFixed(2)}%
						</div>
					</div>
				</div>
			))}
		</div>
	);
};

// --- MAIN COMPONENT ---

export function DensityDashboard() {
	const {
		assets,
		getPortfolioValue,
		getPortfolioGainLoss,
		transactions,
		selectedPortfolio,
	} = usePortfolio();

	const totalValue = getPortfolioValue();
	const { gain, gainPercent } = getPortfolioGainLoss();

	const performanceHistory =
		selectedPortfolio?.analytics?.performanceHistory ?? [];
	const performanceData =
		performanceHistory.length > 0
			? performanceHistory.map((p: any) => ({
					name: new Date(p.date).toLocaleDateString("en-US", {
						month: "short",
					}),
					val: p.value,
				}))
			: [{ name: "No Data", val: 0 }];

	const liabilities = assets
		.filter((a) => a.type === "loan")
		.reduce((sum, a) => sum + (a.currentValue || 0), 0);

	const liquidAssets = assets
		.filter((a) => ["bank", "savings", "securities", "wallet"].includes(a.type))
		.reduce((sum, a) => sum + (a.currentValue || 0), 0);

	const totalAssets = assets.reduce((sum, a) => sum + (a.currentValue || 0), 0);

	return (
		<div className="grid gap-6 animate-in fade-in duration-500">
			{/* 1. KPI ROW */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<KpiCard
					title="Net Worth"
					value={formatCurrency(totalValue)}
					change={`${gainPercent.toFixed(2)}%`}
					trend={gain >= 0 ? "up" : "down"}
					icon={DollarSign}
				/>
				<KpiCard
					title="Monthly Dividends"
					value="$0.00"
					change="+0.0%"
					trend="neutral"
					icon={Wallet}
				/>
				<KpiCard
					title="Liabilities"
					value={formatCurrency(liabilities)}
					change={
						totalAssets > 0
							? `${((liabilities / totalAssets) * 100).toFixed(1)}%`
							: "0%"
					}
					trend={liabilities > 0 ? "down" : "up"}
					icon={TrendingDown}
				/>
				<KpiCard
					title="Liquid Assets"
					value={formatCurrency(liquidAssets)}
					change={
						totalAssets > 0
							? `${((liquidAssets / totalAssets) * 100).toFixed(1)}%`
							: "0%"
					}
					trend="up"
					icon={Activity}
				/>
			</div>

			{/* 2. MAIN GRID */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[500px]">
				{/* LEFT COL: CHART + ALLOCATION */}
				<div className="lg:col-span-2 space-y-6">
					<Card className="h-[400px] border-border/60">
						<CardHeader>
							<CardTitle>Portfolio Performance</CardTitle>
							<CardDescription>
								Time-weighted returns vs. S&P 500 benchmark
							</CardDescription>
						</CardHeader>
						<CardContent className="h-[320px]">
							<ResponsiveContainer width="100%" height="100%">
								<AreaChart data={performanceData}>
									<defs>
										<linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
											<stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
											<stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
										</linearGradient>
									</defs>
									<XAxis dataKey="name" axisLine={false} tickLine={false} />
									<YAxis hide domain={["dataMin", "dataMax"]} />
									<Tooltip
										contentStyle={{
											backgroundColor: "var(--card)",
											borderColor: "var(--border)",
										}}
									/>
									<Area
										type="monotone"
										dataKey="val"
										stroke="#2563eb"
										fillOpacity={1}
										fill="url(#colorVal)"
										strokeWidth={2}
									/>
								</AreaChart>
							</ResponsiveContainer>
						</CardContent>
					</Card>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<Card className="border-border/60">
							<CardHeader>
								<CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
									Allocation
								</CardTitle>
							</CardHeader>
							<CardContent>
								<AssetAllocationChart assets={assets} />
							</CardContent>
						</Card>

						<Card className="border-border/60">
							<CardHeader>
								<CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
									Recent Activity
								</CardTitle>
							</CardHeader>
							<CardContent className="p-0">
								<div className="divide-y divide-border/40">
									{transactions.slice(0, 4).map((tx) => (
										<div
											key={tx.id}
											className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-sm"
										>
											<div className="flex items-center gap-3">
												<div
													className={cn(
														"p-2 rounded-full",
														tx.type === "buy"
															? "bg-emerald-500/10 text-emerald-500"
															: "bg-rose-500/10 text-rose-500",
													)}
												>
													{tx.type === "buy" ? (
														<ArrowDownRight size={14} />
													) : (
														<ArrowUpRight size={14} />
													)}
												</div>
												<div className="flex flex-col">
													<span className="font-medium">
														{tx.type === "buy" ? "Bought" : "Sold"}{" "}
														{assets.find((a) => a.id === tx.assetId)?.symbol ||
															"Asset"}
													</span>
													<span className="text-xs text-muted-foreground">
														{tx.date
															? format(new Date(tx.date), "MMM d, yyyy")
															: "Unknown date"}
													</span>
												</div>
											</div>
											<span className="font-mono font-medium">
												{formatCurrency(tx.total || 0)}
											</span>
										</div>
									))}
									{transactions.length === 0 && (
										<div className="p-8 text-center text-muted-foreground text-sm">
											No recent transactions
										</div>
									)}
								</div>
							</CardContent>
						</Card>
					</div>
				</div>

				{/* RIGHT COL: MOVERS + ACTIONS */}
				<div className="space-y-6">
					<Card className="border-border/60 bg-gradient-to-b from-card to-secondary/10">
						<CardHeader className="border-b border-border/40 bg-muted/20 pb-4">
							<CardTitle>Top Movers</CardTitle>
							<CardDescription>Intraday performance</CardDescription>
						</CardHeader>
						<CardContent className="pt-6">
							<TopMovers assets={assets} />
						</CardContent>
					</Card>

					<Card className="border-border/60">
						<CardHeader className="pb-3">
							<CardTitle className="text-sm font-medium">
								Portfolio Stats
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div className="flex items-start gap-3 text-sm">
									<div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-blue-500/10 text-blue-500">
										<Wallet className="h-3 w-3" />
									</div>
									<div>
										<p className="font-medium">Total Assets</p>
										<p className="text-xs text-muted-foreground">
											{assets.length} holdings
										</p>
									</div>
								</div>
								<div className="flex items-start gap-3 text-sm">
									<div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-purple-500/10 text-purple-500">
										<Activity className="h-3 w-3" />
									</div>
									<div>
										<p className="font-medium">Portfolio ID</p>
										<p className="text-xs text-muted-foreground font-mono">
											{selectedPortfolio?.id?.slice(0, 8) || "None"}...
										</p>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
