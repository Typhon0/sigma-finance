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
import type { PortfolioAsset } from "@/gql/graphql";

interface RemoveAssetDialogProps {
	asset: PortfolioAsset | null;
	isOpen: boolean;
	onClose: () => void;
	onConfirm: () => void;
	isRemoving: boolean;
}

export function RemoveAssetDialog({
	asset,
	isOpen,
	onClose,
	onConfirm,
	isRemoving,
}: RemoveAssetDialogProps) {
	if (!asset) {
		return null;
	}

	return (
		<AlertDialog open={isOpen} onOpenChange={onClose}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Remove Asset</AlertDialogTitle>
					<AlertDialogDescription>
						Are you sure you want to remove{" "}
						<span className="font-semibold">{asset.asset.name}</span> from this
						portfolio? This action cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
					<AlertDialogAction onClick={onConfirm} disabled={isRemoving}>
						{isRemoving ? "Removing..." : "Remove"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
