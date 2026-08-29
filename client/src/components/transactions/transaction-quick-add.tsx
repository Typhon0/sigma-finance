import { DollarSign, Hash, Plus, Zap } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { Asset, TransactionType as GqlTransactionType, Portfolio } from "@/gql/graphql";

type ExtendedTransactionType =
	| "BUY"
	| "SELL"
	| "DEPOSIT"
	| "WITHDRAWAL"
	| "DIVIDEND"
	| "TRANSFER"
	| "FEE"
	| "REFUND"
	| "buy"
	| "sell"
	| "deposit"
	| "withdrawal"
	| "dividend"
	| "transfer"
	| "fee"
	| "refund"
	| "";

// Legacy alias for backward compatibility
type _ExtendedTransactionTypeLegacy = GqlTransactionType | "DEPOSIT" | "WITHDRAWAL";

import { formatCurrency } from "@/lib/utils";

interface QuickAddTransaction {
	assetId: string;
	transactionType: ExtendedTransactionType;
	quantity: number;
	pricePerUnit: number;
	amount: number;
}

interface TransactionQuickAddProps {
	portfolio: Portfolio;
	assets: Asset[];
	onAddTransaction: (transaction: QuickAddTransaction) => Promise<void>;
	isLoading?: boolean;
	compact?: boolean;
}

const quickTransactionTypes: {
	value: ExtendedTransactionType;
	label: string;
	color: string;
}[] = [
	{ value: "BUY", label: "Buy", color: "bg-green-100 text-green-800" },
	{ value: "SELL", label: "Sell", color: "bg-red-100 text-red-800" },
	{ value: "DEPOSIT", label: "Deposit", color: "bg-blue-100 text-blue-800" },
	{
		value: "WITHDRAWAL",
		label: "Withdrawal",
		color: "bg-orange-100 text-orange-800",
	},
];

export function TransactionQuickAdd({
	portfolio,
	assets,
	onAddTransaction,
	isLoading = false,
	compact = false,
}: TransactionQuickAddProps) {
	const [selectedAsset, setSelectedAsset] = useState<string>("");
	const [transactionType, setTransactionType] = useState<ExtendedTransactionType>("BUY");
	const [quantity, setQuantity] = useState<number>(0);
	const [pricePerUnit, setPricePerUnit] = useState<number>(0);
	const [amount, setAmount] = useState<number>(0);
	const [isExpanded, setIsExpanded] = useState(false);

	// Auto-calculate amount when quantity or price changes
	const handleQuantityOrPriceChange = (newQuantity?: number, newPrice?: number) => {
		const qty = newQuantity ?? quantity;
		const price = newPrice ?? pricePerUnit;
		const calculatedAmount = qty * price;
		setAmount(calculatedAmount);
	};

	const handleSubmit = async () => {
		if (!selectedAsset || amount <= 0) return;

		const transaction: QuickAddTransaction = {
			assetId: selectedAsset,
			transactionType,
			quantity,
			pricePerUnit,
			amount,
		};

		try {
			await onAddTransaction(transaction);

			// Reset form
			setSelectedAsset("");
			setQuantity(0);
			setPricePerUnit(0);
			setAmount(0);
			setIsExpanded(false);
		} catch (_error) {}
	};

	const requiresQuantity = ["BUY", "SELL"].includes(transactionType);
	const selectedAssetData = assets.find((asset) => asset.id === selectedAsset);

	if (compact && !isExpanded) {
		return (
			<Card className="border-dashed">
				<CardContent className="p-4">
					<Button
						variant="ghost"
						className="w-full h-auto p-4 flex flex-col items-center gap-2 text-center border-dashed border-2"
						onClick={() => setIsExpanded(true)}
					>
						<Plus className="h-6 w-6 text-muted-foreground" />
						<div className="flex flex-col">
							<span className="font-medium">Quick Add Transaction</span>
							<span className="text-xs text-muted-foreground">Fast entry for {portfolio.name}</span>
						</div>
					</Button>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className={compact ? "border-2 border-primary/20" : ""}>
			<CardHeader className="pb-3">
				<CardTitle className="flex items-center gap-2 text-lg">
					<Zap className="h-5 w-5" />
					Quick Add Transaction
					<Badge variant="outline" className="ml-auto">
						{portfolio.name}
					</Badge>
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Transaction Type Selection */}
				<div className="grid grid-cols-2 md:grid-cols-4 gap-2">
					{quickTransactionTypes.map((type) => (
						<Button
							key={type.value}
							variant={transactionType === type.value ? "default" : "outline"}
							size="sm"
							onClick={() => setTransactionType(type.value)}
							className="h-auto p-3 flex flex-col items-center gap-1"
						>
							<span className="font-medium">{type.label}</span>
						</Button>
					))}
				</div>

				{/* Asset Selection */}
				{!["DEPOSIT", "WITHDRAWAL"].includes(transactionType) && (
					<div className="space-y-2">
						{/* biome-ignore lint/a11y/noLabelWithoutControl: unavoidable */}
						<label className="text-sm font-medium">Asset</label>
						<Select value={selectedAsset} onValueChange={setSelectedAsset}>
							<SelectTrigger>
								<SelectValue placeholder="Select asset" />
							</SelectTrigger>
							<SelectContent>
								{assets.map((asset) => (
									<SelectItem key={asset.id} value={asset.id}>
										<div className="flex items-center gap-2">
											<span>{asset.name}</span>
											{asset.symbol && (
												<span className="text-xs text-muted-foreground">({asset.symbol})</span>
											)}
											{asset.currentValue && (
												<span className="text-xs text-muted-foreground ml-auto">
													{formatCurrency(asset.currentValue)}
												</span>
											)}
										</div>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				)}

				{/* Current Price Display */}
				{selectedAssetData?.currentValue && requiresQuantity && (
					<Alert>
						<DollarSign className="h-4 w-4" />
						<AlertDescription>
							Current market price: {formatCurrency(selectedAssetData.currentValue)}
							<Button
								variant="link"
								size="sm"
								className="ml-2 h-auto p-0"
								onClick={() => {
									setPricePerUnit(selectedAssetData.currentValue || 0);
									handleQuantityOrPriceChange(quantity, selectedAssetData.currentValue || 0);
								}}
							>
								Use current price
							</Button>
						</AlertDescription>
					</Alert>
				)}

				{/* Quantity and Price (for BUY/SELL) */}
				{requiresQuantity && (
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-2">
							{/* biome-ignore lint/a11y/noLabelWithoutControl: unavoidable */}
							<label className="text-sm font-medium">Quantity</label>
							<div className="relative">
								<Hash className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
								<Input
									type="number"
									step="0.00000001"
									min="0"
									placeholder="0"
									value={quantity || ""}
									onChange={(e) => {
										const newQuantity = parseFloat(e.target.value) || 0;
										setQuantity(newQuantity);
										handleQuantityOrPriceChange(newQuantity, pricePerUnit);
									}}
									style={{ paddingLeft: "2.5rem" }}
								/>
							</div>
						</div>

						<div className="space-y-2">
							{/* biome-ignore lint/a11y/noLabelWithoutControl: unavoidable */}
							<label className="text-sm font-medium">Price per Unit</label>
							<div className="relative">
								<DollarSign className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
								<Input
									type="number"
									step="0.01"
									min="0"
									placeholder="0.00"
									value={pricePerUnit || ""}
									onChange={(e) => {
										const newPrice = parseFloat(e.target.value) || 0;
										setPricePerUnit(newPrice);
										handleQuantityOrPriceChange(quantity, newPrice);
									}}
									style={{ paddingLeft: "2.5rem" }}
								/>
							</div>
						</div>
					</div>
				)}

				{/* Amount */}
				<div className="space-y-2">
					{/* biome-ignore lint/a11y/noLabelWithoutControl: unavoidable */}
					<label className="text-sm font-medium">Amount {requiresQuantity && "(calculated)"}</label>
					<div className="relative">
						<DollarSign className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
						<Input
							type="number"
							step="0.01"
							min="0"
							placeholder="0.00"
							value={amount || ""}
							onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
							style={{ paddingLeft: "2.5rem" }}
							readOnly={requiresQuantity}
						/>
					</div>
					{requiresQuantity && (
						<p className="text-xs text-muted-foreground">
							{quantity} × {formatCurrency(pricePerUnit)} = {formatCurrency(amount)}
						</p>
					)}
				</div>

				{/* Action Buttons */}
				<div className="flex gap-2 pt-2">
					<Button
						onClick={handleSubmit}
						disabled={isLoading || !selectedAsset || amount <= 0}
						className="flex-1"
						size="sm"
					>
						{isLoading ? "Adding..." : `Add ${transactionType.toLowerCase()}`}
					</Button>
					{compact && (
						<Button variant="outline" size="sm" onClick={() => setIsExpanded(false)}>
							Cancel
						</Button>
					)}
				</div>

				{/* Transaction Summary */}
				{amount > 0 && selectedAsset && (
					<div className="p-3 bg-muted/30 rounded-lg">
						<div className="flex items-center justify-between text-sm">
							<span className="text-muted-foreground">Transaction Summary:</span>
							<Badge
								variant="outline"
								className={
									transactionType === "BUY"
										? "text-green-700"
										: transactionType === "SELL"
											? "text-red-700"
											: "text-blue-700"
								}
							>
								{transactionType}
							</Badge>
						</div>
						<div className="mt-2 space-y-1 text-sm">
							<div className="flex justify-between">
								<span>Asset:</span>
								<span className="font-medium">
									{selectedAssetData?.name}
									{selectedAssetData?.symbol && ` (${selectedAssetData.symbol})`}
								</span>
							</div>
							{requiresQuantity && (
								<div className="flex justify-between">
									<span>Quantity:</span>
									<span className="font-medium">{quantity.toLocaleString()}</span>
								</div>
							)}
							<div className="flex justify-between">
								<span>Total Amount:</span>
								<span className="font-bold">{formatCurrency(amount)}</span>
							</div>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
