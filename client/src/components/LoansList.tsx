import {
	Banknote,
	BarChart3,
	Building2,
	Calendar,
	ChevronLeft,
	ChevronRight,
	CreditCard,
	FileText,
	Filter,
	LayoutGrid,
	List,
	MoreVertical,
	Percent,
	Plus,
	Search,
	SortAsc,
	TrendingUp,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { usePortfolio } from "@/components/PortfolioProvider";
import {
	type AddLoanInput,
	useAssetMutations,
} from "@/hooks/use-asset-mutations";
import { AddLoanForm } from "./AddLoanForm";
import { LoansAnalytics } from "./LoansAnalytics";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "./ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Input } from "./ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "./ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

interface LoansListProps {
	onSelectLoan?: (loanId: string) => void;
}

type ViewMode = "grid" | "list";
type LoanType =
	| "step"
	| "amortizing"
	| "in-fine"
	| "deferred-interest"
	| "deferred-total";

interface Loan {
	id: string;
	name: string;
	type: LoanType;
	loanAmount: number;
	remainingBalance: number;
	interestRate: number;
	duration: number; // months
	monthlyPayment: number;
	startDate: Date;
	endDate?: Date;
	bank?: string;
	currency: string;
	linkedAssets?: string[];
	ownershipMode: "personal" | "company";
	status: "active" | "paid-off" | "delinquent";
}

const LOAN_ASSET_TYPE_ID = "7"; // Loan asset type ID from server

export function LoansList({ onSelectLoan }: LoansListProps) {
	const { assets, currentPortfolio, refetch } = usePortfolio();
	const { addLoan } = useAssetMutations();
	const [searchTerm, setSearchTerm] = useState("");
	const [sortBy, setSortBy] = useState("balance");
	const [filterType, setFilterType] = useState("all");
	const [filterStatus, setFilterStatus] = useState("all");
	const [viewMode, setViewMode] = useState<ViewMode>("list");
	const [currentPage, setCurrentPage] = useState(1);
	const [isAddFormOpen, setIsAddFormOpen] = useState(false);
	const itemsPerPage = viewMode === "grid" ? 9 : 15;

	// Derive loans from assets with type 'loan'
	const loans = useMemo(() => {
		return assets
			.filter((a) => a.type === "loan")
			.map((a) => ({
				id: a.id,
				name: a.name,
				type: "amortizing" as LoanType,
				loanAmount: a.purchasePrice || a.currentValue || 0,
				remainingBalance: a.currentValue || 0,
				interestRate: 0,
				duration: 0,
				monthlyPayment: 0,
				startDate: new Date(),
				bank: a.symbol || undefined,
				currency: "USD",
				ownershipMode: "personal" as const,
				status: "active" as const,
			}));
	}, [assets]);

	const filteredLoans = loans
		.filter((loan) => {
			const matchesSearch =
				loan.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				loan.bank?.toLowerCase().includes(searchTerm.toLowerCase());
			const matchesType = filterType === "all" || loan.type === filterType;
			const matchesStatus =
				filterStatus === "all" || loan.status === filterStatus;
			return matchesSearch && matchesType && matchesStatus;
		})
		.sort((a, b) => {
			switch (sortBy) {
				case "balance":
					return b.remainingBalance - a.remainingBalance;
				case "payment":
					return b.monthlyPayment - a.monthlyPayment;
				case "rate":
					return b.interestRate - a.interestRate;
				case "name":
					return a.name.localeCompare(b.name);
				default:
					return 0;
			}
		});

	const getTotalBalance = () => {
		return loans.reduce((sum, loan) => sum + loan.remainingBalance, 0);
	};

	const getTotalMonthlyPayment = () => {
		return loans.reduce((sum, loan) => sum + loan.monthlyPayment, 0);
	};

	const getTotalPrincipalPaid = () => {
		return loans.reduce(
			(sum, loan) => sum + (loan.loanAmount - loan.remainingBalance),
			0,
		);
	};

	const getAverageInterestRate = () => {
		if (loans.length === 0) return 0;
		const totalRate = loans.reduce((sum, loan) => sum + loan.interestRate, 0);
		return totalRate / loans.length;
	};

	const totalBalance = getTotalBalance();
	const totalMonthlyPayment = getTotalMonthlyPayment();
	const totalPrincipalPaid = getTotalPrincipalPaid();
	const avgInterestRate = getAverageInterestRate();

	const handleAddLoan = async (formData: {
		name: string;
		type: string;
		loanAmount: string;
		downPayment: string;
		currency: string;
		description: string;
		interestRate: string;
		duration: string;
		startDate: Date | undefined;
		endDate: Date | undefined;
		monthlyPayment: string;
		remainingBalance: string;
		bank: string;
		loanNumber: string;
		applicationFee: string;
		brokerFee: string;
		insuranceFee: string;
		otherFees: string;
		earlyRepaymentFee: string;
		ownershipMode: string;
	}) => {
		if (!currentPortfolio) {
			toast.error("No portfolio selected. Please select a portfolio first.");
			throw new Error("No portfolio selected");
		}

		const input: AddLoanInput = {
			portfolioId: currentPortfolio,
			assetTypeID: LOAN_ASSET_TYPE_ID,
			name: formData.name,
			description: formData.description || undefined,
			loanType: formData.type,
			loanAmount: parseFloat(formData.loanAmount) || 0,
			remainingBalance:
				parseFloat(formData.remainingBalance) ||
				parseFloat(formData.loanAmount) ||
				0,
			interestRate: parseFloat(formData.interestRate) || 0,
			durationMonths: parseInt(formData.duration) || 0,
			monthlyPayment: parseFloat(formData.monthlyPayment) || 0,
			startDate: formData.startDate
				? formData.startDate.toISOString().split("T")[0]
				: new Date().toISOString().split("T")[0],
			endDate: formData.endDate
				? formData.endDate.toISOString().split("T")[0]
				: undefined,
			lender: formData.bank || "Unknown",
			loanNumber: formData.loanNumber || undefined,
			currency: formData.currency || "EUR",
			downPayment: formData.downPayment
				? parseFloat(formData.downPayment)
				: undefined,
			status: "active",
			ownershipMode: formData.ownershipMode || undefined,
			applicationFee: formData.applicationFee
				? parseFloat(formData.applicationFee)
				: undefined,
			brokerFee: formData.brokerFee
				? parseFloat(formData.brokerFee)
				: undefined,
			insuranceFee: formData.insuranceFee
				? parseFloat(formData.insuranceFee)
				: undefined,
			otherFees: formData.otherFees
				? parseFloat(formData.otherFees)
				: undefined,
			earlyRepaymentFee: formData.earlyRepaymentFee
				? parseFloat(formData.earlyRepaymentFee)
				: undefined,
			currentValue:
				parseFloat(formData.remainingBalance) ||
				parseFloat(formData.loanAmount) ||
				0,
			purchasePrice: parseFloat(formData.loanAmount) || 0,
			purchaseDate: formData.startDate
				? formData.startDate.toISOString()
				: new Date().toISOString(),
		};

		try {
			const result = await addLoan(input);
			if (result.asset) {
				toast.success("Loan added successfully");
				await refetch();
				setIsAddFormOpen(false);
			} else {
				throw new Error("createLoanAsset returned no asset");
			}
		} catch (error) {
			console.error("Error adding loan:", error);
			toast.error("Failed to add loan. Please try again.");
			throw error; // Re-throw so AddLoanForm keeps dialog open
		}
	};

	// Pagination
	const totalPages = Math.ceil(filteredLoans.length / itemsPerPage);
	const startIndex = (currentPage - 1) * itemsPerPage;
	const endIndex = startIndex + itemsPerPage;
	const paginatedLoans = filteredLoans.slice(startIndex, endIndex);

	// Reset to page 1 when filters change
	React.useEffect(() => {
		setCurrentPage(1);
	}, [searchTerm, filterType, filterStatus, sortBy, viewMode]);

	const getLoanTypeLabel = (type: LoanType) => {
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
				return "Step";
			default:
				return type;
		}
	};

	const getLoanTypeBadgeColor = (type: LoanType) => {
		switch (type) {
			case "amortizing":
				return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
			case "in-fine":
				return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
			case "deferred-interest":
				return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
			case "deferred-total":
				return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
			case "step":
				return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
			default:
				return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
		}
	};

	const getStatusBadge = (status: string) => {
		switch (status) {
			case "active":
				return (
					<Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
						Active
					</Badge>
				);
			case "paid-off":
				return (
					<Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300">
						Paid Off
					</Badge>
				);
			case "delinquent":
				return (
					<Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
						Delinquent
					</Badge>
				);
			default:
				return <Badge>{status}</Badge>;
		}
	};

	const formatCurrency = (amount: number, currency: string = "EUR") => {
		const validAmount =
			typeof amount === "number" && !Number.isNaN(amount) ? amount : 0;
		return validAmount.toLocaleString("fr-FR", {
			style: "currency",
			currency: currency,
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		});
	};

	const formatDate = (date: Date) => {
		const dateObj = date instanceof Date ? date : new Date(date);
		return dateObj.toLocaleDateString("fr-FR", {
			year: "numeric",
			month: "short",
		});
	};

	const calculateProgress = (loan: Loan) => {
		const paid = loan.loanAmount - loan.remainingBalance;
		return (paid / loan.loanAmount) * 100;
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl">Loans & Debt</h1>
					<p className="text-muted-foreground">
						Manage your loans and track payments
					</p>
				</div>
				<Button onClick={() => setIsAddFormOpen(true)}>
					<Plus className="h-4 w-4 mr-2" />
					Add Loan
				</Button>
			</div>

			{/* Main Tabs */}
			<Tabs defaultValue="loans" className="space-y-6">
				<TabsList className="grid w-full max-w-md grid-cols-2">
					<TabsTrigger value="loans">
						<CreditCard className="h-4 w-4 mr-2" />
						Loans
					</TabsTrigger>
					<TabsTrigger value="analytics">
						<BarChart3 className="h-4 w-4 mr-2" />
						Analytics
					</TabsTrigger>
				</TabsList>

				{/* Loans Tab */}
				<TabsContent value="loans" className="space-y-6">
					{/* Summary Cards */}
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">
									Total Debt
								</CardTitle>
								<Banknote className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">
									{formatCurrency(totalBalance)}
								</div>
								<p className="text-xs text-muted-foreground">
									{loans.length} active {loans.length === 1 ? "loan" : "loans"}
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">
									Monthly Payments
								</CardTitle>
								<Calendar className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">
									{formatCurrency(totalMonthlyPayment)}
								</div>
								<p className="text-xs text-muted-foreground">
									Total monthly obligation
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
									{formatCurrency(totalPrincipalPaid)}
								</div>
								<p className="text-xs text-muted-foreground">
									Total debt reduction
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
									Across all loans
								</p>
							</CardContent>
						</Card>
					</div>

					{/* Filters and Search */}
					<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
						<div className="flex flex-1 gap-2">
							<div className="relative flex-1 max-w-sm">
								<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
								<Input
									placeholder="Search loans..."
									className="pl-8"
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
								/>
							</div>

							<Select value={filterType} onValueChange={setFilterType}>
								<SelectTrigger className="w-[180px]">
									<Filter className="h-4 w-4 mr-2" />
									<SelectValue placeholder="Filter by type" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Types</SelectItem>
									<SelectItem value="amortizing">Amortizing</SelectItem>
									<SelectItem value="in-fine">In Fine</SelectItem>
									<SelectItem value="deferred-interest">
										Deferred Interest
									</SelectItem>
									<SelectItem value="deferred-total">Deferred Total</SelectItem>
									<SelectItem value="step">Step</SelectItem>
								</SelectContent>
							</Select>

							<Select value={filterStatus} onValueChange={setFilterStatus}>
								<SelectTrigger className="w-[150px]">
									<SelectValue placeholder="Status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Status</SelectItem>
									<SelectItem value="active">Active</SelectItem>
									<SelectItem value="paid-off">Paid Off</SelectItem>
									<SelectItem value="delinquent">Delinquent</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="flex gap-2">
							<Select value={sortBy} onValueChange={setSortBy}>
								<SelectTrigger className="w-[180px]">
									<SortAsc className="h-4 w-4 mr-2" />
									<SelectValue placeholder="Sort by" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="balance">Balance</SelectItem>
									<SelectItem value="payment">Monthly Payment</SelectItem>
									<SelectItem value="rate">Interest Rate</SelectItem>
									<SelectItem value="name">Name</SelectItem>
								</SelectContent>
							</Select>

							<div className="flex gap-1 border rounded-lg p-1">
								<Button
									variant={viewMode === "list" ? "secondary" : "ghost"}
									size="sm"
									onClick={() => setViewMode("list")}
									className="h-8 w-8 p-0"
								>
									<List className="h-4 w-4" />
								</Button>
								<Button
									variant={viewMode === "grid" ? "secondary" : "ghost"}
									size="sm"
									onClick={() => setViewMode("grid")}
									className="h-8 w-8 p-0"
								>
									<LayoutGrid className="h-4 w-4" />
								</Button>
							</div>
						</div>
					</div>

					{/* Loans Display */}
					{viewMode === "list" ? (
						<Card>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Loan Name</TableHead>
										<TableHead>Type</TableHead>
										<TableHead>Bank</TableHead>
										<TableHead className="text-right">
											Original Amount
										</TableHead>
										<TableHead className="text-right">Remaining</TableHead>
										<TableHead className="text-right">
											Monthly Payment
										</TableHead>
										<TableHead className="text-center">Rate</TableHead>
										<TableHead className="text-center">Progress</TableHead>
										<TableHead className="text-center">Status</TableHead>
										<TableHead className="text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{paginatedLoans.length === 0 ? (
										<TableRow>
											<TableCell colSpan={10} className="text-center py-12">
												<div className="flex flex-col items-center gap-2">
													<FileText className="h-12 w-12 text-muted-foreground/50" />
													<p className="text-muted-foreground">
														No loans found
													</p>
													<Button
														variant="outline"
														size="sm"
														onClick={() => setIsAddFormOpen(true)}
													>
														<Plus className="h-4 w-4 mr-2" />
														Add your first loan
													</Button>
												</div>
											</TableCell>
										</TableRow>
									) : (
										paginatedLoans.map((loan) => {
											const progress = calculateProgress(loan);
											return (
												<TableRow
													key={loan.id}
													className="cursor-pointer hover:bg-accent/50"
													onClick={() => onSelectLoan?.(loan.id)}
												>
													<TableCell>
														<div className="flex items-center gap-2">
															<div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
																<CreditCard className="h-4 w-4 text-primary" />
															</div>
															<div>
																<p className="font-medium">{loan.name}</p>
																<p className="text-xs text-muted-foreground">
																	{formatDate(loan.startDate)} -{" "}
																	{loan.endDate
																		? formatDate(loan.endDate)
																		: "Ongoing"}
																</p>
															</div>
														</div>
													</TableCell>
													<TableCell>
														<Badge className={getLoanTypeBadgeColor(loan.type)}>
															{getLoanTypeLabel(loan.type)}
														</Badge>
													</TableCell>
													<TableCell>
														<div className="flex items-center gap-2">
															<Building2 className="h-3 w-3 text-muted-foreground" />
															<span className="text-sm">
																{loan.bank || "N/A"}
															</span>
														</div>
													</TableCell>
													<TableCell className="text-right">
														<span className="text-sm text-muted-foreground">
															{formatCurrency(loan.loanAmount, loan.currency)}
														</span>
													</TableCell>
													<TableCell className="text-right">
														<span className="font-medium">
															{formatCurrency(
																loan.remainingBalance,
																loan.currency,
															)}
														</span>
													</TableCell>
													<TableCell className="text-right">
														<span className="font-medium">
															{formatCurrency(
																loan.monthlyPayment,
																loan.currency,
															)}
														</span>
													</TableCell>
													<TableCell className="text-center">
														<Badge variant="outline" className="font-mono">
															{loan.interestRate.toFixed(2)}%
														</Badge>
													</TableCell>
													<TableCell>
														<div className="flex items-center gap-2">
															<div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
																<div
																	className="h-full bg-green-600 transition-all"
																	style={{ width: `${progress}%` }}
																/>
															</div>
															<span className="text-xs text-muted-foreground w-12 text-right">
																{progress.toFixed(0)}%
															</span>
														</div>
													</TableCell>
													<TableCell className="text-center">
														{getStatusBadge(loan.status)}
													</TableCell>
													<TableCell className="text-right">
														<DropdownMenu>
															<DropdownMenuTrigger asChild>
																<Button
																	variant="ghost"
																	size="sm"
																	className="h-8 w-8 p-0"
																	onClick={(e) => e.stopPropagation()}
																>
																	<MoreVertical className="h-4 w-4" />
																</Button>
															</DropdownMenuTrigger>
															<DropdownMenuContent align="end">
																<DropdownMenuItem
																	onClick={() => onSelectLoan?.(loan.id)}
																>
																	View Details
																</DropdownMenuItem>
																<DropdownMenuItem>Edit Loan</DropdownMenuItem>
																<DropdownMenuItem>
																	Payment History
																</DropdownMenuItem>
																<DropdownMenuSeparator />
																<DropdownMenuItem className="text-destructive">
																	Delete Loan
																</DropdownMenuItem>
															</DropdownMenuContent>
														</DropdownMenu>
													</TableCell>
												</TableRow>
											);
										})
									)}
								</TableBody>
							</Table>
						</Card>
					) : (
						<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
							{paginatedLoans.map((loan) => {
								const progress = calculateProgress(loan);
								return (
									<Card
										key={loan.id}
										className="hover:shadow-lg transition-shadow cursor-pointer"
										onClick={() => onSelectLoan?.(loan.id)}
									>
										<CardHeader>
											<div className="flex items-start justify-between">
												<div className="flex items-center gap-3">
													<div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
														<CreditCard className="h-5 w-5 text-primary" />
													</div>
													<div>
														<CardTitle className="text-lg">
															{loan.name}
														</CardTitle>
														<CardDescription className="flex items-center gap-1 mt-1">
															<Building2 className="h-3 w-3" />
															{loan.bank || "N/A"}
														</CardDescription>
													</div>
												</div>
												<DropdownMenu>
													<DropdownMenuTrigger asChild>
														<Button
															variant="ghost"
															size="sm"
															className="h-8 w-8 p-0"
															onClick={(e) => e.stopPropagation()}
														>
															<MoreVertical className="h-4 w-4" />
														</Button>
													</DropdownMenuTrigger>
													<DropdownMenuContent align="end">
														<DropdownMenuItem
															onClick={() => onSelectLoan?.(loan.id)}
														>
															View Details
														</DropdownMenuItem>
														<DropdownMenuItem>Edit Loan</DropdownMenuItem>
														<DropdownMenuItem>Payment History</DropdownMenuItem>
														<DropdownMenuSeparator />
														<DropdownMenuItem className="text-destructive">
															Delete Loan
														</DropdownMenuItem>
													</DropdownMenuContent>
												</DropdownMenu>
											</div>
										</CardHeader>
										<CardContent className="space-y-4">
											<div className="flex items-center justify-between">
												<Badge className={getLoanTypeBadgeColor(loan.type)}>
													{getLoanTypeLabel(loan.type)}
												</Badge>
												{getStatusBadge(loan.status)}
											</div>

											<div className="space-y-2">
												<div className="flex justify-between text-sm">
													<span className="text-muted-foreground">
														Remaining Balance
													</span>
													<span className="font-bold">
														{formatCurrency(
															loan.remainingBalance,
															loan.currency,
														)}
													</span>
												</div>
												<div className="flex justify-between text-sm">
													<span className="text-muted-foreground">
														Monthly Payment
													</span>
													<span className="font-medium">
														{formatCurrency(loan.monthlyPayment, loan.currency)}
													</span>
												</div>
												<div className="flex justify-between text-sm">
													<span className="text-muted-foreground">
														Interest Rate
													</span>
													<Badge variant="outline" className="font-mono">
														{loan.interestRate.toFixed(2)}%
													</Badge>
												</div>
											</div>

											<div className="space-y-2">
												<div className="flex justify-between text-xs text-muted-foreground">
													<span>Progress</span>
													<span>{progress.toFixed(0)}% paid</span>
												</div>
												<div className="h-2 bg-muted rounded-full overflow-hidden">
													<div
														className="h-full bg-green-600 transition-all"
														style={{ width: `${progress}%` }}
													/>
												</div>
											</div>

											<div className="pt-2 border-t">
												<div className="flex justify-between text-xs text-muted-foreground">
													<span>{formatDate(loan.startDate)}</span>
													<span>
														{loan.endDate
															? formatDate(loan.endDate)
															: "Ongoing"}
													</span>
												</div>
											</div>
										</CardContent>
									</Card>
								);
							})}
						</div>
					)}

					{/* Pagination */}
					{totalPages > 1 && (
						<div className="flex items-center justify-between">
							<p className="text-sm text-muted-foreground">
								Showing {startIndex + 1} to{" "}
								{Math.min(endIndex, filteredLoans.length)} of{" "}
								{filteredLoans.length} loans
							</p>
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="sm"
									onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
									disabled={currentPage === 1}
								>
									<ChevronLeft className="h-4 w-4" />
									Previous
								</Button>
								<div className="flex items-center gap-1">
									{Array.from({ length: totalPages }, (_, i) => i + 1).map(
										(page) => (
											<Button
												key={page}
												variant={currentPage === page ? "default" : "outline"}
												size="sm"
												onClick={() => setCurrentPage(page)}
												className="w-8 h-8 p-0"
											>
												{page}
											</Button>
										),
									)}
								</div>
								<Button
									variant="outline"
									size="sm"
									onClick={() =>
										setCurrentPage(Math.min(totalPages, currentPage + 1))
									}
									disabled={currentPage === totalPages}
								>
									Next
									<ChevronRight className="h-4 w-4" />
								</Button>
							</div>
						</div>
					)}
				</TabsContent>

				{/* Analytics Tab */}
				<TabsContent value="analytics">
					<LoansAnalytics loans={loans} />
				</TabsContent>
			</Tabs>

			{/* Add Loan Form */}
			<AddLoanForm
				open={isAddFormOpen}
				onClose={() => setIsAddFormOpen(false)}
				onSubmit={handleAddLoan}
			/>
		</div>
	);
}
