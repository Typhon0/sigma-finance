import { useNavigate } from "@tanstack/react-router";
import {
	BarChart3,
	FileText,
	FolderPlus,
	Settings,
	TrendingUp,
	Wallet,
} from "lucide-react";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { withErrorBoundary } from "@/components/ui/error-boundary";

interface QuickActionsProps {
	onAddTransaction?: () => void;
	onAddAsset?: () => void;
	onCreatePortfolio?: () => void;
	onViewPortfolios?: () => void;
	onViewAnalytics?: () => void;
	onManagePortfolios?: () => void;
	isLoading?: boolean;
}

export function QuickActions({
	onAddTransaction,
	onAddAsset,
	onCreatePortfolio,
	onViewPortfolios,
	onViewAnalytics,
	onManagePortfolios,
	isLoading = false,
}: QuickActionsProps) {
	const navigate = useNavigate();

	const handleAddTransaction = useCallback(() => {
		if (onAddTransaction) {
			onAddTransaction();
		} else {
			// For now, just show an alert instead of opening a modal
			alert("Add Transaction functionality will be implemented soon!");
		}
	}, [onAddTransaction]);

	const handleAddAsset = useCallback(() => {
		if (onAddAsset) {
			onAddAsset();
		} else {
			// For now, just show an alert instead of opening a modal
			alert("Add Asset functionality will be implemented soon!");
		}
	}, [onAddAsset]);

	const handleCreatePortfolio = useCallback(() => {
		if (onCreatePortfolio) {
			onCreatePortfolio();
		} else {
			navigate({ to: "/portfolios/create" });
		}
	}, [onCreatePortfolio, navigate]);

	const handleViewPortfolios = useCallback(() => {
		if (onViewPortfolios) {
			onViewPortfolios();
		} else {
			navigate({ to: "/portfolios" });
		}
	}, [onViewPortfolios, navigate]);

	const handleViewAnalytics = useCallback(() => {
		if (onViewAnalytics) {
			onViewAnalytics();
		} else {
			navigate({ to: "/dashboard", search: { view: "analytics" } });
		}
	}, [onViewAnalytics, navigate]);

	const handleManagePortfolios = useCallback(() => {
		if (onManagePortfolios) {
			onManagePortfolios();
		} else {
			navigate({ to: "/portfolios" });
		}
	}, [onManagePortfolios, navigate]);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Quick Actions</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
					{/* Create Portfolio Button */}
					<Button
						onClick={handleCreatePortfolio}
						disabled={isLoading}
						className="h-auto p-4 flex flex-col items-center gap-2 text-center"
						size="lg"
					>
						<FolderPlus className="h-6 w-6" />
						<div className="flex flex-col">
							<span className="font-semibold">Create Portfolio</span>
							<span className="text-xs opacity-90">
								Start organizing assets
							</span>
						</div>
					</Button>

					{/* View All Portfolios Button */}
					<Button
						onClick={handleViewPortfolios}
						disabled={isLoading}
						variant="outline"
						className="h-auto p-4 flex flex-col items-center gap-2 text-center"
						size="lg"
					>
						<Wallet className="h-6 w-6" />
						<div className="flex flex-col">
							<span className="font-semibold">View Portfolios</span>
							<span className="text-xs opacity-70">Manage all portfolios</span>
						</div>
					</Button>

					{/* Portfolio Analytics Button */}
					<Button
						onClick={handleViewAnalytics}
						disabled={isLoading}
						variant="outline"
						className="h-auto p-4 flex flex-col items-center gap-2 text-center"
						size="lg"
					>
						<BarChart3 className="h-6 w-6" />
						<div className="flex flex-col">
							<span className="font-semibold">Analytics</span>
							<span className="text-xs opacity-70">View performance</span>
						</div>
					</Button>

					{/* Add Transaction Button */}
					<Button
						onClick={handleAddTransaction}
						disabled={isLoading}
						variant="outline"
						className="h-auto p-4 flex flex-col items-center gap-2 text-center"
						size="lg"
					>
						<TrendingUp className="h-6 w-6" />
						<div className="flex flex-col">
							<span className="font-semibold">Add Transaction</span>
							<span className="text-xs opacity-70">Record activity</span>
						</div>
					</Button>

					{/* Add Asset Button */}
					<Button
						onClick={handleAddAsset}
						disabled={isLoading}
						variant="outline"
						className="h-auto p-4 flex flex-col items-center gap-2 text-center"
						size="lg"
					>
						<Settings className="h-6 w-6" />
						<div className="flex flex-col">
							<span className="font-semibold">Add Asset</span>
							<span className="text-xs opacity-70">Track investments</span>
						</div>
					</Button>

					{/* Manage Portfolios Button */}
					<Button
						onClick={handleManagePortfolios}
						disabled={isLoading}
						variant="outline"
						className="h-auto p-4 flex flex-col items-center gap-2 text-center"
						size="lg"
					>
						<FileText className="h-6 w-6" />
						<div className="flex flex-col">
							<span className="font-semibold">Manage</span>
							<span className="text-xs opacity-70">Edit & organize</span>
						</div>
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

export default withErrorBoundary(QuickActions);
