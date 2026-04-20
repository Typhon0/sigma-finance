import {
	ArrowDownLeft,
	ArrowLeftRight,
	ArrowUpRight,
	Building2,
	Edit,
	FileText,
	MapPin,
	MoreHorizontal,
	RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { useCurrency } from "@/hooks/use-currency";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "./ui/dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "./ui/table";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./ui/tooltip";

interface Transaction {
	id: string;
	type:
		| "buy"
		| "sell"
		| "transfer"
		| "deposit"
		| "withdrawal"
		| "dividend"
		| "fee"
		| "refund";
	assetId?: string;
	assetName?: string;
	assetSymbol?: string;
	assetLogo?: string;
	accountId?: string;
	accountName?: string;
	merchantName?: string;
	merchantLogo?: string;
	quantity?: number;
	price?: number;
	amount: number;
	currency: string;
	baseCurrency?: string;
	exchangeRate?: number;
	date: string;
	status: "completed" | "pending" | "failed" | "refunded";
	category?: string;
	reference?: string;
	notes?: string;
	fees?: number;
	fromAccount?: string;
	toAccount?: string;
	tags?: string[];
	location?: string;
	isRecurring?: boolean;
}

interface TransactionsListProps {
	transactions: Transaction[];
	accountId?: string;
	showAccountColumn?: boolean;
	enableSelection?: boolean;
	onSelectTransaction?: (transactionId: string) => void;
	onEditTransaction?: (transaction: Transaction) => void;
	emptyMessage?: string;
	variant?: "card" | "table"; // New: Choose layout style
}

export function TransactionsList({
	transactions,
	accountId,
	showAccountColumn = true,
	enableSelection = false,
	_onSelectTransaction,
	onEditTransaction,
	emptyMessage = "No transactions found",
	variant = "table", // Default to compact table view
}: TransactionsListProps) {
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [detailsTransaction, setDetailsTransaction] =
		useState<Transaction | null>(null);

	const toggleSelection = (id: string) => {
		const newSelected = new Set(selectedIds);
		if (newSelected.has(id)) {
			newSelected.delete(id);
		} else {
			newSelected.add(id);
		}
		setSelectedIds(newSelected);
	};

	const getTypeIcon = (type: string, small = false) => {
		const className = small ? "h-3 w-3" : "h-4 w-4";
		switch (type) {
			case "buy":
			case "deposit":
				return <ArrowDownLeft className={`${className} text-green-600`} />;
			case "sell":
			case "withdrawal":
				return <ArrowUpRight className={`${className} text-red-600`} />;
			case "transfer":
				return <ArrowLeftRight className={`${className} text-blue-600`} />;
			case "dividend":
				return <ArrowDownLeft className={`${className} text-emerald-600`} />;
			case "fee":
				return <ArrowUpRight className={`${className} text-orange-600`} />;
			case "refund":
				return <RefreshCw className={`${className} text-purple-600`} />;
			default:
				return <ArrowLeftRight className={className} />;
		}
	};

	const getTypeColor = (type: string) => {
		switch (type) {
			case "buy":
			case "deposit":
			case "dividend":
				return "text-green-600";
			case "sell":
			case "withdrawal":
			case "fee":
				return "text-red-600";
			case "transfer":
				return "text-blue-600";
			case "refund":
				return "text-purple-600";
			default:
				return "text-muted-foreground";
		}
	};

	const getStatusBadge = (status: string) => {
		switch (status) {
			case "completed":
				return null; // Don't show badge for completed
			case "pending":
				return (
					<Badge variant="secondary" className="text-xs h-5">
						Pending
					</Badge>
				);
			case "failed":
				return (
					<Badge variant="destructive" className="text-xs h-5">
						Failed
					</Badge>
				);
			case "refunded":
				return (
					<Badge variant="outline" className="text-xs h-5">
						Refunded
					</Badge>
				);
			default:
				return null;
		}
	};

	const { currency: displayCurrency } = useCurrency();

	const formatCurrency = (amount: number, currency?: string) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: currency || displayCurrency,
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(amount);
	};

	const formatDate = (date: string) => {
		const d = new Date(date);
		return d.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	};

	const formatTime = (date: string) => {
		const d = new Date(date);
		return d.toLocaleTimeString("en-US", {
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	if (transactions.length === 0) {
		return (
			<Card>
				<CardContent className="py-12 text-center">
					<div className="flex flex-col items-center gap-2 text-muted-foreground">
						<FileText className="h-8 w-8" />
						<p>{emptyMessage}</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	// COMPACT TABLE VIEW (Database-style)
	if (variant === "table") {
		return (
			<TooltipProvider>
				<div className="border rounded-lg overflow-hidden">
					<Table>
						<TableHeader>
							<TableRow className="bg-muted/50">
								{enableSelection && (
									<TableHead className="w-12">
										<input
											type="checkbox"
											checked={selectedIds.size === transactions.length}
											onChange={(e) => {
												if (e.target.checked) {
													setSelectedIds(
														new Set(transactions.map((t) => t.id)),
													);
												} else {
													setSelectedIds(new Set());
												}
											}}
											className="h-4 w-4 rounded border-gray-300"
										/>
									</TableHead>
								)}
								<TableHead className="w-24">Date</TableHead>
								<TableHead className="w-32">Type</TableHead>
								<TableHead>Description</TableHead>
								{showAccountColumn && !accountId && (
									<TableHead className="w-44">Account</TableHead>
								)}
								<TableHead className="w-32">Category</TableHead>
								<TableHead className="w-32 text-right">Amount</TableHead>
								<TableHead className="w-24 text-center">Status</TableHead>
								<TableHead className="w-12"></TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{transactions.map((transaction) => {
								const isSelected = selectedIds.has(transaction.id);
								const hasDetails =
									transaction.reference ||
									transaction.notes ||
									transaction.fees ||
									transaction.exchangeRate ||
									transaction.tags?.length ||
									transaction.location;

								return (
									<TableRow
										key={transaction.id}
										className={`${isSelected ? "bg-primary/5" : ""} hover:bg-muted/50 cursor-pointer`}
										onClick={() =>
											hasDetails && setDetailsTransaction(transaction)
										}
									>
										{/* Selection Checkbox */}
										{enableSelection && (
											<TableCell onClick={(e) => e.stopPropagation()}>
												<input
													type="checkbox"
													checked={isSelected}
													onChange={() => toggleSelection(transaction.id)}
													className="h-4 w-4 rounded border-gray-300"
												/>
											</TableCell>
										)}

										{/* Date */}
										<TableCell className="text-sm">
											<div className="flex flex-col">
												<span className="font-medium">
													{formatDate(transaction.date).split(",")[0]}
												</span>
												<span className="text-xs text-muted-foreground">
													{formatTime(transaction.date)}
												</span>
											</div>
										</TableCell>

										{/* Type */}
										<TableCell>
											<div className="flex items-center gap-2">
												{getTypeIcon(transaction.type, true)}
												<span className="text-sm capitalize">
													{transaction.type}
												</span>
											</div>
										</TableCell>

										{/* Description */}
										<TableCell>
											<div className="flex items-center gap-2 min-w-0">
												{(transaction.merchantLogo ||
													transaction.assetLogo) && (
													<Avatar className="h-6 w-6 flex-shrink-0">
														<AvatarImage
															src={
																transaction.merchantLogo ||
																transaction.assetLogo
															}
														/>
														<AvatarFallback className="text-xs">
															{(
																transaction.merchantName?.[0] ||
																transaction.assetSymbol?.[0] ||
																"?"
															).toUpperCase()}
														</AvatarFallback>
													</Avatar>
												)}
												<div className="flex flex-col min-w-0">
													<span className="font-medium text-sm truncate">
														{transaction.merchantName ||
															transaction.assetName ||
															transaction.type.charAt(0).toUpperCase() +
																transaction.type.slice(1)}
													</span>
													{transaction.assetSymbol && transaction.quantity && (
														<span className="text-xs text-muted-foreground truncate">
															{transaction.quantity.toLocaleString()}{" "}
															{transaction.assetSymbol} @{" "}
															{formatCurrency(transaction.price || 0)}
														</span>
													)}
													{transaction.isRecurring && (
														<div className="flex items-center gap-1 text-xs text-muted-foreground">
															<RefreshCw className="h-3 w-3" />
															<span>Recurring</span>
														</div>
													)}
												</div>
											</div>
										</TableCell>

										{/* Account (if showing) */}
										{showAccountColumn && !accountId && (
											<TableCell>
												<div className="flex items-center gap-1 text-sm">
													<Building2 className="h-3 w-3 text-muted-foreground" />
													<span className="truncate">
														{transaction.accountName || "—"}
													</span>
												</div>
											</TableCell>
										)}

										{/* Category */}
										<TableCell>
											{transaction.category ? (
												<Badge variant="secondary" className="text-xs">
													{transaction.category}
												</Badge>
											) : (
												<span className="text-xs text-muted-foreground">—</span>
											)}
										</TableCell>

										{/* Amount */}
										<TableCell className="text-right">
											<div className="flex flex-col items-end">
												<span
													className={`font-mono text-sm ${getTypeColor(transaction.type)}`}
												>
													{["sell", "withdrawal", "fee"].includes(
														transaction.type,
													)
														? "-"
														: "+"}
													{formatCurrency(
														transaction.amount,
														transaction.currency,
													)}
												</span>
												{transaction.baseCurrency &&
													transaction.baseCurrency !== transaction.currency &&
													transaction.exchangeRate && (
														<span className="text-xs text-muted-foreground">
															≈{" "}
															{formatCurrency(
																transaction.amount * transaction.exchangeRate,
																transaction.baseCurrency,
															)}
														</span>
													)}
												{transaction.fees && transaction.fees > 0 && (
													<span className="text-xs text-orange-600">
														Fee:{" "}
														{formatCurrency(
															transaction.fees,
															transaction.currency,
														)}
													</span>
												)}
											</div>
										</TableCell>

										{/* Status */}
										<TableCell className="text-center">
											{getStatusBadge(transaction.status)}
										</TableCell>

										{/* Actions */}
										<TableCell onClick={(e) => e.stopPropagation()}>
											{hasDetails && (
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															variant="ghost"
															size="sm"
															className="h-8 w-8 p-0"
															onClick={() => setDetailsTransaction(transaction)}
														>
															<MoreHorizontal className="h-4 w-4" />
														</Button>
													</TooltipTrigger>
													<TooltipContent>View details</TooltipContent>
												</Tooltip>
											)}
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</div>

				{/* Details Dialog */}
				{detailsTransaction && (
					<Dialog
						open={!!detailsTransaction}
						onOpenChange={() => setDetailsTransaction(null)}
					>
						<DialogContent className="max-w-2xl">
							<DialogHeader>
								<DialogTitle className="flex items-center gap-2">
									{getTypeIcon(detailsTransaction.type)}
									<span>
										{detailsTransaction.merchantName ||
											detailsTransaction.assetName ||
											detailsTransaction.type.charAt(0).toUpperCase() +
												detailsTransaction.type.slice(1)}
									</span>
								</DialogTitle>
								<DialogDescription>
									Transaction details and metadata
								</DialogDescription>
							</DialogHeader>

							<div className="space-y-4">
								{/* Main Info */}
								<div className="grid grid-cols-2 gap-4">
									<div>
										<label className="text-xs text-muted-foreground">
											Date & Time
										</label>
										<p className="text-sm font-medium">
											{formatDate(detailsTransaction.date)} at{" "}
											{formatTime(detailsTransaction.date)}
										</p>
									</div>
									<div>
										<label className="text-xs text-muted-foreground">
											Amount
										</label>
										<p
											className={`text-sm font-mono ${getTypeColor(detailsTransaction.type)}`}
										>
											{["sell", "withdrawal", "fee"].includes(
												detailsTransaction.type,
											)
												? "-"
												: "+"}
											{formatCurrency(
												detailsTransaction.amount,
												detailsTransaction.currency,
											)}
										</p>
									</div>
									<div>
										<label className="text-xs text-muted-foreground">
											Type
										</label>
										<p className="text-sm font-medium capitalize">
											{detailsTransaction.type}
										</p>
									</div>
									<div>
										<label className="text-xs text-muted-foreground">
											Status
										</label>
										<div className="mt-1">
											{getStatusBadge(detailsTransaction.status) || (
												<Badge variant="default" className="text-xs">
													Completed
												</Badge>
											)}
										</div>
									</div>
								</div>

								{/* Asset Details */}
								{detailsTransaction.assetSymbol && (
									<div className="pt-2 border-t">
										<label className="text-xs text-muted-foreground">
											Asset Details
										</label>
										<div className="grid grid-cols-3 gap-4 mt-2">
											<div>
												<p className="text-xs text-muted-foreground">Symbol</p>
												<p className="text-sm font-medium">
													{detailsTransaction.assetSymbol}
												</p>
											</div>
											{detailsTransaction.quantity && (
												<div>
													<p className="text-xs text-muted-foreground">
														Quantity
													</p>
													<p className="text-sm font-medium">
														{detailsTransaction.quantity.toLocaleString()}
													</p>
												</div>
											)}
											{detailsTransaction.price && (
												<div>
													<p className="text-xs text-muted-foreground">Price</p>
													<p className="text-sm font-medium">
														{formatCurrency(detailsTransaction.price)}
													</p>
												</div>
											)}
										</div>
									</div>
								)}

								{/* Account Info */}
								{detailsTransaction.accountName && (
									<div className="pt-2 border-t">
										<label className="text-xs text-muted-foreground">
											Account
										</label>
										<p className="text-sm font-medium flex items-center gap-2 mt-1">
											<Building2 className="h-4 w-4" />
											{detailsTransaction.accountName}
										</p>
									</div>
								)}

								{/* Reference Number */}
								{detailsTransaction.reference && (
									<div className="pt-2 border-t">
										<label className="text-xs text-muted-foreground">
											Reference Number
										</label>
										<p className="text-sm font-mono mt-1">
											{detailsTransaction.reference}
										</p>
									</div>
								)}

								{/* FX Details */}
								{detailsTransaction.exchangeRate &&
									detailsTransaction.baseCurrency !==
										detailsTransaction.currency && (
										<div className="pt-2 border-t">
											<label className="text-xs text-muted-foreground">
												Foreign Exchange
											</label>
											<div className="grid grid-cols-2 gap-4 mt-2">
												<div>
													<p className="text-xs text-muted-foreground">
														Exchange Rate
													</p>
													<p className="text-sm font-mono">
														1 {detailsTransaction.currency} ={" "}
														{detailsTransaction.exchangeRate.toFixed(4)}{" "}
														{detailsTransaction.baseCurrency}
													</p>
												</div>
												<div>
													<p className="text-xs text-muted-foreground">
														Converted Amount
													</p>
													<p className="text-sm font-mono">
														{formatCurrency(
															detailsTransaction.amount *
																detailsTransaction.exchangeRate,
															detailsTransaction.baseCurrency,
														)}
													</p>
												</div>
											</div>
										</div>
									)}

								{/* Fees */}
								{detailsTransaction.fees && detailsTransaction.fees > 0 && (
									<div className="pt-2 border-t">
										<label className="text-xs text-muted-foreground">
											Fees
										</label>
										<p className="text-sm font-medium text-orange-600 mt-1">
											{formatCurrency(
												detailsTransaction.fees,
												detailsTransaction.currency,
											)}
										</p>
									</div>
								)}

								{/* Transfer Info */}
								{detailsTransaction.type === "transfer" &&
									(detailsTransaction.fromAccount ||
										detailsTransaction.toAccount) && (
										<div className="pt-2 border-t">
											<label className="text-xs text-muted-foreground">
												Transfer Details
											</label>
											<p className="text-sm font-medium mt-1">
												{detailsTransaction.fromAccount} →{" "}
												{detailsTransaction.toAccount}
											</p>
										</div>
									)}

								{/* Category & Tags */}
								{(detailsTransaction.category ||
									detailsTransaction.tags?.length) && (
									<div className="pt-2 border-t">
										<label className="text-xs text-muted-foreground">
											Category & Tags
										</label>
										<div className="flex flex-wrap gap-1 mt-2">
											{detailsTransaction.category && (
												<Badge variant="secondary">
													{detailsTransaction.category}
												</Badge>
											)}
											{detailsTransaction.tags?.map((tag, idx) => (
												<Badge key={idx} variant="outline">
													{tag}
												</Badge>
											))}
										</div>
									</div>
								)}

								{/* Location */}
								{detailsTransaction.location && (
									<div className="pt-2 border-t">
										<label className="text-xs text-muted-foreground">
											Location
										</label>
										<p className="text-sm font-medium flex items-center gap-2 mt-1">
											<MapPin className="h-4 w-4" />
											{detailsTransaction.location}
										</p>
									</div>
								)}

								{/* Notes */}
								{detailsTransaction.notes && (
									<div className="pt-2 border-t">
										<label className="text-xs text-muted-foreground">
											Notes
										</label>
										<p className="text-sm mt-1">{detailsTransaction.notes}</p>
									</div>
								)}

								{/* Actions */}
								{onEditTransaction && (
									<div className="pt-4 flex gap-2 justify-end">
										<Button
											variant="outline"
											onClick={() => setDetailsTransaction(null)}
										>
											Close
										</Button>
										<Button
											onClick={() => {
												onEditTransaction(detailsTransaction);
												setDetailsTransaction(null);
											}}
										>
											<Edit className="h-4 w-4 mr-2" />
											Edit Transaction
										</Button>
									</div>
								)}
							</div>
						</DialogContent>
					</Dialog>
				)}
			</TooltipProvider>
		);
	}

	// CARD VIEW (Original expandable cards - for per-account view)
	return (
		<div className="space-y-2">
			{transactions.map((transaction) => {
				const isSelected = selectedIds.has(transaction.id);

				return (
					<Card
						key={transaction.id}
						className={`transition-colors ${isSelected ? "ring-2 ring-primary" : ""} cursor-pointer hover:bg-muted/50`}
						onClick={() => setDetailsTransaction(transaction)}
					>
						<CardContent className="p-4">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3 flex-1 min-w-0">
									{(transaction.merchantLogo || transaction.assetLogo) && (
										<Avatar className="h-10 w-10">
											<AvatarImage
												src={transaction.merchantLogo || transaction.assetLogo}
											/>
											<AvatarFallback>
												{(
													transaction.merchantName?.[0] ||
													transaction.assetSymbol?.[0] ||
													"?"
												).toUpperCase()}
											</AvatarFallback>
										</Avatar>
									)}
									<div className="flex-1 min-w-0">
										<h4 className="font-medium truncate">
											{transaction.merchantName ||
												transaction.assetName ||
												transaction.type.charAt(0).toUpperCase() +
													transaction.type.slice(1)}
										</h4>
										<p className="text-sm text-muted-foreground truncate">
											{formatDate(transaction.date)} • {transaction.accountName}
										</p>
									</div>
								</div>
								<div className="text-right">
									<div
										className={`font-mono ${getTypeColor(transaction.type)}`}
									>
										{["sell", "withdrawal", "fee"].includes(transaction.type)
											? "-"
											: "+"}
										{formatCurrency(transaction.amount, transaction.currency)}
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				);
			})}
		</div>
	);
}
