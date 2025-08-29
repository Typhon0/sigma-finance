import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
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

	const title = "Delete Portfolio";

	let description = hasAssets
		? `Are you sure you want to delete "${portfolio.name}"? This portfolio contains ${assetCount} asset${assetCount === 1 ? "" : "s"} and all associated data will be permanently removed. This action cannot be undone.`
		: `Are you sure you want to delete "${portfolio.name}"? This action cannot be undone.`;

	if (hasAssets) {
		description += `\n\nWarning: Deleting this portfolio will also remove:\n• ${assetCount} asset position${assetCount === 1 ? "" : "s"}\n• All transaction history\n• Performance analytics data`;
	}

	return (
		<ConfirmationDialog
			open={open}
			onOpenChange={onOpenChange}
			title={title}
			description={description}
			confirmText={isDeleting ? "Deleting..." : "Delete Portfolio"}
			cancelText="Cancel"
			onConfirm={onConfirm}
			variant="destructive"
		/>
	);
}
