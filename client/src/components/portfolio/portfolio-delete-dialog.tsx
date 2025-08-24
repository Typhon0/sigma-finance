import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type {
	Portfolio,
	PortfolioAsset,
} from "@/hooks/use-portfolio-management";
import { formatCurrency } from "@/lib/utils/portfolio-calculations";

interface PortfolioDeleteDialogProps {
	portfolio: Portfolio | null;
	isOpen: boolean;
	onClose: () => void;
	onConfirm: (portfolioId: string) => Promise<void>;
	isDeleting?: boolean;
	trigger?: React.ReactNode;
}

export function PortfolioDeleteDialog({
	portfolio,
	isOpen,
	onClose,
	onConfirm,
	isDeleting = false,
	trigger,
}: PortfolioDeleteDialogProps) {
	const [confirmationText, setConfirmationText] = useState("");
	const [hasAssetsConfirmed, setHasAssetsConfirmed] = useState(false);

	if (!portfolio) return null;

	const hasAssets = portfolio.assets && portfolio.assets.length > 0;
	const totalValue = hasAssets
		? portfolio.assets.reduce(
				(sum, asset) => sum + asset.asset.currentValue * asset.quantity,
				0,
			)
		: 0;
	const assetCount = portfolio.assets?.length || 0;

	const isConfirmationValid =
		confirmationText === portfolio.name && (!hasAssets || hasAssetsConfirmed);

	const handleConfirm = async () => {
		if (!isConfirmationValid || !portfolio) return;

		try {
			await onConfirm(portfolio.id);
			setConfirmationText("");
			setHasAssetsConfirmed(false);
			onClose();
		} catch (error) {
			console.error("Error deleting portfolio:", error);
		}
	};

	const handleClose = () => {
		setConfirmationText("");
		setHasAssetsConfirmed(false);
		onClose();
	};

	return (
		<ActionDialog
			open={isOpen}
			onOpenChange={handleClose}
			trigger={trigger}
			title={
				<div className="flex items-center gap-2 text-destructive">
					<AlertTriangle className="h-5 w-5" />
					Delete Portfolio
				</div>
			}
			description={
				<>
					This action cannot be undone. This will permanently delete the
					portfolio
					<span className="font-semibold"> "{portfolio.name}"</span>
					{hasAssets && " and all its associated assets and transactions"}.
				</>
			}
			actionText={
				isDeleting ? (
					<>
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						Deleting...
					</>
				) : (
					<>
						<Trash2 className="mr-2 h-4 w-4" />
						Delete Portfolio
					</>
				)
			}
			onAction={handleConfirm}
			isActionDisabled={!isConfirmationValid || isDeleting}
			actionButtonVariant="destructive"
		>
			<div className="space-y-4">
				{hasAssets && (
					<Card className="border-destructive/20 bg-destructive/5">
						<CardContent className="pt-4">
							<div className="space-y-2">
								<div className="flex items-center justify-between text-sm">
									<span className="text-muted-foreground">
										Assets to be deleted:
									</span>
									<Badge variant="destructive">{assetCount} assets</Badge>
								</div>
								<div className="flex items-center justify-between text-sm">
									<span className="text-muted-foreground">
										Total portfolio value:
									</span>
									<span className="font-semibold">
										{formatCurrency(totalValue)}
									</span>
								</div>
							</div>

							<div className="mt-3 space-y-1">
								<p className="text-xs font-medium text-muted-foreground">
									Affected assets:
								</p>
								{portfolio.assets.slice(0, 3).map((asset: PortfolioAsset) => (
									<div
										key={asset.id}
										className="flex items-center justify-between text-xs"
									>
										<span className="truncate">
											{asset.asset.name} (
											{asset.asset.symbol || asset.asset.assetType.name})
										</span>
										<span>{asset.quantity} shares</span>
									</div>
								))}
								{assetCount > 3 && (
									<p className="text-xs text-muted-foreground">
										...and {assetCount - 3} more assets
									</p>
								)}
							</div>
						</CardContent>
					</Card>
				)}

				<div className="space-y-2">
					<label htmlFor="confirmation" className="text-sm font-medium">
						Type <span className="font-bold">"{portfolio.name}"</span> to
						confirm deletion:
					</label>
					<Input
						id="confirmation"
						value={confirmationText}
						onChange={(e) => setConfirmationText(e.target.value)}
						placeholder={portfolio.name}
						disabled={isDeleting}
						className={
							confirmationText === portfolio.name ? "border-green-500" : ""
						}
					/>
				</div>

				{hasAssets && (
					<div className="flex items-start space-x-2">
						<Checkbox
							id="assets-confirmation"
							checked={hasAssetsConfirmed}
							onCheckedChange={(checked) =>
								setHasAssetsConfirmed(checked as boolean)
							}
							disabled={isDeleting}
						/>
						<label
							htmlFor="assets-confirmation"
							className="text-sm leading-5 cursor-pointer"
						>
							I understand that this will permanently delete all {assetCount}{" "}
							assets and their transaction history from this portfolio.
						</label>
					</div>
				)}
			</div>
		</ActionDialog>
	);
}
