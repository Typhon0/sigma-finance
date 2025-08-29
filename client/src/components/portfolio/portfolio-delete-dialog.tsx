import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Portfolio } from "@/gql/graphql";

interface PortfolioDeleteDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	portfolio: Portfolio | null;
	onConfirm: () => void;
	isDeleting?: boolean;
}

export function PortfolioDeleteDialog({
	open,
	onOpenChange,
	portfolio,
	onConfirm,
	isDeleting = false,
}: PortfolioDeleteDialogProps) {
	if (!portfolio) return null;

	const assetCount = portfolio.assets?.length || 0;
	const hasAssets = assetCount > 0;
	const transactionCount = portfolio.transactions?.length || 0;
	const hasTransactions = transactionCount > 0;

	// Calculate total value for display
	const totalValue = portfolio.analytics?.totalValue || 0;
	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
		}).format(amount);
	};

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent className="max-w-md">
				<AlertDialogHeader>
					<AlertDialogTitle className="flex items-center gap-2 text-destructive">
						<AlertTriangle className="h-5 w-5" />
						Delete Portfolio
					</AlertDialogTitle>
					<AlertDialogDescription asChild>
						<div className="space-y-4">
							<p>
								Are you sure you want to delete{" "}
								<span className="font-semibold">"{portfolio.name}"</span>?
							</p>

							{hasAssets && (
								<div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
									<div className="flex items-center gap-2 text-sm font-medium text-destructive mb-2">
										<AlertTriangle className="h-4 w-4" />
										Warning: This portfolio contains data
									</div>
									<div className="space-y-2 text-sm">
										<div className="flex justify-between">
											<span>Asset positions:</span>
											<span className="font-medium">{assetCount}</span>
										</div>
										{hasTransactions && (
											<div className="flex justify-between">
												<span>Transaction records:</span>
												<span className="font-medium">{transactionCount}</span>
											</div>
										)}
										{totalValue > 0 && (
											<div className="flex justify-between">
												<span>Portfolio value:</span>
												<span className="font-medium">
													{formatCurrency(totalValue)}
												</span>
											</div>
										)}
									</div>
								</div>
							)}

							<div className="rounded-lg border border-muted bg-muted/30 p-3">
								<div className="text-sm font-medium mb-2">
									The following will be permanently deleted:
								</div>
								<ul className="text-sm space-y-1 text-muted-foreground">
									<li>• Portfolio "{portfolio.name}"</li>
									{hasAssets && (
										<li>
											• All {assetCount} asset position
											{assetCount === 1 ? "" : "s"}
										</li>
									)}
									{hasTransactions && (
										<li>
											• All {transactionCount} transaction record
											{transactionCount === 1 ? "" : "s"}
										</li>
									)}
									<li>• Performance analytics and historical data</li>
									<li>• Any associated tags and metadata</li>
								</ul>
							</div>

							<p className="text-sm font-medium text-destructive">
								This action cannot be undone.
							</p>
						</div>
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={onConfirm}
						disabled={isDeleting}
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
					>
						{isDeleting ? "Deleting..." : "Delete Portfolio"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
