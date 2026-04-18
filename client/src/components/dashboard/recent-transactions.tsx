import { formatDistanceToNow } from "date-fns";
import { ArrowDownLeft, ArrowUpRight, Clock, ExternalLink } from "lucide-react";
import {
	TransactionListSkeleton,
	useComponentErrorHandler,
} from "@/components/dashboard/error-handling";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { withErrorBoundary } from "@/components/ui/error-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import type { Transaction } from "@/gql/graphql";
import { formatCurrency } from "@/lib/utils/portfolio-calculations";

interface RecentTransactionsProps {
	transactions: Transaction[];
	isLoading?: boolean;
	onTransactionClick?: (transactionId: string) => void;
	onViewAllTransactions?: () => void;
}

/**
 * Recent Transactions Component
 *
 * Displays the 5 most recent transactions with transaction details including
 * transaction type, asset name, amount, and timestamp. Implements color-coded
 * transaction amounts and navigation functionality.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */
export function RecentTransactions({
	transactions,
	isLoading = false,
	onTransactionClick,
	onViewAllTransactions,
}: RecentTransactionsProps) {
	const { handleErrorWithRetry } = useComponentErrorHandler(
		"RecentTransactions",
		"component",
	);
	/**
	 * Format relative timestamp
	 * Requirements: 4.2 - Show timestamp
	 */
	const formatRelativeTime = (dateString: string) => {
		try {
			const date = new Date(dateString);
			return formatDistanceToNow(date, { addSuffix: true });
		} catch {
			return "Unknown time";
		}
	};

	// Loading state
	if (isLoading) {
		return (
			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
					<CardTitle className="text-lg font-semibold">
						Recent Transactions
					</CardTitle>
					<Skeleton className="h-9 w-32" />
				</CardHeader>
				<CardContent>
					<TransactionListSkeleton count={5} />
				</CardContent>
			</Card>
		);
	}

	// Empty state
	if (!transactions || transactions.length === 0) {
		return (
			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
					<CardTitle className="text-lg font-semibold">
						Recent Transactions
					</CardTitle>
					<Button
						variant="outline"
						size="sm"
						onClick={onViewAllTransactions}
						className="gap-2"
					>
						View All
						<ExternalLink className="h-4 w-4" />
					</Button>
				</CardHeader>
				<CardContent>
					<div className="text-center py-8">
						<Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
						<h3 className="text-lg font-medium text-muted-foreground mb-2">
							No Recent Transactions
						</h3>
						<p className="text-sm text-muted-foreground">
							Your transaction history will appear here once you start trading.
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
				<CardTitle className="text-lg font-semibold">
					Recent Transactions
				</CardTitle>
				{/* Requirements: 4.6 - "View All Transactions" navigation link */}
				<Button
					variant="outline"
					size="sm"
					onClick={onViewAllTransactions}
					className="gap-2"
				>
					View All
					<ExternalLink className="h-4 w-4" />
				</Button>
			</CardHeader>
			<CardContent className="space-y-3">
				{/* Requirements: 4.1 - Display 5 most recent transactions */}
				{transactions.slice(0, 5).map((transaction) => {
					const typeInfo = getTransactionTypeInfo(transaction.transactionType);
					const amountInfo = calculateTransactionAmount(transaction);
					const TypeIcon = typeInfo.icon;

					return (
						<button
							type="button"
							key={transaction.id}
							className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer text-left"
							onClick={async () => {
								if (onTransactionClick) {
									await handleErrorWithRetry(async () => {
										onTransactionClick(transaction.id);
									});
								}
							}}
						>
							<div className="flex items-center gap-3">
								{/* Transaction type icon and badge */}
								<div className={`p-2 rounded-lg ${typeInfo.bgClass}`}>
									<TypeIcon className="h-4 w-4" />
								</div>

								<div className="space-y-1">
									{/* Requirements: 4.2 - Show transaction type and asset name */}
									<div className="flex items-center gap-2">
										<Badge variant="secondary" className="text-xs">
											{typeInfo.label}
										</Badge>
										<span className="font-medium text-sm">
											{transaction.asset.name}
										</span>
										{transaction.asset.symbol && (
											<span className="text-xs text-muted-foreground">
												({transaction.asset.symbol})
											</span>
										)}
									</div>

									{/* Portfolio and quantity information */}
									<div className="text-xs text-muted-foreground">
										{transaction.portfolio.name} • {transaction.quantity} units
										@ {formatCurrency(transaction.pricePerUnit)}
									</div>
								</div>
							</div>

							<div className="text-right space-y-1">
								{/* Requirements: 4.3, 4.4 - Color-coded transaction amounts */}
								<div className={`font-semibold ${amountInfo.colorClass}`}>
									{amountInfo.displayAmount >= 0 ? "+" : ""}
									{formatCurrency(amountInfo.displayAmount)}
								</div>

								{/* Requirements: 4.2 - Show timestamp */}
								<div className="text-xs text-muted-foreground">
									{formatRelativeTime(transaction.transactionDate)}
								</div>
							</div>
						</button>
					);
				})}
			</CardContent>
		</Card>
	);
}

/**
 * Get transaction type display information
 * Shared utility function for both components
 */
const getTransactionTypeInfo = (transactionType: string) => {
	const type = transactionType.toUpperCase();

	switch (type) {
		case "BUY":
		case "PURCHASE":
			return {
				label: "Buy",
				icon: ArrowDownLeft,
				colorClass: "text-red-600", // Money going out
				bgClass: "bg-red-50 text-red-700",
				isPositive: false,
			};
		case "SELL":
			return {
				label: "Sell",
				icon: ArrowUpRight,
				colorClass: "text-green-600", // Money coming in
				bgClass: "bg-green-50 text-green-700",
				isPositive: true,
			};
		case "DEPOSIT":
			return {
				label: "Deposit",
				icon: ArrowUpRight,
				colorClass: "text-green-600",
				bgClass: "bg-green-50 text-green-700",
				isPositive: true,
			};
		case "WITHDRAWAL":
			return {
				label: "Withdrawal",
				icon: ArrowDownLeft,
				colorClass: "text-red-600",
				bgClass: "bg-red-50 text-red-700",
				isPositive: false,
			};
		default:
			return {
				label: type,
				icon: Clock,
				colorClass: "text-gray-600",
				bgClass: "bg-gray-50 text-gray-700",
				isPositive: false,
			};
	}
};

/**
 * Calculate transaction amount
 * Shared utility function for both components
 */
const calculateTransactionAmount = (transaction: Transaction) => {
	const amount = transaction.quantity * transaction.pricePerUnit;
	const typeInfo = getTransactionTypeInfo(transaction.transactionType);

	return {
		amount,
		displayAmount: typeInfo.isPositive ? amount : -amount,
		colorClass: typeInfo.colorClass,
	};
};

/**
 * Compact Recent Transactions Component
 *
 * A more compact version for use in smaller spaces or grid layouts
 */
export function CompactRecentTransactions({
	transactions,
	isLoading = false,
	onViewAllTransactions,
}: Omit<RecentTransactionsProps, "onTransactionClick">) {
	if (isLoading) {
		return (
			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-sm font-medium">
						Recent Transactions
					</CardTitle>
					<Skeleton className="h-4 w-4" />
				</CardHeader>
				<CardContent>
					<div className="space-y-2">
						{Array.from({ length: 3 }).map((_, index) => (
							<div
								key={`compact-recent-transaction-skeleton-${index}`}
								className="flex items-center justify-between"
							>
								<Skeleton className="h-4 w-24" />
								<Skeleton className="h-4 w-16" />
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		);
	}

	if (!transactions || transactions.length === 0) {
		return (
			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-sm font-medium">
						Recent Transactions
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">
						No recent transactions
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="text-sm font-medium">
					Recent Transactions
				</CardTitle>
				<Button
					variant="ghost"
					size="sm"
					onClick={onViewAllTransactions}
					className="h-auto p-0 text-xs"
				>
					View All
				</Button>
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					{transactions.slice(0, 3).map((transaction) => {
						const typeInfo = getTransactionTypeInfo(
							transaction.transactionType,
						);
						const amountInfo = calculateTransactionAmount(transaction);

						return (
							<div
								key={transaction.id}
								className="flex items-center justify-between text-sm"
							>
								<div className="flex items-center gap-2">
									<Badge variant="outline" className="text-xs px-1 py-0">
										{typeInfo.label}
									</Badge>
									<span className="truncate max-w-24">
										{transaction.asset.name}
									</span>
								</div>
								<span className={`font-medium ${amountInfo.colorClass}`}>
									{amountInfo.displayAmount >= 0 ? "+" : ""}
									{formatCurrency(amountInfo.displayAmount)}
								</span>
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}

export default withErrorBoundary(RecentTransactions);

/**
 * Recent Transactions Skeleton Component
 *
 * Displays a skeleton placeholder for the Recent Transactions component
 * during data loading states. Contains static skeletons for transaction
 * items and adapts to light and dark themes.
 */
export function RecentTransactionsSkeleton() {
	const skeletonItems = Array.from({ length: 5 }, (_, index) => ({
		id: `recent-transaction-skeleton-${index}`,
	}));
	return (
		<Card>
			<CardHeader>
				<Skeleton className="h-6 w-48" />
			</CardHeader>
			<CardContent className="space-y-4">
				{skeletonItems.map((item) => (
					<div
						key={item.id}
						className="flex items-center justify-between p-3 rounded-lg border"
					>
						<div className="flex items-center gap-3">
							<Skeleton className="h-8 w-8 rounded-full" />
							<div className="space-y-1">
								<Skeleton className="h-4 w-28" />
								<Skeleton className="h-3 w-20" />
							</div>
						</div>
						<div className="text-right">
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-3 w-16 mt-1" />
						</div>
					</div>
				))}
			</CardContent>
		</Card>
	);
}

/**
 * Compact Recent Transactions Skeleton Component
 *
 * A more compact skeleton version for use in smaller spaces or grid layouts
 */
function CompactRecentTransactionsSkeleton() {
	const skeletonItems = Array.from({ length: 3 }, (_, index) => ({
		id: `compact-recent-transaction-skeleton-${index}`,
	}));
	return (
		<Card>
			<CardHeader>
				<Skeleton className="h-6 w-48" />
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					{skeletonItems.map((item) => (
						<div key={item.id} className="flex items-center justify-between">
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-4 w-16" />
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

export { CompactRecentTransactionsSkeleton };

/**
 * Full View Skeleton Component
 *
 * A skeleton component for the full view of recent transactions,
 * matching the layout and design of the RecentTransactions component.
 */
export function FullViewSkeleton() {
	const skeletonItems = Array.from({ length: 5 }, (_, index) => ({
		id: `recent-transaction-skeleton-${index}`,
	}));
	return (
		<Card>
			<CardHeader>
				<Skeleton className="h-6 w-48" />
			</CardHeader>
			<CardContent className="space-y-4">
				{skeletonItems.map((item) => (
					<div
						key={item.id}
						className="flex items-center justify-between p-3 rounded-lg border"
					>
						<div className="flex items-center gap-3">
							<Skeleton className="h-8 w-8 rounded-full" />
							<div className="space-y-1">
								<Skeleton className="h-4 w-28" />
								<Skeleton className="h-3 w-20" />
							</div>
						</div>
						<div className="text-right">
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-3 w-16 mt-1" />
						</div>
					</div>
				))}
			</CardContent>
		</Card>
	);
}

/**
 * Compact View Skeleton Component
 *
 * A more compact skeleton component for the recent transactions view,
 * suitable for smaller spaces or grid layouts.
 */
export function CompactViewSkeleton() {
	const skeletonItems = Array.from({ length: 3 }, (_, index) => ({
		id: `compact-recent-transaction-skeleton-${index}`,
	}));
	return (
		<Card>
			<CardHeader>
				<Skeleton className="h-6 w-48" />
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					{skeletonItems.map((item) => (
						<div key={item.id} className="flex items-center justify-between">
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-4 w-16" />
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
