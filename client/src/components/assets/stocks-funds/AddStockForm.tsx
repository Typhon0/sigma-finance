import { ArrowRight, BarChart3, RefreshCw, Search, TrendingUp, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
	TradeableInstrumentSearch,
	type TradeableInstrumentSelection,
} from "@/components/assets/tradeable-instrument-search";
import { Logo } from "@/components/Logo";
import { usePortfolio } from "@/components/PortfolioProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { InstrumentAssetType } from "@/gql/graphql";
import { cn } from "@/lib/utils";

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
	const detailsRef = useRef<HTMLDivElement>(null);

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

	useEffect(() => {
		if (selectedStock && detailsRef.current) {
			detailsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
		}
	}, [selectedStock]);

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
		sector: selection.sector?.trim() || "Other",
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
		<div className="flex flex-col flex-1 min-h-0">
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

			<div className="flex-1 min-h-0 overflow-y-auto p-6">
				<div className="grid gap-4">
					{/* Broker Sync */}
					{/* biome-ignore lint/a11y/useSemanticElements: unavoidable */}
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
					{/* biome-ignore lint/a11y/useSemanticElements: unavoidable */}
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
		</div>
	);

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent
				showCloseButton={false}
				className="max-w-6xl max-h-[90vh] overflow-hidden !flex !flex-col p-0 gap-0 duration-100"
			>
				<DialogTitle className="sr-only">Add Position</DialogTitle>
				<DialogDescription className="sr-only">
					Add a new stock or fund to your portfolio
				</DialogDescription>

				{!addType && renderAddTypeSelection()}

				{addType === "manual" && (
					<div className="flex flex-col flex-1 min-h-0">
						<div className="p-6 pb-4 border-b flex-shrink-0 bg-background/50 backdrop-blur-sm">
							<div className="flex items-center justify-end">
								<Button variant="ghost" size="icon" onClick={handleClose} className="rounded-lg">
									<X className="h-5 w-5" />
								</Button>
							</div>

							<div className="flex items-center gap-3">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setAddType(null)}
									disabled={isSubmitting}
									className="gap-1 h-8 pl-1 rounded-lg"
								>
									<ArrowRight className="h-4 w-4 rotate-180" />
									Back
								</Button>
								<div className="h-4 w-px bg-border" />
								<div>
									<h2 className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/75 bg-clip-text text-transparent">
										Manual Entry
									</h2>
									<p className="text-xs text-muted-foreground mt-0.5">
										Add a position to your portfolio
									</p>
								</div>
							</div>
						</div>

						<div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
							<div className="space-y-6">
								{/* 1. Asset Selection */}
								<div className="space-y-3">
									<Label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider">
										<Search className="h-3.5 w-3.5 text-primary" />
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
										<div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-xl p-4 flex items-center justify-between shadow-sm animate-in fade-in zoom-in-95 duration-75">
											<div className="flex items-center gap-3">
												<div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-xl text-primary border border-primary/20">
													{selectedStock.symbol.substring(0, 1)}
												</div>
												<div>
													<h4 className="font-bold flex items-center gap-2 text-base text-foreground">
														{selectedStock.symbol}
														<Badge
															variant="secondary"
															className="text-[10px] font-semibold px-2 py-0.5 uppercase bg-primary/5 border border-primary/20 text-primary"
														>
															{selectedStock.type}
														</Badge>
													</h4>
													<p className="text-xs text-muted-foreground mt-0.5">
														{selectedStock.name}
													</p>
													<div className="mt-1.5 flex items-center gap-2 flex-wrap">
														{selectedStock.exchange ? (
															<Badge
																variant="outline"
																className="text-[10px] h-5 font-normal px-2 bg-muted/30"
															>
																{selectedStock.exchange}
															</Badge>
														) : null}
														{SUPPORTED_CURRENCY_CODES.has(selectedInstrumentCurrency) ? (
															<Badge
																variant="secondary"
																className="text-[10px] h-5 font-normal px-2 bg-muted"
															>
																Quote: {selectedInstrumentCurrency}
															</Badge>
														) : null}
													</div>
												</div>
											</div>
											<Button
												variant="outline"
												size="sm"
												onClick={() => handleInstrumentChange(null)}
												disabled={isSubmitting}
												className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-all rounded-lg"
											>
												Change
											</Button>
										</div>
									)}
								</div>

								{selectedStock && (
									<div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-bottom-2 fade-in duration-100">
										{/* 2. Position Details - Left Column */}
										<div className="lg:col-span-7 space-y-5">
											<div className="p-5 border border-border/60 bg-muted/10 rounded-xl space-y-5">
												<h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60">
													Position Details
												</h3>

												<div className="grid grid-cols-2 gap-4">
													<div className="space-y-2">
														<Label htmlFor="quantity" className="text-xs font-semibold">
															Quantity *
														</Label>
														<Input
															id="quantity"
															type="number"
															step="0.0001"
															value={formData.quantity}
															onChange={(e) => handleInputChange("quantity", e.target.value)}
															className="font-mono h-10 rounded-lg"
															placeholder="0"
															disabled={isSubmitting}
														/>
													</div>
													<div className="space-y-2">
														<Label htmlFor="price" className="text-xs font-semibold">
															Avg Price *
														</Label>
														<div className="relative">
															<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">
																{currencySymbol}
															</span>
															<Input
																id="price"
																type="number"
																step="0.01"
																value={formData.averageBuyPrice}
																onChange={(e) =>
																	handleInputChange("averageBuyPrice", e.target.value)
																}
																className="font-mono pl-7 h-10 rounded-lg"
																placeholder="0.00"
																disabled={isSubmitting}
															/>
														</div>
													</div>
												</div>

												{/* Holding Quote Currency (locked by instrument) */}
												<div className="space-y-2">
													<Label htmlFor="quoteCurrency" className="text-xs font-semibold">
														Quote Currency (Live Market)
													</Label>
													<Select
														value={formData.quoteCurrency}
														onValueChange={(value) => handleInputChange("quoteCurrency", value)}
														disabled={true}
													>
														<SelectTrigger id="quoteCurrency" className="w-full h-10 rounded-lg">
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
													<p className="text-[10px] text-muted-foreground/80 leading-relaxed">
														Quote currency is derived from the selected instrument and is used for
														live valuation.
													</p>
												</div>

												{/* Transaction currency for cost basis */}
												<div className="space-y-2">
													<Label htmlFor="unitPriceCurrency" className="text-xs font-semibold">
														Average Buy Price Currency
													</Label>
													<Select
														value={formData.unitPriceCurrency}
														onValueChange={(value) => handleInputChange("unitPriceCurrency", value)}
														disabled={isSubmitting}
													>
														<SelectTrigger
															id="unitPriceCurrency"
															className="w-full h-10 rounded-lg"
														>
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
													<p className="text-[10px] text-muted-foreground/80 leading-relaxed">
														Use the broker execution currency (for example EUR on Trade Republic).
													</p>
												</div>

												<div className="grid grid-cols-2 gap-4 pt-2">
													<div className="space-y-1">
														<span className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wide">
															Sector
														</span>
														<div className="text-xs font-medium text-foreground/90 pl-3 border-l-2 border-primary/40 py-0.5">
															{selectedStock?.sector || "Other"}
														</div>
													</div>
													<div className="space-y-2">
														<Label className="text-xs font-semibold">Purchase Date</Label>
														<DatePicker
															date={formData.purchaseDate}
															onChange={(date) => handleInputChange("purchaseDate", date)}
															disabled={isSubmitting}
														/>
													</div>
												</div>
											</div>
										</div>

										{/* Interactive Realtime Summary - Right Column */}
										<div className="lg:col-span-5 h-full">
											{formData.quantity && formData.averageBuyPrice ? (
												<div className="rounded-xl border border-primary/20 bg-gradient-to-b from-primary/10 via-card to-card p-5 space-y-5 shadow-lg relative overflow-hidden group hover:border-primary/30 transition-all duration-300">
													<div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full filter blur-xl opacity-70 group-hover:scale-150 transition-transform duration-500 pointer-events-none" />

													<div className="flex items-center justify-between border-b border-border/40 pb-3">
														<h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1.5 select-none">
															<TrendingUp className="h-4 w-4 text-primary" /> Valuation Projection
														</h4>
														<Badge
															variant="outline"
															className="text-[9px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border-emerald-500/25 py-0.5 px-2 select-none"
														>
															Live Preview
														</Badge>
													</div>

													<div className="space-y-4">
														<div>
															<span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider block mb-1">
																Projected Position Value
															</span>
															<span className="text-3xl font-extrabold tracking-tight text-foreground font-mono">
																{currencySymbol}
																{calculateTotalValue().toLocaleString(undefined, {
																	minimumFractionDigits: 2,
																	maximumFractionDigits: 2,
																})}
															</span>
														</div>

														<div className="grid grid-cols-2 gap-4 py-3 border-y border-border/40 bg-muted/20 px-3.5 rounded-lg">
															<div>
																<span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider block">
																	Total Cost
																</span>
																<span className="text-sm font-semibold text-foreground/90 font-mono">
																	{currencySymbol}
																	{calculateTotalCost().toLocaleString(undefined, {
																		minimumFractionDigits: 2,
																		maximumFractionDigits: 2,
																	})}
																</span>
															</div>
															<div>
																<span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider block">
																	Position Size
																</span>
																<span
																	className="text-sm font-semibold text-foreground/90 font-mono truncate block"
																	title={`${formData.quantity} ${selectedStock.symbol}`}
																>
																	{parseFloat(formData.quantity).toLocaleString(undefined, {
																		maximumFractionDigits: 4,
																	})}{" "}
																	{selectedStock.symbol}
																</span>
															</div>
														</div>

														<div className="flex items-center justify-between pt-1">
															<div>
																<span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider block">
																	Unrealized profit & loss
																</span>
																<span
																	className={`text-lg font-bold font-mono flex items-center ${profitLoss.amount >= 0 ? "text-emerald-400" : "text-rose-400"}`}
																>
																	{profitLoss.amount >= 0 ? "+" : ""}
																	{profitLoss.amount.toLocaleString(undefined, {
																		minimumFractionDigits: 2,
																		maximumFractionDigits: 2,
																	})}
																</span>
															</div>
															<div
																className={cn(
																	"px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono shadow-sm select-none",
																	profitLoss.amount >= 0
																		? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
																		: "bg-rose-500/10 text-rose-400 border border-rose-500/25",
																)}
															>
																{profitLoss.amount >= 0 ? "+" : ""}
																{profitLoss.percent.toFixed(2)}%
															</div>
														</div>
													</div>
												</div>
											) : (
												<div className="h-full min-h-[220px] rounded-xl border border-dashed border-border/60 bg-muted/5 flex flex-col items-center justify-center p-6 text-center select-none text-muted-foreground/40">
													<TrendingUp className="h-10 w-10 mb-3 stroke-[1.2] text-muted-foreground/20 animate-pulse" />
													<p className="text-xs font-medium max-w-[180px]">
														Enter quantity and average purchase price to preview your investment
														valuation
													</p>
												</div>
											)}
										</div>
									</div>
								)}
							</div>
						</div>

						<div className="p-4 border-t bg-muted/20 flex justify-end gap-3 flex-shrink-0 rounded-b-xl">
							<Button
								variant="ghost"
								onClick={handleClose}
								disabled={isSubmitting}
								className="rounded-lg"
							>
								Cancel
							</Button>
							<Button
								onClick={handleSubmit}
								disabled={
									isSubmitting || !selectedStock || !formData.quantity || !formData.averageBuyPrice
								}
								className="rounded-lg px-6 font-semibold"
							>
								{isSubmitting ? "Adding..." : "Add Position"}
							</Button>
						</div>
					</div>
				)}

				{addType === "sync" && (
					<div className="flex flex-col flex-1 min-h-0">
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
