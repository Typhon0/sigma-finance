import { format } from "date-fns";
import {
	ArrowRight,
	BarChart3,
	Building2,
	Calendar as CalendarIcon,
	DollarSign,
	Hash,
	Info,
	RefreshCw,
	Search,
	TrendingUp,
	Wallet,
	X,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { InstrumentAssetType } from "@/gql/graphql";
import {
	TradeableInstrumentSearch,
	type TradeableInstrumentSelection,
} from "@/components/assets/tradeable-instrument-search";
import { Logo } from "./Logo";
import { usePortfolio } from "./PortfolioProvider";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";
import { Textarea } from "./ui/textarea";

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
}

interface FormData {
	symbol: string;
	name: string;
	type: "stock" | "fund" | "etf";
	quantity: string;
	averageBuyPrice: string;
	currentPrice: string;
	purchaseDate: Date | undefined;
}

interface StockItem {
	instrumentID?: string;
	symbol: string;
	name: string;
	type: "stock" | "fund" | "etf";
	exchange?: string;
	source?: "local" | "online";
	sector: string;
	price: number;
	matchedAlias?: string | null;
	score?: number;
}

const sectors = [
	"Technology",
	"Healthcare",
	"Financial Services",
	"Consumer Cyclical",
	"Consumer Defensive",
	"Energy",
	"Industrials",
	"Basic Materials",
	"Real Estate",
	"Utilities",
	"Communication Services",
	"Index Fund",
	"Other",
];

export function AddStockForm({ open, onClose, onSubmit }: AddStockFormProps) {
	const { assets } = usePortfolio();
	const [addType, setAddType] = useState<AddType>(null);
	const [selectedStock, setSelectedStock] = useState<StockItem | null>(null);

	const [formData, setFormData] = useState<FormData>({
		symbol: "",
		name: "",
		type: "stock",
		quantity: "",
		averageBuyPrice: "",
		currentPrice: "",
		purchaseDate: undefined,
	});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const instrumentSearchTypes: InstrumentAssetType[] = [
		InstrumentAssetType.Stock,
		InstrumentAssetType.Etf,
		InstrumentAssetType.Fund,
	];

	// Get available accounts from portfolio
	const availableAccounts = useMemo(() => {
		const accs = assets.filter((a) =>
			["bank", "savings", "securities"].includes(a.type),
		);
		// Also include manually added account names if unique
		const manualNames = [
			"Interactive Brokers",
			"Degiro",
			"Robinhood",
			"Revolut",
			"Charles Schwab",
			"Fidelity",
			"Vanguard",
		];
		const existingNames = new Set(accs.map((a) => a.name || a.accountName));

		return [
			...accs.map((a) => ({ id: a.id, name: a.name || a.accountName })),
			...manualNames
				.filter((n) => !existingNames.has(n))
				.map((n) => ({ id: n, name: n })),
		];
	}, [assets]);

	const handleInputChange = <K extends keyof FormData>(
		field: K,
		value: FormData[K],
	) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
	};

	const mapInstrumentAssetTypeToStockType = (
		assetType: InstrumentAssetType,
	): StockItem["type"] => {
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
		source: selection.source,
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
			}));
			return;
		}

		const stock = mapSelectionToStockItem(selection);
		setSelectedStock(stock);
		setFormData((prev) => ({
			...prev,
			symbol: stock.symbol,
			name: stock.name,
			type: stock.type,
			currentPrice: prev.currentPrice || prev.averageBuyPrice || "",
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
			if (
				!formData.averageBuyPrice ||
				parseFloat(formData.averageBuyPrice) <= 0
			) {
				toast.error("Please enter a valid purchase price");
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
				currentPrice:
					parseFloat(formData.currentPrice) ||
					parseFloat(formData.averageBuyPrice),
				purchaseDate: formData.purchaseDate?.toISOString(),
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
		});
		setSelectedStock(null);
		onClose();
	};

	if (!open) return null;

	const profitLoss = calculateProfitLoss();

	// Step 1: Choose add type
	const renderAddTypeSelection = () => (
		<>
			<div className="p-6 pb-4 border-b">
				<div className="flex items-center justify-between mb-4">
					<Logo compact />
					<Button variant="ghost" size="icon" onClick={handleClose}>
						<X className="h-5 w-5" />
					</Button>
				</div>

				<div disabled={isSubmitting}>
					<h2 className="text-2xl">Add Position</h2>
					<p className="text-sm text-muted-foreground mt-1">
						Add a stock, ETF, or fund to your portfolio
					</p>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto p-6">
				<div className="grid gap-4">
					{/* Broker Sync */}
					<button
						onClick={() => setAddType("sync")}
						className="group relative overflow-hidden rounded-lg border-2 border-border hover:border-primary transition-all p-6 text-left bg-card hover:bg-muted/50"
					>
						<div className="flex items-start gap-4">
							<div className="p-3 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
								<RefreshCw className="h-6 w-6" />
							</div>
							<div className="flex-1">
								<h3 className="font-medium mb-1">Broker Sync</h3>
								<p className="text-sm text-muted-foreground mb-3">
									Connect your brokerage account to automatically sync your
									positions
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
					</button>

					{/* Manual Entry */}
					<button
						onClick={() => setAddType("manual")}
						className="group relative overflow-hidden rounded-lg border-2 border-border hover:border-primary transition-all p-6 text-left bg-card hover:bg-muted/50"
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
									<span className="text-xs px-2 py-1 rounded bg-muted">
										Stocks
									</span>
									<span className="text-xs px-2 py-1 rounded bg-muted">
										ETFs
									</span>
									<span className="text-xs px-2 py-1 rounded bg-muted">
										Funds
									</span>
									<span className="text-xs px-2 py-1 rounded bg-muted">
										Full Control
									</span>
								</div>
							</div>
							<ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
						</div>
					</button>
				</div>
			</div>
		</>
	);

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
				<DialogTitle className="sr-only">Add Position</DialogTitle>
				<DialogDescription className="sr-only">
					Add a new stock or fund to your portfolio
				</DialogDescription>

				{!addType && renderAddTypeSelection()}

				{addType === "manual" && (
					<>
						<div className="p-6 pb-4 border-b flex-shrink-0">
							<div className="flex items-center justify-between mb-4">
								<Logo compact />
								<Button variant="ghost" size="icon" onClick={handleClose}>
									<X className="h-5 w-5" />
								</Button>
							</div>

							<div className="flex items-center gap-3">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setAddType(null)}
									className="gap-1 h-8 pl-1"
								>
									<ArrowRight className="h-4 w-4 rotate-180" />
									Back
								</Button>
								<div className="h-4 w-px bg-border" />
								<div>
									<h2 className="text-xl font-semibold">Manual Entry</h2>
									<p className="text-xs text-muted-foreground">
										Add a position to your portfolio
									</p>
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
											onChange={(selection) =>
												handleInstrumentChange(selection)
											}
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
														<Badge
															variant="secondary"
															className="text-[10px] font-normal h-5"
														>
															{selectedStock.type}
														</Badge>
													</h4>
													<p className="text-xs text-muted-foreground">
														{selectedStock.name}
													</p>
												</div>
											</div>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => handleInstrumentChange(null)}
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
													onChange={(e) =>
														handleInputChange("quantity", e.target.value)
													}
													className="font-mono"
													placeholder="0"
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor="price">Avg Price *</Label>
												<div className="relative">
													<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
														$
													</span>
													<Input
														id="price"
														type="number"
														step="0.01"
														value={formData.averageBuyPrice}
														onChange={(e) =>
															handleInputChange(
																"averageBuyPrice",
																e.target.value,
															)
														}
														className="font-mono pl-6"
														placeholder="0.00"
													/>
												</div>
											</div>
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
													>
														<CalendarIcon className="mr-2 h-4 w-4" />
														{formData.purchaseDate
															? format(formData.purchaseDate, "PPP")
															: "Today"}
													</Button>
												</PopoverTrigger>
												<PopoverContent className="w-auto p-0">
													<Calendar
														mode="single"
														selected={formData.purchaseDate}
														onSelect={(date) =>
															handleInputChange("purchaseDate", date)
														}
														initialFocus
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
														<span className="text-muted-foreground">
															Total Cost
														</span>
														<span className="font-mono font-medium">
															$
															{calculateTotalCost().toLocaleString(undefined, {
																minimumFractionDigits: 2,
															})}
														</span>
													</div>
													<div className="flex justify-between">
														<span className="text-muted-foreground">
															Current Value
														</span>
														<span className="font-mono font-medium">
															$
															{calculateTotalValue().toLocaleString(undefined, {
																minimumFractionDigits: 2,
															})}
														</span>
													</div>
													<div className="flex justify-between pt-2 border-t border-border/10">
														<span className="text-muted-foreground">
															Unrealized P&L
														</span>
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
							<Button variant="ghost" onClick={handleClose}>
								Cancel
							</Button>
							<Button
								onClick={handleSubmit}
								disabled={
									!selectedStock ||
									!formData.quantity ||
									!formData.averageBuyPrice
								}
							>
								Add Position
							</Button>
						</div>
					</>
				)}

				{addType === "sync" && (
					<div className="flex flex-col h-full">
						<div className="p-6 pb-4 border-b">
							<div className="flex items-center justify-between mb-4">
								<Logo compact />
								<Button variant="ghost" size="icon" onClick={handleClose}>
									<X className="h-5 w-5" />
								</Button>
							</div>
							<div className="flex items-center gap-3">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setAddType(null)}
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
								Direct broker integration is coming in the next update. Please
								use Manual Entry for now.
							</p>
							<Button onClick={() => setAddType("manual")}>
								Switch to Manual Entry
							</Button>
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
