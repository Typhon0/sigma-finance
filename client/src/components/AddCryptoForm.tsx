import { format } from "date-fns";
import {
	ArrowRight,
	Bitcoin,
	Calendar as CalendarIcon,
	Coins,
	DollarSign,
	Euro,
	Hash,
	Info,
	Link2,
	PoundSterling,
	RefreshCw,
	TrendingUp,
	Wallet,
	X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	TradeableInstrumentSearch,
	type TradeableInstrumentSelection,
} from "@/components/assets/tradeable-instrument-search";
import { InstrumentAssetType } from "@/gql/graphql";
import { Logo } from "./Logo";
import { usePortfolio } from "./PortfolioProvider";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import { Card } from "./ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";

interface AddCryptoFormProps {
	open: boolean;
	onClose: () => void;
	onSubmit: (data: AddCryptoFormSubmitData) => Promise<void> | void;
}

type AddType = "exchange" | "wallet" | "manual" | null;

interface AddCryptoFormSubmitData {
	instrumentID?: string;
	cryptoId: string;
	cryptoName: string;
	symbol: string;
	quantity: number;
	averageBuyPrice: number;
	currentPrice: number;
	purchaseDate?: string;
	walletAddress: string;
	notes: string;
	quoteCurrency: string;
}

type SupportedCurrency = "USD" | "EUR" | "GBP";

interface FormData {
	instrumentID: string;
	cryptoId: string;
	cryptoName: string;
	symbol: string;
	quantity: string;
	averageBuyPrice: string;
	currentPrice: string;
	purchaseDate: Date | undefined;
	walletAddress: string;
	notes: string;
	quoteCurrency: SupportedCurrency;
}

const CURRENCIES = [
	{ value: "USD", label: "US Dollar (USD)", symbol: "$", icon: DollarSign },
	{ value: "EUR", label: "Euro (EUR)", symbol: "€", icon: Euro },
	{
		value: "GBP",
		label: "British Pound (GBP)",
		symbol: "£",
		icon: PoundSterling,
	},
] as const;

const SUPPORTED_CURRENCIES = new Set(CURRENCIES.map((currency) => currency.value));

export function AddCryptoForm({ open, onClose, onSubmit }: AddCryptoFormProps) {
	const { user } = usePortfolio();
	const [addType, setAddType] = useState<AddType>(null);
	const [selectedCrypto, setSelectedCrypto] = useState<TradeableInstrumentSelection | null>(null);
	const userDisplayCurrency = (user?.displayCurrency ?? "USD").toUpperCase();
	const [formData, setFormData] = useState<FormData>({
		instrumentID: "",
		cryptoId: "",
		cryptoName: "",
		symbol: "",
		quantity: "",
		averageBuyPrice: "",
		currentPrice: "",
		purchaseDate: undefined,
		walletAddress: "",
		notes: "",
		quoteCurrency: (SUPPORTED_CURRENCIES.has(userDisplayCurrency)
			? userDisplayCurrency
			: "USD") as SupportedCurrency,
	});

	const handleInputChange = <K extends keyof FormData>(field: K, value: FormData[K]) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
	};

	const handleSelectCrypto = (crypto: TradeableInstrumentSelection) => {
		const instrumentCurrency = (crypto.currency ?? "").toUpperCase();
		const resolvedCurrency = SUPPORTED_CURRENCIES.has(instrumentCurrency as SupportedCurrency)
			? (instrumentCurrency as SupportedCurrency)
			: "";
		setSelectedCrypto(crypto);
		setFormData((prev) => ({
			...prev,
			instrumentID: crypto.id,
			cryptoId: crypto.id,
			cryptoName: crypto.name,
			symbol: crypto.symbol,
			currentPrice: prev.currentPrice || "",
			quoteCurrency: resolvedCurrency || prev.quoteCurrency,
		}));
	};

	const selectedCryptoDisplay = selectedCrypto
		? {
				symbol: selectedCrypto.symbol,
				name: selectedCrypto.name,
				exchange: selectedCrypto.exchange,
				providerSource: selectedCrypto.providerSource,
				currency: selectedCrypto.currency,
			}
		: null;

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
		const currency = CURRENCIES.find((item) => item.value === currencyCode);
		return currency?.symbol ?? "$";
	};

	const handleSubmit = async () => {
		// Validation
		if (!formData.cryptoId) {
			toast.error("Please select a cryptocurrency");
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
		if (!SUPPORTED_CURRENCIES.has(formData.quoteCurrency)) {
			toast.error("Please select a valid quote currency");
			return;
		}

		await onSubmit({
			instrumentID: formData.instrumentID || undefined,
			cryptoId: formData.cryptoId,
			cryptoName: formData.cryptoName,
			symbol: formData.symbol,
			quantity: parseFloat(formData.quantity),
			averageBuyPrice: parseFloat(formData.averageBuyPrice),
			currentPrice: parseFloat(formData.currentPrice) || parseFloat(formData.averageBuyPrice),
			purchaseDate: formData.purchaseDate?.toISOString(),
			walletAddress: formData.walletAddress,
			notes: formData.notes,
			quoteCurrency: formData.quoteCurrency,
		});
		handleClose();
	};

	const handleClose = () => {
		setAddType(null);
		setFormData({
			instrumentID: "",
			cryptoId: "",
			cryptoName: "",
			symbol: "",
			quantity: "",
			averageBuyPrice: "",
			currentPrice: "",
			purchaseDate: undefined,
			walletAddress: "",
			notes: "",
			quoteCurrency: (SUPPORTED_CURRENCIES.has(userDisplayCurrency)
				? userDisplayCurrency
				: "USD") as SupportedCurrency,
		});
		setSelectedCrypto(null);
		onClose();
	};

	if (!open) return null;

	const profitLoss = calculateProfitLoss();
	const selectedInstrumentCurrency = (selectedCrypto?.currency ?? "").toUpperCase();
	const isQuoteCurrencyLocked =
		!!selectedCrypto &&
		selectedCrypto.source !== "manual" &&
		SUPPORTED_CURRENCIES.has(selectedInstrumentCurrency as SupportedCurrency);
	const currencySymbol = getCurrencySymbol(formData.quoteCurrency);

	// Step 1: Choose add type
	const renderAddTypeSelection = () => (
		<>
			{/* Header */}
			<div className="p-6 pb-4 border-b">
				<div className="flex items-center justify-between mb-4">
					<Logo compact />
					<Button variant="ghost" size="icon" onClick={handleClose}>
						<X className="h-5 w-5" />
					</Button>
				</div>

				<div>
					<h2 className="text-2xl">Add Cryptocurrency</h2>
					<p className="text-sm text-muted-foreground mt-1">
						Choose how you want to add crypto to your portfolio
					</p>
				</div>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto p-6">
				<div className="grid gap-4">
					{/* Exchange Sync */}
					<div
						role="button"
						tabIndex={0}
						onClick={() => setAddType("exchange")}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") setAddType("exchange");
						}}
						className="group relative overflow-hidden rounded-lg border-2 border-border hover:border-primary transition-all p-6 text-left bg-card hover:bg-muted/50 cursor-pointer w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						<div className="flex items-start gap-4">
							<div className="p-3 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
								<RefreshCw className="h-6 w-6" />
							</div>
							<div className="flex-1">
								<h3 className="font-medium mb-1">Exchange Sync</h3>
								<p className="text-sm text-muted-foreground mb-3">
									Connect your exchange account to automatically sync your crypto holdings
								</p>
								<div className="flex flex-wrap gap-2">
									<span className="text-xs px-2 py-1 rounded bg-muted">Binance</span>
									<span className="text-xs px-2 py-1 rounded bg-muted">Coinbase</span>
									<span className="text-xs px-2 py-1 rounded bg-muted">Kraken</span>
									<span className="text-xs px-2 py-1 rounded bg-muted">+10 more</span>
								</div>
							</div>
							<ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
						</div>
					</div>

					{/* Wallet Sync */}
					<div
						role="button"
						tabIndex={0}
						onClick={() => setAddType("wallet")}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") setAddType("wallet");
						}}
						className="group relative overflow-hidden rounded-lg border-2 border-border hover:border-primary transition-all p-6 text-left bg-card hover:bg-muted/50 cursor-pointer w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						<div className="flex items-start gap-4">
							<div className="p-3 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
								<Link2 className="h-6 w-6" />
							</div>
							<div className="flex-1">
								<h3 className="font-medium mb-1">Wallet Sync</h3>
								<p className="text-sm text-muted-foreground mb-3">
									Connect your wallet address to track your on-chain crypto holdings
								</p>
								<div className="flex flex-wrap gap-2">
									<span className="text-xs px-2 py-1 rounded bg-muted">MetaMask</span>
									<span className="text-xs px-2 py-1 rounded bg-muted">Trust Wallet</span>
									<span className="text-xs px-2 py-1 rounded bg-muted">Ledger</span>
									<span className="text-xs px-2 py-1 rounded bg-muted">Any Address</span>
								</div>
							</div>
							<ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
						</div>
					</div>

					{/* Manual Entry */}
					<div
						role="button"
						tabIndex={0}
						onClick={() => setAddType("manual")}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") setAddType("manual");
						}}
						className="group relative overflow-hidden rounded-lg border-2 border-border hover:border-primary transition-all p-6 text-left bg-card hover:bg-muted/50 cursor-pointer w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						<div className="flex items-start gap-4">
							<div className="p-3 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400">
								<Coins className="h-6 w-6" />
							</div>
							<div className="flex-1">
								<h3 className="font-medium mb-1">Manual Entry</h3>
								<p className="text-sm text-muted-foreground mb-3">
									Manually add a single cryptocurrency holding to your portfolio
								</p>
								<div className="flex flex-wrap gap-2">
									<span className="text-xs px-2 py-1 rounded bg-muted">Quick & Simple</span>
									<span className="text-xs px-2 py-1 rounded bg-muted">Full Control</span>
								</div>
							</div>
							<ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
						</div>
					</div>
				</div>

				{/* Info Box */}
				<div className="mt-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
					<div className="flex gap-2">
						<Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
						<div className="text-xs text-blue-900 dark:text-blue-100">
							<p className="font-medium mb-1">Privacy & Security</p>
							<p>
								All your crypto data is stored locally and never shared. API keys are encrypted and
								can be revoked at any time.
							</p>
						</div>
					</div>
				</div>
			</div>
		</>
	);

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
				<DialogTitle className="sr-only">Add Cryptocurrency</DialogTitle>
				<DialogDescription className="sr-only">
					Add a new cryptocurrency to your portfolio
				</DialogDescription>

				{/* Show type selection if no type chosen */}
				{!addType && renderAddTypeSelection()}

				{/* Show manual form if manual type chosen */}
				{addType === "manual" && (
					<>
						{/* Header */}
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
									className="gap-1"
								>
									<ArrowRight className="h-4 w-4 rotate-180" />
									Back
								</Button>
								<div className="h-4 w-px bg-border" />
								<div className="flex-1">
									<h2 className="text-2xl">Manual Entry</h2>
									<p className="text-sm text-muted-foreground mt-1">
										Add a single cryptocurrency to your portfolio
									</p>
								</div>
							</div>
						</div>

						{/* Content */}
						<div className="flex-1 overflow-y-auto px-6 py-4">
							<div className="space-y-6">
								{/* Cryptocurrency Selection */}
								<div className="space-y-3">
									<Label className="flex items-center gap-2">
										<Bitcoin className="h-4 w-4 text-primary" />
										Select Cryptocurrency <span className="text-destructive">*</span>
									</Label>

									{!selectedCrypto ? (
										<TradeableInstrumentSearch
											assetTypes={[InstrumentAssetType.Crypto]}
											value={null}
											onChange={(selection) => {
												if (!selection) {
													setSelectedCrypto(null);
													setFormData((prev) => ({
														...prev,
														instrumentID: "",
														cryptoId: "",
														cryptoName: "",
														symbol: "",
														currentPrice: "",
														quoteCurrency: SUPPORTED_CURRENCIES.has(userDisplayCurrency)
															? userDisplayCurrency
															: prev.quoteCurrency,
													}));
													return;
												}
												handleSelectCrypto(selection);
											}}
											placeholder="Search cryptocurrency..."
										/>
									) : (
										/* Selected Crypto Display */
										<Card className="p-4 bg-primary/5 border-primary/20">
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-3">
													<div className="h-12 w-12 rounded-full flex items-center justify-center bg-amber-500/10 text-amber-600">
														<Bitcoin className="h-6 w-6" />
													</div>
													<div>
														<div className="font-medium text-lg">{selectedCryptoDisplay?.name}</div>
														<div className="text-sm text-muted-foreground">
															{selectedCryptoDisplay?.symbol}
														</div>
													</div>
												</div>
												<div className="text-right">
													<div className="text-sm text-muted-foreground">
														{selectedCryptoDisplay?.exchange}
													</div>
													<div className="text-xs text-muted-foreground">
														{selectedCryptoDisplay?.providerSource}
													</div>
													{SUPPORTED_CURRENCIES.has(
														selectedInstrumentCurrency as SupportedCurrency,
													) ? (
														<div className="text-xs text-muted-foreground">
															Quote: {selectedInstrumentCurrency}
														</div>
													) : null}
												</div>
											</div>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onClick={() => {
													setSelectedCrypto(null);
													setFormData((prev) => ({
														...prev,
														instrumentID: "",
														cryptoId: "",
														cryptoName: "",
														symbol: "",
														currentPrice: "",
														quoteCurrency: SUPPORTED_CURRENCIES.has(userDisplayCurrency)
															? userDisplayCurrency
															: prev.quoteCurrency,
													}));
												}}
												className="w-full mt-3"
											>
												Change Cryptocurrency
											</Button>
										</Card>
									)}
								</div>

								{/* Holdings Details */}
								{selectedCrypto && (
									<div className="space-y-4 p-4 rounded-lg border bg-muted/20">
										<h4 className="font-medium flex items-center gap-2">
											<Coins className="h-4 w-4 text-primary" />
											Holdings Details
										</h4>

										{/* Quantity */}
										<div className="space-y-2">
											<Label htmlFor="quantity" className="flex items-center gap-2">
												<Hash className="h-4 w-4 text-primary" />
												Quantity <span className="text-destructive">*</span>
											</Label>
											<Input
												id="quantity"
												type="number"
												step="0.00000001"
												placeholder="0.00000000"
												value={formData.quantity}
												onChange={(e) => handleInputChange("quantity", e.target.value)}
												className="font-mono"
											/>
											<p className="text-xs text-muted-foreground">
												Number of {selectedCrypto.symbol} you own
											</p>
										</div>

										{/* Average Buy Price */}
										<div className="space-y-2">
											<Label htmlFor="averageBuyPrice" className="flex items-center gap-2">
												<DollarSign className="h-4 w-4 text-primary" />
												Average Buy Price ({formData.quoteCurrency}){" "}
												<span className="text-destructive">*</span>
											</Label>
											<Input
												id="averageBuyPrice"
												type="number"
												step="0.01"
												placeholder="0.00"
												value={formData.averageBuyPrice}
												onChange={(e) => handleInputChange("averageBuyPrice", e.target.value)}
												className="font-mono"
											/>
											<p className="text-xs text-muted-foreground">
												Average price you paid per {selectedCrypto.symbol}
											</p>
										</div>

										<div className="space-y-2">
											<Label htmlFor="quoteCurrency">Quote Currency</Label>
											<Select
												value={formData.quoteCurrency}
												onValueChange={(value) =>
													handleInputChange("quoteCurrency", value as SupportedCurrency)
												}
												disabled={isQuoteCurrencyLocked}
											>
												<SelectTrigger id="quoteCurrency">
													<SelectValue placeholder="Select quote currency" />
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
												{isQuoteCurrencyLocked
													? "Quote currency is derived from the selected instrument."
													: "Required for manual valuation and FX conversion."}
											</p>
										</div>

										{/* Purchase Date */}
										<div className="space-y-2">
											<Label className="flex items-center gap-2">
												<CalendarIcon className="h-4 w-4 text-primary" />
												Purchase Date{" "}
												<span className="text-muted-foreground text-xs">(Optional)</span>
											</Label>
											<Popover>
												<PopoverTrigger asChild>
													<Button
														variant="outline"
														className="w-full justify-start text-left font-normal"
													>
														<CalendarIcon className="mr-2 h-4 w-4" />
														{formData.purchaseDate
															? format(formData.purchaseDate, "PPP")
															: "Select date"}
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
									</div>
								)}

								{/* Storage Details */}
								{selectedCrypto && (
									<div className="space-y-4 p-4 rounded-lg border bg-muted/20">
										<h4 className="font-medium flex items-center gap-2">
											<Wallet className="h-4 w-4 text-primary" />
											Storage Details
										</h4>

										{/* Wallet Address */}
										<div className="space-y-2">
											<Label htmlFor="walletAddress" className="text-sm">
												Wallet Address <span className="text-muted-foreground">(Optional)</span>
											</Label>
											<Input
												id="walletAddress"
												type="text"
												placeholder="0x..."
												value={formData.walletAddress}
												onChange={(e) => handleInputChange("walletAddress", e.target.value)}
												className="font-mono text-xs"
											/>
											<p className="text-xs text-muted-foreground">
												Your wallet address for tracking (kept private)
											</p>
										</div>

										{/* Notes */}
										<div className="space-y-2">
											<Label htmlFor="notes" className="text-sm">
												Notes <span className="text-muted-foreground">(Optional)</span>
											</Label>
											<Textarea
												id="notes"
												placeholder="Add any notes about this investment..."
												value={formData.notes}
												onChange={(e) => handleInputChange("notes", e.target.value)}
												className="resize-none"
												rows={3}
											/>
										</div>
									</div>
								)}

								{/* Summary */}
								{selectedCrypto && formData.quantity && formData.averageBuyPrice && (
									<div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
										<h4 className="text-sm font-medium mb-3 flex items-center gap-2">
											<TrendingUp className="h-4 w-4" />
											Investment Summary
										</h4>
										<div className="space-y-2 text-sm">
											<div className="flex justify-between">
												<span className="text-muted-foreground">Total Cost:</span>
												<span className="font-mono">
													{currencySymbol}
													{calculateTotalCost().toLocaleString("en-US", {
														minimumFractionDigits: 2,
														maximumFractionDigits: 2,
													})}
												</span>
											</div>
											<div className="flex justify-between">
												<span className="text-muted-foreground">Current Value:</span>
												<span className="font-mono">
													{currencySymbol}
													{calculateTotalValue().toLocaleString("en-US", {
														minimumFractionDigits: 2,
														maximumFractionDigits: 2,
													})}
												</span>
											</div>
											<div className="flex justify-between pt-2 border-t">
												<span className="text-muted-foreground">Profit/Loss:</span>
												<div className="text-right">
													<div
														className={`font-mono ${profitLoss.amount >= 0 ? "text-green-600" : "text-red-600"}`}
													>
														{profitLoss.amount >= 0 ? "+" : ""}
														{currencySymbol}
														{Math.abs(profitLoss.amount).toLocaleString("en-US", {
															minimumFractionDigits: 2,
															maximumFractionDigits: 2,
														})}
													</div>
													<div
														className={`text-xs ${profitLoss.amount >= 0 ? "text-green-600" : "text-red-600"}`}
													>
														{profitLoss.amount >= 0 ? "+" : ""}
														{profitLoss.percent.toFixed(2)}%
													</div>
												</div>
											</div>
										</div>
									</div>
								)}

								{/* Info Box */}
								<div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
									<div className="flex gap-2">
										<Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
										<div className="text-xs text-blue-900 dark:text-blue-100">
											<p className="font-medium mb-1">Privacy & Security</p>
											<p>
												Your wallet addresses and crypto holdings are stored locally and never
												shared. Always verify addresses before transactions.
											</p>
										</div>
									</div>
								</div>
							</div>
						</div>

						{/* Footer */}
						<div className="p-6 pt-4 border-t bg-muted/20">
							<div className="flex items-center justify-end gap-3">
								<Button variant="ghost" onClick={handleClose}>
									Cancel
								</Button>
								<Button
									onClick={handleSubmit}
									disabled={
										!selectedCrypto ||
										!formData.quantity ||
										!formData.averageBuyPrice ||
										!SUPPORTED_CURRENCIES.has(formData.quoteCurrency)
									}
								>
									Add to Portfolio
								</Button>
							</div>
						</div>
					</>
				)}

				{/* Show Exchange Sync form */}
				{addType === "exchange" && (
					<>
						{/* Header */}
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
									className="gap-1"
								>
									<ArrowRight className="h-4 w-4 rotate-180" />
									Back
								</Button>
								<div className="h-4 w-px bg-border" />
								<div className="flex-1">
									<h2 className="text-2xl">Exchange Sync</h2>
									<p className="text-sm text-muted-foreground mt-1">
										Connect your exchange account
									</p>
								</div>
							</div>
						</div>

						{/* Content */}
						<div className="flex-1 overflow-y-auto p-6">
							<div className="space-y-4">
								<div className="text-center py-12">
									<RefreshCw className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
									<h3 className="font-medium mb-2">Exchange Sync Coming Soon</h3>
									<p className="text-sm text-muted-foreground mb-4">
										We're working on integrating with major exchanges like Binance, Coinbase, and
										Kraken.
									</p>
									<Button variant="outline" onClick={() => setAddType("manual")}>
										Use Manual Entry Instead
									</Button>
								</div>
							</div>
						</div>
					</>
				)}

				{/* Show Wallet Sync form */}
				{addType === "wallet" && (
					<>
						{/* Header */}
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
									className="gap-1"
								>
									<ArrowRight className="h-4 w-4 rotate-180" />
									Back
								</Button>
								<div className="h-4 w-px bg-border" />
								<div className="flex-1">
									<h2 className="text-2xl">Wallet Sync</h2>
									<p className="text-sm text-muted-foreground mt-1">Connect your wallet address</p>
								</div>
							</div>
						</div>

						{/* Content */}
						<div className="flex-1 overflow-y-auto p-6">
							<div className="space-y-4">
								<div className="text-center py-12">
									<Link2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
									<h3 className="font-medium mb-2">Wallet Sync Coming Soon</h3>
									<p className="text-sm text-muted-foreground mb-4">
										We're working on blockchain integration to automatically track your wallet
										balances.
									</p>
									<Button variant="outline" onClick={() => setAddType("manual")}>
										Use Manual Entry Instead
									</Button>
								</div>
							</div>
						</div>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
