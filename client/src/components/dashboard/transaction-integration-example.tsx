import { Calculator, Info, TrendingUp } from "lucide-react";
import { useState } from "react";
import type {
	BulkTransactionData,
	TransactionFilterData,
	TransactionFormData,
} from "@/components/transactions";
import { TransactionManagement } from "@/components/transactions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Asset, Portfolio, Position, Transaction } from "@/gql/graphql";

// Mock data for demonstration
const mockPortfolio = {
	id: "1",
	name: "Tech Portfolio",
	description: "Technology focused investments",
	user: {
		id: "1",
		email: "john@example.com",
		name: "John Doe",
	} as unknown as Portfolio["user"],
	assets: [],
	analytics: null,
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
	sortOrder: 1,
	tags: [],
	transactions: [],
} as Portfolio;

const mockAssets: Asset[] = [
	{
		id: "1",
		name: "Apple Inc.",
		symbol: "AAPL",
		assetType: { id: "1", name: "STOCK" },
		currentValue: 150.25,
		purchasePrice: 140.0,
		purchaseDate: new Date("2024-01-15").toISOString(),
		positions: [],
		tags: [],
	},
	{
		id: "2",
		name: "Bitcoin",
		symbol: "BTC",
		assetType: { id: "2", name: "CRYPTO" },
		currentValue: 45000.0,
		purchasePrice: 42000.0,
		purchaseDate: new Date("2024-01-20").toISOString(),
		positions: [],
		tags: [],
	},
];

const mockTransactions = [
	{
		id: "1",
		asset: mockAssets[0],
		portfolio: mockPortfolio,
		transactionType: "BUY",
		quantity: 100,
		unitPriceAmount: 140.0,
		unitPriceCurrency: "USD",
		feesAmount: 0,
		feesCurrency: "USD",
		executedAt: new Date("2024-01-15").toISOString(),
		notes: "Initial purchase",
	},
	{
		id: "2",
		asset: mockAssets[1],
		portfolio: mockPortfolio,
		transactionType: "BUY",
		quantity: 0.5,
		unitPriceAmount: 42000.0,
		unitPriceCurrency: "USD",
		feesAmount: 0,
		feesCurrency: "USD",
		executedAt: new Date("2024-01-20").toISOString(),
		notes: "Bitcoin investment",
	},
] as Transaction[];

const mockPositions = [
	{
		id: "1",
		portfolio: mockPortfolio,
		asset: mockAssets[0],
		quantity: 100,
		ownershipPct: 100,
		averagePurchasePrice: 140.0,
	},
	{
		id: "2",
		portfolio: mockPortfolio,
		asset: mockAssets[1],
		quantity: 0.5,
		ownershipPct: 100,
		averagePurchasePrice: 42000.0,
	},
] as Position[];

export function TransactionIntegrationExample() {
	const [isLoading, setIsLoading] = useState(false);
	const [transactions, setTransactions] = useState(mockTransactions);

	const handleAddTransaction = async (data: TransactionFormData) => {
		setIsLoading(true);

		// Simulate API call
		await new Promise((resolve) => setTimeout(resolve, 1000));

		const newTransaction = {
			id: Date.now().toString(),
			asset: mockAssets.find((a) => a.id === data.assetId) || mockAssets[0],
			portfolio: mockPortfolio,
			transactionType: data.transactionType,
			quantity: data.quantity || 0,
			unitPriceAmount: data.pricePerUnit || 0,
			unitPriceCurrency: "USD",
			feesAmount: 0,
			feesCurrency: "USD",
			executedAt: data.transactionDate.toISOString(),
			notes: data.notes || null,
		} as Transaction;

		setTransactions((prev) => [newTransaction, ...prev]);
		setIsLoading(false);
	};

	const handleEditTransaction = async (id: string, data: TransactionFormData) => {
		setIsLoading(true);

		// Simulate API call
		await new Promise((resolve) => setTimeout(resolve, 1000));

		setTransactions((prev) =>
			prev.map((t) =>
				t.id === id
					? ({
							...t,
							transactionType: data.transactionType,
							quantity: data.quantity || 0,
							unitPriceAmount: data.pricePerUnit || 0,
							executedAt: data.transactionDate.toISOString(),
							notes: data.notes || null,
						} as Transaction)
					: t,
			),
		);
		setIsLoading(false);
	};

	const handleDeleteTransaction = async (id: string) => {
		setIsLoading(true);

		// Simulate API call
		await new Promise((resolve) => setTimeout(resolve, 500));

		setTransactions((prev) => prev.filter((t) => t.id !== id));
		setIsLoading(false);
	};

	const handleBulkImport = async (_data: BulkTransactionData) => {
		setIsLoading(true);

		// Simulate bulk import
		await new Promise((resolve) => setTimeout(resolve, 2000));
		setIsLoading(false);
	};

	const handleExportTransactions = async (_filters: TransactionFilterData) => {
		// Simulate export
		const csvContent = [
			"Date,Type,Asset,Quantity,Price,Amount,Notes",
			...transactions.map(
				(t) =>
					`${t.executedAt},${t.transactionType},${t.asset.name},${t.quantity},${t.unitPriceAmount},${t.quantity * (t.unitPriceAmount ?? 0)},"${t.notes || ""}"`,
			),
		].join("\n");

		const blob = new Blob([csvContent], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `transactions_${mockPortfolio.name.replace(/\s+/g, "_")}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	};

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Calculator className="h-5 w-5" />
						Transaction Management Integration Example
						<Badge variant="outline" className="ml-auto">
							Demo Mode
						</Badge>
					</CardTitle>
				</CardHeader>
				<CardContent>
					<Alert className="mb-6">
						<Info className="h-4 w-4" />
						<AlertDescription>
							This is a demonstration of the transaction management interface integrated with the
							dashboard. In the real application, this would connect to GraphQL resolvers for data
							persistence.
						</AlertDescription>
					</Alert>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
						<Card>
							<CardContent className="p-4 text-center">
								<div className="text-2xl font-bold text-green-600">{transactions.length}</div>
								<div className="text-sm text-muted-foreground">Total Transactions</div>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="p-4 text-center">
								<div className="text-2xl font-bold text-blue-600">{mockPositions.length}</div>
								<div className="text-sm text-muted-foreground">Active Positions</div>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="p-4 text-center">
								<div className="text-2xl font-bold text-purple-600">
									$
									{mockPositions
										.reduce((sum, p) => sum + p.quantity * (p.asset.currentValue || 0), 0)
										.toLocaleString()}
								</div>
								<div className="text-sm text-muted-foreground">Portfolio Value</div>
							</CardContent>
						</Card>
					</div>

					<TransactionManagement
						portfolio={mockPortfolio}
						assets={mockAssets}
						transactions={transactions}
						positions={mockPositions}
						onAddTransaction={handleAddTransaction}
						onEditTransaction={handleEditTransaction}
						onDeleteTransaction={handleDeleteTransaction}
						onBulkImport={handleBulkImport}
						onExportTransactions={handleExportTransactions}
						isLoading={isLoading}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<TrendingUp className="h-5 w-5" />
						Implementation Status
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						<div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
							<span className="font-medium">Transaction Forms</span>
							<Badge variant="default" className="bg-green-100 text-green-800">
								Complete
							</Badge>
						</div>
						<div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
							<span className="font-medium">Transaction History</span>
							<Badge variant="default" className="bg-green-100 text-green-800">
								Complete
							</Badge>
						</div>
						<div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
							<span className="font-medium">Cost Basis Tracking</span>
							<Badge variant="default" className="bg-green-100 text-green-800">
								Complete
							</Badge>
						</div>
						<div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
							<span className="font-medium">Bulk Import</span>
							<Badge variant="default" className="bg-green-100 text-green-800">
								Complete
							</Badge>
						</div>
						<div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
							<span className="font-medium">Quick Add Components</span>
							<Badge variant="default" className="bg-green-100 text-green-800">
								Complete
							</Badge>
						</div>
						<div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
							<span className="font-medium">Validation & Error Handling</span>
							<Badge variant="default" className="bg-green-100 text-green-800">
								Complete
							</Badge>
						</div>
						<div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
							<span className="font-medium">GraphQL Integration</span>
							<Badge variant="outline" className="bg-yellow-100 text-yellow-800">
								Pending Task 9
							</Badge>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
