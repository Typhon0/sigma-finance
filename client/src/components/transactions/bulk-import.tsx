import { AlertCircle, CheckCircle, Download, Eye, Upload, X } from "lucide-react";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { Portfolio, TransactionType } from "@/gql/graphql";
import type { BulkTransactionData } from "@/lib/validations/transaction.schemas";
import { csvColumnMapping } from "@/lib/validations/transaction.schemas";

interface BulkImportProps {
	portfolios: Portfolio[];
	onImport: (data: BulkTransactionData) => Promise<void>;
	onCancel: () => void;
	isLoading?: boolean;
}

interface ParsedTransaction {
	date: string;
	type: string;
	asset: string;
	quantity: number;
	price: number;
	amount: number;
	fee: number;
	notes: string;
	rowIndex: number;
	errors: string[];
}

interface ImportProgress {
	total: number;
	processed: number;
	successful: number;
	failed: number;
	errors: Array<{ row: number; error: string }>;
}

export function BulkImport({ portfolios, onImport, onCancel, isLoading = false }: BulkImportProps) {
	const [csvData, setCsvData] = useState<string>("");
	const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
	const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
	const [selectedPortfolio, setSelectedPortfolio] = useState<string>("");
	const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
	const [showPreview, setShowPreview] = useState(false);
	const [validateOnly, setValidationOnly] = useState(true);

	const parseCsv = (csv: string) => {
		const lines = csv.split("\n").filter((line) => line.trim());
		if (lines.length < 2) return;

		const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
		const dataRows = lines.slice(1);

		// Auto-detect column mapping
		const mapping: Record<string, string> = {};
		Object.entries(csvColumnMapping).forEach(([key, possibleNames]) => {
			const matchedHeader = headers.find((header) =>
				possibleNames.some((name) => header.toLowerCase().includes(name.toLowerCase())),
			);
			if (matchedHeader) {
				mapping[key] = matchedHeader;
			}
		});
		setColumnMapping(mapping);

		// Parse transactions
		const transactions: ParsedTransaction[] = [];
		dataRows.forEach((row, index) => {
			const cells = row.split(",").map((c) => c.trim().replace(/"/g, ""));
			const transaction: ParsedTransaction = {
				date: getCellValue(cells, headers, mapping.date) || "",
				type: getCellValue(cells, headers, mapping.type) || "",
				asset: getCellValue(cells, headers, mapping.asset) || "",
				quantity: parseFloat(getCellValue(cells, headers, mapping.quantity) || "0"),
				price: parseFloat(getCellValue(cells, headers, mapping.price) || "0"),
				amount: parseFloat(getCellValue(cells, headers, mapping.amount) || "0"),
				fee: parseFloat(getCellValue(cells, headers, mapping.fee) || "0"),
				notes: getCellValue(cells, headers, mapping.notes) || "",
				rowIndex: index + 2, // +2 because we skip header and 0-index
				errors: [],
			};

			// Validate transaction
			validateTransaction(transaction);
			transactions.push(transaction);
		});

		setParsedTransactions(transactions);
	};

	const onDrop = useCallback(
		(acceptedFiles: File[]) => {
			const file = acceptedFiles[0];
			if (file && file.type === "text/csv") {
				const reader = new FileReader();
				reader.onload = (e) => {
					const csv = e.target?.result as string;
					setCsvData(csv);
					parseCsv(csv);
				};
				reader.readAsText(file);
			}
		},
		[parseCsv],
	);

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop,
		accept: {
			"text/csv": [".csv"],
		},
		multiple: false,
	});

	const getCellValue = (cells: string[], headers: string[], columnName?: string): string => {
		if (!columnName) return "";
		const index = headers.indexOf(columnName);
		return index >= 0 ? cells[index] || "" : "";
	};

	const validateTransaction = (transaction: ParsedTransaction) => {
		const errors: string[] = [];

		if (!transaction.date) {
			errors.push("Date is required");
		} else {
			const date = new Date(transaction.date);
			if (Number.isNaN(date.getTime())) {
				errors.push("Invalid date format");
			}
		}

		if (!transaction.type) {
			errors.push("Transaction type is required");
		} else {
			const validTypes = [
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
			];
			if (!validTypes.includes(transaction.type.toUpperCase())) {
				errors.push("Invalid transaction type");
			}
		}

		if (!transaction.asset && !["DEPOSIT", "WITHDRAWAL"].includes(transaction.type.toUpperCase())) {
			errors.push("Asset is required for this transaction type");
		}

		if (transaction.amount <= 0) {
			errors.push("Amount must be greater than 0");
		}

		if (["BUY", "SELL"].includes(transaction.type.toUpperCase())) {
			if (transaction.quantity <= 0) {
				errors.push("Quantity is required for buy/sell transactions");
			}
			if (transaction.price <= 0) {
				errors.push("Price is required for buy/sell transactions");
			}
		}

		transaction.errors = errors;
	};

	const handleColumnMappingChange = (field: string, column: string) => {
		setColumnMapping((prev) => ({ ...prev, [field]: column }));

		// Re-parse with new mapping
		if (csvData) {
			parseCsv(csvData);
		}
	};

	const handleImport = async () => {
		if (!selectedPortfolio || parsedTransactions.length === 0) return;

		const validTransactions = parsedTransactions.filter((t) => t.errors.length === 0);

		if (validTransactions.length === 0) {
			toast.error("No valid transactions to import");
			return;
		}

		const importData: BulkTransactionData = {
			portfolioId: selectedPortfolio,
			validateOnly,
			transactions: validTransactions.map((t) => ({
				assetId: t.asset, // This would need to be resolved to actual asset ID
				transactionType: t.type.toUpperCase() as TransactionType,
				quantity: t.quantity,
				pricePerUnit: t.price,
				amount: t.amount,
				fee: t.fee,
				transactionDate: new Date(t.date),
				notes: t.notes,
			})),
		};

		try {
			setImportProgress({
				total: validTransactions.length,
				processed: 0,
				successful: 0,
				failed: 0,
				errors: [],
			});

			await onImport(importData);

			// Update progress (this would be updated by the actual import process)
			setImportProgress((prev) =>
				prev
					? {
							...prev,
							processed: prev.total,
							successful: prev.total,
						}
					: null,
			);
		} catch (_error) {}
	};

	const downloadTemplate = () => {
		const template = [
			"Date,Type,Asset,Quantity,Price,Amount,Fee,Notes",
			"2024-01-15,BUY,AAPL,100,150.00,15000.00,9.99,Initial purchase",
			"2024-01-20,SELL,AAPL,50,155.00,7750.00,9.99,Partial sale",
			"2024-01-25,DEPOSIT,,,,1000.00,0.00,Cash deposit",
		].join("\n");

		const blob = new Blob([template], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "transaction_import_template.csv";
		a.click();
		URL.revokeObjectURL(url);
	};

	const validTransactionCount = parsedTransactions.filter((t) => t.errors.length === 0).length;
	const invalidTransactionCount = parsedTransactions.length - validTransactionCount;

	return (
		<Card className="w-full max-w-4xl">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Upload className="h-5 w-5" />
					Bulk Transaction Import
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-6">
				{/* Template Download */}
				<div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
					<div>
						<h3 className="font-medium">Need a template?</h3>
						<p className="text-sm text-muted-foreground">
							Download our CSV template to get started with the correct format.
						</p>
					</div>
					<Button variant="outline" onClick={downloadTemplate}>
						<Download className="h-4 w-4 mr-2" />
						Download Template
					</Button>
				</div>

				{/* File Upload */}
				{!csvData && (
					<div
						{...getRootProps()}
						className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
							isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"
						}`}
					>
						<input {...getInputProps()} />
						<Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
						<h3 className="text-lg font-medium mb-2">
							{isDragActive ? "Drop your CSV file here" : "Upload CSV File"}
						</h3>
						<p className="text-muted-foreground">
							Drag and drop your transaction CSV file, or click to browse
						</p>
					</div>
				)}

				{/* Column Mapping */}
				{csvData && !parsedTransactions.length && (
					<div className="space-y-4">
						<h3 className="font-medium">Map CSV Columns</h3>
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							{Object.entries(csvColumnMapping).map(([field, _possibleNames]) => (
								<div key={field} className="space-y-2">
									<label className="text-sm font-medium capitalize">
										{field.replace("_", " ")}
									</label>
									<Select
										value={columnMapping[field] || ""}
										onValueChange={(value) => handleColumnMappingChange(field, value)}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select column" />
										</SelectTrigger>
										<SelectContent>
											{csvData
												.split("\n")[0]
												?.split(",")
												.map((header, index) => (
													<SelectItem key={index} value={header.trim().replace(/"/g, "")}>
														{header.trim().replace(/"/g, "")}
													</SelectItem>
												))}
										</SelectContent>
									</Select>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Portfolio Selection */}
				{parsedTransactions.length > 0 && (
					<div className="space-y-4">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div className="space-y-2">
								<label className="text-sm font-medium">Target Portfolio *</label>
								<Select value={selectedPortfolio} onValueChange={setSelectedPortfolio}>
									<SelectTrigger>
										<SelectValue placeholder="Select portfolio" />
									</SelectTrigger>
									<SelectContent>
										{portfolios.map((portfolio) => (
											<SelectItem key={portfolio.id} value={portfolio.id}>
												{portfolio.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-2">
								<label className="text-sm font-medium">Import Mode</label>
								<div className="flex items-center space-x-2">
									<Checkbox
										id="validation-only"
										checked={validateOnly}
										onCheckedChange={(checked) => setValidationOnly(checked as boolean)}
									/>
									<label htmlFor="validation-only" className="text-sm">
										Validation only (don't save transactions)
									</label>
								</div>
							</div>
						</div>

						{/* Import Summary */}
						<div className="grid grid-cols-3 gap-4">
							<Card>
								<CardContent className="p-4 text-center">
									<div className="text-2xl font-bold">{parsedTransactions.length}</div>
									<div className="text-sm text-muted-foreground">Total Rows</div>
								</CardContent>
							</Card>
							<Card>
								<CardContent className="p-4 text-center">
									<div className="text-2xl font-bold text-green-600">{validTransactionCount}</div>
									<div className="text-sm text-muted-foreground">Valid</div>
								</CardContent>
							</Card>
							<Card>
								<CardContent className="p-4 text-center">
									<div className="text-2xl font-bold text-red-600">{invalidTransactionCount}</div>
									<div className="text-sm text-muted-foreground">Invalid</div>
								</CardContent>
							</Card>
						</div>

						{/* Validation Errors */}
						{invalidTransactionCount > 0 && (
							<Alert>
								<AlertCircle className="h-4 w-4" />
								<AlertDescription>
									{invalidTransactionCount} transaction(s) have validation errors. Please review and
									fix the issues before importing.
								</AlertDescription>
							</Alert>
						)}

						{/* Preview Button */}
						<Dialog open={showPreview} onOpenChange={setShowPreview}>
							<DialogTrigger asChild>
								<Button variant="outline" className="w-full">
									<Eye className="h-4 w-4 mr-2" />
									Preview Transactions
								</Button>
							</DialogTrigger>
							<DialogContent className="max-w-6xl max-h-[80vh] overflow-auto">
								<DialogHeader>
									<DialogTitle>Transaction Preview</DialogTitle>
								</DialogHeader>
								<div className="space-y-4">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Row</TableHead>
												<TableHead>Date</TableHead>
												<TableHead>Type</TableHead>
												<TableHead>Asset</TableHead>
												<TableHead>Quantity</TableHead>
												<TableHead>Price</TableHead>
												<TableHead>Amount</TableHead>
												<TableHead>Status</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{parsedTransactions.map((transaction) => (
												<TableRow key={transaction.rowIndex}>
													<TableCell>{transaction.rowIndex}</TableCell>
													<TableCell>{transaction.date}</TableCell>
													<TableCell>{transaction.type}</TableCell>
													<TableCell>{transaction.asset}</TableCell>
													<TableCell>{transaction.quantity}</TableCell>
													<TableCell>{transaction.price}</TableCell>
													<TableCell>{transaction.amount}</TableCell>
													<TableCell>
														{transaction.errors.length === 0 ? (
															<Badge variant="default" className="bg-green-100 text-green-800">
																<CheckCircle className="h-3 w-3 mr-1" />
																Valid
															</Badge>
														) : (
															<Badge variant="destructive">
																<AlertCircle className="h-3 w-3 mr-1" />
																{transaction.errors.length} error(s)
															</Badge>
														)}
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							</DialogContent>
						</Dialog>
					</div>
				)}

				{/* Import Progress */}
				{importProgress && (
					<div className="space-y-4">
						<h3 className="font-medium">Import Progress</h3>
						<Progress
							value={(importProgress.processed / importProgress.total) * 100}
							className="w-full"
						/>
						<div className="grid grid-cols-4 gap-4 text-center">
							<div>
								<div className="text-lg font-bold">{importProgress.total}</div>
								<div className="text-sm text-muted-foreground">Total</div>
							</div>
							<div>
								<div className="text-lg font-bold">{importProgress.processed}</div>
								<div className="text-sm text-muted-foreground">Processed</div>
							</div>
							<div>
								<div className="text-lg font-bold text-green-600">{importProgress.successful}</div>
								<div className="text-sm text-muted-foreground">Successful</div>
							</div>
							<div>
								<div className="text-lg font-bold text-red-600">{importProgress.failed}</div>
								<div className="text-sm text-muted-foreground">Failed</div>
							</div>
						</div>
					</div>
				)}

				{/* Actions */}
				<div className="flex gap-3 pt-4">
					{parsedTransactions.length > 0 && selectedPortfolio && (
						<Button
							onClick={handleImport}
							disabled={isLoading || validTransactionCount === 0}
							className="flex-1"
						>
							{isLoading
								? "Processing..."
								: validateOnly
									? "Validate Transactions"
									: "Import Transactions"}
						</Button>
					)}
					<Button variant="outline" onClick={onCancel} disabled={isLoading}>
						Cancel
					</Button>
					{csvData && (
						<Button
							variant="outline"
							onClick={() => {
								setCsvData("");
								setParsedTransactions([]);
								setColumnMapping({});
								setImportProgress(null);
							}}
						>
							<X className="h-4 w-4 mr-2" />
							Clear
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
