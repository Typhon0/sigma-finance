import { z } from "zod";

// Transaction form validation schema
export const transactionFormSchema = z
	.object({
		portfolioId: z.string().min(1, "Portfolio is required"),
		assetId: z.string().optional(),
		transactionType: z.enum(
			[
				"BUY",
				"SELL",
				"DEPOSIT",
				"WITHDRAWAL",
				"TRANSFER_IN",
				"TRANSFER_OUT",
				"DIVIDEND",
				"INTEREST",
				"FEE",
				"ADJUSTMENT",
			],
			{
				required_error: "Transaction type is required",
			},
		),
		quantity: z.number().min(0, "Quantity must be positive").optional(),
		pricePerUnit: z
			.number()
			.min(0, "Price per unit must be positive")
			.optional(),
		amount: z.number().min(0.01, "Amount must be greater than 0"),
		fee: z.number().min(0, "Fee must be positive").optional().default(0),
		transactionDate: z.date({
			required_error: "Transaction date is required",
		}),
		notes: z
			.string()
			.max(500, "Notes must be less than 500 characters")
			.optional(),
	})
	.refine(
		(data) => {
			// For BUY/SELL transactions, require asset, quantity, and price per unit
			if (["BUY", "SELL"].includes(data.transactionType)) {
				return data.assetId && data.quantity && data.pricePerUnit;
			}
			return true;
		},
		{
			message:
				"Buy/Sell transactions require asset, quantity, and price per unit",
			path: ["assetId"],
		},
	)
	.refine(
		(data) => {
			// For non-deposit/withdrawal transactions, require asset
			if (!["DEPOSIT", "WITHDRAWAL"].includes(data.transactionType)) {
				return data.assetId;
			}
			return true;
		},
		{
			message: "Asset is required for this transaction type",
			path: ["assetId"],
		},
	);

// Bulk transaction import schema
export const bulkTransactionSchema = z.object({
	portfolioId: z.string().min(1, "Portfolio is required"),
	transactions: z
		.array(transactionFormSchema.omit({ portfolioId: true }))
		.min(1, "At least one transaction is required"),
	validateOnly: z.boolean().default(false),
});

// Transaction filter schema
export const transactionFilterSchema = z.object({
	portfolioId: z.string().optional(),
	assetId: z.string().optional(),
	transactionType: z
		.enum([
			"BUY",
			"SELL",
			"DEPOSIT",
			"WITHDRAWAL",
			"TRANSFER_IN",
			"TRANSFER_OUT",
			"DIVIDEND",
			"INTEREST",
			"FEE",
			"ADJUSTMENT",
		])
		.optional(),
	dateFrom: z.date().optional(),
	dateTo: z.date().optional(),
	minAmount: z.number().min(0).optional(),
	maxAmount: z.number().min(0).optional(),
	searchQuery: z.string().optional(),
});

// Transaction form data type
export type TransactionFormData = z.infer<typeof transactionFormSchema>;

// Bulk transaction data type
export type BulkTransactionData = z.infer<typeof bulkTransactionSchema>;

// Transaction filter data type
export type TransactionFilterData = z.infer<typeof transactionFilterSchema>;

// Transaction validation helpers
export const transactionValidationHelpers = {
	/**
	 * Validates that transaction date is not in the future
	 */
	validateTransactionDate: (date: Date): boolean => {
		return date <= new Date();
	},

	/**
	 * Validates cost basis calculation for sell transactions
	 */
	validateSellTransaction: (
		quantity: number,
		availableQuantity: number,
	): boolean => {
		return quantity <= availableQuantity;
	},

	/**
	 * Calculates total transaction value including fees
	 */
	calculateTotalValue: (amount: number, fee: number = 0): number => {
		return amount + fee;
	},

	/**
	 * Validates transaction amount against quantity and price
	 */
	validateTransactionAmount: (
		quantity: number,
		pricePerUnit: number,
		amount: number,
		tolerance: number = 0.01,
	): boolean => {
		const calculatedAmount = quantity * pricePerUnit;
		return Math.abs(calculatedAmount - amount) <= tolerance;
	},

	/**
	 * Formats transaction type for display
	 */
	formatTransactionType: (type: string): string => {
		return type
			.replace(/_/g, " ")
			.toLowerCase()
			.replace(/\b\w/g, (l) => l.toUpperCase());
	},

	/**
	 * Gets transaction type color class
	 */
	getTransactionTypeColor: (type: string): string => {
		switch (type) {
			case "BUY":
			case "DEPOSIT":
			case "TRANSFER_IN":
			case "DIVIDEND":
			case "INTEREST":
				return "text-green-600";
			case "SELL":
			case "WITHDRAWAL":
			case "TRANSFER_OUT":
				return "text-blue-600";
			case "FEE":
				return "text-red-600";
			case "ADJUSTMENT":
				return "text-yellow-600";
			default:
				return "text-gray-600";
		}
	},

	/**
	 * Gets transaction type icon
	 */
	getTransactionTypeIcon: (type: string): string => {
		switch (type) {
			case "BUY":
				return "arrow-down-left";
			case "SELL":
				return "arrow-up-right";
			case "DEPOSIT":
			case "TRANSFER_IN":
				return "plus-circle";
			case "WITHDRAWAL":
			case "TRANSFER_OUT":
				return "minus-circle";
			case "DIVIDEND":
			case "INTEREST":
				return "trending-up";
			case "FEE":
				return "credit-card";
			case "ADJUSTMENT":
				return "edit";
			default:
				return "circle";
		}
	},
};

// Error messages for transaction validation
export const transactionErrorMessages = {
	portfolioRequired: "Portfolio selection is required",
	assetRequired: "Asset selection is required for this transaction type",
	transactionTypeRequired: "Transaction type is required",
	quantityRequired: "Quantity is required for buy/sell transactions",
	priceRequired: "Price per unit is required for buy/sell transactions",
	amountRequired: "Amount is required",
	amountPositive: "Amount must be greater than 0",
	quantityPositive: "Quantity must be positive",
	pricePositive: "Price per unit must be positive",
	feePositive: "Fee must be positive",
	dateRequired: "Transaction date is required",
	dateFuture: "Transaction date cannot be in the future",
	notesTooLong: "Notes must be less than 500 characters",
	insufficientQuantity: "Insufficient quantity available for sale",
	amountMismatch: "Amount does not match quantity × price per unit",
	networkError: "Network error occurred. Please try again.",
	serverError: "Server error occurred. Please try again later.",
	unauthorized: "You are not authorized to perform this action",
	validationFailed: "Please fix the errors below and try again",
} as const;

// CSV import column mapping
export const csvColumnMapping = {
	date: ["date", "transaction_date", "Date", "Transaction Date"],
	type: ["type", "transaction_type", "Type", "Transaction Type"],
	asset: ["asset", "symbol", "Asset", "Symbol", "Ticker"],
	quantity: ["quantity", "qty", "Quantity", "Qty", "Shares"],
	price: ["price", "price_per_unit", "Price", "Price Per Unit", "Unit Price"],
	amount: ["amount", "total", "Amount", "Total", "Value"],
	fee: ["fee", "fees", "commission", "Fee", "Fees", "Commission"],
	notes: ["notes", "description", "memo", "Notes", "Description", "Memo"],
} as const;
