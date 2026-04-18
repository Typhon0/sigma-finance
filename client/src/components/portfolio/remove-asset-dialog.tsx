import { Loader2, Minus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { PortfolioAsset } from "@/gql/graphql";
import { useAssetManagement } from "@/hooks/use-asset-management";

interface RemoveAssetDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	portfolioID: string;
	portfolioName: string;
	asset: PortfolioAsset | null;
	onSuccess?: () => void;
}

export function RemoveAssetDialog({
	open,
	onOpenChange,
	portfolioID,
	portfolioName,
	asset,
	onSuccess,
}: RemoveAssetDialogProps) {
	const { removeAssetFromPortfolio } = useAssetManagement();
	const [isRemoving, setIsRemoving] = useState(false);

	const handleClose = () => {
		if (!isRemoving) {
			onOpenChange(false);
		}
	};

	const handleRemoveAsset = async () => {
		if (!asset) return;

		setIsRemoving(true);
		try {
			await removeAssetFromPortfolio(portfolioID, asset.asset.id);
			toast.success(
				`${asset.asset.symbol || asset.asset.name} removed from ${portfolioName}`,
			);
			onSuccess?.();
			onOpenChange(false);
		} catch {
			toast.error("Failed to remove asset from portfolio. Please try again.");
		} finally {
			setIsRemoving(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Remove Asset from {portfolioName}</DialogTitle>
					<DialogDescription>
						{asset
							? `Remove ${asset.asset.name} from your portfolio. This action cannot be undone.`
							: "Remove asset from your portfolio. This action cannot be undone."}
					</DialogDescription>
				</DialogHeader>

				{asset && (
					<div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
						<Minus className="h-5 w-5 text-muted-foreground" />
						<div className="min-w-0 flex-1">
							<p className="font-medium text-sm truncate">{asset.asset.name}</p>
							<p className="text-xs text-muted-foreground">
								{asset.asset.symbol && `${asset.asset.symbol} · `}
								{asset.quantity} shares · {asset.asset.assetType.name}
							</p>
						</div>
					</div>
				)}

				<DialogFooter>
					<Button onClick={handleClose} variant="outline" disabled={isRemoving}>
						Cancel
					</Button>
					<Button
						onClick={handleRemoveAsset}
						variant="destructive"
						disabled={isRemoving || !asset}
					>
						{isRemoving ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Removing...
							</>
						) : (
							<>
								<Minus className="mr-2 h-4 w-4" />
								Remove Asset
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
