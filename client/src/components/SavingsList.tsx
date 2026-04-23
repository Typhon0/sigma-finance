import ReactECharts from "echarts-for-react";
import {
	ArrowUpDown,
	Building2,
	DollarSign,
	Eye,
	Filter,
	LayoutGrid,
	List,
	MoreVertical,
	PieChart,
	PiggyBank,
	Plus,
	Trash2,
	TrendingUp,
	Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { usePortfolio } from "@/components/PortfolioProvider";
import { SearchInput } from "@/components/ui/search-input";
import { useAssetMutations } from "@/hooks/use-asset-mutations";
import { useCurrency } from "@/hooks/use-currency";
import { AddSavingForm, type SavingsFormData } from "./AddSavingForm";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

interface SavingsListProps {
	onSelectSaving: (savingId: string) => void;
}

const BANK_ACCOUNT_ASSET_TYPE_ID = "3"; // Bank Account asset type ID from server

export function SavingsList({ onSelectSaving }: SavingsListProps) {
	const { assets, currentPortfolio, refetch } = usePortfolio();
	const { addBankAccount } = useAssetMutations();
	const [showAddForm, setShowAddForm] = useState(false);
	const [viewMode, setViewMode] = useState<"list" | "grid">("list");
	const [searchQuery, setSearchQuery] = useState("");
	const [ownershipFilter, setOwnershipFilter] = useState("all");
	const [bankFilter, setBankFilter] = useState("all");
	const [sortBy, setSortBy] = useState("balance-desc");
	const [distributionChartType, setDistributionChartType] = useState<"pie" | "treemap">("pie");
	const [timePeriod, setTimePeriod] = useState("1Y");

	// Derive savings from assets with type 'bank' or 'savings'
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
			}));
	}, [assets]);

	const { formatCurrencyCompact: formatCurrency, currencySymbol } = useCurrency();

	// Calculate metrics
	const totalBalance = savings.reduce((sum, s) => sum + s.balance, 0);
	const numberOfAccounts = savings.length;
	const averageBalance = numberOfAccounts > 0 ? totalBalance / numberOfAccounts : 0;
	const totalAnnualInterest = savings.reduce(
		(sum, s) => sum + (s.balance * (s.interestRate || 0)) / 100,
		0,
	);

	// Filter and sort (useMemo to avoid in-place mutation and re-computation)
	const filteredSavings = useMemo(() => {
		const filtered = savings.filter((s) => {
			if (ownershipFilter !== "all" && s.ownership !== ownershipFilter) return false;
			if (bankFilter !== "all" && s.bankName !== bankFilter) return false;
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				return (
					s.accountName.toLowerCase().includes(query) ||
					s.bankName.toLowerCase().includes(query) ||
					s.accountNumber.includes(query)
				);
			}
			return true;
		});

		// Sort (on a copy to avoid mutating the source array)
		const sorted = [...filtered];
		if (sortBy === "balance-desc") sorted.sort((a, b) => b.balance - a.balance);
		else if (sortBy === "balance-asc") sorted.sort((a, b) => a.balance - b.balance);
		else if (sortBy === "rate-desc")
			sorted.sort((a, b) => (b.interestRate || 0) - (a.interestRate || 0));
		else if (sortBy === "rate-asc")
			sorted.sort((a, b) => (a.interestRate || 0) - (b.interestRate || 0));
		else if (sortBy === "name-asc")
			sorted.sort((a, b) => a.accountName.localeCompare(b.accountName));

		return sorted;
	}, [savings, ownershipFilter, bankFilter, searchQuery, sortBy]);

	// Get unique banks
	const uniqueBanks = [...new Set(savings.map((s) => s.bankName))];

	// Get ownership badge
	const getOwnershipBadge = (ownership: string) => {
		switch (ownership) {
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
				return <Badge className="capitalize">{ownership}</Badge>;
		}
	};

	// Generate portfolio value history (useMemo for stability — deterministic, no Math.random())
	const portfolioHistory = useMemo(() => {
		let months = 12;

		switch (timePeriod) {
			case "1M":
				months = 1;
				break;
			case "3M":
				months = 3;
				break;
			case "6M":
				months = 6;
				break;
			case "1Y":
				months = 12;
				break;
			case "YTD": {
				const now = new Date();
				const startOfYear = new Date(now.getFullYear(), 0, 1);
				months = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24 * 30));
				break;
			}
			case "ALL":
				months = 48;
				break;
		}

		// Calculate average initial deposit (assume 80% of current as starting point)
		const avgInitialDeposit = savings.reduce((sum, s) => sum + s.balance * 0.8, 0);
		const currentValue = totalBalance;
		const monthlyGrowth = months > 0 ? (currentValue - avgInitialDeposit) / months : 0;

		const data: { date: string; value: number }[] = [];
		for (let i = 0; i <= months; i++) {
			const date = new Date();
			date.setMonth(date.getMonth() - (months - i));

			// Deterministic sinusoidal variation instead of Math.random()
			const baseValue = avgInitialDeposit + monthlyGrowth * i;
			const variation =
				months > 0 ? Math.sin((i / months) * Math.PI * 2) * (currentValue * 0.01) : 0;
			const value = Math.max(baseValue + variation, avgInitialDeposit);

			data.push({
				date: date.toLocaleDateString("en-US", {
					month: "short",
					year: i % 3 === 0 ? "numeric" : undefined,
				}),
				value: Math.round(value),
			});
		}

		return data;
	}, [savings, totalBalance, timePeriod]);

	// Charts

	// Portfolio Value Over Time
	const portfolioValueOption = {
		tooltip: {
			trigger: "axis",
			backgroundColor: "rgba(0, 0, 0, 0.8)",
			borderColor: "#333",
			textStyle: { color: "#fff" },
			formatter: (params: any) => {
				const data = params[0];
				return `${data.name}<br/>Value: ${currencySymbol}${data.value.toLocaleString("en-US")}`;
			},
		},
		grid: { left: 60, right: 20, top: 60, bottom: 40 },
		xAxis: {
			type: "category",
			data: portfolioHistory.map((p) => p.date),
			axisLabel: { rotate: 45, fontSize: 10 },
		},
		yAxis: {
			type: "value",
			axisLabel: {
				formatter: (value: number) => `${currencySymbol}${(value / 1000).toFixed(0)}K`,
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
				name: "Total Balance",
				type: "line",
				data: portfolioHistory.map((p) => p.value),
				smooth: true,
				areaStyle: {
					color: {
						type: "linear",
						x: 0,
						y: 0,
						x2: 0,
						y2: 1,
						colorStops: [
							{ offset: 0, color: "rgba(16, 185, 129, 0.4)" },
							{ offset: 1, color: "rgba(16, 185, 129, 0.05)" },
						],
					},
				},
				lineStyle: { color: "#10b981", width: 3 },
				itemStyle: { color: "#10b981" },
			},
		],
	};

	// Distribution by Bank
	const bankDistribution = savings.reduce(
		(acc, s) => {
			acc[s.bankName] = (acc[s.bankName] || 0) + s.balance;
			return acc;
		},
		{} as Record<string, number>,
	);

	const bankPieOption = {
		tooltip: {
			trigger: "item",
			backgroundColor: "rgba(0, 0, 0, 0.8)",
			borderColor: "#333",
			textStyle: { color: "#fff" },
			formatter: (params: any) => {
				return `${params.name}<br/>${currencySymbol}${params.value.toLocaleString("en-US")}<br/>${params.percent}%`;
			},
		},
		legend: {
			bottom: 0,
			left: "center",
		},
		series: [
			{
				name: "Distribution",
				type: "pie",
				radius: ["40%", "70%"],
				avoidLabelOverlap: false,
				itemStyle: {
					borderRadius: 10,
					borderColor: "#fff",
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
					},
				},
				labelLine: {
					show: false,
				},
				data: Object.entries(bankDistribution).map(([name, value]) => ({
					name,
					value,
				})),
			},
		],
	};

	const bankTreemapOption = {
		tooltip: {
			trigger: "item",
			backgroundColor: "rgba(0, 0, 0, 0.8)",
			borderColor: "#333",
			textStyle: { color: "#fff" },
			formatter: (params: any) => {
				const percent = ((params.value / totalBalance) * 100).toFixed(2);
				return `${params.name}<br/>${currencySymbol}${params.value.toLocaleString("en-US")}<br/>${percent}%`;
			},
		},
		series: [
			{
				name: "Distribution",
				type: "treemap",
				width: "100%",
				height: "100%",
				roam: false,
				breadcrumb: { show: false },
				itemStyle: {
					borderColor: "#fff",
					borderWidth: 2,
					gapWidth: 2,
				},
				label: {
					show: true,
					formatter: (params: any) => {
						const percent = ((params.value / totalBalance) * 100).toFixed(1);
						return `{name|${params.name}}\n{value|${currencySymbol}${(params.value / 1000).toFixed(1)}K}\n{percent|${percent}%}`;
					},
					rich: {
						name: {
							fontSize: 13,
							fontWeight: "bold",
							lineHeight: 20,
						},
						value: {
							fontSize: 12,
							lineHeight: 18,
							color: "rgba(255,255,255,0.9)",
						},
						percent: {
							fontSize: 11,
							lineHeight: 16,
							color: "rgba(255,255,255,0.7)",
						},
					},
				},
				upperLabel: {
					show: false,
				},
				data: Object.entries(bankDistribution).map(([name, value]) => ({
					name,
					value,
				})),
			},
		],
	};

	// Balance Comparison
	const balanceBarOption = {
		tooltip: {
			trigger: "axis",
			backgroundColor: "rgba(0, 0, 0, 0.8)",
			borderColor: "#333",
			textStyle: { color: "#fff" },
			axisPointer: { type: "shadow" },
			formatter: (params: any) => {
				const data = params[0];
				return `${data.name}<br/>${currencySymbol}${data.value.toLocaleString("en-US")}`;
			},
		},
		grid: { left: 60, right: 20, top: 20, bottom: 60 },
		xAxis: {
			type: "category",
			data: savings.slice(0, 10).map((s) => s.accountName),
			axisLabel: { rotate: 45, fontSize: 10 },
		},
		yAxis: {
			type: "value",
			axisLabel: {
				formatter: (value: number) => `${currencySymbol}${(value / 1000).toFixed(0)}K`,
			},
		},
		series: [
			{
				name: "Balance",
				type: "bar",
				data: savings.slice(0, 10).map((s) => s.balance),
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

	// Growth Projection (useMemo for stability)
	const projectionData = useMemo(() => {
		const months = 12;
		const data: { month: string; balance: number }[] = [];
		for (let i = 0; i <= months; i++) {
			const date = new Date();
			date.setMonth(date.getMonth() + i);

			// Calculate projected balance with compound interest
			const projectedBalance = savings.reduce((sum, s) => {
				const monthlyRate = (s.interestRate || 0) / 100 / 12;
				const projected = s.balance * (1 + monthlyRate) ** i;
				return sum + projected;
			}, 0);

			data.push({
				month: date.toLocaleDateString("en-US", { month: "short" }),
				balance: projectedBalance,
			});
		}
		return data;
	}, [savings]);

	const projectionOption = {
		tooltip: {
			trigger: "axis",
			backgroundColor: "rgba(0, 0, 0, 0.8)",
			borderColor: "#333",
			textStyle: { color: "#fff" },
			formatter: (params: any) => {
				const data = params[0];
				return `${data.name}<br/>Balance: ${currencySymbol}${Math.round(data.value).toLocaleString("en-US")}`;
			},
		},
		grid: { left: 60, right: 20, top: 20, bottom: 40 },
		xAxis: {
			type: "category",
			data: projectionData.map((p) => p.month),
			axisLabel: { rotate: 45, fontSize: 10 },
		},
		yAxis: {
			type: "value",
			axisLabel: {
				formatter: (value: number) => `${currencySymbol}${(value / 1000).toFixed(0)}K`,
			},
		},
		series: [
			{
				name: "Projected Balance",
				type: "line",
				data: projectionData.map((p) => p.balance),
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
				lineStyle: { color: "#10b981", width: 3 },
				itemStyle: { color: "#10b981" },
			},
		],
	};

	const handleAddSaving = async (data: SavingsFormData) => {
		if (!currentPortfolio) {
			toast.error("No portfolio selected. Please select a portfolio first.");
			throw new Error("No portfolio selected");
		}
		try {
			const result = await addBankAccount({
				portfolioId: currentPortfolio,
				assetTypeID: BANK_ACCOUNT_ASSET_TYPE_ID,
				name: data.accountName,
				institution: data.bankName,
				accountType: data.accountType,
				accountNumber: data.accountNumber,
				currency: data.currency || "USD",
				currentValue: parseFloat(data.balance) || 0,
				interestRate: data.interestRate ? parseFloat(data.interestRate) : undefined,
			});

			if (result.asset) {
				toast.success("Savings account added successfully");
				await refetch();
			} else {
				throw new Error("createBankAccountAsset returned no asset");
			}
		} catch (error) {
			toast.error("Failed to add savings account. Please try again.");
			throw error; // Re-throw so AddSavingForm keeps dialog open
		}
	};

	return (
		<div className="p-6 space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl">Savings Accounts</h1>
					<p className="text-muted-foreground mt-1">Manage and track your savings accounts</p>
				</div>
				<Button onClick={() => setShowAddForm(true)} className="gap-2">
					<Plus className="h-4 w-4" />
					Add Account
				</Button>
			</div>

			{/* KPI Cards */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
							<DollarSign className="h-4 w-4" />
							Total Balance
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-mono text-green-600">{formatCurrency(totalBalance)}</div>
						<p className="text-xs text-muted-foreground mt-1">Across all accounts</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
							<Wallet className="h-4 w-4" />
							Number of Accounts
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-mono">{numberOfAccounts}</div>
						<p className="text-xs text-muted-foreground mt-1">Active savings accounts</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
							<TrendingUp className="h-4 w-4" />
							Average Balance
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-mono">{formatCurrency(averageBalance)}</div>
						<p className="text-xs text-muted-foreground mt-1">Per account</p>
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
							{formatCurrency(totalAnnualInterest)}
						</div>
						<p className="text-xs text-muted-foreground mt-1">Projected yearly</p>
					</CardContent>
				</Card>
			</div>

			{/* Tabs */}
			<Tabs defaultValue="accounts" className="space-y-4">
				<TabsList>
					<TabsTrigger value="accounts">Accounts</TabsTrigger>
					<TabsTrigger value="analytics">Analytics</TabsTrigger>
				</TabsList>

				{/* Accounts Tab */}
				<TabsContent value="accounts" className="space-y-4">
					{/* Filters and Search */}
					<div className="flex flex-col sm:flex-row gap-4">
						<SearchInput
							placeholder="Search accounts, banks..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							onClear={() => setSearchQuery("")}
							containerClassName="flex-1"
						/>

						<Select value={ownershipFilter} onValueChange={setOwnershipFilter}>
							<SelectTrigger className="w-[180px]">
								<Filter className="h-4 w-4 mr-2" />
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Ownership</SelectItem>
								<SelectItem value="personal">Personal</SelectItem>
								<SelectItem value="company">Company</SelectItem>
								<SelectItem value="joint">Joint</SelectItem>
							</SelectContent>
						</Select>

						<Select value={bankFilter} onValueChange={setBankFilter}>
							<SelectTrigger className="w-[180px]">
								<Building2 className="h-4 w-4 mr-2" />
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Banks</SelectItem>
								{uniqueBanks.map((bank) => (
									<SelectItem key={String(bank)} value={String(bank)}>
										{String(bank)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<Select value={sortBy} onValueChange={setSortBy}>
							<SelectTrigger className="w-[180px]">
								<ArrowUpDown className="h-4 w-4 mr-2" />
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="balance-desc">Balance (High to Low)</SelectItem>
								<SelectItem value="balance-asc">Balance (Low to High)</SelectItem>
								<SelectItem value="rate-desc">Rate (High to Low)</SelectItem>
								<SelectItem value="rate-asc">Rate (Low to High)</SelectItem>
								<SelectItem value="name-asc">Name (A to Z)</SelectItem>
							</SelectContent>
						</Select>

						<div className="flex gap-2">
							<Button
								variant={viewMode === "list" ? "default" : "outline"}
								size="icon"
								onClick={() => setViewMode("list")}
							>
								<List className="h-4 w-4" />
							</Button>
							<Button
								variant={viewMode === "grid" ? "default" : "outline"}
								size="icon"
								onClick={() => setViewMode("grid")}
							>
								<LayoutGrid className="h-4 w-4" />
							</Button>
						</div>
					</div>

					{/* List View */}
					{viewMode === "list" && (
						<Card>
							<CardContent className="p-0">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Account Name</TableHead>
											<TableHead>Bank</TableHead>
											<TableHead className="text-right">Balance</TableHead>
											<TableHead className="text-right">Interest Rate</TableHead>
											<TableHead>Ownership</TableHead>
											<TableHead className="text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{filteredSavings.map((saving) => (
											<TableRow
												key={saving.id}
												className="cursor-pointer hover:bg-muted/50"
												onClick={() => onSelectSaving(saving.id)}
											>
												<TableCell>
													<div className="flex flex-col">
														<span className="font-medium">{saving.accountName}</span>
														<span className="text-xs text-muted-foreground">
															{saving.accountNumber}
														</span>
													</div>
												</TableCell>
												<TableCell>
													<div className="flex items-center gap-2">
														<Building2 className="h-4 w-4 text-muted-foreground" />
														{saving.bankName}
													</div>
												</TableCell>
												<TableCell className="text-right font-mono text-green-600">
													{formatCurrency(saving.balance)}
												</TableCell>
												<TableCell className="text-right font-mono">
													{(saving.interestRate || 0).toFixed(2)}%
												</TableCell>
												<TableCell>{getOwnershipBadge(saving.ownership)}</TableCell>
												<TableCell className="text-right">
													<DropdownMenu>
														<DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
															<Button variant="ghost" size="icon">
																<MoreVertical className="h-4 w-4" />
															</Button>
														</DropdownMenuTrigger>
														<DropdownMenuContent align="end">
															<DropdownMenuItem
																onClick={(e) => {
																	e.stopPropagation();
																	onSelectSaving(saving.id);
																}}
															>
																<Eye className="h-4 w-4 mr-2" />
																View Details
															</DropdownMenuItem>
															<DropdownMenuSeparator />
															<DropdownMenuItem
																onClick={(e) => {
																	e.stopPropagation();
																	toast.error("Delete feature coming soon");
																}}
																className="text-destructive"
															>
																<Trash2 className="h-4 w-4 mr-2" />
																Delete
															</DropdownMenuItem>
														</DropdownMenuContent>
													</DropdownMenu>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>

								{filteredSavings.length === 0 && (
									<div className="p-12 text-center">
										<PiggyBank className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
										<h3 className="text-lg font-medium mb-2">No savings accounts found</h3>
										<p className="text-muted-foreground mb-4">
											{searchQuery || ownershipFilter !== "all" || bankFilter !== "all"
												? "Try adjusting your search or filters"
												: "Add your first savings account to get started"}
										</p>
										{!searchQuery && ownershipFilter === "all" && bankFilter === "all" && (
											<Button onClick={() => setShowAddForm(true)}>
												<Plus className="h-4 w-4 mr-2" />
												Add Account
											</Button>
										)}
									</div>
								)}
							</CardContent>
						</Card>
					)}

					{/* Grid View */}
					{viewMode === "grid" && (
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{filteredSavings.map((saving) => (
								<Card
									key={saving.id}
									className="cursor-pointer hover:shadow-lg transition-shadow"
									onClick={() => onSelectSaving(saving.id)}
								>
									<CardHeader>
										<div className="flex items-start justify-between">
											<div className="flex-1">
												<CardTitle className="text-lg">{saving.accountName}</CardTitle>
												<CardDescription className="flex items-center gap-2 mt-1">
													<Building2 className="h-3 w-3" />
													{saving.bankName}
												</CardDescription>
											</div>
											<DropdownMenu>
												<DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
													<Button variant="ghost" size="icon">
														<MoreVertical className="h-4 w-4" />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem
														onClick={(e) => {
															e.stopPropagation();
															onSelectSaving(saving.id);
														}}
													>
														<Eye className="h-4 w-4 mr-2" />
														View Details
													</DropdownMenuItem>
													<DropdownMenuSeparator />
													<DropdownMenuItem
														onClick={(e) => {
															e.stopPropagation();
															toast.error("Delete feature coming soon");
														}}
														className="text-destructive"
													>
														<Trash2 className="h-4 w-4 mr-2" />
														Delete
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</div>
									</CardHeader>
									<CardContent className="space-y-4">
										<div className="space-y-2">
											<div className="flex items-center justify-between">
												<span className="text-sm text-muted-foreground">Balance</span>
												<span className="text-lg font-mono text-green-600">
													{formatCurrency(saving.balance)}
												</span>
											</div>
											<div className="flex items-center justify-between">
												<span className="text-sm text-muted-foreground">Interest Rate</span>
												<span className="font-mono">{(saving.interestRate || 0).toFixed(2)}%</span>
											</div>
											<div className="flex items-center justify-between">
												<span className="text-sm text-muted-foreground">Account No.</span>
												<span className="text-sm font-mono">{saving.accountNumber}</span>
											</div>
										</div>
										<div className="pt-2 border-t">{getOwnershipBadge(saving.ownership)}</div>
									</CardContent>
								</Card>
							))}

							{filteredSavings.length === 0 && (
								<div className="col-span-full p-12 text-center">
									<PiggyBank className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
									<h3 className="text-lg font-medium mb-2">No savings accounts found</h3>
									<p className="text-muted-foreground mb-4">
										{searchQuery || ownershipFilter !== "all" || bankFilter !== "all"
											? "Try adjusting your search or filters"
											: "Add your first savings account to get started"}
									</p>
									{!searchQuery && ownershipFilter === "all" && bankFilter === "all" && (
										<Button onClick={() => setShowAddForm(true)}>
											<Plus className="h-4 w-4 mr-2" />
											Add Account
										</Button>
									)}
								</div>
							)}
						</div>
					)}
				</TabsContent>

				{/* Analytics Tab */}
				<TabsContent value="analytics" className="space-y-4">
					{/* Portfolio Value Over Time */}
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle className="flex items-center gap-2">
										<TrendingUp className="h-5 w-5" />
										Total Balance Over Time
									</CardTitle>
									<CardDescription>Track your savings growth over time</CardDescription>
								</div>
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
							</div>
						</CardHeader>
						<CardContent>
							<ReactECharts
								option={portfolioValueOption}
								style={{ height: "400px" }}
								opts={{ renderer: "svg" }}
							/>
						</CardContent>
					</Card>

					<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
						{/* Distribution by Bank */}
						<Card>
							<CardHeader>
								<div className="flex items-center justify-between">
									<div>
										<CardTitle className="flex items-center gap-2">
											<Building2 className="h-5 w-5" />
											Distribution by Bank
										</CardTitle>
										<CardDescription>Balance distribution across banks</CardDescription>
									</div>
									<div className="flex items-center gap-2">
										<Button
											variant={distributionChartType === "pie" ? "default" : "outline"}
											size="sm"
											onClick={() => setDistributionChartType("pie")}
											className="h-8 px-3"
										>
											<PieChart className="h-3.5 w-3.5 mr-1.5" />
											Pie
										</Button>
										<Button
											variant={distributionChartType === "treemap" ? "default" : "outline"}
											size="sm"
											onClick={() => setDistributionChartType("treemap")}
											className="h-8 px-3"
										>
											<LayoutGrid className="h-3.5 w-3.5 mr-1.5" />
											Treemap
										</Button>
									</div>
								</div>
							</CardHeader>
							<CardContent>
								<ReactECharts
									option={distributionChartType === "pie" ? bankPieOption : bankTreemapOption}
									style={{ height: "350px" }}
									opts={{ renderer: "svg" }}
								/>
							</CardContent>
						</Card>

						{/* Balance Comparison */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<TrendingUp className="h-5 w-5" />
									Balance Comparison
								</CardTitle>
								<CardDescription>Top accounts by balance</CardDescription>
							</CardHeader>
							<CardContent>
								<ReactECharts
									option={balanceBarOption}
									style={{ height: "350px" }}
									opts={{ renderer: "svg" }}
								/>
							</CardContent>
						</Card>

						{/* Growth Projection */}
						<Card className="lg:col-span-2">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<PiggyBank className="h-5 w-5" />
									Growth Projection (12 Months)
								</CardTitle>
								<CardDescription>Projected total balance with compound interest</CardDescription>
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
				</TabsContent>
			</Tabs>

			{/* Add Saving Form */}
			<AddSavingForm
				open={showAddForm}
				onClose={() => setShowAddForm(false)}
				onSubmit={handleAddSaving}
			/>
		</div>
	);
}
