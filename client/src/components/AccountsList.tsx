import ReactECharts from "echarts-for-react";
import {
	Building2,
	CheckCircle2,
	Coins,
	Download,
	Eye,
	LayoutGrid,
	List,
	MoreVertical,
	PieChart,
	Plus,
	Trash2,
	Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { type PortfolioAssetItem, usePortfolio } from "@/components/PortfolioProvider";
import { SearchInput } from "@/components/ui/search-input";
import { useAssetMutations } from "@/hooks/use-asset-mutations";
import { useCurrency } from "@/hooks/use-currency";
import { AddSavingForm, type SavingsFormData } from "./AddSavingForm";
import { TrendArrowDown, TrendArrowUp } from "./TrendArrows";
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
import { Separator } from "./ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

interface AccountsListProps {
	onSelectAccount: (accountId: string) => void;
}

type ViewMode = "cards" | "table";
type AccountType = "all" | "CEX" | "Bank" | "Broker";

/** Account-level view derived from portfolio assets */
interface AccountData {
	id: string;
	name: string;
	type: "CEX" | "Bank" | "Broker";
	assetClass: string;
	totalValue: number;
	totalCost: number;
	profitLoss: number;
	profitLossPercent: number;
	accountNumber: string;
	color: string;
	symbol?: string;
	dayChange?: number;
	dayChangePercent?: number;
}

/** Map portfolio asset type to account-level type */
function mapAssetTypeToAccountType(asset: PortfolioAssetItem): AccountData["type"] {
	switch (asset.type) {
		case "bank":
			return "Bank";
		case "crypto":
			return "CEX";
		case "stock":
		case "fund":
			return "Broker";
		default:
			return "Bank";
	}
}

/** Derive a color per account type */
const ACCOUNT_TYPE_COLORS: Record<AccountData["type"], string> = {
	CEX: "#F3BA2F",
	Bank: "#117ACA",
	Broker: "#C52328",
};

const BANK_ACCOUNT_ASSET_TYPE_ID = "3"; // Bank Account asset type ID from server

export function AccountsList({ onSelectAccount }: AccountsListProps) {
	const { assets, currentPortfolio, refetch } = usePortfolio();
	const { addBankAccount } = useAssetMutations();
	const [viewMode, setViewMode] = useState<ViewMode>("cards");
	const [searchQuery, setSearchQuery] = useState("");
	const [filterType, setFilterType] = useState<AccountType>("all");
	const [sortBy, setSortBy] = useState("value-desc");
	const [distributionChartType, setDistributionChartType] = useState<"pie" | "treemap">("pie");
	const [showAddForm, setShowAddForm] = useState(false);
	const [hoveredAccountData, setHoveredAccountData] = useState<{
		name: string;
		value: number;
		percent: number;
	} | null>(null);

	const handleAddAccount = async (data: SavingsFormData) => {
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
				toast.success("Account added successfully");
				await refetch();
			} else {
				throw new Error("createBankAccountAsset returned no asset");
			}
		} catch (error) {
			toast.error("Failed to add account. Please try again.");
			throw error; // Re-throw so AddSavingForm keeps dialog open
		}
	};

	// Derive accounts from real portfolio assets
	const accounts = useMemo((): AccountData[] => {
		return assets.map((a) => {
			const type = mapAssetTypeToAccountType(a);
			const totalCost = a.purchasePrice * a.quantity;
			const profitLoss = a.currentValue - totalCost;
			const profitLossPercent = totalCost > 0 ? (profitLoss / totalCost) * 100 : 0;

			const assetClass = type === "CEX" ? "Crypto" : type === "Bank" ? "Cash" : "Stocks";

			return {
				id: a.id,
				name: a.institution || a.name,
				type,
				assetClass,
				totalValue: a.currentValue,
				totalCost,
				profitLoss,
				profitLossPercent,
				accountNumber: a.accountNumber || `****${a.id.slice(-4)}`,
				color: ACCOUNT_TYPE_COLORS[type],
				symbol: a.symbol,
				dayChange: a.dayChange,
				dayChangePercent: a.dayChangePercent,
			};
		});
	}, [assets]);

	const { formatCurrencyCompact: formatCurrency, currencySymbol: _currencySymbol } = useCurrency();

	// Calculate metrics
	const totalValue = accounts.reduce((sum, acc) => sum + acc.totalValue, 0);
	const totalCost = accounts.reduce((sum, acc) => sum + acc.totalCost, 0);
	const totalProfitLoss = totalValue - totalCost;
	const totalProfitLossPercent = totalCost > 0 ? (totalProfitLoss / totalCost) * 100 : 0;
	const numberOfAccounts = accounts.length;

	// Filter and sort
	const filteredAccounts = accounts.filter((acc) => {
		if (filterType !== "all" && acc.type !== filterType) return false;
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			return (
				acc.name.toLowerCase().includes(query) ||
				acc.accountNumber.toLowerCase().includes(query) ||
				acc.assetClass.toLowerCase().includes(query)
			);
		}
		return true;
	});

	// Sort
	if (sortBy === "value-desc") filteredAccounts.sort((a, b) => b.totalValue - a.totalValue);
	else if (sortBy === "value-asc") filteredAccounts.sort((a, b) => a.totalValue - b.totalValue);
	else if (sortBy === "profit-desc") filteredAccounts.sort((a, b) => b.profitLoss - a.profitLoss);
	else if (sortBy === "profit-asc") filteredAccounts.sort((a, b) => a.profitLoss - b.profitLoss);
	else if (sortBy === "name-asc") filteredAccounts.sort((a, b) => a.name.localeCompare(b.name));

	// Distribution data
	const distributionData = filteredAccounts.map((acc) => ({
		name: acc.name,
		value: acc.totalValue,
		itemStyle: { color: acc.color },
	}));

	const distributionChartOption =
		distributionChartType === "pie"
			? {
					tooltip: {
						show: false,
					},
					legend: {
						show: false,
					},
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
									text: hoveredAccountData ? hoveredAccountData.name : formatCurrency(totalValue),
									textAlign: "center",
									fill: document.documentElement.classList.contains("dark") ? "#fafafa" : "#0a0a0a",
									fontSize: hoveredAccountData ? 18 : 28,
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
									text: hoveredAccountData ? formatCurrency(hoveredAccountData.value) : "Total",
									textAlign: "center",
									fill: document.documentElement.classList.contains("dark") ? "#a3a3a3" : "#737373",
									fontSize: hoveredAccountData ? 16 : 13,
									fontWeight: hoveredAccountData ? "500" : "400",
									y: hoveredAccountData ? 26 : 38,
								},
							},
							{
								type: "text",
								z: 100,
								left: "center",
								top: "middle",
								style: {
									text: hoveredAccountData ? `${hoveredAccountData.percent.toFixed(1)}%` : "",
									textAlign: "center",
									fill: document.documentElement.classList.contains("dark") ? "#737373" : "#a3a3a3",
									fontSize: 13,
									fontWeight: "400",
									y: 48,
								},
							},
						],
					},
					series: [
						{
							type: "pie",
							radius: ["60%", "85%"],
							avoidLabelOverlap: false,
							itemStyle: {
								borderRadius: 4,
								borderColor: document.documentElement.classList.contains("dark")
									? "#0a0a0a"
									: "#fafafa",
								borderWidth: 3,
							},
							label: {
								show: false,
							},
							emphasis: {
								scale: false,
								itemStyle: {
									shadowBlur: 0,
								},
							},
							data: distributionData,
						},
					],
				}
			: {
					tooltip: {
						// biome-ignore lint/suspicious/noExplicitAny: unavoidable
						formatter: (params: any) => `${params.name}: ${formatCurrency(params.value)}`,
					},
					series: [
						{
							type: "treemap",
							data: distributionData,
							width: "100%",
							height: "100%",
							roam: false,
							nodeClick: false,
							breadcrumb: { show: false },
							label: {
								show: true,
								formatter: "{b}\n{c}",
							},
							upperLabel: {
								show: true,
								height: 30,
							},
							itemStyle: {
								borderColor: "#fff",
								borderWidth: 2,
								gapWidth: 2,
							},
						},
					],
				};

	const AccountIcon = ({ type }: { type: string }) => {
		if (type === "CEX") return <Building2 className="h-5 w-5" />;
		if (type === "Bank") return <Wallet className="h-5 w-5" />;
		if (type === "Broker") return <Coins className="h-5 w-5" />;
		return <Wallet className="h-5 w-5" />;
	};

	return (
		<div className="space-y-6">
			{/* KPIs */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<Card>
					<CardHeader className="pb-3">
						<CardDescription>Total Value</CardDescription>
						<CardTitle className="text-2xl font-mono">{formatCurrency(totalValue)}</CardTitle>
					</CardHeader>
					<CardContent>
						<div
							className={`flex items-center gap-2 text-sm ${totalProfitLoss >= 0 ? "text-green-600" : "text-red-600"}`}
						>
							{totalProfitLoss >= 0 ? <TrendArrowUp /> : <TrendArrowDown />}
							<span className="font-mono">
								{formatCurrency(totalProfitLoss)} ({totalProfitLoss >= 0 ? "+" : ""}
								{totalProfitLossPercent.toFixed(2)}%)
							</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-3">
						<CardDescription>Total Accounts</CardDescription>
						<CardTitle className="text-2xl">{numberOfAccounts}</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<CheckCircle2 className="h-4 w-4 text-green-600" />
							<span>{numberOfAccounts} total</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-3">
						<CardDescription>Best Account</CardDescription>
						<CardTitle className="text-xl text-green-600">
							{[...accounts].sort((a, b) => b.profitLossPercent - a.profitLossPercent)[0]?.name ||
								"—"}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm font-mono">
							{(() => {
								const best = [...accounts].sort(
									(a, b) => b.profitLossPercent - a.profitLossPercent,
								)[0];
								return best ? `+${best.profitLossPercent.toFixed(2)}%` : "—";
							})()}
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-3">
						<CardDescription>Asset Classes</CardDescription>
						<CardTitle className="text-2xl">
							{[...new Set(accounts.map((a) => a.assetClass))].length}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground">
							{[...new Set(accounts.map((a) => a.assetClass))].join(", ") || "—"}
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Distribution Chart */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle>Account Distribution</CardTitle>
							<CardDescription>Total value by account</CardDescription>
						</div>
						<div className="flex gap-2">
							<Button
								variant={distributionChartType === "pie" ? "default" : "outline"}
								size="sm"
								onClick={() => setDistributionChartType("pie")}
							>
								<PieChart className="h-4 w-4 mr-2" />
								Pie Chart
							</Button>
							<Button
								variant={distributionChartType === "treemap" ? "default" : "outline"}
								size="sm"
								onClick={() => setDistributionChartType("treemap")}
							>
								<LayoutGrid className="h-4 w-4 mr-2" />
								Treemap
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<ReactECharts
						option={distributionChartOption}
						style={{ height: "350px" }}
						opts={{ renderer: "svg" }}
						onEvents={{
							// biome-ignore lint/suspicious/noExplicitAny: unavoidable
							mouseover: (params: any) => {
								if (params.componentType === "series" && params.seriesType === "pie") {
									setHoveredAccountData({
										name: params.name,
										value: params.value,
										percent: params.percent,
									});
								}
							},
							mouseout: () => {
								setHoveredAccountData(null);
							},
						}}
					/>
				</CardContent>
			</Card>

			{/* Accounts List */}
			<Card>
				<CardHeader>
					<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
						<div>
							<CardTitle>Accounts</CardTitle>
							<CardDescription>Manage all your financial accounts</CardDescription>
						</div>
						<div className="flex gap-2">
							<Button onClick={() => setShowAddForm(true)}>
								<Plus className="h-4 w-4 mr-2" />
								Add Account
							</Button>
							<Button variant="outline">
								<Download className="h-4 w-4 mr-2" />
								Export
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{/* Filters & View Mode */}
						<div className="flex flex-col sm:flex-row gap-3">
							<SearchInput
								placeholder="Search accounts..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								onClear={() => setSearchQuery("")}
								containerClassName="flex-1"
							/>

							<Select value={filterType} onValueChange={(v) => setFilterType(v as AccountType)}>
								<SelectTrigger className="w-[150px]">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Types</SelectItem>
									<SelectItem value="CEX">Exchanges</SelectItem>
									<SelectItem value="Bank">Banks</SelectItem>
									<SelectItem value="Broker">Brokers</SelectItem>
								</SelectContent>
							</Select>

							<Select value={sortBy} onValueChange={setSortBy}>
								<SelectTrigger className="w-[150px]">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="value-desc">Value (High)</SelectItem>
									<SelectItem value="value-asc">Value (Low)</SelectItem>
									<SelectItem value="profit-desc">Profit (High)</SelectItem>
									<SelectItem value="profit-asc">Profit (Low)</SelectItem>
									<SelectItem value="name-asc">Name (A-Z)</SelectItem>
								</SelectContent>
							</Select>

							{/* View Mode Toggle */}
							<div className="flex border rounded-lg">
								<Button
									variant={viewMode === "cards" ? "default" : "ghost"}
									size="sm"
									onClick={() => setViewMode("cards")}
									className="rounded-r-none"
								>
									<LayoutGrid className="h-4 w-4" />
								</Button>
								<Button
									variant={viewMode === "table" ? "default" : "ghost"}
									size="sm"
									onClick={() => setViewMode("table")}
									className="rounded-l-none"
								>
									<List className="h-4 w-4" />
								</Button>
							</div>
						</div>

						{/* Results count */}
						<div className="flex items-center justify-between text-sm text-muted-foreground">
							<span>{filteredAccounts.length} accounts</span>
							<Badge variant="outline">{formatCurrency(totalValue)} total value</Badge>
						</div>

						{filteredAccounts.length > 0 ? (
							<>
								{/* Cards View */}
								{viewMode === "cards" && (
									<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
										{filteredAccounts.map((account) => (
											<Card
												key={account.id}
												className="hover:shadow-lg transition-shadow cursor-pointer"
												onClick={() => onSelectAccount(account.id)}
											>
												<CardHeader className="pb-3">
													<div className="flex items-start justify-between">
														<div className="flex items-center gap-3">
															<div
																className="h-12 w-12 rounded-full flex items-center justify-center text-white"
																style={{ backgroundColor: account.color }}
															>
																<AccountIcon type={account.type} />
															</div>
															<div>
																<CardTitle className="text-lg">{account.name}</CardTitle>
																<CardDescription className="text-xs">
																	{account.type} • {account.assetClass}
																</CardDescription>
															</div>
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
																		onSelectAccount(account.id);
																	}}
																>
																	<Eye className="h-4 w-4 mr-2" />
																	View Details
																</DropdownMenuItem>
																<DropdownMenuSeparator />
																<DropdownMenuItem
																	className="text-destructive"
																	onClick={(e) => e.stopPropagation()}
																>
																	<Trash2 className="h-4 w-4 mr-2" />
																	Delete
																</DropdownMenuItem>
															</DropdownMenuContent>
														</DropdownMenu>
													</div>
												</CardHeader>
												<CardContent className="space-y-3">
													<div>
														<p className="text-xs text-muted-foreground mb-1">Total Value</p>
														<p className="text-2xl font-mono">
															{formatCurrency(account.totalValue)}
														</p>
													</div>

													<div className="flex items-center justify-between">
														<div>
															<p className="text-xs text-muted-foreground">P&L</p>
															<p
																className={`font-mono ${account.profitLoss >= 0 ? "text-green-600" : "text-red-600"}`}
															>
																{account.profitLoss >= 0 ? "+" : ""}
																{formatCurrency(account.profitLoss)}
															</p>
														</div>
														<div className="text-right">
															<p className="text-xs text-muted-foreground">Return</p>
															<p
																className={`font-mono ${account.profitLossPercent >= 0 ? "text-green-600" : "text-red-600"}`}
															>
																{account.profitLossPercent >= 0 ? "+" : ""}
																{account.profitLossPercent.toFixed(2)}%
															</p>
														</div>
													</div>

													<Separator />

													<div className="flex items-center justify-between text-xs text-muted-foreground">
														<span>{account.symbol || account.assetClass}</span>
														{account.dayChangePercent != null && (
															<div className="flex items-center gap-1">
																{account.dayChangePercent >= 0 ? (
																	<>
																		<TrendArrowUp />
																		<span className="text-green-600">
																			+{account.dayChangePercent.toFixed(2)}%
																		</span>
																	</>
																) : (
																	<>
																		<TrendArrowDown />
																		<span className="text-red-600">
																			{account.dayChangePercent.toFixed(2)}%
																		</span>
																	</>
																)}
															</div>
														)}
													</div>

													<div className="text-xs text-muted-foreground">
														Account: {account.accountNumber}
													</div>
												</CardContent>
											</Card>
										))}
									</div>
								)}

								{/* Table View */}
								{viewMode === "table" && (
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Account</TableHead>
												<TableHead>Type</TableHead>
												<TableHead>Asset Class</TableHead>
												<TableHead className="text-right">Symbol</TableHead>
												<TableHead className="text-right">Total Value</TableHead>
												<TableHead className="text-right">P&L</TableHead>
												<TableHead className="text-right">Return</TableHead>
												<TableHead>Day Change</TableHead>
												<TableHead className="text-right">Actions</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{filteredAccounts.map((account) => (
												<TableRow
													key={account.id}
													className="cursor-pointer hover:bg-muted/50"
													onClick={() => onSelectAccount(account.id)}
												>
													<TableCell>
														<div className="flex items-center gap-3">
															<div
																className="h-10 w-10 rounded-full flex items-center justify-center text-white flex-shrink-0"
																style={{ backgroundColor: account.color }}
															>
																<AccountIcon type={account.type} />
															</div>
															<div>
																<p className="font-medium">{account.name}</p>
																<p className="text-xs text-muted-foreground">
																	{account.accountNumber}
																</p>
															</div>
														</div>
													</TableCell>
													<TableCell>
														<Badge variant="outline">{account.type}</Badge>
													</TableCell>
													<TableCell>{account.assetClass}</TableCell>
													<TableCell className="text-right">{account.symbol || "—"}</TableCell>
													<TableCell className="text-right font-mono">
														{formatCurrency(account.totalValue)}
													</TableCell>
													<TableCell
														className={`text-right font-mono ${account.profitLoss >= 0 ? "text-green-600" : "text-red-600"}`}
													>
														{account.profitLoss >= 0 ? "+" : ""}
														{formatCurrency(account.profitLoss)}
													</TableCell>
													<TableCell
														className={`text-right font-mono ${account.profitLossPercent >= 0 ? "text-green-600" : "text-red-600"}`}
													>
														{account.profitLossPercent >= 0 ? "+" : ""}
														{account.profitLossPercent.toFixed(2)}%
													</TableCell>
													<TableCell>
														{account.dayChangePercent != null ? (
															<div
																className={`flex items-center gap-1 text-xs ${account.dayChangePercent >= 0 ? "text-green-600" : "text-red-600"}`}
															>
																{account.dayChangePercent >= 0 ? (
																	<TrendArrowUp />
																) : (
																	<TrendArrowDown />
																)}
																<span>
																	{account.dayChangePercent >= 0 ? "+" : ""}
																	{account.dayChangePercent.toFixed(2)}% today
																</span>
															</div>
														) : (
															<span className="text-xs text-muted-foreground">—</span>
														)}
													</TableCell>
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
																		onSelectAccount(account.id);
																	}}
																>
																	<Eye className="h-4 w-4 mr-2" />
																	View Details
																</DropdownMenuItem>
																<DropdownMenuSeparator />
																<DropdownMenuItem
																	className="text-destructive"
																	onClick={(e) => e.stopPropagation()}
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
								)}
							</>
						) : (
							<div className="text-center py-12">
								<Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
								<h3 className="text-lg font-medium mb-2">No accounts found</h3>
								<p className="text-muted-foreground mb-4">
									{searchQuery || filterType !== "all"
										? "Try adjusting your search or filters"
										: "Add your first account to get started"}
								</p>
								{!searchQuery && filterType === "all" && (
									<Button onClick={() => setShowAddForm(true)}>
										<Plus className="h-4 w-4 mr-2" />
										Add Account
									</Button>
								)}
							</div>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Add Account Dialog */}
			<AddSavingForm
				open={showAddForm}
				onClose={() => setShowAddForm(false)}
				onSubmit={handleAddAccount}
			/>
		</div>
	);
}
