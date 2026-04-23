import { format } from "date-fns";
import {
	ArrowRight,
	BarChart3,
	Calendar as CalendarIcon,
	RefreshCw,
	Search,
	TrendingUp,
	X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	TradeableInstrumentSearch,
	type TradeableInstrumentSelection,
} from "@/components/assets/tradeable-instrument-search";
import { InstrumentAssetType } from "@/gql/graphql";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { usePortfolio } from "./PortfolioProvider";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

interface AddStockFormProps {
	open: boolean;
	onClose: () => void;
	onSubmit: (data: AddStockFormSubmitData) => Promise<void> | void;
}

type AddType = "sync" | "manual" | null;

interface AddStockFormSubmitData {
	instrumentID?: string;
	symbol: string;
	name: string;
	type: "stock" | "fund" | "etf";
	quantity: number;
	averageBuyPrice: number;
	purchasePrice: number;
	currentPrice: number;
	purchaseDate?: string;
	quoteCurrency: string;
	unitPriceCurrency: string;
}

interface FormData {
	symbol: string;
	name: string;
	type: "stock" | "fund" | "etf";
	quantity: string;
	averageBuyPrice: string;
	currentPrice: string;
	purchaseDate: Date | undefined;
	quoteCurrency: string;
	unitPriceCurrency: string;
}

interface StockItem {
	instrumentID?: string;
	symbol: string;
	name: string;
	type: "stock" | "fund" | "etf";
	exchange?: string;
	currency?: string | null;
	source?: "local" | "online" | "manual";
	sector: string;
	price: number;
	matchedAlias?: string | null;
	score?: number;
}

const CURRENCIES = [
	{ value: "USD", label: "US Dollar (USD)", symbol: "$" },
	{ value: "EUR", label: "Euro (EUR)", symbol: "€" },
	{ value: "GBP", label: "British Pound (GBP)", symbol: "£" },
];

const SUPPORTED_CURRENCY_CODES = new Set(CURRENCIES.map((currency) => currency.value));

export function AddStockForm({ open, onClose, onSubmit }: AddStockFormProps) {
	const { user } = usePortfolio();
	const [addType, setAddType] = useState<AddType>(null);
	const [selectedStock, setSelectedStock] = useState<StockItem | null>(null);

	// Get user's display currency or default to USD
	const userDisplayCurrency = user?.displayCurrency || "USD";

	const [formData, setFormData] = useState<FormData>({
		symbol: "",
		name: "",
		type: "stock",
		quantity: "",
		averageBuyPrice: "",
		currentPrice: "",
		purchaseDate: undefined,
		quoteCurrency: userDisplayCurrency,
		unitPriceCurrency: userDisplayCurrency,
	});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const instrumentSearchTypes: InstrumentAssetType[] = [
		InstrumentAssetType.Stock,
		InstrumentAssetType.Etf,
		InstrumentAssetType.Fund,
	];

	const handleInputChange = <K extends keyof FormData>(field: K, value: FormData[K]) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
	};

	const mapInstrumentAssetTypeToStockType = (assetType: InstrumentAssetType): StockItem["type"] => {
		switch (assetType) {
			case InstrumentAssetType.Etf:
				return "etf";
			case InstrumentAssetType.Fund:
				return "fund";
			default:
				return "stock";
		}
	};

	const mapSelectionToStockItem = (selection: TradeableInstrumentSelection): StockItem => ({
		instrumentID: selection.id,
		symbol: selection.symbol,
		name: selection.name,
		type: mapInstrumentAssetTypeToStockType(selection.assetType),
		exchange: selection.exchange,
		currency: selection.currency ?? null,
		source: selection.source as "local" | "online" | "manual" | undefined,
		sector: "Other",
		price: 0,
	});

	const handleInstrumentChange = (selection: TradeableInstrumentSelection | null) => {
		if (!selection) {
			setSelectedStock(null);
			setFormData((prev) => ({
				...prev,
				symbol: "",
				name: "",
				type: "stock",
				currentPrice: "",
				quoteCurrency: userDisplayCurrency,
				unitPriceCurrency: userDisplayCurrency,
			}));
			return;
		}

		const stock = mapSelectionToStockItem(selection);
		const instrumentCurrency = (stock.currency ?? "").toUpperCase();
		const resolvedCurrency = SUPPORTED_CURRENCY_CODES.has(instrumentCurrency)
			? instrumentCurrency
			: "";
		setSelectedStock(stock);
		setFormData((prev) => ({
			...prev,
			symbol: stock.symbol,
			name: stock.name,
			type: stock.type,
			currentPrice: prev.currentPrice || prev.averageBuyPrice || "",
			quoteCurrency: resolvedCurrency || prev.quoteCurrency,
			unitPriceCurrency: resolvedCurrency || prev.unitPriceCurrency,
		}));
	};

	const calculateTotalValue = () => {
		const qty = parseFloat(formData.quantity || "0");
		const price = parseFloat(formData.currentPrice || "0");
		return qty * price;
	};

	const calculateTotalCost = () => {
		const qty = parseFloat(formData.quantity || "0");
		const avgPrice = parseFloat(formData.averageBuyPrice || "0");
		return qty * avgPrice;
	};

	const calculateProfitLoss = () => {
		const totalValue = calculateTotalValue();
		const totalCost = calculateTotalCost();
		const diff = totalValue - totalCost;
		const percent = totalCost > 0 ? (diff / totalCost) * 100 : 0;
		return { amount: diff, percent };
	};

	const getCurrencySymbol = (currencyCode: string): string => {
		const currency = CURRENCIES.find((c) => c.value === currencyCode);
		return currency?.symbol || "$";
	};

	const handleSubmit = async () => {
		setIsSubmitting(true);
		try {
			if (!formData.symbol) {
				toast.error("Please enter a symbol");
				return;
			}
			if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
				toast.error("Please enter a valid quantity");
				return;
			}
			if (!formData.averageBuyPrice || parseFloat(formData.averageBuyPrice) <= 0) {
				toast.error("Please enter a valid purchase price");
				return;
			}
			if (!SUPPORTED_CURRENCY_CODES.has(formData.quoteCurrency)) {
				toast.error("Please select a valid quote currency");
				return;
			}
			if (!SUPPORTED_CURRENCY_CODES.has(formData.unitPriceCurrency)) {
				toast.error("Please select a valid average buy price currency");
				return;
			}

			await onSubmit({
				instrumentID: selectedStock?.instrumentID,
				symbol: formData.symbol,
				name: formData.name,
				type: formData.type,
				quantity: parseFloat(formData.quantity),
				averageBuyPrice: parseFloat(formData.averageBuyPrice),
				purchasePrice: parseFloat(formData.averageBuyPrice),
				currentPrice: parseFloat(formData.currentPrice) || parseFloat(formData.averageBuyPrice),
				purchaseDate: formData.purchaseDate?.toISOString(),
				quoteCurrency: formData.quoteCurrency,
				unitPriceCurrency: formData.unitPriceCurrency,
			});
			handleClose(); // Only close on success
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleClose = () => {
		setAddType(null);
		setFormData({
			symbol: "",
			name: "",
			type: "stock",
			quantity: "",
			averageBuyPrice: "",
			currentPrice: "",
			purchaseDate: undefined,
			quoteCurrency: userDisplayCurrency,
			unitPriceCurrency: userDisplayCurrency,
		});
		setSelectedStock(null);
		onClose();
	};

	if (!open) return null;

	const profitLoss = calculateProfitLoss();
	const currencySymbol = getCurrencySymbol(formData.unitPriceCurrency);
	const selectedInstrumentCurrency = (selectedStock?.currency ?? "").toUpperCase();

	// Step 1: Choose add type
	const renderAddTypeSelection = () => (
		<>
			<div className="p-6 pb-4 border-b">
				<div className="flex items-center justify-between mb-4">
					<Logo />
					<Button variant="ghost" size="icon" onClick={handleClose}>
						<X className="h-5 w-5" />
					</Button>
				</div>

				<div>
					<h2 className="text-2xl">Add Position</h2>
					<p className="text-sm text-muted-foreground mt-1">
						Add a stock, ETF, or fund to your portfolio
					</p>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto p-6">
				<div className="grid gap-4">
					{/* Broker Sync */}
					<div
						role="button"
						tabIndex={0}
						aria-disabled={isSubmitting}
						onClick={() => setAddType("sync")}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") setAddType("sync");
						}}
						className={cn(
							"group relative overflow-hidden rounded-lg border-2 border-border hover:border-primary transition-all p-6 text-left bg-card hover:bg-muted/50 cursor-pointer w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
							isSubmitting && "opacity-50 pointer-events-none",
						)}
					>
						<div className="flex items-start gap-4">
							<div className="p-3 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
								<RefreshCw className="h-6 w-6" />
							</div>
							<div className="flex-1">
								<h3 className="font-medium mb-1">Broker Sync</h3>
								<p className="text-sm text-muted-foreground mb-3">
									Connect your brokerage account to automatically sync your positions
								</p>
								<div className="flex flex-wrap gap-2">
									<Badge variant="secondary" className="font-normal text-xs">
										Interactive Brokers
									</Badge>
									<Badge variant="secondary" className="font-normal text-xs">
										Robinhood
									</Badge>
									<Badge variant="secondary" className="font-normal text-xs">
										Degiro
									</Badge>
									<Badge variant="secondary" className="font-normal text-xs">
										+20 more
									</Badge>
								</div>
							</div>
							<ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
						</div>
					</div>

					{/* Manual Entry */}
					<div
						role="button"
						tabIndex={0}
						aria-disabled={isSubmitting}
						onClick={() => setAddType("manual")}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") setAddType("manual");
						}}
						className={cn(
							"group relative overflow-hidden rounded-lg border-2 border-border hover:border-primary transition-all p-6 text-left bg-card hover:bg-muted/50 cursor-pointer w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
							isSubmitting && "opacity-50 pointer-events-none",
						)}
					>
						<div className="flex items-start gap-4">
							<div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
								<BarChart3 className="h-6 w-6" />
							</div>
							<div className="flex-1">
								<h3 className="font-medium mb-1">Manual Entry</h3>
								<p className="text-sm text-muted-foreground mb-3">
									Manually add a single stock or fund holding
								</p>
								<div className="flex flex-wrap gap-2">
									<span className="text-xs px-2 py-1 rounded bg-muted">Stocks</span>
									<span className="text-xs px-2 py-1 rounded bg-muted">ETFs</span>
									<span className="text-xs px-2 py-1 rounded bg-muted">Funds</span>
									<span className="text-xs px-2 py-1 rounded bg-muted">Full Control</span>
								</div>
							</div>
							<ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
						</div>
					</div>
				</div>
			</div>
		</>
	);

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent
				showCloseButton={false}
				className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0"
			>
				<DialogTitle className="sr-only">Add Position</DialogTitle>
				<DialogDescription className="sr-only">
					Add a new stock or fund to your portfolio
				</DialogDescription>

				{!addType && renderAddTypeSelection()}

				{addType === "manual" && (
					<>
						<div className="p-6 pb-4 border-b flex-shrink-0">
							<div className="flex items-center justify-between mb-4">
								<Logo />
								<Button variant="ghost" size="icon" onClick={handleClose}>
									<X className="h-5 w-5" />
								</Button>
							</div>

							<div className="flex items-center gap-3">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setAddType(null)}
									disabled={isSubmitting}
									className="gap-1 h-8 pl-1"
								>
									<ArrowRight className="h-4 w-4 rotate-180" />
									Back
								</Button>
								<div className="h-4 w-px bg-border" />
								<div>
									<h2 className="text-xl font-semibold">Manual Entry</h2>
									<p className="text-xs text-muted-foreground">Add a position to your portfolio</p>
								</div>
							</div>
						</div>

						<div className="flex-1 overflow-y-auto px-6 py-6">
							<div className="space-y-6">
								{/* 1. Asset Selection */}
								<div className="space-y-3">
									<Label className="flex items-center gap-2">
										<Search className="h-4 w-4 text-primary" />
										Select Asset <span className="text-destructive">*</span>
									</Label>

									{!selectedStock ? (
										<TradeableInstrumentSearch
											assetTypes={instrumentSearchTypes}
											value={null}
											onChange={(selection) => handleInstrumentChange(selection)}
											placeholder="Search stock, ETF, or fund..."
										/>
									) : (
										<div className="bg-muted/30 border rounded-lg p-4 flex items-center justify-between">
											<div className="flex items-center gap-3">
												<div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center font-bold text-lg text-primary">
													{selectedStock.symbol.substring(0, 1)}
												</div>
												<div>
													<h4 className="font-bold flex items-center gap-2">
														{selectedStock.symbol}
														<Badge variant="secondary" className="text-[10px] font-normal h-5">
															{selectedStock.type}
														</Badge>
													</h4>
													<p className="text-xs text-muted-foreground">{selectedStock.name}</p>
													<div className="mt-1 flex items-center gap-2">
														{selectedStock.exchange ? (
															<Badge variant="outline" className="text-[10px] h-5 font-normal">
																{selectedStock.exchange}
															</Badge>
														) : null}
														{SUPPORTED_CURRENCY_CODES.has(selectedInstrumentCurrency) ? (
															<Badge variant="secondary" className="text-[10px] h-5 font-normal">
																Quote: {selectedInstrumentCurrency}
															</Badge>
														) : null}
													</div>
												</div>
											</div>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => handleInstrumentChange(null)}
												disabled={isSubmitting}
											>
												Change
											</Button>
										</div>
									)}
								</div>

								{selectedStock && (
									<div className="space-y-6 animate-in slide-in-from-bottom-5 fade-in duration-300">
										{/* 2. Position Details */}
										<div className="grid grid-cols-2 gap-4">
											<div className="space-y-2">
												<Label htmlFor="quantity">Quantity *</Label>
												<Input
													id="quantity"
													type="number"
													step="0.0001"
													value={formData.quantity}
													onChange={(e) => handleInputChange("quantity", e.target.value)}
													className="font-mono"
													placeholder="0"
													disabled={isSubmitting}
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor="price">Avg Price *</Label>
												<div className="relative">
													<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
														{currencySymbol}
													</span>
													<Input
														id="price"
														type="number"
														step="0.01"
														value={formData.averageBuyPrice}
														onChange={(e) => handleInputChange("averageBuyPrice", e.target.value)}
														className="font-mono pl-6"
														placeholder="0.00"
														disabled={isSubmitting}
													/>
												</div>
											</div>
										</div>

										{/* Holding Quote Currency (locked by instrument) */}
										<div className="space-y-2">
											<Label htmlFor="quoteCurrency">Quote Currency (Live Market)</Label>
											<Select
												value={formData.quoteCurrency}
												onValueChange={(value) => handleInputChange("quoteCurrency", value)}
												disabled={true}
											>
												<SelectTrigger id="quoteCurrency" className="w-full">
													<SelectValue placeholder="Select currency" />
												</SelectTrigger>
												<SelectContent>
													{CURRENCIES.map((currency) => (
														<SelectItem key={currency.value} value={currency.value}>
															{currency.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											<p className="text-xs text-muted-foreground">
												Quote currency is derived from the selected instrument and is used for live
												valuation.
											</p>
										</div>

										{/* Transaction currency for cost basis */}
										<div className="space-y-2">
											<Label htmlFor="unitPriceCurrency">Average Buy Price Currency</Label>
											<Select
												value={formData.unitPriceCurrency}
												onValueChange={(value) => handleInputChange("unitPriceCurrency", value)}
												disabled={isSubmitting}
											>
												<SelectTrigger id="unitPriceCurrency" className="w-full">
													<SelectValue placeholder="Select currency" />
												</SelectTrigger>
												<SelectContent>
													{CURRENCIES.map((currency) => (
														<SelectItem key={currency.value} value={currency.value}>
															{currency.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											<p className="text-xs text-muted-foreground">
												Use the broker execution currency (for example EUR on Trade Republic).
											</p>
										</div>

										<div className="grid grid-cols-2 gap-4">
											<div className="space-y-2">
												<Label>Sector</Label>
												<div className="text-sm text-muted-foreground pl-3 border-l-2 border-muted">
													{selectedStock?.sector || "Other"}
												</div>
											</div>
										</div>

										<div className="space-y-2">
											<Label>Date</Label>
											<Popover>
												<PopoverTrigger asChild>
													<Button
														variant="outline"
														className="w-full justify-start text-left font-normal"
														disabled={isSubmitting}
													>
														<CalendarIcon className="mr-2 h-4 w-4" />
														{formData.purchaseDate ? format(formData.purchaseDate, "PPP") : "Today"}
													</Button>
												</PopoverTrigger>
												<PopoverContent className="w-auto p-0">
													<Calendar
														mode="single"
														selected={formData.purchaseDate}
														onSelect={(date) => handleInputChange("purchaseDate", date)}
														autoFocus
													/>
												</PopoverContent>
											</Popover>
										</div>

										{/* Summary Card */}
										{formData.quantity && formData.averageBuyPrice && (
											<div className="rounded-lg bg-primary/5 border border-primary/20 p-4 space-y-3">
												<h4 className="text-sm font-medium flex items-center gap-2">
													<TrendingUp className="h-4 w-4" /> Summary
												</h4>
												<div className="space-y-2 text-sm">
													<div className="flex justify-between">
														<span className="text-muted-foreground">Total Cost</span>
														<span className="font-mono font-medium">
															{currencySymbol}
															{calculateTotalCost().toLocaleString(undefined, {
																minimumFractionDigits: 2,
															})}
														</span>
													</div>
													<div className="flex justify-between">
														<span className="text-muted-foreground">Current Value</span>
														<span className="font-mono font-medium">
															{currencySymbol}
															{calculateTotalValue().toLocaleString(undefined, {
																minimumFractionDigits: 2,
															})}
														</span>
													</div>
													<div className="flex justify-between pt-2 border-t border-border/10">
														<span className="text-muted-foreground">Unrealized P&L</span>
														<span
															className={`font-mono font-medium ${profitLoss.amount >= 0 ? "text-emerald-500" : "text-rose-500"}`}
														>
															{profitLoss.amount >= 0 ? "+" : ""}
															{profitLoss.amount.toLocaleString(undefined, {
																minimumFractionDigits: 2,
															})}{" "}
															({profitLoss.percent.toFixed(2)}%)
														</span>
													</div>
												</div>
											</div>
										)}
									</div>
								)}
							</div>
						</div>

						<div className="p-4 border-t bg-muted/20 flex justify-end gap-3 flex-shrink-0">
							<Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
								Cancel
							</Button>
							<Button
								onClick={handleSubmit}
								disabled={
									isSubmitting || !selectedStock || !formData.quantity || !formData.averageBuyPrice
								}
							>
								{isSubmitting ? "Adding..." : "Add Position"}
							</Button>
						</div>
					</>
				)}

				{addType === "sync" && (
					<div className="flex flex-col h-full">
						<div className="p-6 pb-4 border-b">
							<div className="flex items-center justify-between mb-4">
								<Logo />
								<Button variant="ghost" size="icon" onClick={handleClose}>
									<X className="h-5 w-5" />
								</Button>
							</div>
							<div className="flex items-center gap-3">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setAddType(null)}
									disabled={isSubmitting}
									className="gap-1 pl-1"
								>
									<ArrowRight className="h-4 w-4 rotate-180" /> Back
								</Button>
								<div className="h-4 w-px bg-border" />
								<h2 className="text-xl font-semibold">Connect Broker</h2>
							</div>
						</div>
						<div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
							<div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
								<RefreshCw className="h-8 w-8 text-muted-foreground animate-pulse" />
							</div>
							<h3 className="text-lg font-medium">Coming Soon</h3>
							<p className="text-muted-foreground max-w-xs">
								Direct broker integration is coming in the next update. Please use Manual Entry for
								now.
							</p>
							<Button onClick={() => setAddType("manual")} disabled={isSubmitting}>
								Switch to Manual Entry
							</Button>
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
