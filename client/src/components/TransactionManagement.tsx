import ReactECharts from "echarts-for-react";
import { AlertCircle, BookmarkPlus, Download, FileText, Filter, Plus, Tag, X } from "lucide-react";
import { useMemo, useState } from "react";
import { usePortfolio } from "@/components/PortfolioProvider";
import { SearchInput } from "@/components/ui/search-input";
import { useCurrency } from "@/hooks/use-currency";
import { TransactionsList } from "./TransactionsList";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "./ui/dialog";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

export function TransactionManagement() {
	const { transactions, assets, addTransaction } = usePortfolio();

	// State Management
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedAccount, setSelectedAccount] = useState("all");
	const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
	const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
	const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set(["completed"]));
	const [dateRange, setDateRange] = useState("all");
	const [minAmount, setMinAmount] = useState("");
	const [maxAmount, setMaxAmount] = useState("");
	const [sortBy, setSortBy] = useState("date-desc");
	const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false);
	const [savedFilters, setSavedFilters] = useState<any[]>([]);
	const [showSaveFilterDialog, setShowSaveFilterDialog] = useState(false);
	const [filterName, setFilterName] = useState("");

	// New transaction form state
	const [newTransaction, setNewTransaction] = useState({
		type: "",
		assetId: "",
		accountId: "",
		quantity: "",
		price: "",
		amount: "",
		date: new Date().toISOString().split("T")[0],
		category: "",
		notes: "",
		reference: "",
		tags: [] as string[],
	});

	const { currencySymbol } = useCurrency();

	// Use only real transactions from context
	const allTransactions = transactions.map((t) => ({
		...t,
		status: "completed" as const,
		currency: "USD",
	}));

	// Extract unique values for filters
	const availableAccounts = useMemo<string[]>(() => {
		const accounts = new Set<string>();
		allTransactions.forEach((t) => {
			if (t.accountName) accounts.add(t.accountName);
		});
		return Array.from(accounts);
	}, [allTransactions]);

	const availableCategories = useMemo<string[]>(() => {
		const categories = new Set<string>();
		allTransactions.forEach((t) => {
			if (t.category) categories.add(t.category);
		});
		return Array.from(categories);
	}, [allTransactions]);

	const transactionTypes = [
		"buy",
		"sell",
		"transfer",
		"deposit",
		"withdrawal",
		"dividend",
		"fee",
		"refund",
	];
	const transactionStatuses = ["completed", "pending", "failed", "refunded"];

	// Filtering Logic
	const filteredTransactions = useMemo(() => {
		return allTransactions.filter((transaction) => {
			// Search filter
			if (searchTerm) {
				const searchLower = searchTerm.toLowerCase();
				const matchesSearch =
					transaction.assetName?.toLowerCase().includes(searchLower) ||
					transaction.assetSymbol?.toLowerCase().includes(searchLower) ||
					transaction.accountName?.toLowerCase().includes(searchLower) ||
					transaction.merchantName?.toLowerCase().includes(searchLower) ||
					transaction.reference?.toLowerCase().includes(searchLower) ||
					transaction.category?.toLowerCase().includes(searchLower) ||
					transaction.notes?.toLowerCase().includes(searchLower);

				if (!matchesSearch) return false;
			}

			// Account filter
			if (selectedAccount !== "all" && transaction.accountName !== selectedAccount) {
				return false;
			}

			// Type filter
			if (selectedTypes.size > 0 && !selectedTypes.has(transaction.type)) {
				return false;
			}

			// Category filter
			if (selectedCategories.size > 0 && !selectedCategories.has(transaction.category || "")) {
				return false;
			}

			// Status filter
			if (selectedStatuses.size > 0 && !selectedStatuses.has(transaction.status)) {
				return false;
			}

			// Amount range filter
			if (minAmount && transaction.amount < parseFloat(minAmount)) {
				return false;
			}
			if (maxAmount && transaction.amount > parseFloat(maxAmount)) {
				return false;
			}

			// Date range filter
			if (dateRange !== "all") {
				const transactionDate = new Date(transaction.date);
				const now = new Date();
				const daysDiff = (now.getTime() - transactionDate.getTime()) / (1000 * 60 * 60 * 24);

				switch (dateRange) {
					case "7d":
						if (daysDiff > 7) return false;
						break;
					case "30d":
						if (daysDiff > 30) return false;
						break;
					case "90d":
						if (daysDiff > 90) return false;
						break;
					case "1y":
						if (daysDiff > 365) return false;
						break;
				}
			}

			return true;
		});
	}, [
		allTransactions,
		searchTerm,
		selectedAccount,
		selectedTypes,
		selectedCategories,
		selectedStatuses,
		minAmount,
		maxAmount,
		dateRange,
	]);

	// Sorting Logic
	const sortedTransactions = useMemo(() => {
		const sorted = [...filteredTransactions];

		switch (sortBy) {
			case "date-desc":
				sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
				break;
			case "date-asc":
				sorted.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
				break;
			case "amount-desc":
				sorted.sort((a, b) => b.amount - a.amount);
				break;
			case "amount-asc":
				sorted.sort((a, b) => a.amount - b.amount);
				break;
			case "type":
				sorted.sort((a, b) => a.type.localeCompare(b.type));
				break;
		}

		return sorted;
	}, [filteredTransactions, sortBy]);

	// Analytics Calculations
	const analytics = useMemo(() => {
		const total = sortedTransactions.length;
		const completed = sortedTransactions.filter((t) => t.status === "completed").length;
		const pending = sortedTransactions.filter((t) => t.status === "pending").length;

		const inflow = sortedTransactions
			.filter((t) => ["buy", "deposit", "dividend"].includes(t.type) && t.status === "completed")
			.reduce((sum, t) => sum + t.amount, 0);

		const outflow = sortedTransactions
			.filter((t) => ["sell", "withdrawal", "fee"].includes(t.type) && t.status === "completed")
			.reduce((sum, t) => sum + t.amount, 0);

		const totalFees = sortedTransactions
			.filter((t) => t.status === "completed")
			.reduce((sum, t) => sum + (t.fees || 0), 0);

		const netFlow = inflow - outflow;

		// Transactions by type
		const byType = transactionTypes
			.map((type) => ({
				type,
				count: sortedTransactions.filter((t) => t.type === type).length,
				total: sortedTransactions
					.filter((t) => t.type === type)
					.reduce((sum, t) => sum + t.amount, 0),
			}))
			.filter((t) => t.count > 0);

		return {
			total,
			completed,
			pending,
			inflow,
			outflow,
			netFlow,
			totalFees,
			byType,
		};
	}, [sortedTransactions, transactionTypes.map]);

	// Chart Options
	const getTransactionsByTypeChart = () => {
		return {
			tooltip: {
				trigger: "item",
				formatter: "{b}: {c} ({d}%)",
			},
			series: [
				{
					type: "pie",
					radius: ["40%", "70%"],
					avoidLabelOverlap: false,
					itemStyle: {
						borderRadius: 8,
						borderColor: "#fff",
						borderWidth: 2,
					},
					label: {
						show: false,
					},
					emphasis: {
						label: {
							show: true,
							fontSize: 16,
						},
					},
					data: analytics.byType.map((t) => ({
						name: t.type.charAt(0).toUpperCase() + t.type.slice(1),
						value: t.count,
					})),
				},
			],
		};
	};

	const getVolumeChart = () => {
		// Group by date for volume chart
		const volumeByDate = sortedTransactions.reduce(
			(acc, t) => {
				const date = new Date(t.date).toLocaleDateString();
				if (!acc[date]) acc[date] = 0;
				acc[date] += t.amount;
				return acc;
			},
			{} as Record<string, number>,
		);

		const dates = Object.keys(volumeByDate).sort();
		const volumes = dates.map((d) => volumeByDate[d]);

		return {
			tooltip: {
				trigger: "axis",
			},
			xAxis: {
				type: "category",
				data: dates,
			},
			yAxis: {
				type: "value",
				axisLabel: {
					formatter: `${currencySymbol}{value}`,
				},
			},
			series: [
				{
					name: "Volume",
					type: "bar",
					data: volumes,
					itemStyle: {
						borderRadius: [4, 4, 0, 0],
					},
				},
			],
		};
	};

	const handleAddTransaction = () => {
		if (!newTransaction.type || !newTransaction.amount) {
			alert("Please fill in all required fields");
			return;
		}

		const transaction = {
			...newTransaction,
			quantity: newTransaction.quantity ? parseFloat(newTransaction.quantity) : undefined,
			price: newTransaction.price ? parseFloat(newTransaction.price) : undefined,
			amount: parseFloat(newTransaction.amount),
			total:
				newTransaction.quantity && newTransaction.price
					? parseFloat(newTransaction.quantity) * parseFloat(newTransaction.price)
					: parseFloat(newTransaction.amount),
		};

		addTransaction(transaction);
		resetForm();
		setIsAddTransactionOpen(false);
	};

	const resetForm = () => {
		setNewTransaction({
			type: "",
			assetId: "",
			accountId: "",
			quantity: "",
			price: "",
			amount: "",
			date: new Date().toISOString().split("T")[0],
			category: "",
			notes: "",
			reference: "",
			tags: [],
		});
	};

	const handleExport = (format: "csv" | "json") => {
		alert(`Exporting ${sortedTransactions.length} transactions as ${format.toUpperCase()}`);
	};

	const handleSaveFilter = () => {
		const filter = {
			id: Date.now().toString(),
			name: filterName,
			config: {
				searchTerm,
				selectedAccount,
				selectedTypes: Array.from(selectedTypes),
				selectedCategories: Array.from(selectedCategories),
				selectedStatuses: Array.from(selectedStatuses),
				dateRange,
				minAmount,
				maxAmount,
				sortBy,
			},
		};

		setSavedFilters([...savedFilters, filter]);
		setFilterName("");
		setShowSaveFilterDialog(false);
	};

	const loadSavedFilter = (filter: any) => {
		setSearchTerm(filter.config.searchTerm);
		setSelectedAccount(filter.config.selectedAccount);
		setSelectedTypes(new Set(filter.config.selectedTypes));
		setSelectedCategories(new Set(filter.config.selectedCategories));
		setSelectedStatuses(new Set(filter.config.selectedStatuses));
		setDateRange(filter.config.dateRange);
		setMinAmount(filter.config.minAmount);
		setMaxAmount(filter.config.maxAmount);
		setSortBy(filter.config.sortBy);
	};

	const clearAllFilters = () => {
		setSearchTerm("");
		setSelectedAccount("all");
		setSelectedTypes(new Set());
		setSelectedCategories(new Set());
		setSelectedStatuses(new Set(["completed"]));
		setDateRange("all");
		setMinAmount("");
		setMaxAmount("");
		setSortBy("date-desc");
	};

	const activeFiltersCount =
		(searchTerm ? 1 : 0) +
		(selectedAccount !== "all" ? 1 : 0) +
		selectedTypes.size +
		selectedCategories.size +
		(selectedStatuses.size !== 1 || !selectedStatuses.has("completed") ? 1 : 0) +
		(dateRange !== "all" ? 1 : 0) +
		(minAmount ? 1 : 0) +
		(maxAmount ? 1 : 0);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1>Transactions Hub</h1>
					<p className="text-muted-foreground">
						Global search, analysis, and management across all accounts
					</p>
				</div>
				<div className="flex gap-2">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline">
								<Download className="h-4 w-4 mr-2" />
								Export
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuLabel>Export Format</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => handleExport("csv")}>
								<FileText className="h-4 w-4 mr-2" />
								CSV File
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => handleExport("json")}>
								<FileText className="h-4 w-4 mr-2" />
								JSON File
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>

					<Dialog open={isAddTransactionOpen} onOpenChange={setIsAddTransactionOpen}>
						<DialogTrigger asChild>
							<Button>
								<Plus className="h-4 w-4 mr-2" />
								Add Transaction
							</Button>
						</DialogTrigger>
						<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
							<DialogHeader>
								<DialogTitle>Add New Transaction</DialogTitle>
								<DialogDescription>Record a new transaction for your portfolio</DialogDescription>
							</DialogHeader>

							<div className="space-y-4">
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label htmlFor="transaction-type">Type *</Label>
										<Select
											value={newTransaction.type}
											onValueChange={(value) =>
												setNewTransaction({ ...newTransaction, type: value })
											}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select type" />
											</SelectTrigger>
											<SelectContent>
												{transactionTypes.map((type) => (
													<SelectItem key={type} value={type}>
														{type.charAt(0).toUpperCase() + type.slice(1)}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>

									<div className="space-y-2">
										<Label htmlFor="account">Account</Label>
										<Select
											value={newTransaction.accountId}
											onValueChange={(value) =>
												setNewTransaction({
													...newTransaction,
													accountId: value,
												})
											}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select account" />
											</SelectTrigger>
											<SelectContent>
												{availableAccounts.map((account) => (
													<SelectItem key={account} value={account}>
														{account}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								</div>

								{["buy", "sell"].includes(newTransaction.type) && (
									<div className="space-y-2">
										<Label htmlFor="asset">Asset</Label>
										<Select
											value={newTransaction.assetId}
											onValueChange={(value) =>
												setNewTransaction({ ...newTransaction, assetId: value })
											}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select asset" />
											</SelectTrigger>
											<SelectContent>
												{assets.map((asset) => (
													<SelectItem key={asset.id} value={asset.id}>
														{asset.symbol || asset.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								)}

								<div className="grid grid-cols-3 gap-4">
									{["buy", "sell"].includes(newTransaction.type) && (
										<>
											<div className="space-y-2">
												<Label htmlFor="quantity">Quantity</Label>
												<Input
													id="quantity"
													type="number"
													step="0.000001"
													value={newTransaction.quantity}
													onChange={(e) =>
														setNewTransaction({
															...newTransaction,
															quantity: e.target.value,
														})
													}
													placeholder="10"
												/>
											</div>

											<div className="space-y-2">
												<Label htmlFor="price">Price</Label>
												<Input
													id="price"
													type="number"
													step="0.01"
													value={newTransaction.price}
													onChange={(e) =>
														setNewTransaction({
															...newTransaction,
															price: e.target.value,
														})
													}
													placeholder="185.50"
												/>
											</div>
										</>
									)}

									<div className="space-y-2">
										<Label htmlFor="amount">Amount *</Label>
										<Input
											id="amount"
											type="number"
											step="0.01"
											value={newTransaction.amount}
											onChange={(e) =>
												setNewTransaction({
													...newTransaction,
													amount: e.target.value,
												})
											}
											placeholder="1855.00"
										/>
									</div>
								</div>

								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label htmlFor="date">Date</Label>
										<Input
											id="date"
											type="date"
											value={newTransaction.date}
											onChange={(e) =>
												setNewTransaction({
													...newTransaction,
													date: e.target.value,
												})
											}
										/>
									</div>

									<div className="space-y-2">
										<Label htmlFor="category">Category</Label>
										<Input
											id="category"
											value={newTransaction.category}
											onChange={(e) =>
												setNewTransaction({
													...newTransaction,
													category: e.target.value,
												})
											}
											placeholder="e.g., Technology, Dividend Income"
										/>
									</div>
								</div>

								<div className="space-y-2">
									<Label htmlFor="reference">Reference Number</Label>
									<Input
										id="reference"
										value={newTransaction.reference}
										onChange={(e) =>
											setNewTransaction({
												...newTransaction,
												reference: e.target.value,
											})
										}
										placeholder="TXN-2024-001234"
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="notes">Notes</Label>
									<Input
										id="notes"
										value={newTransaction.notes}
										onChange={(e) =>
											setNewTransaction({
												...newTransaction,
												notes: e.target.value,
											})
										}
										placeholder="Optional notes..."
									/>
								</div>
							</div>

							<DialogFooter>
								<Button variant="outline" onClick={() => setIsAddTransactionOpen(false)}>
									Cancel
								</Button>
								<Button onClick={handleAddTransaction}>Add Transaction</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</div>
			</div>

			{/* Analytics Cards */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm">Total Transactions</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-mono">{analytics.total}</div>
						<p className="text-xs text-muted-foreground">
							{analytics.completed} completed, {analytics.pending} pending
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm">Inflow</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-mono text-green-600">
							{currencySymbol}
							{analytics.inflow.toLocaleString()}
						</div>
						<p className="text-xs text-muted-foreground">Deposits, purchases, dividends</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm">Outflow</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-mono text-red-600">
							{currencySymbol}
							{analytics.outflow.toLocaleString()}
						</div>
						<p className="text-xs text-muted-foreground">Withdrawals, sales, fees</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm">Net Flow</CardTitle>
					</CardHeader>
					<CardContent>
						<div
							className={`text-2xl font-mono ${analytics.netFlow >= 0 ? "text-green-600" : "text-red-600"}`}
						>
							{analytics.netFlow >= 0 ? "+" : ""}
							{currencySymbol}
							{analytics.netFlow.toLocaleString()}
						</div>
						<p className="text-xs text-muted-foreground">
							Fees: {currencySymbol}
							{analytics.totalFees.toLocaleString()}
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Charts */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<Card>
					<CardHeader>
						<CardTitle>Transactions by Type</CardTitle>
						<CardDescription>Distribution across transaction types</CardDescription>
					</CardHeader>
					<CardContent>
						<ReactECharts option={getTransactionsByTypeChart()} style={{ height: "300px" }} />
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Transaction Volume</CardTitle>
						<CardDescription>Daily transaction amounts</CardDescription>
					</CardHeader>
					<CardContent>
						<ReactECharts option={getVolumeChart()} style={{ height: "300px" }} />
					</CardContent>
				</Card>
			</div>

			{/* Filters & Search */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<CardTitle>Filters & Search</CardTitle>
							{activeFiltersCount > 0 && (
								<Badge variant="secondary">{activeFiltersCount} active</Badge>
							)}
						</div>
						<div className="flex gap-2">
							{savedFilters.length > 0 && (
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="outline" size="sm">
											<BookmarkPlus className="h-4 w-4 mr-2" />
											Saved Filters
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end" className="w-56">
										<DropdownMenuLabel>Load Saved Filter</DropdownMenuLabel>
										<DropdownMenuSeparator />
										{savedFilters.map((filter) => (
											<DropdownMenuItem key={filter.id} onClick={() => loadSavedFilter(filter)}>
												{filter.name}
											</DropdownMenuItem>
										))}
									</DropdownMenuContent>
								</DropdownMenu>
							)}

							<Button
								variant="outline"
								size="sm"
								onClick={() => setShowSaveFilterDialog(true)}
								disabled={activeFiltersCount === 0}
							>
								<BookmarkPlus className="h-4 w-4 mr-2" />
								Save Current
							</Button>

							<Button
								variant="outline"
								size="sm"
								onClick={clearAllFilters}
								disabled={activeFiltersCount === 0}
							>
								<X className="h-4 w-4 mr-2" />
								Clear All
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{/* Search Bar */}
						<SearchInput
							placeholder="Search transactions..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							onClear={() => setSearchTerm("")}
							containerClassName="flex-1"
						/>

						{/* Filter Row 1 */}
						<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
							{/* Account Filter */}
							<div className="space-y-2">
								<Label>Account</Label>
								<Select value={selectedAccount} onValueChange={setSelectedAccount}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Accounts</SelectItem>
										{availableAccounts.map((account) => (
											<SelectItem key={account} value={account}>
												{account}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{/* Type Filter */}
							<div className="space-y-2">
								<Label>Type</Label>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="outline" className="w-full justify-between">
											<span>
												{selectedTypes.size === 0 ? "All Types" : `${selectedTypes.size} selected`}
											</span>
											<Filter className="h-4 w-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent className="w-56">
										{transactionTypes.map((type) => (
											<DropdownMenuCheckboxItem
												key={type}
												checked={selectedTypes.has(type)}
												onCheckedChange={(checked) => {
													const newTypes = new Set(selectedTypes);
													if (checked) {
														newTypes.add(type);
													} else {
														newTypes.delete(type);
													}
													setSelectedTypes(newTypes);
												}}
											>
												{type.charAt(0).toUpperCase() + type.slice(1)}
											</DropdownMenuCheckboxItem>
										))}
									</DropdownMenuContent>
								</DropdownMenu>
							</div>

							{/* Category Filter */}
							<div className="space-y-2">
								<Label>Category</Label>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="outline" className="w-full justify-between">
											<span>
												{selectedCategories.size === 0
													? "All Categories"
													: `${selectedCategories.size} selected`}
											</span>
											<Tag className="h-4 w-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent className="w-56">
										{availableCategories.map((category) => (
											<DropdownMenuCheckboxItem
												key={category}
												checked={selectedCategories.has(category)}
												onCheckedChange={(checked) => {
													const newCategories = new Set(selectedCategories);
													if (checked) {
														newCategories.add(category);
													} else {
														newCategories.delete(category);
													}
													setSelectedCategories(newCategories);
												}}
											>
												{category}
											</DropdownMenuCheckboxItem>
										))}
									</DropdownMenuContent>
								</DropdownMenu>
							</div>

							{/* Status Filter */}
							<div className="space-y-2">
								<Label>Status</Label>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="outline" className="w-full justify-between">
											<span>
												{selectedStatuses.size === 0
													? "All Statuses"
													: `${selectedStatuses.size} selected`}
											</span>
											<AlertCircle className="h-4 w-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent className="w-56">
										{transactionStatuses.map((status) => (
											<DropdownMenuCheckboxItem
												key={status}
												checked={selectedStatuses.has(status)}
												onCheckedChange={(checked) => {
													const newStatuses = new Set(selectedStatuses);
													if (checked) {
														newStatuses.add(status);
													} else {
														newStatuses.delete(status);
													}
													setSelectedStatuses(newStatuses);
												}}
											>
												{status.charAt(0).toUpperCase() + status.slice(1)}
											</DropdownMenuCheckboxItem>
										))}
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
						</div>

						{/* Filter Row 2 */}
						<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
							{/* Date Range */}
							<div className="space-y-2">
								<Label>Date Range</Label>
								<Select value={dateRange} onValueChange={setDateRange}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Time</SelectItem>
										<SelectItem value="7d">Last 7 Days</SelectItem>
										<SelectItem value="30d">Last 30 Days</SelectItem>
										<SelectItem value="90d">Last 90 Days</SelectItem>
										<SelectItem value="1y">Last Year</SelectItem>
									</SelectContent>
								</Select>
							</div>

							{/* Min Amount */}
							<div className="space-y-2">
								<Label>Min Amount</Label>
								<Input
									type="number"
									placeholder="$0"
									value={minAmount}
									onChange={(e) => setMinAmount(e.target.value)}
								/>
							</div>

							{/* Max Amount */}
							<div className="space-y-2">
								<Label>Max Amount</Label>
								<Input
									type="number"
									placeholder="No limit"
									value={maxAmount}
									onChange={(e) => setMaxAmount(e.target.value)}
								/>
							</div>

							{/* Sort By */}
							<div className="space-y-2">
								<Label>Sort By</Label>
								<Select value={sortBy} onValueChange={setSortBy}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="date-desc">Date (Newest First)</SelectItem>
										<SelectItem value="date-asc">Date (Oldest First)</SelectItem>
										<SelectItem value="amount-desc">Amount (Highest First)</SelectItem>
										<SelectItem value="amount-asc">Amount (Lowest First)</SelectItem>
										<SelectItem value="type">Type</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Transactions List */}
			<div>
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center gap-2">
						<h3>Transactions</h3>
						<Badge variant="secondary">{sortedTransactions.length} results</Badge>
					</div>
				</div>

				<TransactionsList
					transactions={sortedTransactions}
					showAccountColumn={selectedAccount === "all"}
					enableSelection={true}
					variant="table"
				/>
			</div>

			{/* Save Filter Dialog */}
			<Dialog open={showSaveFilterDialog} onOpenChange={setShowSaveFilterDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Save Current Filter</DialogTitle>
						<DialogDescription>
							Save your current filter configuration for quick access later
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="filter-name">Filter Name</Label>
							<Input
								id="filter-name"
								value={filterName}
								onChange={(e) => setFilterName(e.target.value)}
								placeholder="e.g., Last 30 Days - Crypto Only"
							/>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setShowSaveFilterDialog(false)}>
							Cancel
						</Button>
						<Button onClick={handleSaveFilter} disabled={!filterName.trim()}>
							Save Filter
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
